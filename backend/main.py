from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from backend.routers import interview, feedback, ws_interview

load_dotenv()

app = FastAPI(
    title="AI Interview Platform API",
    description="Backend for the AI Agentic Interview Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview.router)
app.include_router(feedback.router)
app.include_router(ws_interview.router)


@app.get("/health")
async def health():
    return {"status": "ok", "message": "AI Interview Platform API is running"}
