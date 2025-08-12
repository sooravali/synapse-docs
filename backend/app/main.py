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
    """Initialize database tables and services on startup."""
    logger.info("Synapse-Docs API starting up...")
    
    # Create database tables
    logger.info("Creating database tables...")
    SQLModel.metadata.create_all(engine, checkfirst=True)
    logger.info("Database tables created successfully")
    
    # Initialize services
    logger.info("Initializing services...")
    
    try:
        # Initialize shared services
        from app.services.shared import get_embedding_service, get_document_parser, get_faiss_service
        
        # Initialize embedding service (Challenge 1B)
        embedding_service = get_embedding_service()
        logger.info("✓ Embedding service (Challenge 1B) initialized")
        
        # Initialize document parser (Challenge 1A)
        document_parser = get_document_parser()
        logger.info("✓ Document parser (Challenge 1A) initialized")
        
        # Initialize Faiss service
        faiss_service = get_faiss_service()
        logger.info("✓ Faiss vector database initialized")
        
        logger.info("All services initialized successfully")
        
    except Exception as e:
        logger.error(f"Service initialization warning: {e}")
        logger.info("API will continue with limited functionality")
    
    logger.info("Synapse-Docs API startup complete")

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Health check endpoint (separate from system health for monitoring)
@app.get("/health")
async def health_check():
    """Simple health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy", 
        "service": "synapse-docs-api",
        "version": "1.0.0"
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
