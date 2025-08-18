# Synapse-Docs

> An intelligent document experience platform that transforms static PDFs into interactive, queryable knowledge bases with real-time semantic connections and AI-powered insights.

## Table of Contents

- [Overview](#overview)
- [Problem & Solution](#problem--solution)
- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Environment Configuration](#environment-configuration)
- [API Documentation](#api-documentation)
- [Live Demo](#live-demo)
- [Development](#development)
- [Contributing](#contributing)

## Overview

Synapse-Docs is a comprehensive document intelligence platform built for the Adobe India Hackathon 2025 Grand Finale. It combines advanced PDF processing capabilities with semantic search and AI-powered insights to create an immersive document reading experience that connects information across multiple documents in real-time.

The platform implements a sophisticated pipeline that processes PDFs through a 4-stage extraction system, generates semantic embeddings using sentence transformers, and provides instant cross-document connections when users select text segments.

## Problem & Solution

### Problem
Researchers, students, and professionals deal with large volumes of documents daily but struggle to:
- Remember details across multiple documents
- Identify connections between related concepts
- Surface contradictory or supporting evidence quickly
- Generate contextual insights from their personal document library

### Solution
Synapse-Docs provides:
- **Instant Semantic Connections**: Real-time linking of selected text to relevant sections across all uploaded documents
- **AI-Powered Insights**: Context-aware analysis that identifies contradictions, examples, and key takeaways
- **Immersive PDF Experience**: High-fidelity PDF rendering with interactive text selection and progressive disclosure
- **Audio Overviews**: Generated podcast-style summaries for on-the-go consumption

## Core Features

### Mandatory Features (Adobe Hackathon 2025)

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **PDF Handling** | Bulk upload and high-fidelity rendering | Adobe PDF Embed API integration |
| **Connecting the Dots** | Semantic search across documents | FAISS vector database with all-MiniLM-L6-v2 embeddings |
| **Speed Optimization** | Sub-second response times | Optimized vector indexing and caching |

### Bonus Features (+10 Points)

| Feature | Points | Description | Status |
|---------|--------|-------------|---------|
| **Insights Bulb** | +5 | AI-generated contextual insights using Gemini 2.5 Flash | ✅ Implemented |
| **Audio Overview/Podcast** | +5 | Multi-speaker audio generation with Azure TTS | ✅ Implemented |

### Advanced UI/UX Features

- **Document Workbench**: Immersive PDF viewing with Context Lens and Action Halo
- **Synapse Panel**: Tabbed interface for connections and insights with structured display
- **Flow Status Bar**: Visual workflow tracking with step-by-step progress indication
- **Knowledge Graph Modal**: Interactive force-directed graph of document relationships
- **Breadcrumb Trail**: Navigation history for document exploration paths

## Technology Stack

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| **API Framework** | FastAPI | High-performance async API with auto-documentation |
| **Database** | SQLModel + SQLite | Type-safe ORM with development simplicity |
| **Vector Search** | FAISS | High-performance similarity search and clustering |
| **Embeddings** | SentenceTransformers | all-MiniLM-L6-v2 for semantic understanding |
| **LLM Integration** | Gemini 2.5 Flash | AI insights generation |
| **TTS Engine** | Azure Text-to-Speech | Multi-speaker audio generation |
| **PDF Processing** | PyMuPDF + Custom CRF | 4-stage extraction pipeline |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | React 18 + Vite | Modern development with fast HMR |
| **PDF Rendering** | Adobe PDF Embed API | High-fidelity document display |
| **Graph Visualization** | react-force-graph-2d | Interactive knowledge graphs |
| **HTTP Client** | Axios | API communication with session management |
| **Styling** | CSS Modules | Component-scoped styling |

### DevOps
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Containerization** | Docker | Portable deployment |
| **Cloud Platform** | Google Cloud Run | Serverless container hosting |
| **CI/CD** | Cloud Build | Automated build and deployment |
| **Monitoring** | Built-in Health Checks | System status monitoring |

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Adobe PDF Embed API credentials (optional but recommended)
- Google API key for Gemini LLM (for insights feature)
- Azure TTS credentials (for audio features)

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd synapse-docs
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API credentials
   ```

3. **Start the application**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Open http://localhost:8080
   - Upload your first PDF documents
   - Select text to see semantic connections

### Using Adobe Hackathon Evaluation Format

```bash
# Build the Docker image
docker build --platform linux/amd64 -t synapse-docs:final .

# Run with full feature set
docker run \
  -v /path/to/credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=<YOUR_API_KEY> \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<TTS_KEY> \
  -e AZURE_TTS_ENDPOINT=<TTS_ENDPOINT> \
  -p 8080:8080 \
  synapse-docs:final
```

## Production Deployment

The application is deployed on Google Cloud Run with automatic CI/CD:

**Live Demo**: https://synapse-docs-833062842245.us-central1.run.app/

### Deployment Architecture
- **Cloud Build**: Automated Docker image building
- **Container Registry**: Image storage and versioning
- **Cloud Run**: Serverless container hosting with auto-scaling
- **Persistent Storage**: Document and vector index persistence

## Architecture

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │   External      │
│   (React)       │◄──►│   (FastAPI)      │◄──►│   Services      │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • PDF Embed     │    │ • Document CRUD  │    │ • Adobe PDF API │
│ • Synapse Panel │    │ • Semantic Search│    │ • Gemini LLM    │
│ • Force Graph   │    │ • Vector DB      │    │ • Azure TTS     │
│ • Audio Player  │    │ • LLM Service    │    │ • Storage       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Processing Pipeline
```
PDF Upload → Content Extraction → Semantic Chunking → Vector Embedding → FAISS Index
     ↓              ↓                    ↓               ↓             ↓
File Storage → Text Chunks → Heading Detection → Embeddings → Search Ready
```

### Real-time Connection Flow
```
Text Selection → Semantic Query → Vector Search → Result Ranking → UI Display
     ↓               ↓              ↓              ↓            ↓
User Action → Embedding Gen → FAISS Lookup → Score Filter → Live Updates
```

## Project Structure

```
synapse-docs/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/v1/            # API endpoints
│   │   ├── core/              # Configuration and database
│   │   ├── crud/              # Database operations
│   │   ├── models/            # SQLModel schemas
│   │   ├── schemas/           # Pydantic models
│   │   └── services/          # Business logic
│   ├── data/                  # Persistent storage
│   └── requirements.txt
├── frontend/                  # React application
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── api/              # HTTP client
│   │   └── services/         # Frontend services
│   └── package.json
├── Dockerfile                 # Multi-stage container build
├── docker-compose.yml         # Development environment
└── cloudbuild.yaml           # Production CI/CD
```

## Environment Configuration

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `ADOBE_EMBED_API_KEY` | PDF rendering | `your_adobe_key` |
| `GOOGLE_API_KEY` | LLM insights | `your_gemini_key` |
| `AZURE_TTS_KEY` | Audio generation | `your_azure_key` |
| `DATABASE_URL` | Data persistence | `sqlite:///./synapse.db` |

### Optional Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_PROVIDER` | `gemini` | LLM service selection |
| `TTS_PROVIDER` | `azure` | Text-to-speech service |
| `EMBEDDING_MODEL_NAME` | `all-MiniLM-L6-v2` | Sentence transformer model |
| `CORS_ORIGINS` | `localhost` | Cross-origin request handling |

## API Documentation

### Interactive Documentation
- **Swagger UI**: http://localhost:8080/docs
- **ReDoc**: http://localhost:8080/redoc
- **OpenAPI Schema**: http://localhost:8080/openapi.json

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/documents/upload` | POST | Upload PDF documents |
| `/api/v1/search/semantic` | POST | Semantic text search |
| `/api/v1/insights` | POST | Generate AI insights |
| `/api/v1/podcast` | POST | Create audio overview |
| `/api/v1/graph/connectivity` | GET | Document relationship graph |
| `/api/v1/system/health` | GET | System health status |

## Live Demo

**Production URL**: https://synapse-docs-833062842245.us-central1.run.app/

### Demo Flow
1. **Upload Documents**: Bulk upload your PDF research papers or documents
2. **Open a Document**: Click on any document to start reading
3. **Select Text**: Highlight any paragraph or phrase of interest
4. **See Connections**: View related sections from other documents instantly
5. **Generate Insights**: Click the lightbulb for AI-powered analysis
6. **Create Audio**: Generate podcast-style overviews for mobile listening

## Development

### Local Development Setup

1. **Backend Development**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
   ```

2. **Frontend Development**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Testing

```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd frontend
npm test

# Integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Performance Optimization

- **Vector Search**: FAISS indexing with optimized similarity thresholds
- **Caching**: Redis integration for frequently accessed embeddings
- **Batch Processing**: Async document processing pipeline
- **CDN Integration**: Static asset optimization for production

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- **Backend**: Follow PEP 8 with Black formatting
- **Frontend**: ESLint + Prettier configuration
- **Documentation**: Comprehensive docstrings and type hints
- **Testing**: Minimum 80% code coverage

---

**Built for Adobe India Hackathon 2025 Grand Finale** | **Team**: Synapse Labs | **Challenge**: From Brains to Experience – Make It Real
