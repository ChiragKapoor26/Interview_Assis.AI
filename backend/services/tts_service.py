import httpx
import os
from typing import Optional


ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # "Sarah" - natural, warm voice


async def text_to_speech(text: str) -> Optional[bytes]:
    """Convert text to speech using ElevenLabs API. Returns audio bytes."""
    if not ELEVENLABS_API_KEY:
        return None  # Fallback: frontend uses Web Speech Synthesis

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2",  # Fastest model for low latency
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.3,
            "use_speaker_boost": True,
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.content
        return None
