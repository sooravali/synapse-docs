from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
import logging
import os

from app.core.config import settings
from app.core.database import engine
from app.api.v1 import api_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application with comprehensive documentation
app = FastAPI(
    title="Synapse-Docs API",
    description="""
    An intelligent document experience platform that transforms static PDFs into interactive, queryable knowledge bases.
    
    ## Features
    
    * **Document Processing**: Upload and process PDF documents using refactored Challenge 1A pipeline
    * **Semantic Search**: Advanced vector-based search using Challenge 1B all-MiniLM-L6-v2 embeddings
    * **Text Analysis**: Intelligent heading detection, layout analysis, and content extraction
    * **Vector Database**: Faiss-powered similarity search with cosine similarity
    * **Health Monitoring**: Comprehensive system health checks and analytics
    
    ## Refactored Components
    
    * **Challenge 1A Logic**: 4-stage PDF processing pipeline with CRF-based heading detection
    * **Challenge 1B Logic**: Semantic analysis with sentence transformer embeddings
    
    ## API Sections
    
    * **Documents**: Upload, process, and manage PDF documents
    * **Search**: Semantic and text-based search capabilities  
    * **System**: Health checks, statistics, and dependency monitoring
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
@app.on_event("startup")
async def startup_event():
    """Initialize database tables and basic services on startup."""
    logger.info("Synapse-Docs API starting up...")
    
    # Create database tables
    logger.info("Creating database tables...")
    try:
        SQLModel.metadata.create_all(engine, checkfirst=True)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    
    # Create required directories
    import os
    os.makedirs("/app/data/audio", exist_ok=True)
    os.makedirs("/app/uploads", exist_ok=True)
    os.makedirs("/app/data/faiss_index", exist_ok=True)
    logger.info("Required directories created")
    
    # Initialize services eagerly to avoid delays on first request
    logger.info("Initializing core services...")
    try:
        from app.services.shared import initialize_services_background
        initialize_services_background()
        logger.info("Service initialization started in background")
    except Exception as e:
        logger.error(f"Service initialization error: {e}")
        # Don't fail startup if services can't initialize
        # They will be lazy-loaded on first use
    
    # Note: Heavy services (ML models) are initialized lazily on first use
    # to prevent startup timeout in Cloud Run
    logger.info("Synapse-Docs API startup complete (services will load on demand)")

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Health check endpoint (for Docker/K8s health checks)
@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {
        "status": "ready",
        "service": "synapse-docs-api",
        "message": "Application started successfully"
    }

# Readiness check endpoint (checks if services are initialized)
@app.get("/ready")
async def readiness_check():
    """Check if all services are ready to handle requests."""
    from app.services.shared import get_services_status
    
    status = get_services_status()
    
    if status["services_initialized"] and status["embedding_model_loaded"]:
        return {
            "status": "ready",
            "message": "All services initialized and ready",
            "details": status
        }
    else:
        return {
            "status": "initializing",
            "message": "Services are still initializing",
            "details": status
        }

# Startup check endpoint for Cloud Run
@app.get("/startup")
async def startup_check():
    """Startup check endpoint for Cloud Run health probes."""
    return {
        "status": "ready",
        "service": "synapse-docs-api",
        "message": "Application started successfully"
    }

# API info endpoint (moved from root to avoid conflict with frontend)
@app.get("/api")
async def api_info():
    """API information endpoint."""
    return {
        "service": "Synapse-Docs API",
        "version": "1.0.0",
        "description": "PDF document processing and semantic search API",
        "documentation": "/docs",
        "openapi_spec": "/openapi.json",
        "refactored_components": {
            "challenge_1a": "4-stage PDF processing pipeline",
            "challenge_1b": "Semantic analysis with all-MiniLM-L6-v2"
        },
        "api_endpoints": {
            "documents": "/api/v1/documents",
            "search": "/api/v1/search", 
            "system": "/api/v1/system",
            "insights": "/api/v1/insights",
            "podcast": "/api/v1/podcast"
        }
    }

# Static file serving (for frontend) - MUST be last in the mount order
try:
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
    logger.info("Static file serving configured")
except RuntimeError:
    # Static directory doesn't exist yet - this is expected during development
    logger.info("Static directory not found - will be created during Docker build")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
