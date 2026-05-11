from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.services.resume_parser import extract_text_from_pdf, parse_resume_with_llm
from backend.services.interview_planner import generate_job_description, generate_interview_plan
from backend.models.schemas import (
    JDGenerateRequest, JDGenerateResponse,
    InterviewSetupRequest, InterviewSetupResponse, ResumeData
)
import json
import uuid
import os
from supabase import create_client

router = APIRouter(prefix="/api", tags=["setup"])


def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


@router.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    """Parse a PDF resume and return structured JSON data."""
    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

    raw_text = extract_text_from_pdf(pdf_bytes)
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

    resume_data = await parse_resume_with_llm(raw_text)
    return resume_data


@router.post("/jd/generate", response_model=JDGenerateResponse)
async def generate_jd(request: JDGenerateRequest):
    """Generate a realistic job description for a given role."""
    jd = await generate_job_description(request.role)
    return JDGenerateResponse(job_description=jd)


@router.post("/interview/setup", response_model=InterviewSetupResponse)
async def setup_interview(request: InterviewSetupRequest):
    """Generate interview plan and save to DB. Returns interview_id."""
    interview_plan = await generate_interview_plan(
        resume=request.resume_data,
        role=request.role,
        job_description=request.job_description,
    )

    interview_id = str(uuid.uuid4())
    resume_summary = (
        f"Name: {request.resume_data.name}, "
        f"Skills: {', '.join(request.resume_data.skills[:10])}, "
        f"Experience: {len(request.resume_data.experience)} roles"
    )

    # Store in Supabase
    supabase = get_supabase()
    if supabase:
        supabase.table("interviews").insert({
            "id": interview_id,
            "user_id": request.user_id,
            "role": request.role,
            "job_description": request.job_description,
            "resume_summary": resume_summary,
            "interview_plan": json.dumps(interview_plan),
            "status": "pending",
            "conversation_history": "[]",
        }).execute()

    return InterviewSetupResponse(
        interview_id=interview_id,
        message="Interview plan ready. You may enter the interview room."
    )
