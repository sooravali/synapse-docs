"""
Shared service instances to ensure consistency across the application.

This module provides singleton-like behavior for critical services
that need to maintain state across different parts of the application.
"""
import logging
import asyncio
import threading
import time
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.document_parser import DocumentParser
    from app.services.embedding_service import EmbeddingService
    from app.services.faiss_service import FaissService

logger = logging.getLogger(__name__)

# Global service instances
_document_parser: Optional['DocumentParser'] = None
_embedding_service: Optional['EmbeddingService'] = None
_faiss_service: Optional['FaissService'] = None
_services_initialized = False
_initialization_lock = threading.Lock()

def initialize_services_eagerly():
    """
    Initialize all services eagerly at startup to avoid delays during first requests.
    This should be called during application startup.
    """
    global _services_initialized
    
    if _services_initialized:
        logger.info("Services already initialized")
        return
    
    with _initialization_lock:
        if _services_initialized:  # Double-check pattern
            return
            
        logger.info("Starting eager initialization of all services...")
        start_time = time.time()
        
        try:
            # Initialize in order of dependency
            logger.info("Initializing DocumentParser...")
            get_document_parser()
            
            logger.info("Initializing EmbeddingService (this may take a moment)...")
            get_embedding_service()
            
            logger.info("Initializing FaissService...")
            get_faiss_service()
            
            _services_initialized = True
            elapsed = time.time() - start_time
            logger.info(f"All services initialized successfully in {elapsed:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Failed to initialize services: {e}")
            raise

def initialize_services_background():
    """
    Initialize services in background thread to avoid blocking startup.
    """
    def _background_init():
        try:
            initialize_services_eagerly()
        except Exception as e:
            logger.error(f"Background service initialization failed: {e}")
    
    thread = threading.Thread(target=_background_init, daemon=True)
    thread.start()
    logger.info("Started background service initialization")

def get_document_parser():
    """Get or create the shared DocumentParser instance."""
    global _document_parser
    if _document_parser is None:
        try:
            from app.services.document_parser import DocumentParser
            _document_parser = DocumentParser()
            logger.info("Initialized shared DocumentParser")
        except Exception as e:
            logger.error(f"Failed to initialize DocumentParser: {e}")
            raise
    return _document_parser

def get_embedding_service():
    """Get or create the shared EmbeddingService instance."""
    global _embedding_service
    if _embedding_service is None:
        try:
            from app.services.embedding_service import EmbeddingService
            _embedding_service = EmbeddingService()
            logger.info("Initialized shared EmbeddingService")
        except Exception as e:
            logger.error(f"Failed to initialize EmbeddingService: {e}")
            raise
    return _embedding_service

def get_faiss_service():
    """Get or create the shared FaissService instance."""
    global _faiss_service
    if _faiss_service is None:
        try:
            from app.services.faiss_service import FaissService
            _faiss_service = FaissService()
            logger.info("Initialized shared FaissService")
        except Exception as e:
            logger.error(f"Failed to initialize FaissService: {e}")
            # For Faiss, we can continue without it - it will be created when needed
            logger.warning("FaissService will be created when first document is processed")
    return _faiss_service

def reload_faiss_service():
    """Reload the Faiss service - useful when index files have been updated."""
    global _faiss_service
    if _faiss_service is not None:
        success = _faiss_service.reload_index()
        if success:
            logger.info("Reloaded Faiss service index")
        else:
            logger.error("Failed to reload Faiss service index")
        return success
    return False

def clear_services():
    """Clear all service instances - mainly for testing."""
    global _document_parser, _embedding_service, _faiss_service
    _document_parser = None
    _embedding_service = None
    _faiss_service = None
    logger.info("Cleared all shared service instances")

def get_services_status():
    """Get status of all services for health checks."""
    global _document_parser, _embedding_service, _faiss_service, _services_initialized
    
    status = {
        "services_initialized": _services_initialized,
        "document_parser_ready": _document_parser is not None,
        "embedding_service_ready": _embedding_service is not None,
        "faiss_service_ready": _faiss_service is not None
    }
    
    # Check if embedding service has model loaded
    if _embedding_service is not None:
        try:
            model_info = _embedding_service.get_model_info()
            status["embedding_model_loaded"] = model_info.get("model_loaded", False)
        except Exception:
            status["embedding_model_loaded"] = False
    else:
        status["embedding_model_loaded"] = False
    
    return status
