import fitz  # PyMuPDF
import json
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from backend.models.schemas import ResumeData


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract raw text from PDF bytes using PyMuPDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


async def parse_resume_with_llm(raw_text: str) -> ResumeData:
    """Use Gemini via LangChain to structure raw resume text into JSON."""
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.2,
    )

    prompt = f"""
You are a resume parser. Extract the following fields from this resume text and return ONLY valid JSON.

Resume Text:
---
{raw_text[:4000]}
---

Return this exact JSON structure:
{{
  "name": "Full Name",
  "email": "email@example.com",
  "skills": ["skill1", "skill2"],
  "experience": [
    {{"company": "Company Name", "role": "Job Title", "duration": "Jan 2022 - Dec 2023", "description": "Brief summary"}}
  ],
  "projects": [
    {{"name": "Project Name", "description": "What it does", "tech": ["Python", "React"]}}
  ],
  "education": [
    {{"institution": "University Name", "degree": "B.Tech in CS", "year": "2024"}}
  ]
}}

Return ONLY the JSON object, no markdown, no explanation.
"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    text = response.content.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    data = json.loads(text)
    data["raw_text"] = raw_text[:2000]  # Store first 2000 chars for context
    return ResumeData(**data)
