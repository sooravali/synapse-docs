# Synapse-Docs Backend

> A high-performance FastAPI service implementing advanced PDF processing, semantic search, and AI-powered document intelligence with FAISS vector database integration.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [Services](#services)
- [Configuration](#configuration)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Performance](#performance)

## Overview

The Synapse-Docs backend is a production-grade FastAPI application that powers intelligent document processing and semantic search capabilities. It implements a sophisticated 4-stage PDF processing pipeline refined from Adobe Hackathon Challenge 1A, combined with advanced semantic embeddings from Challenge 1B to deliver real-time cross-document connections.

### Key Capabilities

- **Advanced PDF Processing**: 4-stage extraction pipeline with CRF-based heading detection
- **Semantic Understanding**: all-MiniLM-L6-v2 embeddings for cross-document similarity
- **High-Performance Search**: FAISS vector database with sub-second query responses
- **AI Integration**: Gemini 2.5 Flash for contextual insights generation
- **Multi-Modal Output**: Azure TTS for podcast-style audio generation
- **Session Isolation**: User-specific document libraries with session management

## Architecture

### Microservices Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Layer     │    │  Service Layer  │    │  Data Layer     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Documents     │    │ • Document      │    │ • SQLModel      │
│ • Search        │    │   Parser        │    │ • FAISS Index   │
│ • Insights      │    │ • Embedding     │    │ • File Storage  │
│ • Graph         │    │   Service       │    │ • Vector DB     │
│ • System        │    │ • LLM Service   │    │ • Session Data  │
│ • Config        │    │ • TTS Service   │    │ • Metadata      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Request Processing Flow

```
HTTP Request → FastAPI Router → Business Logic → Data Access → Response
     ↓              ↓              ↓              ↓           ↓
Auth/Session → Endpoint Logic → Service Layer → Database → JSON/Binary
```

### Document Processing Pipeline

```
PDF Upload → Content Extraction → Semantic Chunking → Embedding Generation → Vector Indexing
     ↓              ↓                    ↓                   ↓                 ↓
File Storage → Text Analysis → Heading Detection → all-MiniLM-L6-v2 → FAISS Storage
```

## Technology Stack

### Core Framework
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **API Framework** | FastAPI | 0.104+ | High-performance async API with automatic OpenAPI |
| **Database ORM** | SQLModel | 0.0.14+ | Type-safe database operations with Pydantic integration |
| **Validation** | Pydantic | 2.5+ | Data validation and serialization |
| **ASGI Server** | Uvicorn | 0.24+ | Production-grade async server |

### Data Processing
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Vector Database** | FAISS | 1.7+ | High-performance similarity search and clustering |
| **Embeddings** | SentenceTransformers | 2.2+ | all-MiniLM-L6-v2 semantic embeddings |
| **PDF Processing** | PyMuPDF | 1.23+ | Document parsing and text extraction |
| **Text Analysis** | spaCy | 3.7+ | NLP pipeline for content analysis |

### AI Integration
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **LLM Service** | Google Generative AI | 0.3+ | Gemini 2.5 Flash for insights generation |
| **Text-to-Speech** | Azure Cognitive Services | 1.34+ | Multi-speaker audio generation |
| **Machine Learning** | scikit-learn | 1.3+ | CRF models for heading detection |

### Infrastructure
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Database** | SQLite | 3.40+ | Development and production data storage |
| **HTTP Client** | httpx | 0.25+ | Async HTTP requests for external APIs |
| **Logging** | Python logging | Built-in | Structured application logging |

## API Endpoints

### Document Management

| Endpoint | Method | Description | Input | Output |
|----------|--------|-------------|-------|--------|
| `/api/v1/documents/upload` | POST | Upload PDF document | FormData file | Document metadata |
| `/api/v1/documents/bulk-upload` | POST | Upload multiple PDFs | FormData files | Batch status |
| `/api/v1/documents/` | GET | List user documents | Query params | Document list |
| `/api/v1/documents/{id}` | GET | Get document details | Document ID | Full document info |
| `/api/v1/documents/{id}` | DELETE | Delete document | Document ID | Success status |
| `/api/v1/documents/clear-all` | DELETE | Clear user library | Session ID | Cleanup status |

### Semantic Search

| Endpoint | Method | Description | Input | Output |
|----------|--------|-------------|-------|--------|
| `/api/v1/search/semantic` | POST | Semantic text search | Query text, filters | Ranked results |
| `/api/v1/search/contextual` | POST | Context-aware search | Text + context | Enhanced results |

### AI Services

| Endpoint | Method | Description | Input | Output |
|----------|--------|-------------|-------|--------|
| `/api/v1/insights` | POST | Generate insights | Text + context | AI analysis |
| `/api/v1/podcast` | POST | Create audio overview | Text + options | Audio file |

### Knowledge Graph

| Endpoint | Method | Description | Input | Output |
|----------|--------|-------------|-------|--------|
| `/api/v1/graph/connectivity` | GET | Document relationships | Similarity threshold | Graph data |
| `/api/v1/graph/analysis` | GET | Graph analytics | User session | Network metrics |

### System Monitoring

| Endpoint | Method | Description | Input | Output |
|----------|--------|-------------|-------|--------|
| `/api/v1/system/health` | GET | Health check | None | System status |
| `/api/v1/system/stats` | GET | Usage statistics | None | Metrics data |
| `/api/v1/config/` | GET | Runtime configuration | None | Config object |

## Data Models

### Core Models

#### Document Model
```python
class Document(SQLModel, table=True):
    id: Optional[int] = Field(primary_key=True)
    file_name: str = Field(index=True)
    session_id: str = Field(index=True)
    status: str = Field(default="processing")
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_completed_at: Optional[datetime]
    page_count: Optional[int]
    total_chunks: Optional[int]
    content_hash: str = Field(unique=True)
    file_size: Optional[int]
    document_language: Optional[str]
    has_embedded_toc: Optional[bool]
    extraction_method: Optional[str]
    error_message: Optional[str]
```

#### TextChunk Model
```python
class TextChunk(SQLModel, table=True):
    id: Optional[int] = Field(primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    page_number: int
    text_chunk: str
    chunk_index: int
    faiss_index_position: Optional[int]
    chunk_type: Optional[str]
    heading_level: Optional[str]
    confidence_score: Optional[float]
    embedding_created_at: Optional[datetime]
    embedding_model: Optional[str]
    embedding_dimension: Optional[int]
    extraction_features: Optional[str]  # JSON string
    semantic_cluster: Optional[int]
```

### Schema Validation

#### Search Schemas
```python
class SearchQuery(BaseModel):
    query_text: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=50)
    similarity_threshold: float = Field(default=0.3, ge=0.0, le=1.0)
    document_ids: Optional[List[int]] = None
    chunk_types: Optional[List[str]] = None

class SearchResultItem(BaseModel):
    chunk_id: int
    document_id: int
    document_name: str
    page_number: int
    text_snippet: str
    similarity_score: float
    chunk_type: Optional[str]
    heading_context: Optional[str]
```

#### AI Service Schemas
```python
class InsightsRequest(BaseModel):
    text: str = Field(..., description="Text content for insights")
    context: Optional[str] = Field(None, description="Additional context")

class PodcastRequest(BaseModel):
    text: str = Field(..., description="Content for audio generation")
    voice_config: Optional[Dict[str, str]] = None
    podcast_style: bool = Field(default=True)
```

## Services

### Document Parser Service

**Purpose**: Advanced PDF processing with 4-stage extraction pipeline

**Key Features**:
- Layout analysis with confidence scoring
- CRF-based heading detection
- Table and figure extraction
- Multi-language support
- Error recovery and fallback mechanisms

**Implementation**:
```python
class DocumentParserService:
    def process_document(self, file_path: str) -> ProcessingResult:
        # Stage 1: Document structure analysis
        # Stage 2: Content extraction with layout preservation
        # Stage 3: Heading detection using CRF models
        # Stage 4: Semantic chunking and metadata extraction
```

### Embedding Service

**Purpose**: Semantic understanding through vector embeddings

**Key Features**:
- all-MiniLM-L6-v2 sentence transformer integration
- Batch processing for efficiency
- Embedding dimension optimization (384d)
- Cosine similarity calculations
- Cache management for frequently accessed embeddings

**Implementation**:
```python
class EmbeddingService:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        # Batch embedding generation with optimization
        # Normalization for cosine similarity
        # Cache management
```

### FAISS Service

**Purpose**: High-performance vector similarity search

**Key Features**:
- IndexFlatIP for exact cosine similarity
- Dynamic index updates
- Memory-efficient storage
- Session-based isolation
- Batch query processing

**Implementation**:
```python
class FaissService:
    def __init__(self):
        self.dimension = 384
        self.index = faiss.IndexFlatIP(self.dimension)
        
    def search(self, query_embedding: np.ndarray, k: int) -> SearchResults:
        # Similarity search with score filtering
        # Result ranking and metadata retrieval
```

### LLM Service

**Purpose**: AI-powered insights generation using Gemini 2.5 Flash

**Key Features**:
- Context-aware prompt engineering
- Multi-turn conversation support
- Structured output formatting
- Error handling and retries
- Rate limiting and quota management

**Implementation**:
```python
class LLMService:
    def generate_insights(self, text: str, context: str) -> InsightsResponse:
        # Prompt construction with context
        # Gemini API integration
        # Response parsing and validation
```

### TTS Service

**Purpose**: Multi-speaker audio generation for podcast-style content

**Key Features**:
- Azure Neural Voices integration
- Multi-speaker dialogue generation
- SSML markup for natural speech
- Audio format optimization
- Streaming response support

**Implementation**:
```python
class TTSService:
    def generate_podcast(self, content: str, speakers: List[str]) -> AudioResponse:
        # Content segmentation for speakers
        # SSML generation with timing
        # Azure TTS API integration
        # Audio concatenation and optimization
```

## Configuration

### Environment Variables

#### Core Configuration
```python
class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./synapse.db"
    
    # Adobe PDF Embed API
    ADOBE_CLIENT_ID: Optional[str] = None
    ADOBE_EMBED_API_KEY: Optional[str] = None
    
    # Vector Search Configuration
    FAISS_INDEX_PATH: str = "./data/faiss_index/index.faiss"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    
    # LLM Configuration
    LLM_PROVIDER: str = "gemini"
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # TTS Configuration
    TTS_PROVIDER: str = "azure"
    AZURE_TTS_KEY: Optional[str] = None
    AZURE_TTS_REGION: Optional[str] = None
    AZURE_TTS_ENDPOINT: Optional[str] = None
```

#### Production Optimization
```python
    # Performance Tuning
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
    CHUNK_SIZE: int = 1000
    SIMILARITY_THRESHOLD: float = 0.3
    MAX_SEARCH_RESULTS: int = 50
    
    # Security Configuration
    CORS_ORIGINS: List[str] = ["https://synapse-docs-833062842245.us-central1.run.app"]
    SESSION_TIMEOUT: int = 3600  # 1 hour
```

### Dependency Management

**Production Dependencies**:
- FastAPI ecosystem with async support
- Database drivers with connection pooling
- ML libraries with CPU optimization
- Security middleware for production

**Development Dependencies**:
- Testing frameworks (pytest, httpx)
- Code quality tools (black, isort, mypy)
- Documentation generators (sphinx)
- Development servers with hot reload

## Development Setup

### Local Development

1. **Create Virtual Environment**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

4. **Initialize Database**
   ```bash
   python -c "from app.core.database import engine; from app.models.document import *; from sqlmodel import SQLModel; SQLModel.metadata.create_all(engine)"
   ```

5. **Start Development Server**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
   ```

### Container Development

```bash
# Build development image
docker build -t synapse-backend:dev -f Dockerfile.dev .

# Run with hot reload
docker run -v $(pwd):/app -p 8080:8080 synapse-backend:dev
```

## Testing

### Test Structure

```
tests/
├── api/                    # API endpoint tests
├── services/              # Service layer tests
├── models/                # Database model tests
├── integration/           # End-to-end tests
├── fixtures/              # Test data and fixtures
└── conftest.py           # Pytest configuration
```

### Running Tests

```bash
# Unit tests
pytest tests/unit/

# Integration tests
pytest tests/integration/

# Coverage report
pytest --cov=app --cov-report=html

# Performance tests
pytest tests/performance/ -v
```

### Test Examples

```python
# API Endpoint Test
async def test_document_upload(client: TestClient, sample_pdf: bytes):
    response = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.pdf", sample_pdf, "application/pdf")}
    )
    assert response.status_code == 200
    assert "document_id" in response.json()

# Service Layer Test
def test_embedding_generation(embedding_service: EmbeddingService):
    texts = ["Sample text for testing", "Another test document"]
    embeddings = embedding_service.generate_embeddings(texts)
    assert embeddings.shape == (2, 384)
    assert np.allclose(np.linalg.norm(embeddings, axis=1), 1.0)  # Normalized
```

## Performance

### Optimization Strategies

#### Database Optimization
- **Indexing**: Strategic indexes on frequently queried fields
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Optimized SQLModel queries with eager loading

#### Vector Search Optimization
- **Index Type**: FAISS IndexFlatIP for exact cosine similarity
- **Batch Processing**: Vectorized operations for multiple queries
- **Memory Management**: Efficient index loading and caching

#### API Performance
- **Async Processing**: Non-blocking I/O operations
- **Response Compression**: GZIP compression for large responses
- **Caching**: Redis integration for frequently accessed data

### Performance Metrics

| Operation | Target Latency | Throughput |
|-----------|---------------|------------|
| Document Upload | < 30 seconds | 10 MB/s |
| Semantic Search | < 500ms | 100 RPS |
| Insights Generation | < 5 seconds | 20 RPS |
| Audio Generation | < 10 seconds | 5 RPS |

### Monitoring

```python
# Performance monitoring middleware
@app.middleware("http")
async def performance_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    # Log slow requests
    if process_time > 1.0:
        logger.warning(f"Slow request: {request.url} took {process_time:.2f}s")
    
    return response
```

---

**Technical Implementation**: FastAPI + FAISS + Gemini 2.5 Flash | **Performance**: Sub-second semantic search | **Scalability**: Horizontal scaling ready
