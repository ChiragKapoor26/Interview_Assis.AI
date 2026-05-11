from dotenv import load_dotenv
import os
load_dotenv()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY") or ""
if  DEEPSEEK_API_KEY is None:
    raise ValueError("Deepseek API is not configured")
SUPABASE_URL =os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") 
if not all([SUPABASE_SERVICE_ROLE_KEY,SUPABASE_URL]):
    raise ValueError("Supabase api keys are not configured properly")
