# Synapse: Intelligent Document Experience Platform

**Adobe India Hackathon 2025 - Grand Finale Submission**  
**Team**: Connect the Dots Challenge  
**Theme**: From Brains to Experience – Make It Real

## Table of Contents

- [Project Overview](#project-overview)
- [Adobe Hackathon 2025 Compliance](#adobe-hackathon-2025-compliance)
- [Architecture Overview](#architecture-overview)
- [Core Features](#core-features)
- [Innovative Features](#innovative-features)
- [Technology Stack](#technology-stack)
- [Installation and Setup](#installation-and-setup)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Performance and Scalability](#performance-and-scalability)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Team and Credits](#team-and-credits)

## Project Overview

Synapse transforms static PDF documents into interactive, queryable knowledge bases through advanced AI and machine learning. Built specifically for the Adobe Hackathon 2025 "Connecting the Dots" challenge, it addresses the core problem of information overload that researchers, students, and professionals face when managing large document libraries.

### The Problem We Solve

Users dealing with extensive document collections struggle to:
- Remember details across multiple documents
- Find connections between related concepts
- Extract actionable insights from dense content
- Navigate efficiently through document relationships

### Our Solution

Synapse provides an intelligent document experience that:
- **Connects the Dots**: Automatically surfaces related content across your document library
- **Accelerates Understanding**: Generates AI-powered insights and contextual analysis
- **Enhances Engagement**: Creates natural-sounding audio overviews and podcasts
- **Preserves Context**: Maintains breadcrumb trails of your exploration journey

## Adobe Hackathon 2025 Compliance

### Challenge Requirements Fulfillment

#### Core Features (Mandatory)

**PDF Handling**
- ✅ **Bulk Upload**: Multi-file upload with session-based organization
- ✅ **Fresh Upload**: Individual document processing with real-time status
- ✅ **High-Fidelity Display**: Adobe PDF Embed API integration with full zoom/pan support

**Connecting the Dots**
- ✅ **Semantic Search**: Identifies up to 5 relevant sections across PDFs with high accuracy
- ✅ **Section-Based Results**: Logical document sections based on heading hierarchy
- ✅ **Smart Snippets**: 2-4 sentence extracts with contextual relevance
- ✅ **Navigation Integration**: Click-to-navigate functionality with page targeting

**Speed Optimization**
- ✅ **Fast Search**: Sub-second semantic search using optimized Faiss vector database
- ✅ **Real-time Updates**: Background processing with live status updates
- ✅ **Efficient Ingestion**: Optimized Challenge 1A/1B pipeline integration

#### Follow-On Features (Bonus Points)

**Insights Bulb (+5 points)**
- ✅ **LLM-Powered Analysis**: Google Gemini integration for sophisticated insights
- ✅ **Key Takeaways**: Structured analysis with main points extraction
- ✅ **Contradictions**: Cross-document conflict identification
- ✅ **Examples**: Relevant example extraction and analysis
- ✅ **Cross-Document Inspirations**: Creative connections between different sources

**Audio Overview / Podcast Mode (+5 points)**
- ✅ **Multi-Speaker Podcasts**: 2-5 minute conversations between Pooja (Host) and Arjun (Analyst)
- ✅ **Azure TTS Integration**: High-quality voice synthesis using Azure Cognitive Services
- ✅ **Context-Aware Content**: Based on selected text, related sections, and generated insights
- ✅ **Natural Dialogue**: Structured conversation flow with distinct speaker personalities

### Environment Variables Compliance

```bash
# Required Adobe Hackathon Environment Variables
ADOBE_EMBED_API_KEY=<ADOBE_EMBED_API_KEY>
LLM_PROVIDER=gemini
GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json
GEMINI_MODEL=gemini-2.5-flash
TTS_PROVIDER=azure
AZURE_TTS_KEY=<AZURE_TTS_KEY>
AZURE_TTS_ENDPOINT=<AZURE_TTS_ENDPOINT>
```

### Sample Scripts Integration

**Included Adobe Sample Scripts**:
- `backend/chat_with_llm.py` - LLM integration following hackathon requirements
- `backend/generate_audio.py` - TTS functionality using Azure services
- `backend/requirements.txt` - Dependencies aligned with sample script requirements

### Docker Compliance

**Build Command**:
```bash
docker build --platform linux/amd64 -t synapse-docs:final .
```

**Run Command**:
```bash
docker run -v /path/to/credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=<ADOBE_EMBED_API_KEY> \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<AZURE_TTS_KEY> \
  -e AZURE_TTS_ENDPOINT=<AZURE_TTS_ENDPOINT> \
  -p 8080:8080 synapse-docs:final
```

**Accessibility**: Application runs on `http://localhost:8080`

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Synapse Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │   React     │    │   FastAPI   │    │    External Services    │  │
│  │  Frontend   │◄──►│   Backend   │◄──►│                         │  │
│  │             │    │             │    │ • Adobe PDF Embed API  │  │
│  │ • Three-    │    │ • Challenge │    │ • Google Gemini (LLM)   │  │
│  │   Panel UI  │    │   1A Logic  │    │ • Azure TTS             │  │
│  │ • Adobe PDF │    │ • Challenge │    │                         │  │
│  │   Embed     │    │   1B Logic  │    └─────────────────────────┘  │
│  │ • Real-time │    │ • Vector    │                                 │
│  │   Updates   │    │   Database  │                                 │
│  └─────────────┘    │ • AI/ML     │                                 │
│                     │   Services  │                                 │
│                     └─────────────┘                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        Data Layer                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │   SQLite    │    │    Faiss    │    │    File Storage         │  │
│  │  Database   │    │   Vector    │    │                         │  │
│  │             │    │   Index     │    │ • PDF Files             │  │
│  │ • Documents │    │             │    │ • Audio Files           │  │
│  │ • Text      │    │ • Session-  │    │ • Cache Data            │  │
│  │   Chunks    │    │   Aware     │    │ • Temporary Files       │  │
│  │ • Metadata  │    │ • High-     │    │                         │  │
│  │             │    │   Speed     │    │                         │  │
│  └─────────────┘    │   Search    │    └─────────────────────────┘  │
│                     └─────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Two-Stage Workflow Design

#### Stage 1: Connections Workflow (Real-time & Automatic)
```
User Reading → Context Detection → Semantic Search → Connection Display
     ↓              ↓                    ↓               ↓
   Scroll       Extract Text      Find Related     Update Right Panel
  Position      from Viewport     Content Auto-    with Connections
                                 matically
```

#### Stage 2: Insights Workflow (On-Demand & Explicit)
```
Text Selection → Action Halo → User Choice → AI Processing → Rich Output
      ↓             ↓            ↓             ↓             ↓
   User Selects   Show Action   Insights or   LLM/TTS      Display Results
   Specific Text   Buttons      Podcast       Generation   with Media
```

### Component Architecture

#### Frontend (React)
- **App.jsx**: Main orchestrator with two-stage workflow management
- **DocumentLibrary.jsx**: Document management and upload interface
- **DocumentWorkbench.jsx**: PDF viewer with Adobe Embed API integration
- **SynapsePanel.jsx**: AI-powered connections and insights display
- **FlowStatusBar.jsx**: Visual workflow progress indicator
- **Specialized Components**: Knowledge graph, breadcrumbs, audio player

#### Backend (FastAPI)
- **API Layer**: RESTful endpoints with comprehensive error handling
- **Service Layer**: Business logic and external integrations
- **Data Layer**: Database operations and file management
- **Core Services**: Document parsing, embedding generation, vector search

## Core Features

### Intelligent Document Processing

#### Challenge 1A Integration - Advanced PDF Processing
Our system implements the complete 4-stage processing pipeline from the winning Challenge 1A submission:

**Stage 1: Embedded TOC Detection**
- Fast-path extraction for documents with embedded table of contents
- Significantly improves processing speed for structured documents

**Stage 2: Deep Content & Layout Analysis**
- **Primary Engine**: PyMuPDF for high-fidelity text extraction
- **Fallback Engine**: PDFMiner for complex layouts
- Font size, weight, and positioning analysis
- Spatial relationship detection

**Stage 3: ML Classification**
- **CRF-based Heading Detection**: Conditional Random Fields for structural analysis
- **Confidence Scoring**: Each classification includes reliability metrics
- **Feature Engineering**: Advanced feature extraction from layout data

**Stage 4: Hierarchical Reconstruction**
- Document structure building from classified elements
- Section boundary detection
- Content quality assessment

#### Challenge 1B Integration - Semantic Understanding
Sophisticated semantic analysis using the proven Challenge 1B approach:

**Core Technologies**:
- **Model**: Sentence Transformers all-MiniLM-L6-v2 (384-dimensional embeddings)
- **Vector Database**: Faiss with session-aware indexing
- **Similarity Computation**: Cosine similarity with intelligent thresholding

**Advanced Capabilities**:
- **Batch Processing**: Optimized for large document sets (32 texts per batch)
- **Intelligent Caching**: Hash-based embedding cache with LRU eviction
- **Semantic Clustering**: Automatic content organization and relationship detection

### Real-Time Connection Discovery

#### Automatic Content Linking
The system continuously monitors user reading behavior and automatically discovers connections:

```javascript
// Reading detection triggers semantic search
const handleContextChange = (context) => {
  // Stage 1: Automatic semantic search
  findRelatedContent(context.text, excludeCurrentDocument)
    .then(connections => updateConnectionsPanel(connections))
    .catch(error => handleConnectionError(error));
};
```

#### Smart Relevance Scoring
Each connection includes multiple relevance indicators:
- **Semantic Similarity**: Vector-based similarity scores
- **Content Quality**: Extraction confidence and text quality metrics
- **Context Relevance**: Relationship to current reading position
- **Cross-Document Insights**: Novel connections between different sources

### AI-Powered Insights Generation

#### LLM Integration (Google Gemini)
Advanced insights generation using Google Gemini 2.5 Flash:

**Insight Categories**:
- **Key Takeaways**: Main points and critical information extraction
- **Contradictions**: Identification of conflicting information across documents
- **Examples**: Relevant examples and case studies
- **Cross-Document Inspirations**: Creative connections and novel insights

**Processing Pipeline**:
```python
async def generate_insights(selected_text, related_connections):
    # 1. Perform semantic search for Top 5 relevant snippets
    # 2. Structure LLM prompt with context and connections
    # 3. Generate insights using Gemini 2.5 Flash
    # 4. Parse and format structured response
    # 5. Return with citations and confidence scores
```

#### Structured Output Format
```json
{
  "insights": {
    "key_takeaways": ["Point 1", "Point 2", "Point 3"],
    "contradictions": ["Conflict 1", "Conflict 2"],
    "examples": ["Example 1", "Example 2"],
    "cross_document_inspirations": ["Connection 1", "Connection 2"]
  },
  "citations": ["Source 1", "Source 2"],
  "confidence_score": 0.89
}
```

### Multi-Speaker Podcast Generation

#### Azure TTS Integration
High-quality audio generation using Azure Cognitive Services:

**Speaker Configuration**:
- **Pooja (Host)**: en-US-JennyNeural - Warm, engaging voice for introductions and transitions
- **Arjun (Analyst)**: en-US-GuyNeural - Professional, analytical voice for technical content

**Generation Pipeline**:
```python
async def generate_podcast_audio(script):
    # 1. Parse script for speaker roles (Pooja/Arjun)
    # 2. Generate individual voice segments with rate limiting
    # 3. Apply sophisticated audio concatenation using FFmpeg
    # 4. Return final audio file with metadata
```

#### Script Structure
```
Pooja: Welcome to today's analysis of [TOPIC]. We're exploring some fascinating insights from your document library.

Arjun: Thank you, Pooja. I've identified several key connections that I think will interest our listeners...

[Natural dialogue continues with insights and analysis]
```

### Advanced Navigation System

#### Breadcrumb Trail Technology
Unique navigation feature that tracks user exploration paths:

**Trail Management**:
- **Smart Deduplication**: Prevents consecutive duplicate entries
- **Context Preservation**: Stores reading context for each trail point
- **Intelligent Truncation**: Removes future items when navigating to past locations

**Navigation Features**:
```javascript
const navigateToBreadcrumbItem = async (trailItem) => {
  // 1. Determine if document switch is required
  // 2. Calculate appropriate timing delays
  // 3. Execute navigation with PDF viewer API
  // 4. Truncate trail to maintain logical flow
};
```

## Innovative Features

### Synapse View Breadcrumbs (Trail Path)

A groundbreaking navigation system that tracks the user's intellectual journey through documents:

**Concept**: Unlike traditional browsing history, the breadcrumb trail captures the semantic journey of discovery, allowing users to retrace their thought process and return to previous insights.

**Implementation**:
- **Contextual Capture**: Each breadcrumb includes the reading context and page location
- **Visual Representation**: Clean, intuitive display of the exploration path
- **Smart Navigation**: One-click return to any previous point in the journey
- **Trail Truncation**: Intelligent removal of future items when backtracking

### Flow Status Bar

A professional workflow indicator that shows users exactly where they are in the document analysis process:

**Three-Stage Visualization**:
1. **Upload Stage**: Building document library
2. **Connect Stage**: Automatic connection discovery in progress
3. **Generate Stage**: Ready for insights and podcast generation

**Visual Design**:
- **Completed**: Solid blue circles with white icons
- **Active**: Blue outline with prominent blue icon
- **Pending**: Gray outline indicating future steps

**Responsive Behavior**:
- **Horizontal Layout**: For standard desktop viewing
- **Vertical Layout**: For compact sidebar display
- **Tooltip Integration**: Contextual help for each stage

### Context Lens Technology

An invisible but powerful feature that automatically understands what users are reading:

**Reading Detection**:
- **Viewport Analysis**: Continuous monitoring of visible PDF content
- **Content Extraction**: Intelligent text extraction from current view
- **Context Understanding**: Semantic analysis of reading focus

**Automatic Triggering**:
- **Stage 1 Workflow**: Seamlessly triggers connection discovery
- **Background Processing**: No user interaction required
- **Performance Optimized**: Minimal impact on reading experience

### Action Halo Interface

A contextual interaction system that appears when users select text:

**Progressive Disclosure**:
- **Smart Positioning**: Optimal placement avoiding viewport edges
- **Context-Aware Actions**: Different options based on selection type
- **Visual Feedback**: Clear indication of available interactions

**Action Categories**:
- **Insights Generation**: Deep AI analysis of selected content
- **Podcast Creation**: Audio content generation
- **Connection Discovery**: Related content identification
- **Knowledge Graph**: Visual relationship mapping

## Technology Stack

### Frontend Technologies

**Core Framework**:
- **React 18.2.0**: Modern component-based architecture with hooks
- **Vite 5.0.8**: Fast development server and optimized builds
- **Lucide React 0.539.0**: Consistent icon library

**PDF Integration**:
- **Adobe PDF Embed API**: High-fidelity PDF rendering and interaction
- **Custom Event Handling**: Advanced text selection and navigation

**Visualization**:
- **react-force-graph-2d 1.28.0**: Interactive knowledge graph visualization
- **Custom CSS Grid**: Responsive three-panel layout system

**HTTP Client**:
- **Axios 1.6.0**: Robust API communication with interceptors

### Backend Technologies

**Web Framework**:
- **FastAPI 0.116.1**: High-performance async API framework
- **Uvicorn 0.35.0**: ASGI server with WebSocket support
- **Gunicorn 21.2.0**: Production WSGI server

**Database & ORM**:
- **SQLModel 0.0.24**: Type-safe database operations
- **SQLite**: Embedded database for development and deployment
- **Pydantic 2.11.7**: Data validation and serialization

**Machine Learning & AI**:
- **Sentence Transformers 3.0.1**: Semantic embedding generation
- **Faiss CPU 1.8.0**: High-performance vector similarity search
- **scikit-learn 1.5.2**: Machine learning utilities
- **NumPy 1.26.4**: Numerical computing foundation

**PDF Processing**:
- **PyMuPDF (fitz)**: Primary PDF processing engine
- **PDFMiner.six 20250506**: Fallback PDF text extraction

**External Service Integration**:
- **Google Cloud AI Platform 1.60.0**: Gemini LLM integration
- **Vertex AI 1.60.0**: Enterprise-grade ML platform
- **Azure Cognitive Services Speech 1.34.0**: Text-to-speech synthesis
- **LangChain 0.3.15**: LLM orchestration framework

**HTTP & Communication**:
- **httpx 0.28.1**: Async HTTP client for external APIs
- **requests 2.32.3**: Synchronous HTTP operations

### Infrastructure

**Containerization**:
- **Docker**: Multi-stage builds for optimal image size
- **Docker Compose**: Development environment orchestration

**Development Tools**:
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Git**: Version control with feature branching

## Installation and Setup

### Quick Start (Docker - Recommended)

**1. Clone Repository**:
```bash
git clone https://github.com/sooravali/synapse-docs.git
cd synapse-docs
```

**2. Build Docker Image**:
```bash
docker build --platform linux/amd64 -t synapse-docs:final .
```

**3. Run Application**:
```bash
docker run -v /path/to/credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=your-adobe-key \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=your-azure-key \
  -e AZURE_TTS_ENDPOINT=your-azure-endpoint \
  -p 8080:8080 synapse-docs:final
```

**4. Access Application**:
Open `http://localhost:8080` in your web browser.

### Development Setup

#### Backend Development

**1. Setup Python Environment**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**2. Configure Environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

**3. Run Development Server**:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Development

**1. Setup Node.js Environment**:
```bash
cd frontend
npm install
```

**2. Start Development Server**:
```bash
npm run dev
```

**3. Access Development Environment**:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`

### Environment Configuration

#### Required Environment Variables

```bash
# Adobe PDF Embed API (Optional but recommended)
ADOBE_EMBED_API_KEY=your-adobe-embed-api-key

# LLM Configuration (Required for insights)
LLM_PROVIDER=gemini
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GEMINI_MODEL=gemini-2.5-flash

# Alternative LLM Providers
# OPENAI_API_KEY=your-openai-key
# AZURE_OPENAI_KEY=your-azure-openai-key

# TTS Configuration (Required for podcasts)
TTS_PROVIDER=azure
AZURE_TTS_KEY=your-azure-tts-key
AZURE_TTS_ENDPOINT=your-azure-tts-endpoint

# Database Configuration
DATABASE_URL=sqlite:///./synapse.db

# File Processing Limits
MAX_FILE_SIZE_MB=500
CHUNK_BATCH_SIZE=50
EMBEDDING_BATCH_SIZE=32
```

#### Optional Configuration

```bash
# Performance Tuning
FAISS_INDEX_PATH=./data/faiss_index/index.faiss
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
SIMILARITY_THRESHOLD=0.7

# Audio Configuration
AZURE_TTS_HOST_VOICE=en-US-JennyNeural
AZURE_TTS_ANALYST_VOICE=en-US-GuyNeural
MAX_TTS_CHARACTERS=10000

# CORS Configuration
CORS_ORIGINS=["http://localhost:5173", "http://localhost:8080"]
```

## Usage Guide

### Getting Started

#### 1. Document Upload

**Single Document Upload**:
1. Click the upload area in the left panel or drag and drop a PDF
2. Wait for processing to complete (status shown in document list)
3. Document appears in library when ready

**Bulk Document Upload**:
1. Use "Upload Multiple" button or drag multiple PDFs
2. Each document processes independently
3. Monitor individual progress in the document list

#### 2. Document Reading and Exploration

**PDF Viewing**:
1. Click any document in the library to open in the center panel
2. Use standard PDF controls (zoom, pan, page navigation)
3. The system automatically detects your reading context

**Automatic Connections**:
1. As you read, the right panel automatically updates with related content
2. Connection suggestions appear from other documents in your library
3. Click any connection to navigate to the related content

#### 3. Generating Insights

**Text Selection Method**:
1. Select any text in the PDF viewer
2. Action Halo appears with available options
3. Click "Insights" to generate AI-powered analysis

**Insight Types**:
- **Key Takeaways**: Main points and critical information
- **Contradictions**: Conflicts with other documents
- **Examples**: Relevant examples and case studies
- **Cross-Document Inspirations**: Novel connections

#### 4. Creating Podcasts

**Podcast Generation**:
1. Select text for podcast content
2. Click "Podcast" in the Action Halo
3. System generates natural dialogue between Pooja and Arjun
4. Audio file becomes available for playback and download

**Podcast Features**:
- **Multi-Speaker**: Natural conversation format
- **Context-Aware**: Based on selected text and related connections
- **High Quality**: Professional voice synthesis
- **Downloadable**: MP3 format for offline listening

### Advanced Features

#### Breadcrumb Navigation

**Trail Building**:
1. Navigation trail automatically builds as you explore
2. Each breadcrumb captures the document, page, and context
3. Visual trail appears at the top of the interface

**Trail Navigation**:
1. Click any breadcrumb to return to that location
2. Trail truncates to maintain logical flow
3. Add current location manually using the bookmark button

#### Knowledge Graph

**Access**: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open

**Features**:
- Interactive visualization of document relationships
- Node-based representation of documents and concepts
- Zoom and pan navigation
- Click nodes to navigate to specific documents

#### Flow Status Bar

**Workflow Stages**:
1. **Upload**: Building your document library
2. **Connect**: System discovering connections automatically
3. **Generate**: Ready for insights and podcast generation

**Visual Indicators**:
- **Blue filled**: Completed stages
- **Blue outline**: Current active stage
- **Gray outline**: Future stages

### Tips for Optimal Experience

#### Document Selection
- **Mix Content Types**: Include diverse document types for richer connections
- **Related Topics**: Upload documents with overlapping themes
- **Quality PDFs**: Text-based PDFs work better than scanned images

#### Reading Strategy
- **Natural Reading**: Read at your normal pace; the system adapts
- **Text Selection**: Select meaningful phrases or sentences for better insights
- **Exploration**: Follow connection suggestions to discover new relationships

#### Podcast Creation
- **Context Selection**: Choose text with clear concepts for better audio content
- **Length Consideration**: Longer selections create more comprehensive podcasts
- **Related Content**: The system uses connection data to enrich podcast content

## API Documentation

### RESTful API Structure

The Synapse backend provides a comprehensive RESTful API following OpenAPI 3.0 standards.

**Base URL**: `http://localhost:8080/api/v1`

**Interactive Documentation**: `http://localhost:8080/docs`

### Core Endpoints

#### Document Management

```http
POST /api/v1/documents/upload
Content-Type: multipart/form-data
Headers: X-Session-ID: user-session-123

Upload single PDF document for processing
```

```http
POST /api/v1/documents/upload-multiple
Content-Type: multipart/form-data
Headers: X-Session-ID: user-session-123

Upload multiple PDF documents in batch
```

```http
GET /api/v1/documents/
Headers: X-Session-ID: user-session-123

List all documents for current session
```

```http
GET /api/v1/documents/{document_id}
Headers: X-Session-ID: user-session-123

Get detailed document information
```

```http
DELETE /api/v1/documents/{document_id}
Headers: X-Session-ID: user-session-123

Remove document and associated data
```

#### Semantic Search

```http
POST /api/v1/search/semantic
Content-Type: application/json
Headers: X-Session-ID: user-session-123

{
  "query_text": "machine learning applications",
  "top_k": 10,
  "similarity_threshold": 0.7,
  "document_ids": [1, 2, 3]
}

Perform semantic search across document library
```

#### AI-Powered Features

```http
POST /api/v1/insights/generate
Content-Type: application/json
Headers: X-Session-ID: user-session-123

{
  "text": "Selected text for analysis",
  "context": "Additional context"
}

Generate AI-powered insights for selected text
```

```http
POST /api/v1/podcast/generate
Content-Type: application/json
Headers: X-Session-ID: user-session-123

{
  "content": "Main podcast content",
  "related_content": "Supporting context",
  "generate_audio": true
}

Generate multi-speaker podcast with audio
```

### Response Formats

#### Standard Success Response
```json
{
  "status": "success",
  "data": {
    // Response data
  },
  "metadata": {
    "timestamp": "2025-08-19T10:30:00Z",
    "processing_time_ms": 245
  }
}
```

#### Error Response
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Detailed error description",
    "details": {
      // Additional error context
    }
  }
}
```

### Authentication and Sessions

The API uses session-based authentication through HTTP headers:

```http
X-Session-ID: user-session-123
```

Sessions are automatically generated and maintained by the frontend, providing user isolation for document libraries and search contexts.

## Performance and Scalability

### Performance Metrics

#### Processing Speed
- **Document Ingestion**: 50-500 pages per minute (depending on complexity)
- **Semantic Search**: Sub-second response times for most queries
- **Embedding Generation**: 32 texts per batch, optimized for all-MiniLM-L6-v2
- **Vector Search**: Faiss-optimized for millions of vectors

#### Memory Management
- **Streaming Processing**: Large documents processed in chunks
- **Intelligent Caching**: LRU-based caching for embeddings and search results
- **Batch Operations**: Optimized batch sizes for different operations

#### Resource Utilization
- **CPU Optimized**: Uses CPU-optimized PyTorch and NumPy operations
- **Memory Efficient**: Streaming processing prevents memory overflow
- **Storage Efficient**: Compressed vector indices and optimized database schema

### Scalability Considerations

#### Horizontal Scaling
- **Stateless Design**: API services are stateless for easy horizontal scaling
- **Session Isolation**: User sessions are isolated for multi-tenant support
- **Database Compatibility**: SQLite for single-instance, PostgreSQL for multi-instance

#### Vertical Scaling
- **Memory Scaling**: Supports larger document sets with increased memory
- **CPU Scaling**: Parallel processing for embedding generation and search
- **Storage Scaling**: Efficient file storage with configurable limits

#### Performance Optimization

**Backend Optimizations**:
```python
# Batch processing configuration
CHUNK_BATCH_SIZE = 50        # Text chunks per batch
EMBEDDING_BATCH_SIZE = 32    # Embeddings per batch
METADATA_BATCH_SIZE = 100    # Database updates per batch

# Caching configuration
EMBEDDING_CACHE_SIZE = 10000
FAISS_CACHE_SIZE = 5000
SIMILARITY_THRESHOLD = 0.7
```

**Frontend Optimizations**:
```javascript
// React optimizations
const ExpensiveComponent = React.memo(Component);
const memoizedCallback = useCallback(fn, dependencies);
const memoizedValue = useMemo(() => calculation, dependencies);

// Lazy loading
const LazyComponent = lazy(() => import('./Component'));
```

### Monitoring and Observability

#### Health Monitoring
```http
GET /health
GET /api/v1/system/health
GET /api/v1/system/stats
```

#### Performance Metrics
- Request/response times
- Document processing metrics
- Vector search performance
- External API latencies
- Error rates and types

#### Logging Strategy
- Structured JSON logging
- Different log levels for development and production
- Performance timing for critical operations
- Error tracking with context

## Development Workflow

### Version Control Strategy

**Branch Structure**:
- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/***: Individual feature development
- **hotfix/***: Critical bug fixes

**Commit Conventions**:
```
feat: add podcast generation feature
fix: resolve PDF loading issue
docs: update API documentation
style: improve CSS formatting
refactor: optimize search performance
test: add integration tests
```

### Code Quality Standards

#### Backend Standards
- **Type Hints**: All functions use Python type hints
- **Docstrings**: Comprehensive documentation for all public methods
- **Error Handling**: Robust error handling with appropriate HTTP status codes
- **Testing**: Unit tests for critical business logic

#### Frontend Standards
- **JSDoc Comments**: Documentation for complex functions
- **PropTypes**: Type checking for React components
- **ESLint Configuration**: Consistent code style enforcement
- **Accessibility**: ARIA labels and semantic HTML

### Testing Strategy

#### Backend Testing
```python
# Unit tests for services
def test_embedding_generation():
    service = EmbeddingService()
    embedding = service.create_embedding("test text")
    assert len(embedding) == 384

# Integration tests for APIs
def test_document_upload():
    response = client.post("/api/v1/documents/upload", files={"file": pdf_content})
    assert response.status_code == 200
```

#### Frontend Testing
```javascript
// Component testing
import { render, screen, fireEvent } from '@testing-library/react';

test('renders document library', () => {
  render(<DocumentLibrary documents={mockDocuments} />);
  expect(screen.getByText('Document Library')).toBeInTheDocument();
});
```

### Development Tools

#### IDE Configuration
- **VS Code**: Recommended with Python and React extensions
- **Linting**: ESLint for JavaScript, flake8 for Python
- **Formatting**: Prettier for JavaScript, black for Python

#### Debugging Tools
- **Frontend**: React Developer Tools, browser dev tools
- **Backend**: FastAPI interactive docs, Python debugger
- **Network**: Browser network tab, Postman for API testing

## Deployment

### Production Deployment

#### Docker Deployment (Recommended)

**Multi-Stage Build Process**:
1. **Frontend Build**: Node.js Alpine image for minimal size
2. **Python Dependencies**: Optimized compilation with minimal tools
3. **Runtime**: Ultra-slim Python image with only required libraries

**Final Image Characteristics**:
- **Size**: ~3-4GB (optimized from potential 12GB+)
- **Startup Time**: Sub-30 seconds
- **Memory Usage**: 2-4GB depending on document load
- **CPU Usage**: Efficient multi-core utilization

#### Environment-Specific Configuration

**Development**:
```bash
docker-compose up -d
# Includes hot-reloading and development tools
```

**Production**:
```bash
docker run --restart=unless-stopped \
  -e NODE_ENV=production \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -v /app/data:/app/data \
  synapse-docs:final
```

#### Health Checks and Monitoring

**Docker Health Check**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

**Monitoring Integration**:
- Application metrics via `/api/v1/system/stats`
- Health status via `/health` endpoint
- Error tracking through structured logging

### Cloud Deployment Options

#### Google Cloud Run
Optimized for the Adobe Hackathon evaluation environment:

```bash
# Build for Cloud Run
docker build --platform linux/amd64 -t gcr.io/project/synapse-docs .

# Deploy with proper resource allocation
gcloud run deploy synapse-docs \
  --image gcr.io/project/synapse-docs \
  --memory 4Gi \
  --cpu 2 \
  --port 8080 \
  --set-env-vars LLM_PROVIDER=gemini,TTS_PROVIDER=azure
```

#### AWS ECS/Fargate
Container-based deployment with auto-scaling:

```yaml
# ECS Task Definition
version: '3.8'
services:
  synapse:
    image: synapse-docs:final
    memory: 4096
    cpu: 2048
    environment:
      - LLM_PROVIDER=gemini
      - TTS_PROVIDER=azure
```

#### Azure Container Instances
Simple container deployment for Azure TTS integration:

```bash
az container create \
  --resource-group synapse-rg \
  --name synapse-docs \
  --image synapse-docs:final \
  --memory 4 \
  --cpu 2 \
  --environment-variables \
    LLM_PROVIDER=gemini \
    TTS_PROVIDER=azure
```

### Backup and Recovery

#### Data Backup Strategy
- **Database**: Automated SQLite backups with versioning
- **Files**: PDF and audio file backup to persistent storage
- **Configuration**: Environment variable backup and restoration

#### Recovery Procedures
- **Database Recovery**: SQLite restoration from backup
- **File Recovery**: Restoration from cloud storage
- **Vector Index Recovery**: Automatic rebuilding from database

## Team and Credits

### Development Team

This project represents the culmination of advanced research in document intelligence, semantic analysis, and human-computer interaction, specifically designed for the Adobe India Hackathon 2025.

### Technical Achievements

#### Challenge 1A Integration
Successfully integrated and refactored the complete 4-stage PDF processing pipeline from the winning Challenge 1A submission:
- Embedded TOC detection for fast-path processing
- Deep content and layout feature extraction
- ML-based heading classification using CRF
- Hierarchical document reconstruction

#### Challenge 1B Integration
Implemented sophisticated semantic analysis from the winning Challenge 1B submission:
- all-MiniLM-L6-v2 sentence transformer integration
- Advanced semantic clustering and relevance scoring
- Efficient caching and batch processing
- Persona-aware content analysis

#### Innovation Beyond Challenges
Developed unique features that extend beyond the original challenge requirements:
- **Synapse View Breadcrumbs**: Novel navigation system for exploration tracking
- **Flow Status Bar**: Professional workflow visualization
- **Context Lens Technology**: Automatic reading detection and context extraction
- **Action Halo Interface**: Progressive disclosure for user interactions

### Acknowledgments

#### Adobe Hackathon 2025
Special thanks to Adobe India for organizing this challenging and inspiring hackathon, pushing the boundaries of document intelligence and user experience design.

#### Open Source Community
This project builds upon the incredible work of the open source community:
- **Sentence Transformers**: For state-of-the-art embedding models
- **Faiss**: For high-performance vector similarity search
- **FastAPI**: For modern, fast web framework architecture
- **React**: For powerful, declarative user interface development

#### External Services
Integration with industry-leading services that make advanced AI accessible:
- **Adobe PDF Embed API**: For high-fidelity PDF rendering and interaction
- **Google Gemini**: For sophisticated language understanding and generation
- **Azure Cognitive Services**: For natural, high-quality text-to-speech synthesis

### Future Development

#### Roadmap
- **Multi-Language Support**: Expand beyond English for global accessibility
- **Advanced Analytics**: Detailed usage analytics and user behavior insights
- **Collaborative Features**: Multi-user document libraries and shared insights
- **Mobile Application**: Native mobile apps for on-the-go document analysis

#### Research Directions
- **Advanced Semantic Understanding**: Integration with larger language models
- **Visual Document Analysis**: OCR and layout understanding for scanned documents
- **Interactive Visualizations**: Enhanced knowledge graph capabilities
- **Personalization**: AI-driven personalization based on user behavior

---

**Synapse** represents a new paradigm in document intelligence, transforming static content into dynamic, interactive knowledge experiences. Built for the Adobe Hackathon 2025, it demonstrates the power of combining cutting-edge AI with thoughtful user experience design to solve real-world information management challenges.

**Experience it today**: `http://localhost:8080`

---

*Built with ❤️ for Adobe India Hackathon 2025*
