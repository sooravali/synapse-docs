from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List
import json

class Document(SQLModel, table=True):
    """
    Database model for uploaded PDF documents.
    Stores metadata about files and their processing status.
    """
    
    id: Optional[int] = Field(default=None, primary_key=True)
    file_name: str = Field(index=True)
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_completed_at: Optional[datetime] = Field(default=None)
    status: str = Field(default="processing")  # "processing", "ready", "error"
    content_hash: str = Field(unique=True, index=True)  # To prevent duplicate uploads
    file_size: Optional[int] = Field(default=None)
    page_count: Optional[int] = Field(default=None)
    total_chunks: Optional[int] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    
    # Document metadata extracted during processing
    document_language: Optional[str] = Field(default=None)
    has_embedded_toc: Optional[bool] = Field(default=None)
    extraction_method: Optional[str] = Field(default=None)  # "pymupdf", "pdfminer", "fallback"
    
    # Relationships
    text_chunks: List["TextChunk"] = Relationship(back_populates="document")
    
    def to_dict(self) -> dict:
        """Convert model to dictionary for API responses."""
        return {
            "id": self.id,
            "file_name": self.file_name,
            "upload_timestamp": self.upload_timestamp.isoformat() if self.upload_timestamp else None,
            "processing_completed_at": self.processing_completed_at.isoformat() if self.processing_completed_at else None,
            "status": self.status,
            "content_hash": self.content_hash,
            "file_size": self.file_size,
            "page_count": self.page_count,
            "total_chunks": self.total_chunks,
            "error_message": self.error_message,
            "document_language": self.document_language,
            "has_embedded_toc": self.has_embedded_toc,
            "extraction_method": self.extraction_method
        }

class TextChunk(SQLModel, table=True):
    """
    Database model for text chunks extracted from documents.
    Each chunk represents a semantically coherent piece of text with its metadata.
    """
    
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    page_number: int = Field(index=True)  # 0-based page numbering as per requirements
    text_chunk: str = Field(index=True)
    chunk_index: int = Field(index=True)  # Position within the document
    faiss_index_position: Optional[int] = Field(default=None, index=True)  # Position in Faiss index
    
    # Content analysis metadata
    chunk_type: Optional[str] = Field(default="content")  # "content", "heading", "title", "section"
    heading_level: Optional[str] = Field(default=None)  # "H1", "H2", "H3" from Challenge 1A classification
    confidence_score: Optional[float] = Field(default=None)  # Confidence in chunk classification
    
    # Vector embedding metadata
    embedding_created_at: Optional[datetime] = Field(default=None)
    embedding_model: Optional[str] = Field(default="all-MiniLM-L6-v2")
    embedding_dimension: Optional[int] = Field(default=384)
    
    # Processing metadata
    extraction_features: Optional[str] = Field(default=None)  # JSON string of Challenge 1A features
    semantic_cluster: Optional[int] = Field(default=None)  # Challenge 1B cluster assignment
    
    # Relationships  
    document: Optional[Document] = Relationship(back_populates="text_chunks")
    
    def to_dict(self) -> dict:
        """Convert model to dictionary for API responses."""
        features = None
        if self.extraction_features:
            try:
                features = json.loads(self.extraction_features)
            except (json.JSONDecodeError, TypeError):
                features = None
        
        return {
            "id": self.id,
            "document_id": self.document_id,
            "page_number": self.page_number,
            "text_chunk": self.text_chunk,
            "chunk_index": self.chunk_index,
            "faiss_index_position": self.faiss_index_position,
            "chunk_type": self.chunk_type,
            "heading_level": self.heading_level,
            "confidence_score": self.confidence_score,
            "embedding_created_at": self.embedding_created_at.isoformat() if self.embedding_created_at else None,
            "embedding_model": self.embedding_model,
            "embedding_dimension": self.embedding_dimension,
            "extraction_features": features,
            "semantic_cluster": self.semantic_cluster
        }
    
    def set_extraction_features(self, features: dict):
        """Set extraction features as JSON string."""
        self.extraction_features = json.dumps(features) if features else None
    
    def get_extraction_features(self) -> dict:
        """Get extraction features as dictionary."""
        if not self.extraction_features:
            return {}
        try:
            return json.loads(self.extraction_features)
        except (json.JSONDecodeError, TypeError):
            return {}
