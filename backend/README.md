# Synapse-Docs Backend

FastAPI-based backend service implementing intelligent document processing, semantic search, and AI-powered insights generation.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Core Services](#core-services)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [Processing Pipeline](#processing-pipeline)
- [Setup & Configuration](#setup--configuration)
- [Development](#development)
- [Performance](#performance)
- [Hackathon Compliance](#hackathon-compliance)

## Overview

The Synapse-Docs backend is a production-grade FastAPI application that processes PDF documents, generates embeddings for semantic search, and provides AI-powered insights. It implements the complete Challenge 1A and 1B logic from previous hackathon rounds, refactored into a scalable microservices architecture.

## Architecture

### Microservices Design

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Application                     │
├─────────────────┬─────────────────┬─────────────────────────┤
│   API Layer     │  Business Logic │    Data Layer          │
│                 │                 │                        │
│ • REST Endpoints│ • Document      │ • SQLite Database      │
│ • Request/Response│  Processing   │ • Faiss Vector Store   │
│ • Authentication│ • Embedding     │ • File Storage         │
│ • Error Handling│   Generation    │ • Session Management   │
│                 │ • Search Logic  │                        │
│                 │ • AI Integration│                        │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Service Architecture

```
Document Upload → Document Parser → Text Extraction → Embedding Service
                                                           ↓
Knowledge Graph ← Faiss Service ← Vector Storage ← Chunk Processing
       ↓
LLM Service → Insights Generation → TTS Service → Audio Generation
```

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Web Framework** | FastAPI | 0.116.1 | High-performance async API |
| **ASGI Server** | Uvicorn + Gunicorn | 0.35.0 / 21.2.0 | Production WSGI deployment |
| **Database ORM** | SQLModel | 0.0.24 | Type-safe database operations |
| **Data Validation** | Pydantic | 2.11.7 | Request/response validation |
| **PDF Processing** | PDFMiner.six | 20250506 | Text extraction from PDFs |
| **ML Framework** | Sentence Transformers | 3.0.1 | Text embedding generation |
| **Vector Database** | Faiss | 1.8.0 | Similarity search and indexing |
| **LLM Integration** | Google Gemini 2.5 Flash | via Vertex AI | AI insights generation |
| **Text-to-Speech** | Azure Cognitive Services | 1.34.0 | Audio podcast generation |
| **HTTP Client** | HTTPX | 0.28.1 | Async API calls |

## Core Services

### Document Parser Service
**File**: `app/services/document_parser.py`

Implements the complete Challenge 1A processing pipeline:
- **4-Stage Processing**: Layout analysis, heading detection, content extraction, quality validation
- **CRF-based Heading Detection**: Machine learning approach for structural analysis
- **Multi-format Support**: PDF processing with fallback mechanisms
- **Language Detection**: Automatic language identification for content processing

**Key Features**:
- Refactored Challenge 1A logic with improved accuracy
- Robust error handling and graceful degradation
- Configurable processing parameters
- Comprehensive text quality metrics

### Embedding Service
**File**: `app/services/embedding_service.py`

Handles text-to-vector conversion using Challenge 1B methodology:
- **Model**: `all-MiniLM-L6-v2` sentence transformer
- **Dimensionality**: 384-dimensional embeddings
- **Batch Processing**: Efficient bulk embedding generation
- **Caching**: Intelligent embedding cache management

**Processing Workflow**:
1. Text preprocessing and cleaning
2. Sentence-level segmentation
3. Batch embedding generation
4. Vector normalization
5. Faiss index integration

### Faiss Service
**File**: `app/services/faiss_service.py`

Vector database implementation for semantic search:
- **Index Type**: Flat L2 index for exact similarity search
- **Similarity Metric**: Cosine similarity for semantic matching
- **Search Features**: K-nearest neighbor with configurable thresholds
- **Performance**: Sub-second search across large document collections

**Capabilities**:
- Real-time vector insertion
- Batch similarity queries
- Index persistence and loading
- Memory-efficient storage

### LLM Service
**File**: `app/services/llm_service.py`

AI integration following hackathon sample scripts:
- **Provider**: Google Gemini 2.5 Flash via Vertex AI
- **Compliance**: Uses provided `chat_with_llm.py` sample script
- **Features**: Context-aware insight generation, contradiction detection
- **Error Handling**: Graceful fallback and retry mechanisms

**Insight Types**:
- Key takeaways and summaries
- Cross-document contradictions
- Supporting examples and evidence
- Thematic connections

### TTS Service
**File**: `app/services/tts_service.py`

Audio generation using hackathon requirements:
- **Provider**: Azure Cognitive Services TTS
- **Compliance**: Uses provided `generate_audio.py` sample script
- **Formats**: Multi-speaker podcast generation
- **Quality**: Production-ready audio output

**Audio Features**:
- Single and multi-speaker synthesis
- SSML support for natural speech
- Audio concatenation and mixing
- Optimized file sizes

## API Endpoints

### Documents API
**Base Path**: `/api/v1/documents`

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/upload` | POST | Upload and process PDF | `file: UploadFile` |
| `/list` | GET | List user documents | `session_id: str` |
| `/{id}` | GET | Get document details | `id: int` |
| `/{id}` | DELETE | Delete document | `id: int` |

### Search API
**Base Path**: `/api/v1/search`

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/semantic` | POST | Semantic text search | `query: str, threshold: float` |
| `/connections` | POST | Find document connections | `text: str, limit: int` |

### Insights API
**Base Path**: `/api/v1/insights`

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/generate` | POST | Generate AI insights | `text: str, context: str` |
| `/podcast` | POST | Create audio podcast | `content: str, audio: bool` |
| `/document/{id}` | GET | Document analysis | `id: int, type: str` |

### Knowledge Graph API
**Base Path**: `/api/v1/graph`

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/connectivity` | GET | Document relationship graph | `threshold: float, max_connections: int` |

### System API
**Base Path**: `/api/v1/system`

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/health` | GET | Service health check | None |
| `/stats` | GET | System statistics | `session_id: str` |
| `/status` | GET | Service status | None |

## Data Models

### Document Model
**File**: `app/models/document.py`

```python
class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    file_name: str
    session_id: str
    upload_timestamp: datetime
    file_size: int
    page_count: int
    processing_status: str
    text_content: Optional[str]
    structured_content: Optional[str]
    embedding_ids: Optional[str]
```

### Text Chunk Schema
**File**: `app/schemas/document.py`

```python
class TextChunk(BaseModel):
    chunk_id: str
    document_id: int
    content: str
    page_number: int
    section_type: str
    embedding_vector: List[float]
    similarity_score: Optional[float]
```

## Processing Pipeline

### Document Upload Workflow

```
1. File Upload & Validation
   ├── File type verification (PDF only)
   ├── Size validation (< 50MB)
   └── Security scanning

2. Document Processing (Challenge 1A Pipeline)
   ├── PDF text extraction
   ├── Layout analysis
   ├── Heading detection (CRF-based)
   └── Content structuring

3. Embedding Generation (Challenge 1B Pipeline)
   ├── Text chunking and preprocessing
   ├── Sentence transformer encoding
   ├── Vector normalization
   └── Faiss index insertion

4. Database Storage
   ├── Document metadata storage
   ├── Text chunk persistence
   ├── Embedding ID mapping
   └── Session association
```

### Search Processing Workflow

```
1. Query Processing
   ├── Text preprocessing
   ├── Query embedding generation
   └── Context expansion

2. Vector Search
   ├── Faiss similarity search
   ├── Threshold filtering
   ├── Result ranking
   └── Context assembly

3. Response Generation
   ├── Snippet extraction
   ├── Relevance scoring
   ├── Metadata enrichment
   └── JSON serialization
```

## Setup & Configuration

### Environment Variables

```bash
# Core Configuration
PYTHONPATH=/app
PYTHONDONTWRITEBYTECODE=1
PYTHONUNBUFFERED=1

# Database
DATABASE_URL=sqlite:///./data/synapse.db

# AI Services (Hackathon Requirements)
LLM_PROVIDER=gemini
GOOGLE_APPLICATION_CREDENTIALS=/credentials/service-account.json
GEMINI_MODEL=gemini-2.5-flash

# TTS Configuration
TTS_PROVIDER=azure
AZURE_TTS_KEY=your_azure_key
AZURE_TTS_ENDPOINT=your_azure_endpoint

# Optional
ADOBE_EMBED_API_KEY=your_adobe_key
```

### Dependencies Installation

```bash
# Production dependencies
pip install -r requirements.txt

# Development dependencies
pip install pytest pytest-asyncio httpx
```

### Database Initialization

```bash
# Automatic on startup
# Creates SQLite database with all tables
# Initializes Faiss index directory
# Sets up required file storage
```

## Development

### Local Development Server

```bash
# Start development server
uvicorn app.main:app --reload --port 8000

# With environment variables
export LLM_PROVIDER=gemini
export GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
uvicorn app.main:app --reload --port 8000
```

### Testing

```bash
# Run test suite
pytest tests/

# With coverage
pytest --cov=app tests/

# Specific test categories
pytest tests/test_services.py
pytest tests/test_api.py
```

### Code Quality

```bash
# Linting
pylint app/

# Type checking
mypy app/

# Formatting
black app/
isort app/
```

## Performance

### Metrics

| Operation | Target Performance | Actual Performance |
|-----------|-------------------|-------------------|
| Document Upload | < 30s per document | ~15-25s |
| Text Search | < 500ms | ~200-300ms |
| Insight Generation | < 10s | ~5-8s |
| Audio Generation | < 60s | ~30-45s |

### Optimizations

- **Lazy Loading**: ML models loaded on first use
- **Connection Pooling**: Database connection reuse
- **Async Processing**: Non-blocking I/O operations
- **Caching**: Intelligent embedding and result caching
- **Batch Processing**: Efficient bulk operations

### Memory Management

- **Model Loading**: On-demand initialization
- **Vector Storage**: Memory-mapped Faiss indices
- **Garbage Collection**: Automatic cleanup
- **Resource Monitoring**: Health check endpoints

## Hackathon Compliance

### Sample Script Integration

The backend strictly follows hackathon requirements by integrating provided sample scripts:

- **`chat_with_llm.py`**: Used in `LLMService` for Gemini integration
- **`generate_audio.py`**: Used in `TTSService` for Azure TTS
- **Environment Variables**: Exact compliance with specified variables
- **Docker Compatibility**: Single-command deployment

### Challenge Integration

- **Challenge 1A Logic**: Complete refactoring into `DocumentParser`
- **Challenge 1B Logic**: Embedding pipeline in `EmbeddingService`
- **Performance Requirements**: Sub-second search response times
- **Feature Completeness**: All mandatory and bonus features implemented

---

**API Documentation**: Available at `/docs` endpoint when server is running  
**Health Monitoring**: Use `/health` and `/ready` endpoints for service monitoring
