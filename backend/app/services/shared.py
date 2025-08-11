"""
Shared service instances to ensure consistency across the application.

This module provides singleton-like behavior for critical services
that need to maintain state across different parts of the application.
"""
import logging
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

def get_document_parser():
    """Get or create the shared DocumentParser instance."""
    global _document_parser
    if _document_parser is None:
        from app.services.document_parser import DocumentParser
        _document_parser = DocumentParser()
        logger.info("Initialized shared DocumentParser")
    return _document_parser

def get_embedding_service():
    """Get or create the shared EmbeddingService instance."""
    global _embedding_service
    if _embedding_service is None:
        from app.services.embedding_service import EmbeddingService
        _embedding_service = EmbeddingService()
        logger.info("Initialized shared EmbeddingService")
    return _embedding_service

def get_faiss_service():
    """Get or create the shared FaissService instance."""
    global _faiss_service
    if _faiss_service is None:
        from app.services.faiss_service import FaissService
        _faiss_service = FaissService()
        logger.info("Initialized shared FaissService")
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
