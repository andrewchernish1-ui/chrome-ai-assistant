import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Gemini API configuration
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # EXA MCP configuration
    EXA_API_KEY = os.getenv("EXA_API_KEY")

    # ElevenLabs API configuration
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

    # FastAPI configuration
    HOST = os.getenv("HOST", "localhost")
    PORT = int(os.getenv("PORT", 8000))

    # CORS settings for Chrome extension
    ALLOWED_ORIGINS = [
        "chrome-extension://*",  # Allow all Chrome extensions
        "http://localhost:3000",  # For development
        "http://localhost:5173",  # For Vite dev server
    ]

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        # Сделать API ключи опциональными для тестирования
        if not cls.GEMINI_API_KEY:
            print("Warning: GEMINI_API_KEY not set, using mock responses")
        if not cls.EXA_API_KEY:
            print("Warning: EXA_API_KEY not set, research features will be limited")
