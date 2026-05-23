from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.gemini_service import stream_agent_response
from backend.services.tts_service import text_to_speech
from backend.utlis.config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
import os
import json
import base64
from supabase import create_client

router = APIRouter(tags=["websocket"])


def get_supabase():
    url = SUPABASE_URL
    key = SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        return None
    return create_client(url, key)


@router.websocket("/ws/interview/{interview_id}")
async def interview_websocket(websocket: WebSocket, interview_id: str):
    """Main real-time interview WebSocket endpoint."""
    await websocket.accept()

    supabase = get_supabase()
    interview_plan = {}
    resume_summary = ""
    role = "Software Engineer"
    conversation_history = []
    current_question_index = 0

    # Load interview context
    if supabase:
        result = supabase.table("interviews").select("*").eq("id", interview_id).execute()
        if result.data:
            data = result.data[0]
            interview_plan = json.loads(data.get("interview_plan", "{}"))
            resume_summary = data.get("resume_summary", "")
            role = data.get("role", role)
            conversation_history = json.loads(data.get("conversation_history", "[]"))

    # Send opening message
    opening_line = interview_plan.get(
        "opening_line",
        "Hey! Welcome! I'm Alex. Really glad you could make it today. Ready to get started?"
    )
    await websocket.send_json({
        "type": "agent_turn",
        "text": opening_line,
        "question_index": current_question_index,
    })

    audio_bytes = await text_to_speech(opening_line)
    if audio_bytes:
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        await websocket.send_json({"type": "audio", "data": audio_b64})

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)

            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if message.get("type") == "end_interview":
                await websocket.send_json({"type": "interview_complete"})
                break

            if message.get("type") == "user_turn":
                user_transcript = message.get("transcript", "").strip()
                code_content = message.get("code_content", "")

                # Guard: ignore empty transcripts entirely
                if not user_transcript or len(user_transcript.split()) < 2:
                    await websocket.send_json({
                        "type": "agent_turn",
                        "text": "Sorry, I didn't quite catch that — could you say that again?",
                        "question_index": current_question_index,
                    })
                    continue

                conversation_history.append({"role": "user", "text": user_transcript})

                # BUG FIX 1: accumulate all chunks, not just the last one
                agent_text = ""
                async for chunk in stream_agent_response(
                    conversation_history=conversation_history,
                    interview_plan=interview_plan,
                    current_question_index=current_question_index,
                    resume_summary=resume_summary,
                    code_content=code_content,
                    user_transcript=user_transcript,
                ):
                    agent_text += chunk  # += not =

                # Safety net: if model still returns garbage, replace it
                agent_text = agent_text.strip()
                if not agent_text or agent_text in {"?", ".", "...", "!"}:
                    questions = interview_plan.get("questions", [])
                    if current_question_index < len(questions):
                        agent_text = f"That's interesting! So, {questions[current_question_index]['question']}"
                    else:
                        agent_text = "Thanks for sharing that! Could you tell me a bit more?"

                conversation_history.append({"role": "agent", "text": agent_text})

                # BUG FIX 2: only advance the index if the agent actually moved on
                # We detect this by checking if the next question text appears in the response
                questions = interview_plan.get("questions", [])
                advanced = False
                if current_question_index < len(questions):
                    next_q_keywords = questions[current_question_index]["question"].split()[:4]
                    # If at least 2 keywords from the next question appear in the response,
                    # the agent has transitioned — advance the index
                    matches = sum(1 for w in next_q_keywords if w.lower() in agent_text.lower())
                    if matches >= 2:
                        current_question_index += 1
                        advanced = True

                await websocket.send_json({
                    "type": "agent_turn",
                    "text": agent_text,
                    "question_index": current_question_index,
                    "is_complete": current_question_index >= len(questions),
                })

                audio_bytes = await text_to_speech(agent_text)
                if audio_bytes:
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    await websocket.send_json({"type": "audio", "data": audio_b64})

                # Persist every 3 agent turns
                if len(conversation_history) % 6 == 0 and supabase:
                    supabase.table("interviews").update({
                        "conversation_history": json.dumps(conversation_history[-30:])
                    }).eq("id", interview_id).execute()

    except WebSocketDisconnect:
        if supabase and conversation_history:
            supabase.table("interviews").update({
                "conversation_history": json.dumps(conversation_history)
            }).eq("id", interview_id).execute()