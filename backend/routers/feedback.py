from fastapi import APIRouter, HTTPException
from backend.models.schemas import EndInterviewRequest, FeedbackReport, DashboardInterview
from backend.services.gemini_service import generate_feedback_report
import os
import json
from supabase import create_client

router = APIRouter(prefix="/api", tags=["feedback"])


def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


@router.post("/interview/end")
async def end_interview(request: EndInterviewRequest):
    """Generate feedback report and save to DB."""
    supabase = get_supabase()

    # Fetch interview context from DB
    interview_data = None
    interview_plan = {}
    role = "Software Engineer"
    resume_summary = ""

    if supabase:
        result = supabase.table("interviews").select("*").eq("id", request.interview_id).execute()
        if result.data:
            interview_data = result.data[0]
            interview_plan = json.loads(interview_data.get("interview_plan", "{}"))
            role = interview_data.get("role", role)
            resume_summary = interview_data.get("resume_summary", "")

    # Generate feedback with Gemini
    feedback = await generate_feedback_report(
        transcript=request.transcript,
        interview_plan=interview_plan,
        role=role,
        resume_summary=resume_summary,
        facial_metrics=request.facial_metrics,
    )
    feedback["interview_id"] = request.interview_id

    # Save feedback to Supabase
    if supabase:
        supabase.table("interviews").update({
            "status": "completed",
            "feedback": json.dumps(feedback),
            "overall_score": feedback.get("overall_score", 0),
            "conversation_history": json.dumps(request.transcript),
        }).eq("id", request.interview_id).execute()

    return feedback


@router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str):
    """Get all past interviews for a user, sorted newest first."""
    supabase = get_supabase()
    if not supabase:
        return {"interviews": []}

    result = (
        supabase.table("interviews")
        .select("id, role, overall_score, status, created_at, feedback")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .order("created_at", desc=True)
        .execute()
    )

    interviews = []
    for row in result.data:
        interviews.append({
            "interview_id": row["id"],
            "role": row["role"],
            "overall_score": row.get("overall_score", 0),
            "created_at": row["created_at"],
            "feedback": json.loads(row["feedback"]) if row.get("feedback") else None,
        })

    return {"interviews": interviews}
