# Synapse-Docs

> An intelligent document experience platform that transforms static PDFs into interactive, queryable knowledge bases with AI-powered insights and semantic connections.

## Table of Contents

- [Overview](#overview)
- [Problem & Solution](#problem--solution)
- [Live Demo](#live-demo)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Performance Specifications](#performance-specifications)

## Overview

Synapse-Docs is a full-stack web application built for the Adobe India Hackathon 2025 Grand Finale. It implements a sophisticated document intelligence system that enables users to upload PDF documents, view them with high fidelity, select text passages, and instantly discover related content across their entire document library. The platform leverages advanced AI capabilities including semantic search, knowledge graph visualization, contextual insights generation, and audio podcast creation.

## Problem & Solution

**Problem**: Users managing large document collections struggle to remember details and connect insights across multiple PDFs, leading to information silos and missed connections.

**Solution**: Synapse-Docs creates an intelligent document ecosystem where:
- Text selection automatically surfaces related content across documents
- AI generates contextual insights and cross-document analysis
- Interactive knowledge graphs visualize document relationships
- Audio podcasts provide on-the-go consumption of insights

## Live Demo

**Production Application**: [https://synapse-docs-833062842245.us-central1.run.app/](https://synapse-docs-833062842245.us-central1.run.app/)

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18 + Vite | Interactive user interface |
| **PDF Rendering** | Adobe PDF Embed API | High-fidelity PDF viewing |
| **Backend** | Python FastAPI | REST API and business logic |
| **Database** | SQLite + SQLModel | Document metadata storage |
| **Vector Search** | Faiss + Sentence Transformers | Semantic similarity search |
| **AI/LLM** | Google Gemini 2.5 Flash | Insights and content generation |
| **Text-to-Speech** | Azure Cognitive Services | Audio podcast generation |
| **Knowledge Graph** | React Force Graph 2D | Interactive relationship visualization |
| **Containerization** | Docker | Deployment and isolation |
| **Cloud Platform** | Google Cloud Run | Production hosting |
| **CI/CD** | Google Cloud Build | Automated deployment |

## System Architecture

### Three-Panel "Cockpit" Design

```
┌─────────────────┬─────────────────────┬─────────────────┐
│   Workspace     │      Workbench      │     Synapse     │
│  (Left Panel)   │   (Center Panel)    │  (Right Panel)  │
├─────────────────┼─────────────────────┼─────────────────┤
│ Document        │ PDF Viewer with     │ Connections &   │
│ Library         │ Text Selection      │ Insights        │
│                 │ & Action Halo       │                 │
│ • Upload PDFs   │ • Adobe Embed API   │ • Related Text  │
│ • Manage Docs   │ • Context Lens      │ • AI Insights   │
│ • Quick Access  │ • Breadcrumb Trail  │ • Audio Podcast │
│                 │ • Page Navigation   │ • Knowledge Graph│
└─────────────────┴─────────────────────┴─────────────────┘
```

### Data Processing Pipeline

```
PDF Upload → Document Parser → Text Extraction → Embedding Generation → Vector Storage
                ↓
Knowledge Graph Generation ← Semantic Search ← User Text Selection
                ↓
AI Insights & Audio Generation ← Context Assembly ← Related Content Retrieval
```

## Key Features

### Core Functionality
- **High-Fidelity PDF Rendering**: Adobe PDF Embed API integration with zoom, pan, and navigation
- **Intelligent Text Selection**: Real-time semantic search triggered by user text selection
- **Cross-Document Connections**: Automatic discovery of related content across document library
- **Breadcrumb Navigation**: Trail-based navigation system for exploration tracking

### Advanced AI Features
- **Contextual Insights**: LLM-powered analysis generating takeaways, contradictions, and examples
- **Audio Podcasts**: Multi-speaker TTS generation creating engaging audio overviews
- **Knowledge Graph**: Interactive visualization of document relationships and themes
- **Semantic Search**: Vector-based similarity matching using sentence transformers

### Technical Features
- **Session Management**: Isolated user sessions with persistent state
- **Performance Optimization**: Sub-second response times for text selection
- **Scalable Architecture**: Cloud-native design with auto-scaling capabilities
- **Docker Containerization**: Single-command deployment with all dependencies

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/sooravali/synapse-docs.git
cd synapse-docs

# Build the Docker image
docker build --platform linux/amd64 -t synapse-docs:latest .

# Run with environment variables
docker run \
  -e ADOBE_EMBED_API_KEY=your_adobe_key \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/service-account.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=your_azure_key \
  -e AZURE_TTS_ENDPOINT=your_azure_endpoint \
  -p 8080:8080 \
  synapse-docs:latest
```

**Access the application**: [http://localhost:8080](http://localhost:8080)

### Local Development

```bash
# Backend setup
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

## Deployment

### Google Cloud Run (Production)

The application is deployed using Google Cloud Build with automatic CI/CD:

```bash
# Configure Google Cloud
gcloud config set project synapse-docs-468420
gcloud builds submit --config cloudbuild.yaml
```

**Configuration Features**:
- Auto-scaling (0-2 instances)
- 8GB memory allocation
- Cloud Storage integration
- Secret management for API keys
- Load balancing and SSL termination

### Environment Configuration

| Variable | Purpose | Required |
|----------|---------|----------|
| `ADOBE_EMBED_API_KEY` | PDF rendering service | Optional |
| `LLM_PROVIDER` | AI service provider | Required |
| `GOOGLE_APPLICATION_CREDENTIALS` | Gemini API access | Required |
| `AZURE_TTS_KEY` | Text-to-speech service | Required |
| `AZURE_TTS_ENDPOINT` | TTS endpoint URL | Required |

## API Documentation

### Interactive Documentation
- **Swagger UI**: [http://localhost:8080/docs](http://localhost:8080/docs)
- **ReDoc**: [http://localhost:8080/redoc](http://localhost:8080/redoc)
- **OpenAPI Spec**: [http://localhost:8080/openapi.json](http://localhost:8080/openapi.json)

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/documents/upload` | POST | Upload and process PDFs |
| `/api/v1/search/semantic` | POST | Semantic text search |
| `/api/v1/insights/generate` | POST | Generate AI insights |
| `/api/v1/insights/podcast` | POST | Create audio podcasts |
| `/api/v1/graph/connectivity` | GET | Knowledge graph data |

## Project Structure

```
synapse-docs/
├── backend/                 # FastAPI backend application
│   ├── app/
│   │   ├── api/v1/         # API route definitions
│   │   ├── core/           # Configuration and database
│   │   ├── crud/           # Database operations
│   │   ├── models/         # Data models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic services
│   ├── data/               # Storage directories
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api/           # API client functions
│   │   └── services/      # Frontend services
│   └── package.json       # Node.js dependencies
├── Dockerfile             # Container configuration
├── cloudbuild.yaml        # Google Cloud Build config
└── README.md              # This file
```

## Performance Specifications

### Response Times
- **Text Selection to Results**: < 500ms
- **Document Upload Processing**: < 30s per document
- **Insight Generation**: < 10s
- **Audio Podcast Generation**: < 60s

### Scalability
- **Concurrent Users**: Up to 10 per Cloud Run instance
- **Document Storage**: Cloud Storage with unlimited capacity
- **Vector Index**: In-memory Faiss with fast similarity search
- **Auto-scaling**: 0-2 instances based on traffic

### System Requirements
- **Memory**: 8GB per instance
- **CPU**: 2 vCPUs per instance
- **Docker Image Size**: ~4GB (optimized from 12GB)
- **Storage**: Persistent Cloud Storage volumes

---

**For detailed component documentation**:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)

**Hackathon Submission**: Adobe India Hackathon 2025 Grand Finale - "Connecting the Dots Challenge"
