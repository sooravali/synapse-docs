from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    """
    Centralized configuration management using Pydantic settings.
    Automatically loads from environment variables and .env file.
    Follows Adobe Hackathon 2025 requirements for LLM and TTS integration.
    """
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./synapse.db"
    
    # Adobe PDF Embed API Configuration
    ADOBE_CLIENT_ID: Optional[str] = None
    ADOBE_EMBED_API_KEY: Optional[str] = None  # Alternative name for hackathon compatibility
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173", 
        "http://localhost:8000", 
        "http://localhost:8080",
        "https://synapse-docs-833062842245.us-central1.run.app"  # Cloud Run production URL
    ]
    
    # Vector Search Configuration (configurable for different scenarios)
    FAISS_INDEX_PATH: str = "./data/faiss_index/index.faiss"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"  # Default, can be overridden via env var
    
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
    
    # Gemini Configuration (Adobe Hackathon 2025 Compatible)
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None  # Path to service account JSON file for Vertex AI
    GEMINI_MODEL: str = "gemini-2.5-flash"  # Using Gemini 2.5 Flash - best model for price and performance with thinking capabilities
    
    # Ollama Configuration (for local development)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    # TTS Configuration (Adobe Hackathon 2025 Requirements)
    TTS_PROVIDER: str = "azure"
    AZURE_TTS_KEY: Optional[str] = None
    AZURE_TTS_REGION: Optional[str] = None
    AZURE_TTS_ENDPOINT: Optional[str] = None
    AZURE_TTS_VOICE: str = "en-US-AriaNeural"  # Configurable voice for different languages
    
    # Multi-speaker podcast voices
    AZURE_TTS_HOST_VOICE: str = "en-US-JennyNeural"  # Host speaker voice
    AZURE_TTS_ANALYST_VOICE: str = "en-US-GuyNeural"  # Analyst speaker voice
    
    MAX_TTS_CHARACTERS: int = 10000
    
    # File System Configuration (configurable for different deployment scenarios)
    UPLOADS_DIR: str = "uploads"
    AUDIO_DIR: str = "./data/audio"
    DEFAULT_DOCUMENT_LANGUAGE: str = "unknown"
    
    # Processing Configuration
    MAX_FILE_SIZE_MB: int = 500  # Increased from 100MB to 500MB for large documents
    CHUNK_BATCH_SIZE: int = 50   # Number of chunks to process in each batch
    EMBEDDING_BATCH_SIZE: int = 32  # Optimal batch size for embedding generation
    METADATA_BATCH_SIZE: int = 100  # Number of metadata updates per batch
    
    # LLM Content Generation Configuration  
    INSIGHTS_SYSTEM_PROMPT: Optional[str] = None
    PODCAST_SYSTEM_PROMPT: Optional[str] = None
    PODCAST_DURATION_MINUTES: str = "2-5"
    PODCAST_WORD_COUNT: str = "300-500"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    @property
    def adobe_client_id(self) -> Optional[str]:
        """Get Adobe Client ID from either environment variable name"""
        return self.ADOBE_EMBED_API_KEY or self.ADOBE_CLIENT_ID

# Global settings instance
settings = Settings()
