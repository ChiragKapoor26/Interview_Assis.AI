import os
import json
from typing import List, AsyncGenerator
from langchain_openai import ChatOpenAI
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
11. CRITICAL: Never respond with just "?" or a single punctuation mark. Always give a meaningful, human response.
12. CRITICAL: If the candidate's answer is vague or short, gently probe deeper with a follow-up. Do NOT jump to the next topic yet.
13. CRITICAL: Only move to the next question when you see [ADVANCE TO NEXT QUESTION] in your instructions.

Current Interview State:
- Persona: Alex (Senior Engineer, 8 years experience)
- Interview Plan: {interview_plan}
- Current Question Index: {current_question_index}
- Resume Summary: {resume_summary}
"""

RESPONSE_EVALUATOR_PROMPT = """
You are evaluating whether a candidate's interview answer is sufficient to move on to the next question.

Question asked: {question}
Candidate's answer: {answer}

Rules:
- If the answer is a complete sentence or more and addresses the question even partially → ADVANCE
- If the answer is very short (under 8 words), vague, or off-topic → FOLLOW_UP
- If the answer is just filler like "um", "uh", "I don't know", "?" → FOLLOW_UP

Respond with ONLY one word: ADVANCE or FOLLOW_UP
"""


def _build_llm(streaming: bool = False) -> ChatOpenAI:
    """Build the LangChain DeepSeek LLM instance."""
    return ChatOpenAI(
        model="deepseek-chat",
        api_key=SecretStr(DEEPSEEK_API_KEY),
        temperature=0.4,
        streaming=streaming,
        base_url="https://api.deepseek.com"
    )


async def _should_advance(
    current_question: dict,
    candidate_answer: str,
) -> bool:
    """Use a fast LLM call to decide whether the candidate's answer warrants advancing."""
    # Short-circuit: if answer is too short, don't even call the LLM
    word_count = len(candidate_answer.strip().split())
    if word_count < 8:
        return False

    llm = _build_llm(streaming=False)
    prompt = RESPONSE_EVALUATOR_PROMPT.format(
        question=current_question.get("question", ""),
        answer=candidate_answer,
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    decision = str(response.content).strip().upper()
    return decision == "ADVANCE"


async def stream_agent_response(
    conversation_history: List[dict],
    interview_plan: dict,
    current_question_index: int,
    resume_summary: str,
    code_content: str = "",
    user_transcript: str = "",
) -> AsyncGenerator[str, None]:
    """Stream the agent's response token by token."""
    llm = _build_llm(streaming=True)

    system_prompt = PERSONA_SYSTEM_PROMPT.format(
        interview_plan=json.dumps(interview_plan.get("questions", []), indent=2),
        current_question_index=current_question_index,
        resume_summary=resume_summary,
    )

    questions = interview_plan.get("questions", [])

    # Determine the current question being discussed (the one just asked)
    # current_question_index points to the NEXT question to ask,
    # so the question the candidate just answered is index - 1
    just_answered_question = None
    if current_question_index > 0 and (current_question_index - 1) < len(questions):
        just_answered_question = questions[current_question_index - 1]

    next_question = None
    if current_question_index < len(questions):
        next_question = questions[current_question_index]

    # Decide whether the candidate's answer is good enough to advance
    should_advance = False
    if just_answered_question and user_transcript.strip():
        should_advance = await _should_advance(just_answered_question, user_transcript)
    elif not just_answered_question:
        # First message — always advance (ask the first question)
        should_advance = True

    # Build the context injection based on the decision
    context_injection = ""
    if should_advance and next_question:
        context_injection = (
            f"\n\n[ADVANCE TO NEXT QUESTION] After briefly acknowledging the candidate's response "
            f"(1 sentence max), naturally transition to ask: '{next_question['question']}'. "
            f"Be smooth and conversational."
        )
    elif not should_advance and just_answered_question:
        context_injection = (
            f"\n\n[FOLLOW UP] The candidate's answer was too brief or unclear. "
            f"Do NOT move to the next question yet. Instead, gently probe deeper on: "
            f"'{just_answered_question['question']}'. "
            f"Ask a natural follow-up like 'Could you walk me through that a bit more?' "
            f"or 'Interesting — what made you choose that approach?'"
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

    # Robust JSON extraction: Find the first '{' and last '}'
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_str = text[start_idx:end_idx + 1]
    else:
        # Fallback if no braces found (rare, but protects against crash)
        json_str = text
        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]

    try:
        return json.loads(json_str.strip())
    except json.JSONDecodeError as e:
        print(f"Failed to parse Gemini feedback JSON: {e}")
        print(f"Raw text was: {text}")
        # Return a safe fallback so the frontend doesn't crash
        return {
            "overall_score": 0,
            "technical": {"score": 0, "notes": "Could not parse AI feedback."},
            "communication": {"score": 0, "notes": ""},
            "confidence": {"score": 0, "notes": ""},
            "strengths": [],
            "improvements": ["The AI generated an invalid report format."],
            "encouraging_summary": "We had trouble generating your report."
        }