from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    """
    Centralized configuration management using Pydantic settings.
    Automatically loads from environment variables and .env file.
    Follows Adobe Hackathon 2025 requirements for LLM and TTS integration.
    """
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./data/synapse.db"
    
    # Adobe PDF Embed API Configuration
    ADOBE_CLIENT_ID: Optional[str] = None
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:8000", "http://localhost:8080"]
    
    # Vector Search Configuration
    FAISS_INDEX_PATH: str = "./data/faiss_index.bin"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    
    # LLM Configuration (Adobe Hackathon 2025 Requirements)
    LLM_PROVIDER: str = "gemini"
    
    # OpenAI Configuration
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_BASE: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o"
    
    # Azure OpenAI Configuration
    AZURE_OPENAI_KEY: Optional[str] = None
    AZURE_OPENAI_BASE: Optional[str] = None
    AZURE_API_VERSION: Optional[str] = None
    AZURE_DEPLOYMENT_NAME: Optional[str] = None
    
    # Gemini Configuration
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None  # Alternative credential method
    GEMINI_MODEL: str = "gemini-1.5-flash"
    
    # Ollama Configuration (for local development)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    # TTS Configuration (Adobe Hackathon 2025 Requirements)
    TTS_PROVIDER: str = "azure"
    AZURE_TTS_KEY: Optional[str] = None
    AZURE_TTS_REGION: Optional[str] = None
    AZURE_TTS_ENDPOINT: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Global settings instance
settings = Settings()
