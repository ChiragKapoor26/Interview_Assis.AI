import io
import os
from typing import Optional
import edge_tts

# "en-US-EmmaMultilingualNeural" or "en-US-AvaNeural" are great choices 
# for a natural, warm female voice similar to ElevenLabs "Sarah"
VOICE_ID = os.getenv("EDGE_VOICE_ID", "en-US-EmmaMultilingualNeural")


async def text_to_speech(text: str) -> Optional[bytes]:
    """Convert text to speech using edge-tts. Returns audio bytes."""
    if not text.strip():
        return None

    try:
        # Initialize the edge-tts Communicate object
        communicate = edge_tts.Communicate(text, VOICE_ID)
        
        # Create an in-memory byte buffer to hold the audio data
        audio_buffer = io.BytesIO()
        
        # Iterate over the async stream generator and write chunks to buffer
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                audio_data = chunk.get("data")
                if audio_data:
                    audio_buffer.write(audio_data)
        
        # Retrieve the complete raw bytes
        audio_bytes = audio_buffer.getvalue()
        
        return audio_bytes if len(audio_bytes) > 0 else None

    except Exception as e:
        # Log the error in production as needed
        print(f"Edge-TTS Error: {e}")
        return None