import json
import os
from pydantic import SecretStr
from backend.utlis.config import DEEPSEEK_API_KEY
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from backend.models.schemas import ResumeData


def _build_llm() -> ChatOpenAI:
    # return ChatGoogleGenerativeAI(
    #     model="gemini-2.0-flash",
    #     api_key=os.getenv("GEMINI_API_KEY"),
    #     temperature=0.7,
    # )
    return ChatOpenAI(
        model="deepseek-chat",
        base_url="https://api.deepseek.com",
        api_key=SecretStr(DEEPSEEK_API_KEY),
        temperature=0,
    )


def _extract_response_text(response) -> str:
    content = response.content
    if isinstance(content, list):
        if not content:
            return ""
        content = content[0]
    if isinstance(content, dict):
        return str(content.get("content", "")).strip()
    return str(content).strip()


async def generate_interview_plan(
    resume: ResumeData, role: str, job_description: str
) -> dict:
    """Pre-generate a structured interview plan before the session starts."""
    llm = _build_llm()

    resume_summary = f"""
Name: {resume.name}
Skills: {', '.join(resume.skills[:15])}
Experience: {json.dumps(resume.experience[:3])}
Projects: {json.dumps(resume.projects[:3])}
Education: {json.dumps(resume.education[:2])}
"""

    prompt = f"""
You are a senior interviewer at a top tech company. Create a realistic, personalized interview plan 
for a candidate applying for the role of "{role}".

Candidate Resume Summary:
{resume_summary}

Job Description (excerpt):
{job_description[:1000]}

Generate a JSON interview plan with exactly 10 questions spread across these categories:
1. Introduction & Background (2 questions - warm, conversational)
2. Resume Deep Dive (3 questions - specific to their projects/experience)
3. Technical / DSA (3 questions - appropriate for the role)
4. Behavioral / Situational (2 questions - using STAR method prompts)

Return ONLY this JSON:
{{
  "persona": "Alex",
  "opening_line": "Hey! Welcome. I'm Alex. Really glad you could make it today. Let's have a good conversation - think of this as a chat between engineers. Ready to get started?",
  "questions": [
    {{
      "id": 1,
      "category": "introduction",
      "question": "...",
      "follow_up_hint": "Listen for communication clarity and self-awareness",
      "expected_duration_seconds": 60
    }}
  ],
  "closing_line": "That was a great conversation! I really enjoyed learning about your background. We'll be in touch soon with detailed feedback. Thank you so much for your time today."
}}

Make the questions feel NATURAL and CONVERSATIONAL, not like a formal exam.
Return ONLY the JSON, no markdown.
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    text = _extract_response_text(response)

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return json.loads(text)


async def generate_job_description(role: str) -> str:
    """Generate a realistic job description for a given role."""
    llm = _build_llm()

    prompt = f"""
Write a realistic, professional job description for the role: "{role}"

Include:
- 3-4 line company intro (modern tech company)
- Responsibilities (6-8 bullet points)
- Required Skills (5-7 items)
- Nice to have (3-4 items)
- Compensation & perks (brief)

Keep it under 400 words. Make it sound like a real company posting.
Return only the job description text, no extra commentary.
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return _extract_response_text(response)
