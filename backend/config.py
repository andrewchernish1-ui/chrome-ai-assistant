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
        if not cls.GEMINI_API_KEY or cls.GEMINI_API_KEY == "your_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY environment variable is required")
        if not cls.EXA_API_KEY or cls.EXA_API_KEY == "your_exa_api_key_here":
            raise ValueError("EXA_API_KEY environment variable is required")
