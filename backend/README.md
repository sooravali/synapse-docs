# Synapse Backend Documentation

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Services](#core-services)
- [API Endpoints](#api-endpoints)
- [Database Models](#database-models)
- [Adobe Hackathon 2025 Compliance](#adobe-hackathon-2025-compliance)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Development Guide](#development-guide)
- [Production Deployment](#production-deployment)

## Overview

The Synapse backend is a FastAPI-based microservice that implements an intelligent document processing and search system. Built for the Adobe Hackathon 2025 "Connecting the Dots" challenge, it transforms static PDF documents into queryable, interactive knowledge bases through advanced AI and machine learning techniques.

### Key Capabilities

- **Document Intelligence**: Advanced PDF processing with text extraction, layout analysis, and semantic understanding
- **Vector Search**: High-performance semantic search using Faiss vector database with session-aware indexing
- **Multi-Modal AI**: Integration with Google Gemini for insights generation and Azure TTS for audio synthesis
- **Real-time Processing**: Asynchronous document processing pipeline with progress tracking
- **Session Management**: User-isolated document libraries and search contexts

## Architecture

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI App   │────│  Core Services  │────│   External APIs │
│                 │    │                 │    │                 │
│ • Route Handlers│    │ • Document      │    │ • Adobe PDF     │
│ • Middleware    │    │   Parser        │    │   Embed API     │
│ • Background    │    │ • Embedding     │    │ • Google Gemini │
│   Tasks         │    │   Service       │    │ • Azure TTS     │
│ • Session Mgmt  │    │ • Faiss Vector  │    │                 │
└─────────────────┘    │   Database      │    └─────────────────┘
                       │ • LLM Service   │
                       │ • TTS Service   │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Data Layer    │
                       │                 │
                       │ • SQLite DB     │
                       │ • File Storage  │
                       │ • Vector Index  │
                       └─────────────────┘
```

### Service Layer Design

The backend follows a service-oriented architecture with clear separation of concerns:

- **API Layer**: FastAPI routes and request/response handling
- **Service Layer**: Business logic and external integrations
- **Data Layer**: Database operations and file management
- **Core Layer**: Configuration, authentication, and shared utilities

## Core Services

### Document Parser Service

**Location**: `app/services/document_parser.py`

Implements the complete Challenge 1A processing pipeline with a 4-stage approach:

#### Stage 1: Embedded TOC Detection
- Fast-path extraction for documents with embedded table of contents
- Significantly improves processing speed for structured documents

#### Stage 2: Text Extraction with Metadata
- **Primary Engine**: PyMuPDF (fitz) for high-fidelity text extraction
- **Fallback Engine**: PDFMiner for compatibility with complex layouts
- Extracts font information, positioning data, and layout structure

#### Stage 3: Feature Extraction
```python
# Key features extracted for each text block:
- Font size and weight analysis
- Spatial positioning and margins
- Text length and formatting patterns
- Hierarchical relationships
- Content quality scoring
```

#### Stage 4: ML Classification
- **CRF-based Classification**: Conditional Random Fields for heading detection
- **Confidence Scoring**: Each classification includes confidence metrics
- **Hierarchical Reconstruction**: Builds document structure from classified elements

#### Stage 5: Enhanced Chunking
- **Semantic Chunking**: Creates coherent text segments
- **Context Preservation**: Maintains section relationships
- **Metadata Enrichment**: Adds extraction quality scores and semantic markers

### Embedding Service

**Location**: `app/services/embedding_service.py`

Implements the sophisticated Challenge 1B semantic analysis approach:

#### Core Features
- **Model**: Sentence Transformers all-MiniLM-L6-v2 (384-dimensional embeddings)
- **Batch Processing**: Optimized batch embedding generation (32 texts per batch)
- **Intelligent Caching**: Hash-based embedding cache with configurable size limits
- **Similarity Computation**: Cosine similarity with configurable thresholds

#### Advanced Capabilities
```python
# Semantic content extraction with ranking
def extract_semantic_content(chunks, query, max_chunks=10):
    # 1. Generate query embedding
    # 2. Compute similarity scores
    # 3. Apply semantic filtering
    # 4. Rank by relevance
    # 5. Return enhanced results with context
```

#### Performance Optimizations
- **Memory Management**: Streaming processing for large document sets
- **CPU Optimization**: Leverages NumPy and scikit-learn for efficient computation
- **Cache Strategy**: LRU-based cache with automatic cleanup

### Faiss Vector Database Service

**Location**: `app/services/faiss_service.py`

Provides high-performance vector similarity search with session-aware indexing:

#### Key Features
- **Session Isolation**: Separate vector indices per user session
- **Incremental Updates**: Efficient addition of new vectors without full rebuilds
- **Similarity Search**: Fast k-nearest neighbor search with configurable thresholds
- **Metadata Management**: Rich metadata storage with each vector

#### Index Management
```python
# Session-aware vector operations
def add_embeddings(embeddings, metadata, session_id):
    # Creates or updates session-specific index
    # Maintains metadata mappings
    # Returns vector positions for database updates

def search(query_embedding, top_k, threshold, session_id):
    # Searches within session-specific index
    # Applies similarity filtering
    # Returns ranked results with metadata
```

### LLM Service

**Location**: `app/services/llm_service.py`

Implements multi-provider LLM integration following Adobe Hackathon 2025 requirements:

#### Supported Providers
- **Google Gemini**: Primary provider using Vertex AI with service account authentication
- **OpenAI**: GPT-4 integration for development and testing
- **Azure OpenAI**: Enterprise-grade deployment option
- **Ollama**: Local LLM support for offline development

#### Provider Configuration
```python
# Adobe Hackathon compliant configuration
LLM_PROVIDER=gemini
GOOGLE_APPLICATION_CREDENTIALS=/credentials/service-account.json
GEMINI_MODEL=gemini-2.5-flash
```

#### Features
- **Universal Interface**: Consistent API across all providers
- **Error Handling**: Comprehensive error handling with fallback mechanisms
- **Rate Limiting**: Built-in rate limiting for API compliance
- **Response Validation**: Structured response parsing and validation

### TTS Service

**Location**: `app/services/tts_service.py`

Implements text-to-speech functionality using Adobe Hackathon sample scripts:

#### Core Components
- **Azure TTS Integration**: Primary TTS provider using Azure Cognitive Services
- **Multi-Speaker Support**: Different voices for podcast-style audio generation
- **Rate Limiting**: Conservative rate limiting for Azure F0 tier compliance
- **Audio Concatenation**: FFmpeg-based audio segment merging

#### Advanced Features
```python
# Multi-speaker podcast generation
async def generate_podcast_audio(script):
    # 1. Parse script for speaker roles (Pooja/Arjun)
    # 2. Generate individual voice segments
    # 3. Apply rate limiting between calls
    # 4. Concatenate segments into final audio
    # 5. Return audio file path and success status
```

#### Voice Configuration
- **Host Voice**: en-US-JennyNeural (Pooja)
- **Analyst Voice**: en-US-GuyNeural (Arjun)
- **Quality Settings**: 16kHz, 32kbps mono MP3 output

## API Endpoints

### Document Management

#### `POST /api/v1/documents/upload`
Upload and process PDF documents with comprehensive error handling.

**Request**:
```http
POST /api/v1/documents/upload
Headers:
  X-Session-ID: user-session-123
  Content-Type: multipart/form-data
Body:
  file: document.pdf
```

**Response**:
```json
{
  "message": "Document uploaded successfully. Processing started.",
  "document_id": 42,
  "status": "processing"
}
```

**Processing Pipeline**:
1. File validation and duplicate detection
2. Background processing initiation
3. Challenge 1A text extraction
4. Challenge 1B embedding generation
5. Faiss vector index updates
6. Status update to "ready"

#### `POST /api/v1/documents/upload-multiple`
Batch upload multiple PDF documents with individual result tracking.

#### `GET /api/v1/documents/`
List all documents for the current session with status information.

#### `GET /api/v1/documents/{document_id}`
Retrieve detailed information about a specific document.

#### `GET /api/v1/documents/{document_id}/pdf`
Serve the original PDF file for viewing in the Adobe PDF Embed API.

#### `DELETE /api/v1/documents/{document_id}`
Remove document and associated data from the system.

### Search and Discovery

#### `POST /api/v1/search/semantic`
Perform semantic search using Challenge 1B embedding logic.

**Request**:
```json
{
  "query_text": "machine learning applications in healthcare",
  "top_k": 10,
  "similarity_threshold": 0.7,
  "document_ids": [1, 2, 3]
}
```

**Response**:
```json
{
  "query": "machine learning applications in healthcare",
  "total_results": 8,
  "results": [
    {
      "chunk_id": 156,
      "document_id": 1,
      "document_name": "AI_Healthcare_Review.pdf",
      "similarity_score": 0.89,
      "text_chunk": "Machine learning algorithms have shown remarkable success...",
      "page_number": 15,
      "chunk_type": "content",
      "heading_level": "H2"
    }
  ],
  "search_time_ms": 245.6,
  "embedding_time_ms": 23.1
}
```

#### `GET /api/v1/search/text`
Fallback text-based search for exact text matching.

### AI-Powered Features

#### `POST /api/v1/insights/generate`
Generate AI-powered insights using the "Insights Bulb" feature.

**Request**:
```json
{
  "text": "Selected text from document for analysis",
  "context": "Additional context for better insights"
}
```

**Response**:
```json
{
  "insights": "## Key Insights\n\n1. **Critical Analysis**: ...\n2. **Contradictions**: ...",
  "status": "success"
}
```

#### `POST /api/v1/insights/document/{document_id}`
Generate comprehensive document-level insights and analysis.

#### `POST /api/v1/podcast/generate`
Generate podcast-style audio content from selected text and insights.

**Request**:
```json
{
  "content": "Main content for podcast",
  "related_content": "Additional context from connections",
  "generate_audio": true,
  "insights": {...}
}
```

**Response**:
```json
{
  "script": "Pooja: Welcome to today's analysis...\nArjun: Thank you, Pooja...",
  "audio_url": "/api/v1/podcast/audio/podcast_1734567890_abc123.mp3",
  "status": "success"
}
```

### System and Health

#### `GET /api/v1/system/health`
Comprehensive system health check with dependency validation.

#### `GET /api/v1/system/stats`
System statistics including document counts, processing metrics, and performance data.

#### `GET /api/v1/config/client`
Client configuration including Adobe PDF Embed API keys and feature flags.

### Knowledge Graph

#### `GET /api/v1/graph/document/{document_id}`
Generate knowledge graph representation of document relationships.

## Database Models

### Document Model

**Location**: `app/models/document.py`

```python
class Document(SQLModel, table=True):
    id: Optional[int] = Field(primary_key=True)
    session_id: str = Field(index=True)
    file_name: str = Field(index=True)
    upload_timestamp: datetime
    processing_completed_at: Optional[datetime]
    status: str  # "processing", "ready", "error"
    content_hash: str = Field(index=True)
    file_size: Optional[int]
    page_count: Optional[int]
    total_chunks: Optional[int]
    error_message: Optional[str]
    document_language: Optional[str]
    has_embedded_toc: Optional[bool]
    extraction_method: Optional[str]
```

### TextChunk Model

```python
class TextChunk(SQLModel, table=True):
    id: Optional[int] = Field(primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    page_number: int = Field(index=True)
    text_chunk: str = Field(index=True)
    chunk_index: int = Field(index=True)
    faiss_index_position: Optional[int] = Field(index=True)
    
    # Content analysis metadata
    chunk_type: Optional[str]  # "content", "heading", "title"
    heading_level: Optional[str]  # "H1", "H2", "H3"
    confidence_score: Optional[float]
    
    # Vector embedding metadata
    embedding_created_at: Optional[datetime]
    embedding_model: Optional[str]
    embedding_dimension: Optional[int]
    
    # Processing metadata
    extraction_features: Optional[str]  # JSON string
    semantic_cluster: Optional[int]
```

## Adobe Hackathon 2025 Compliance

### Environment Variables

The backend strictly follows Adobe Hackathon requirements for environment variable configuration:

```bash
# LLM Configuration (Required)
LLM_PROVIDER=gemini
GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json
GEMINI_MODEL=gemini-2.5-flash

# TTS Configuration (Required)
TTS_PROVIDER=azure
AZURE_TTS_KEY=your-azure-tts-key
AZURE_TTS_ENDPOINT=your-azure-tts-endpoint

# PDF Embed API (Optional)
ADOBE_EMBED_API_KEY=your-adobe-embed-key
```

### Sample Script Integration

The backend includes and utilizes the required Adobe Hackathon sample scripts:

- **`chat_with_llm.py`**: Integrated into LLM service for Gemini communication
- **`generate_audio.py`**: Integrated into TTS service for audio generation
- **`requirements.txt`**: Dependencies aligned with sample script requirements

### Docker Compatibility

The application is designed to run in the specified Docker environment:

```bash
# Build command
docker build --platform linux/amd64 -t synapse-docs:final .

# Run command
docker run -v /path/to/credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=<key> \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<key> \
  -e AZURE_TTS_ENDPOINT=<endpoint> \
  -p 8080:8080 synapse-docs:final
```

## Installation & Setup

### Prerequisites

- Python 3.11+
- SQLite (included)
- Docker (for containerized deployment)

### Local Development

1. **Clone and Setup**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Environment Configuration**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Run Development Server**:
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Setup

1. **Environment Variables**:
```bash
export DATABASE_URL="sqlite:///./synapse.db"
export LLM_PROVIDER="gemini"
export TTS_PROVIDER="azure"
# Add other required variables
```

2. **Run with Gunicorn**:
```bash
gunicorn -c gunicorn_conf.py app.main:app
```

## Configuration

### Core Settings

**Location**: `app/core/config.py`

```python
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./synapse.db"
    
    # Adobe PDF Embed API
    ADOBE_EMBED_API_KEY: Optional[str] = None
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:8080"
    ]
    
    # Vector Search
    FAISS_INDEX_PATH: str = "./data/faiss_index/index.faiss"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    
    # LLM Configuration
    LLM_PROVIDER: str = "gemini"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # TTS Configuration
    TTS_PROVIDER: str = "azure"
    AZURE_TTS_HOST_VOICE: str = "en-US-JennyNeural"
    AZURE_TTS_ANALYST_VOICE: str = "en-US-GuyNeural"
    
    # File Processing
    MAX_FILE_SIZE_MB: int = 500
    CHUNK_BATCH_SIZE: int = 50
    EMBEDDING_BATCH_SIZE: int = 32
```

### Performance Tuning

#### Memory Optimization
```python
# Batch processing configuration
CHUNK_BATCH_SIZE = 50        # Text chunks per batch
EMBEDDING_BATCH_SIZE = 32    # Embeddings per batch
METADATA_BATCH_SIZE = 100    # Database updates per batch
```

#### Caching Configuration
```python
# Embedding service cache
EMBEDDING_CACHE_SIZE = 10000
SIMILARITY_THRESHOLD = 0.7

# Rate limiting for external APIs
TTS_CALLS_PER_MINUTE = 20
LLM_CALLS_PER_MINUTE = 60
```

## Development Guide

### Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── documents.py    # Document management
│   │       │   ├── search.py       # Search endpoints
│   │       │   ├── system.py       # Health & stats
│   │       │   ├── llm.py          # LLM endpoints
│   │       │   └── graph.py        # Knowledge graph
│   │       ├── insights.py         # Insights API
│   │       └── config.py           # Configuration
│   ├── core/
│   │   ├── config.py               # Settings management
│   │   └── database.py             # Database setup
│   ├── crud/
│   │   └── crud_document.py        # Database operations
│   ├── models/
│   │   └── document.py             # SQLModel definitions
│   ├── schemas/
│   │   └── document.py             # Pydantic schemas
│   ├── services/
│   │   ├── document_parser.py      # Challenge 1A logic
│   │   ├── embedding_service.py    # Challenge 1B logic
│   │   ├── faiss_service.py        # Vector database
│   │   ├── llm_service.py          # LLM integration
│   │   ├── tts_service.py          # Audio generation
│   │   └── shared.py               # Service singletons
│   └── main.py                     # FastAPI application
├── requirements.txt                # Dependencies
├── gunicorn_conf.py               # Production server config
├── chat_with_llm.py               # Adobe sample script
└── generate_audio.py              # Adobe sample script
```

### Adding New Features

#### Adding a New Endpoint

1. **Create Route Handler**:
```python
# app/api/v1/endpoints/new_feature.py
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.core.database import get_session

router = APIRouter()

@router.post("/process")
async def process_feature(data: RequestModel, session: Session = Depends(get_session)):
    # Implementation
    pass
```

2. **Register Router**:
```python
# app/api/v1/__init__.py
from app.api.v1.endpoints import new_feature

api_router.include_router(
    new_feature.router,
    prefix="/new-feature",
    tags=["new-feature"]
)
```

#### Adding a New Service

1. **Create Service Class**:
```python
# app/services/new_service.py
class NewService:
    def __init__(self):
        # Initialization
        pass
    
    def process(self, data):
        # Implementation
        pass
```

2. **Register in Shared Services**:
```python
# app/services/shared.py
_new_service = None

def get_new_service():
    global _new_service
    if _new_service is None:
        _new_service = NewService()
    return _new_service
```

### Testing

#### Unit Tests
```python
# tests/test_services.py
import pytest
from app.services.embedding_service import EmbeddingService

def test_embedding_generation():
    service = EmbeddingService()
    embedding = service.create_embedding("test text")
    assert len(embedding) == 384  # all-MiniLM-L6-v2 dimension
```

#### Integration Tests
```python
# tests/test_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_document_upload():
    response = client.post("/api/v1/documents/upload", files={"file": pdf_content})
    assert response.status_code == 200
```

### Debugging

#### Logging Configuration
```python
# Enhanced logging for development
import logging
logging.basicConfig(level=logging.DEBUG)

# Service-specific loggers
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
```

#### Performance Monitoring
```python
# Add timing decorators for performance analysis
import time
from functools import wraps

def timing_decorator(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.time()
        result = await func(*args, **kwargs)
        duration = time.time() - start
        logger.info(f"{func.__name__} took {duration:.2f}s")
        return result
    return wrapper
```

## Production Deployment

### Docker Deployment

The application uses a multi-stage Docker build for optimal performance and size:

```dockerfile
# Frontend build stage
FROM node:18-alpine AS frontend
# ... frontend build

# Python dependencies stage  
FROM python:3.11-slim AS python-deps
# ... dependency installation

# Runtime stage
FROM python:3.11-slim AS runtime
# ... minimal runtime setup
```

### Environment Configuration

#### Production Variables
```bash
# Core configuration
DATABASE_URL=sqlite:///./synapse.db
PYTHONDONTWRITEBYTECODE=1
PYTHONUNBUFFERED=1

# External services
LLM_PROVIDER=gemini
TTS_PROVIDER=azure
ADOBE_EMBED_API_KEY=your-key

# Performance tuning
MAX_FILE_SIZE_MB=500
CHUNK_BATCH_SIZE=50
EMBEDDING_BATCH_SIZE=32
```

#### Health Checks
```yaml
# Docker Compose health check
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Monitoring and Observability

#### Metrics Collection
- Request/response times
- Document processing metrics
- Vector search performance
- External API call latencies

#### Error Tracking
- Comprehensive error logging
- Structured error responses
- Health check endpoints
- Dependency monitoring

### Scaling Considerations

#### Horizontal Scaling
- Stateless service design
- Session-based user isolation
- Shared vector database support

#### Performance Optimization
- Connection pooling for databases
- Caching for embeddings and search results
- Batch processing for large operations
- Memory management for large documents

---

This documentation provides a comprehensive overview of the Synapse backend architecture, implementation details, and operational requirements. For specific implementation questions or troubleshooting, refer to the inline code documentation or the development team.
