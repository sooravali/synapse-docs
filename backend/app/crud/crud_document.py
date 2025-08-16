from typing import List, Optional, Dict, Any
from sqlmodel import Session, select, and_, or_, func, desc
from datetime import datetime
from app.models.document import Document, TextChunk
from app.schemas.document import DocumentCreate, TextChunkCreate

# Document CRUD Operations

def create_document(session: Session, document_data: DocumentCreate) -> Document:
    """Create a new document record."""
    document = Document(
        session_id=document_data.session_id,
        file_name=document_data.file_name,
        content_hash=document_data.content_hash,
        file_size=document_data.file_size,
        status="processing"
    )
    session.add(document)
    session.commit()
    session.refresh(document)
    return document

def get_document(session: Session, document_id: int, session_id: Optional[str] = None) -> Optional[Document]:
    """Get a document by ID with session-based filtering."""
    statement = select(Document).where(Document.id == document_id)
    if session_id:
        statement = statement.where(Document.session_id == session_id)
    return session.exec(statement).first()

def get_document_by_hash(session: Session, content_hash: str, session_id: str) -> Optional[Document]:
    """Get a document by content hash within the same session to prevent duplicates."""
    statement = select(Document).where(
        and_(Document.content_hash == content_hash, Document.session_id == session_id)
    )
    return session.exec(statement).first()

def get_all_documents(session: Session, session_id: str, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[Document]:
    """Get documents with session-based filtering, pagination and optional status filter."""
    statement = select(Document).where(Document.session_id == session_id)
    
    if status:
        statement = statement.where(Document.status == status)
    
    statement = statement.offset(skip).limit(limit).order_by(desc(Document.upload_timestamp))
    return session.exec(statement).all()

def get_documents_count(session: Session, session_id: str, status: Optional[str] = None) -> int:
    """Get total count of documents for a session."""
    statement = select(func.count(Document.id)).where(Document.session_id == session_id)
    
    if status:
        statement = statement.where(Document.status == status)
    
    return session.exec(statement).first()

def update_document_status(session: Session, document_id: int, status: str, 
                          error_message: Optional[str] = None, 
                          processing_metadata: Optional[Dict[str, Any]] = None) -> Optional[Document]:
    """Update document processing status with metadata."""
    document = get_document(session, document_id)
    if document:
        document.status = status
        if error_message:
            document.error_message = error_message
        
        if status == "ready":
            document.processing_completed_at = datetime.utcnow()
        
        if processing_metadata:
            document.page_count = processing_metadata.get('page_count', document.page_count)
            document.total_chunks = processing_metadata.get('total_chunks', document.total_chunks)
            document.document_language = processing_metadata.get('document_language', document.document_language)
            document.has_embedded_toc = processing_metadata.get('has_embedded_toc', document.has_embedded_toc)
            document.extraction_method = processing_metadata.get('extraction_method', document.extraction_method)
        
        session.add(document)
        session.commit()
        session.refresh(document)
    return document

def delete_document(session: Session, document_id: int, session_id: Optional[str] = None) -> bool:
    """Delete a document and all its related chunks with session-based filtering."""
    document = get_document(session, document_id, session_id)
    if document:
        # Delete all related text chunks first
        chunks_statement = select(TextChunk).where(TextChunk.document_id == document_id)
        chunks = session.exec(chunks_statement).all()
        for chunk in chunks:
            session.delete(chunk)
        
        # Delete the document
        session.delete(document)
        session.commit()
        return True
    return False

def clear_all_session_documents(session: Session, session_id: str) -> Dict[str, int]:
    """Clear all documents and chunks for a specific session."""
    # Get all documents for this session
    documents = get_all_documents(session, session_id, limit=10000)  # High limit to get all
    
    deleted_count = 0
    deleted_chunks = 0
    
    for document in documents:
        # Delete all related text chunks first
        chunks_statement = select(TextChunk).where(TextChunk.document_id == document.id)
        chunks = session.exec(chunks_statement).all()
        
        for chunk in chunks:
            session.delete(chunk)
            deleted_chunks += 1
        
        # Delete the document
        session.delete(document)
        deleted_count += 1
    
    session.commit()
    
    return {
        "deleted_count": deleted_count,
        "deleted_chunks": deleted_chunks
    }

# Text Chunk CRUD Operations

def create_text_chunk(session: Session, chunk_data: TextChunkCreate) -> TextChunk:
    """Create a new text chunk record."""
    chunk = TextChunk(
        document_id=chunk_data.document_id,
        page_number=chunk_data.page_number,
        text_chunk=chunk_data.text_chunk,
        chunk_index=chunk_data.chunk_index,
        chunk_type=chunk_data.chunk_type,
        heading_level=chunk_data.heading_level,
        confidence_score=chunk_data.confidence_score,
        semantic_cluster=chunk_data.semantic_cluster
    )
    
    if chunk_data.extraction_features:
        chunk.set_extraction_features(chunk_data.extraction_features)
    
    session.add(chunk)
    session.commit()
    session.refresh(chunk)
    return chunk

def create_text_chunks_batch(session: Session, chunks_data: List[Dict[str, Any]]) -> List[TextChunk]:
    """Create multiple text chunks in a batch for efficiency."""
    chunks = []
    for chunk_data in chunks_data:
        chunk = TextChunk(**chunk_data)
        session.add(chunk)
        chunks.append(chunk)
    
    session.commit()
    
    # Refresh all chunks to get their IDs
    for chunk in chunks:
        session.refresh(chunk)
    
    return chunks

def get_text_chunk(session: Session, chunk_id: int) -> Optional[TextChunk]:
    """Get a text chunk by ID."""
    statement = select(TextChunk).where(TextChunk.id == chunk_id)
    return session.exec(statement).first()

def get_text_chunks_by_document(session: Session, document_id: int, 
                               page_number: Optional[int] = None,
                               chunk_type: Optional[str] = None) -> List[TextChunk]:
    """Get text chunks for a document with optional filters."""
    statement = select(TextChunk).where(TextChunk.document_id == document_id)
    
    if page_number is not None:
        statement = statement.where(TextChunk.page_number == page_number)
    
    if chunk_type:
        statement = statement.where(TextChunk.chunk_type == chunk_type)
    
    statement = statement.order_by(TextChunk.chunk_index)
    return session.exec(statement).all()

def get_text_chunks_by_faiss_positions(session: Session, faiss_positions: List[int]) -> List[TextChunk]:
    """Get text chunks by their positions in the Faiss index."""
    statement = select(TextChunk).where(TextChunk.faiss_index_position.in_(faiss_positions))
    return session.exec(statement).all()

def get_text_chunk_by_faiss_position(session: Session, faiss_position: int) -> Optional[TextChunk]:
    """Get text chunk by its position in the Faiss index."""
    statement = select(TextChunk).where(TextChunk.faiss_index_position == faiss_position)
    return session.exec(statement).first()

def update_chunk_faiss_position(session: Session, chunk_id: int, faiss_position: int) -> Optional[TextChunk]:
    """Update the Faiss index position for a text chunk."""
    chunk = get_text_chunk(session, chunk_id)
    if chunk:
        chunk.faiss_index_position = faiss_position
        session.add(chunk)
        session.commit()
        session.refresh(chunk)
    return chunk

def update_chunk_embedding_metadata(session: Session, chunk_id: int, 
                                   embedding_model: str, embedding_dimension: int) -> Optional[TextChunk]:
    """Update embedding metadata for a text chunk."""
    chunk = get_text_chunk(session, chunk_id)
    if chunk:
        chunk.embedding_created_at = datetime.utcnow()
        chunk.embedding_model = embedding_model
        chunk.embedding_dimension = embedding_dimension
        session.add(chunk)
        session.commit()
        session.refresh(chunk)
    return chunk

def update_chunks_faiss_positions_batch(session: Session, chunk_position_map: Dict[int, int]) -> List[TextChunk]:
    """Update Faiss positions for multiple chunks in batch."""
    updated_chunks = []
    
    for chunk_id, faiss_position in chunk_position_map.items():
        chunk = get_text_chunk(session, chunk_id)
        if chunk:
            chunk.faiss_index_position = faiss_position
            session.add(chunk)
            updated_chunks.append(chunk)
    
    session.commit()
    
    for chunk in updated_chunks:
        session.refresh(chunk)
    
    return updated_chunks

# Advanced Query Operations

def search_chunks_by_text(session: Session, search_text: str, 
                         document_ids: Optional[List[int]] = None,
                         limit: int = 10) -> List[TextChunk]:
    """Simple text search in chunks (for fallback when vector search fails)."""
    statement = select(TextChunk).where(TextChunk.text_chunk.contains(search_text))
    
    if document_ids:
        statement = statement.where(TextChunk.document_id.in_(document_ids))
    
    statement = statement.limit(limit)
    return session.exec(statement).all()

def get_document_statistics(session: Session, document_id: int) -> Dict[str, Any]:
    """Get comprehensive statistics for a document."""
    document = get_document(session, document_id)
    if not document:
        return {}
    
    # Get chunk statistics
    chunks_statement = select(TextChunk).where(TextChunk.document_id == document_id)
    chunks = session.exec(chunks_statement).all()
    
    # Calculate statistics
    total_chunks = len(chunks)
    chunks_by_type = {}
    chunks_by_page = {}
    total_text_length = 0
    
    for chunk in chunks:
        # Count by type
        chunk_type = chunk.chunk_type or 'content'
        chunks_by_type[chunk_type] = chunks_by_type.get(chunk_type, 0) + 1
        
        # Count by page
        page = chunk.page_number
        chunks_by_page[page] = chunks_by_page.get(page, 0) + 1
        
        # Total text length
        total_text_length += len(chunk.text_chunk)
    
    return {
        'document_id': document_id,
        'total_chunks': total_chunks,
        'chunks_by_type': chunks_by_type,
        'chunks_by_page': chunks_by_page,
        'total_text_length': total_text_length,
        'average_chunk_length': total_text_length / total_chunks if total_chunks > 0 else 0,
        'pages_with_content': len(chunks_by_page),
        'processing_status': document.status,
        'extraction_method': document.extraction_method,
        'document_language': document.document_language
    }

def get_chunks_for_semantic_analysis(session: Session, document_id: int) -> List[Dict[str, Any]]:
    """Get chunks formatted for semantic analysis."""
    chunks = get_text_chunks_by_document(session, document_id)
    
    return [
        {
            'id': chunk.id,
            'text_chunk': chunk.text_chunk,
            'page_number': chunk.page_number,
            'chunk_index': chunk.chunk_index,
            'chunk_type': chunk.chunk_type,
            'extraction_features': chunk.get_extraction_features()
        }
        for chunk in chunks
    ]

# Database Health and Maintenance

def get_database_health(session: Session) -> Dict[str, Any]:
    """Get database health statistics."""
    try:
        total_documents = session.exec(select(func.count(Document.id))).first()
        total_chunks = session.exec(select(func.count(TextChunk.id))).first()
        
        ready_documents = session.exec(
            select(func.count(Document.id)).where(Document.status == "ready")
        ).first()
        
        processing_documents = session.exec(
            select(func.count(Document.id)).where(Document.status == "processing")
        ).first()
        
        error_documents = session.exec(
            select(func.count(Document.id)).where(Document.status == "error")
        ).first()
        
        # Get chunks with embeddings
        chunks_with_embeddings = session.exec(
            select(func.count(TextChunk.id)).where(TextChunk.faiss_index_position.isnot(None))
        ).first()
        
        return {
            'status': 'healthy',
            'total_documents': total_documents,
            'total_chunks': total_chunks,
            'ready_documents': ready_documents,
            'processing_documents': processing_documents,
            'error_documents': error_documents,
            'chunks_with_embeddings': chunks_with_embeddings,
            'embedding_coverage': (chunks_with_embeddings / total_chunks * 100) if total_chunks > 0 else 0
        }
    
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e)
        }

# Session-based search functions

def get_text_chunks_by_faiss_positions_with_session(session: Session, faiss_positions: List[int], session_id: str) -> List[TextChunk]:
    """Get text chunks by Faiss positions filtered by session."""
    statement = select(TextChunk).join(Document).where(
        and_(
            TextChunk.faiss_index_position.in_(faiss_positions),
            Document.session_id == session_id
        )
    )
    return session.exec(statement).all()

def get_text_chunks_by_document_with_session(session: Session, document_id: int, session_id: str) -> List[TextChunk]:
    """Get all text chunks for a document filtered by session."""
    statement = select(TextChunk).join(Document).where(
        and_(
            TextChunk.document_id == document_id,
            Document.session_id == session_id
        )
    )
    return session.exec(statement).all()
