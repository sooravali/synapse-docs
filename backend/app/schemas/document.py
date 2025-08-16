from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# Document Schemas

class DocumentBase(BaseModel):
    """Base schema for document information."""
    file_name: str = Field(..., description="Name of the uploaded file")

class DocumentCreate(DocumentBase):
    """Schema for creating a new document."""
    session_id: str = Field(..., description="Session ID for user isolation")
    content_hash: str = Field(..., description="Hash of the file content to prevent duplicates")
    file_size: Optional[int] = Field(None, description="Size of the file in bytes")

class DocumentPublic(DocumentBase):
    """Public schema for document information."""
    id: int
    status: str = Field(..., description="Processing status: processing, ready, error")
    upload_timestamp: datetime
    processing_completed_at: Optional[datetime] = None
    page_count: Optional[int] = None
    total_chunks: Optional[int] = None
    error_message: Optional[str] = None
    document_language: Optional[str] = None
    has_embedded_toc: Optional[bool] = None
    extraction_method: Optional[str] = None

    class Config:
        from_attributes = True

    @validator('file_name')
    def clean_filename(cls, v):
        """Remove doc_X_ prefix from filename for frontend display."""
        if isinstance(v, str) and v.startswith('doc_') and '_' in v:
            # Remove "doc_X_" prefix: "doc_5_filename.pdf" -> "filename.pdf"
            parts = v.split('_', 2)  # Split on first 2 underscores
            if len(parts) >= 3:
                return parts[2]  # Return everything after "doc_X_"
        return v

class DocumentUploadResponse(BaseModel):
    """Response schema for document upload."""
    message: str = Field(..., description="Upload status message")
    document_id: int = Field(..., description="ID of the uploaded document")
    status: str = Field(..., description="Initial processing status")

class DocumentProcessingStatus(BaseModel):
    """Schema for document processing status updates."""
    document_id: int
    status: str
    progress_percentage: Optional[float] = None
    current_stage: Optional[str] = None
    error_message: Optional[str] = None

# Text Chunk Schemas

class TextChunkBase(BaseModel):
    """Base schema for text chunks."""
    page_number: int = Field(..., ge=0, description="Page number (0-based)")
    text_chunk: str = Field(..., min_length=1, description="Text content of the chunk")
    chunk_index: int = Field(..., ge=0, description="Position within the document")

class TextChunkCreate(TextChunkBase):
    """Schema for creating text chunks."""
    document_id: int
    chunk_type: Optional[str] = "content"
    heading_level: Optional[str] = None
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    extraction_features: Optional[Dict[str, Any]] = None
    semantic_cluster: Optional[int] = None

class TextChunkPublic(TextChunkBase):
    """Public schema for text chunks."""
    id: int
    document_id: int
    faiss_index_position: Optional[int] = None
    chunk_type: Optional[str] = None
    heading_level: Optional[str] = None
    confidence_score: Optional[float] = None
    embedding_created_at: Optional[datetime] = None
    embedding_model: Optional[str] = None
    embedding_dimension: Optional[int] = None
    extraction_features: Optional[Dict[str, Any]] = None
    semantic_cluster: Optional[int] = None

    class Config:
        from_attributes = True

# Search Schemas

class SearchQuery(BaseModel):
    """Request schema for semantic search queries."""
    query_text: str = Field(..., min_length=1, max_length=1000, description="Search query text")
    top_k: int = Field(5, ge=1, le=50, description="Number of results to return")
    document_ids: Optional[List[int]] = Field(None, description="Limit search to specific documents")
    similarity_threshold: Optional[float] = Field(0.3, ge=0.0, le=1.0, description="Minimum similarity score")
    include_metadata: bool = Field(True, description="Include chunk metadata in results")

    @validator('query_text')
    def validate_query_text(cls, v):
        if not v.strip():
            raise ValueError('Query text cannot be empty or only whitespace')
        return v.strip()

class SearchResultItem(BaseModel):
    """Schema for individual search result items."""
    chunk_id: int = Field(..., description="ID of the text chunk")
    document_id: int = Field(..., description="ID of the source document")
    document_name: str = Field(..., description="Name of the source document")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Semantic similarity score")
    text_chunk: str = Field(..., description="Matching text content")
    page_number: int = Field(..., description="Page number in source document")
    chunk_index: int = Field(..., description="Position within the document")
    chunk_type: Optional[str] = None
    heading_level: Optional[str] = None
    semantic_cluster: Optional[int] = None

    @validator('document_name')
    def clean_document_name(cls, v):
        """Remove doc_X_ prefix from document name for frontend display."""
        if isinstance(v, str) and v.startswith('doc_') and '_' in v:
            # Remove "doc_X_" prefix: "doc_5_filename.pdf" -> "filename.pdf"
            parts = v.split('_', 2)  # Split on first 2 underscores
            if len(parts) >= 3:
                return parts[2]  # Return everything after "doc_X_"
        return v

class SearchResponse(BaseModel):
    """Response schema for search queries."""
    query: str = Field(..., description="Original search query")
    total_results: int = Field(..., description="Total number of results found")
    results: List[SearchResultItem] = Field(..., description="Search result items")
    search_time_ms: float = Field(..., description="Search execution time in milliseconds")
    embedding_time_ms: Optional[float] = Field(None, description="Query embedding time in milliseconds")

# Document Analysis Schemas

class DocumentStructureSection(BaseModel):
    """Schema for document structure sections."""
    title: str = Field(..., description="Section title")
    chunk_count: int = Field(..., description="Number of chunks in this section")
    cluster_id: int = Field(..., description="Semantic cluster ID")
    chunks: List[Dict[str, Any]] = Field(..., description="Chunks in this section")

class DocumentAnalysis(BaseModel):
    """Schema for document structure analysis."""
    document_id: int
    sections: List[DocumentStructureSection]
    summary: str = Field(..., description="Document summary")
    total_chunks: int
    embedding_dimension: int
    analysis_timestamp: datetime

# Batch Processing Schemas

class BatchUploadRequest(BaseModel):
    """Schema for batch document upload requests."""
    files: List[str] = Field(..., description="List of file identifiers for batch processing")
    processing_options: Optional[Dict[str, Any]] = Field(None, description="Processing configuration options")

class BatchUploadResponse(BaseModel):
    """Response schema for batch uploads."""
    batch_id: str = Field(..., description="Batch processing identifier")
    submitted_count: int = Field(..., description="Number of files submitted for processing")
    message: str = Field(..., description="Batch submission status")

class BatchStatus(BaseModel):
    """Schema for batch processing status."""
    batch_id: str
    total_files: int
    completed_files: int
    failed_files: int
    progress_percentage: float
    status: str  # "processing", "completed", "failed"
    started_at: datetime
    completed_at: Optional[datetime] = None

# Error Schemas

class ErrorResponse(BaseModel):
    """Schema for API error responses."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ValidationError(BaseModel):
    """Schema for validation error responses."""
    error: str = "validation_error"
    message: str = Field(..., description="Validation error message")
    field_errors: Optional[List[Dict[str, str]]] = Field(None, description="Field-specific validation errors")

# Health and Status Schemas

class HealthCheck(BaseModel):
    """Schema for health check responses."""
    status: str = Field(..., description="Service health status")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(..., description="API version")
    dependencies: Dict[str, bool] = Field(..., description="Status of service dependencies")

class ServiceInfo(BaseModel):
    """Schema for service information."""
    service_name: str = "Synapse-Docs API"
    version: str = "1.0.0"
    description: str = "PDF document processing and semantic search API"
    model_info: Dict[str, Any] = Field(..., description="Information about loaded ML models")
    database_status: str = Field(..., description="Database connection status")
    faiss_status: str = Field(..., description="Faiss index status")
    chunk_index: int

class InsightsRequest(BaseModel):
    """Request schema for insights generation."""
    text: str = Field(..., description="Text content for which to generate insights")
    context: Optional[str] = Field(None, description="Additional context for insights generation")

class PodcastRequest(BaseModel):
    """Request schema for podcast generation."""
    main_text: str
    recommendations: List[dict]
