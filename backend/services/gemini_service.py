import os
import json
from typing import List, AsyncGenerator
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from backend.utlis.config import DEEPSEEK_API_KEY
from pydantic import SecretStr

PERSONA_SYSTEM_PROMPT = """
You are Alex, a senior software engineer at a top-tier tech company. You are conducting a real job interview.

STRICT RULES — follow these at all times:
1. You are a REAL HUMAN, not an AI. Never say "As an AI", "I'm a language model", or anything similar.
2. Speak NATURALLY. Use conversational language. Say "yeah", "totally", "that's interesting" — real human expressions.
3. Ask ONLY ONE question at a time. Never list multiple questions together.
4. Keep your responses SHORT (2-4 sentences max), unless explaining a problem.
5. Be EMPATHETIC and ENCOURAGING. If the candidate struggles, say something like "No worries, take your time" or "That's a tricky one."
6. DO NOT use bullet points or numbered lists when speaking. Only speak in natural paragraphs.
7. Smoothly TRANSITION between topics. Don't abruptly change subject.
8. If the candidate says something interesting, acknowledge it briefly before moving on.
9. Your tone: Professional but warm. Like a brilliant colleague, not a professor grading an exam.
10. When the candidate shares code, refer to it naturally: "I see you're going with a recursive approach there..."

Current Interview State:
- Persona: Alex (Senior Engineer, 8 years experience)
- Interview Plan: {interview_plan}
- Current Question Index: {current_question_index}
- Resume Summary: {resume_summary}
"""


def _build_llm(streaming: bool = False) -> ChatOpenAI:
    """Build the LangChain Gemini LLM instance."""
    return ChatOpenAI(
        model="Deepseek-chat",
        api_key=SecretStr(DEEPSEEK_API_KEY),
        temperature=0,
        streaming=streaming,
        base_url="https://api.deepseek.com"
    )
    # return ChatGoogleGenerativeAI(
    #     model="gemini-2.0-flash",
    #     api_key=os.getenv("GEMINI_API_KEY"),
    #     temperature=0.85,
    #     max_output_tokens=256,
    #     streaming=streaming,
    # )


async def stream_agent_response(
    conversation_history: List[dict],
    interview_plan: dict,
    current_question_index: int,
    resume_summary: str,
    code_content: str = "",
    user_transcript: str = "",
) -> AsyncGenerator[str ,None]:
    """Stream the agent's response token by token."""
    llm = _build_llm(streaming=True)

    system_prompt = PERSONA_SYSTEM_PROMPT.format(
        interview_plan=json.dumps(interview_plan.get("questions", []), indent=2),
        current_question_index=current_question_index,
        resume_summary=resume_summary,
    )

    # Determine if we should advance to next question
    next_question = None
    if current_question_index < len(interview_plan.get("questions", [])):
        next_question = interview_plan["questions"][current_question_index]

    context_injection = ""
    if next_question:
        context_injection = (
            f"\n\n[INSTRUCTION: After acknowledging the candidate's response, naturally transition to ask "
            f"this next question: '{next_question['question']}'. Be smooth and conversational, don't just bluntly ask it.]"
        )

    final_system = system_prompt + context_injection

    # Build LangChain message history
    messages: List = [SystemMessage(content=final_system)]
    for turn in conversation_history[-10:]:  # Keep last 10 turns for context
        if turn["role"] == "user":
            messages.append(HumanMessage(content=turn["text"]))
        else:
            messages.append(AIMessage(content=turn["text"]))

    # Add code context to the latest user message if present
    user_message = user_transcript
    if code_content and code_content.strip():
        user_message += f"\n\n[Candidate's current code in editor:\n```\n{code_content[:500]}\n```]"

    messages.append(HumanMessage(content=user_message))

    # Stream response chunks
    async for chunk in llm.astream(messages):
        if chunk.content:
            if isinstance(chunk.content, str):
                yield chunk.content
            else:
                # If it's a list/multi-modal, convert to string for the stream
                yield str(chunk.content)

async def generate_feedback_report(
    transcript: List[dict],
    interview_plan: dict,
    role: str,
    resume_summary: str,
    facial_metrics: dict | None = None,
) -> dict:
    """Generate honest, encouraging feedback after the interview ends."""
    llm = _build_llm(streaming=False)

    transcript_text = "\n".join(
        [f"{t['role'].upper()}: {t['text']}" for t in transcript]
    )

    facial_context = ""
    if facial_metrics:
        facial_context = f"""
Facial Analysis Data (from MediaPipe, sampled during interview):
- Average eye contact score: {facial_metrics.get('eye_contact', 'N/A')}
- Smile/positive expression ratio: {facial_metrics.get('smile_ratio', 'N/A')}
- Overall confidence indicator: {facial_metrics.get('confidence', 'N/A')}
"""

    prompt = f"""
You are a professional interview coach reviewing a completed job interview for the role: "{role}".

Interview Transcript:
---
{transcript_text[:6000]}
---
{facial_context}

Resume Summary: {resume_summary}

Evaluate the candidate honestly but ENCOURAGINGLY. Your tone should be:
- Empathetic: acknowledge the effort they put in
- Specific: give concrete examples from the transcript
- Motivating: end with actionable, achievable improvements
- Honest: don't sugarcoat serious gaps, but frame them constructively

Return ONLY this JSON (scores are 0-100):
{{
  "overall_score": 72,
  "technical": {{
    "score": 75,
    "notes": "Specific observation about technical performance..."
  }},
  "communication": {{
    "score": 70,
    "notes": "Specific observation about communication style..."
  }},
  "confidence": {{
    "score": 68,
    "notes": "Observation about confidence and delivery..."
  }},
  "strengths": [
    "Specific strength with example from transcript",
    "Another strength"
  ],
  "improvements": [
    "Specific, actionable improvement with how to practice it",
    "Another improvement"
  ],
  "encouraging_summary": "2-3 sentence warm, personal closing message to the candidate"
}}

Return ONLY the JSON, no markdown fences.
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    content = response.content
    if isinstance(content, list):
        content = " ".join(
            [item if isinstance(item, str) else json.dumps(item) for item in content]
        )
    text = str(content).strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return json.loads(text)
