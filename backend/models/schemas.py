from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ResumeData(BaseModel):
    name: str
    email: Optional[str] = None
    skills: List[str] = []
    experience: List[dict] = []
    projects: List[dict] = []
    education: List[dict] = []
    raw_text: str = ""


class JDGenerateRequest(BaseModel):
    role: str


class JDGenerateResponse(BaseModel):
    job_description: str


class InterviewSetupRequest(BaseModel):
    user_id: str
    role: str
    job_description: str
    resume_data: ResumeData


class InterviewSetupResponse(BaseModel):
    interview_id: str
    message: str


class WSMessage(BaseModel):
    type: str  # "user_turn" | "ping"
    transcript: Optional[str] = None
    code_content: Optional[str] = None


class WSResponse(BaseModel):
    type: str  # "agent_turn" | "error" | "interview_complete"
    text: Optional[str] = None
    audio_url: Optional[str] = None


class FeedbackScore(BaseModel):
    score: int
    notes: str


class FeedbackReport(BaseModel):
    interview_id: str
    overall_score: int
    ats_score: int
    transcript_analysis: str
    technical: FeedbackScore
    communication: FeedbackScore
    confidence: FeedbackScore
    improvements: List[str]
    strengths: List[str]
    created_at: Optional[str] = None


class EndInterviewRequest(BaseModel):
    interview_id: str
    user_id: str
    transcript: List[dict]  # [{role: "user"|"agent", text: str}]
    facial_metrics: Optional[dict] = None  # aggregated from MediaPipe


class DashboardInterview(BaseModel):
    interview_id: str
    role: str
    overall_score: int
    created_at: str
    feedback: Optional[FeedbackReport] = None
