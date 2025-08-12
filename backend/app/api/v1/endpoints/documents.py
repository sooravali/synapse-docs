"""
Document management endpoints for the Synapse-Docs API.

Handles document upload, processing, retrieval, and management operations.
"""
import os
import hashlib
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
import tempfile
import asyncio

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from sqlmodel import Session

from app.core.database import get_session
from app.core.config import settings
from app.models.document import Document, TextChunk
from app.schemas.document import (
    DocumentPublic, DocumentUploadResponse, DocumentProcessingStatus,
    ErrorResponse, DocumentAnalysis
)
from app.crud.crud_document import (
    create_document, get_document, get_document_by_hash, get_all_documents,
    update_document_status, delete_document, get_documents_count,
    get_document_statistics, get_chunks_for_semantic_analysis
)
from app.schemas.document import DocumentCreate
from app.services.shared import get_document_parser, get_embedding_service, get_faiss_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Get shared service instances
def get_services():
    """Get the shared service instances."""
    return {
        'document_parser': get_document_parser(),
        'embedding_service': get_embedding_service(),
        'faiss_service': get_faiss_service()
    }

# Helper functions

def calculate_file_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of file content."""
    return hashlib.sha256(content).hexdigest()

async def process_document_background(document_id: int, file_content: bytes, session: Session):
    """
    Background task to process uploaded document.
    
    This implements the complete pipeline:
    1. Parse PDF using Challenge 1A logic (DocumentParser)
    2. Generate embeddings using Challenge 1B logic (EmbeddingService)  
    3. Store in Faiss vector database
    4. Update database with results
    """
    try:
        logger.info(f"Starting background processing for document {document_id}")
        
        # Get shared service instances
        services = get_services()
        document_parser = services['document_parser']
        embedding_service = services['embedding_service']
        faiss_service = services['faiss_service']
        
        # Stage 1: Extract text chunks using Challenge 1A pipeline
        logger.info(f"Document {document_id}: Starting Challenge 1A text extraction")
        text_chunks = document_parser.get_text_chunks(file_content)
        
        if not text_chunks:
            update_document_status(
                session, document_id, "error", 
                "No text could be extracted from the PDF"
            )
            return
        
        logger.info(f"Document {document_id}: Extracted {len(text_chunks)} text chunks")
        
        # Stage 2: Store text chunks in database
        chunk_objects = []
        for i, chunk_data in enumerate(text_chunks):
            try:
                from app.crud.crud_document import create_text_chunk
                from app.schemas.document import TextChunkCreate
                
                chunk_create = TextChunkCreate(
                    document_id=document_id,
                    page_number=chunk_data.get('page_number', 0),
                    text_chunk=chunk_data.get('text_chunk', ''),
                    chunk_index=i,
                    chunk_type='content'
                )
                
                chunk_obj = create_text_chunk(session, chunk_create)
                chunk_objects.append(chunk_obj)
                
            except Exception as e:
                logger.error(f"Failed to create chunk {i} for document {document_id}: {e}")
        
        if not chunk_objects:
            update_document_status(
                session, document_id, "error", 
                "Failed to store text chunks in database"
            )
            return
        
        # Stage 3: Generate embeddings using Challenge 1B logic
        logger.info(f"Document {document_id}: Starting Challenge 1B embedding generation")
        
        chunk_texts = [chunk.text_chunk for chunk in chunk_objects]
        embeddings = embedding_service.create_embeddings_batch(chunk_texts)
        
        if not embeddings or len(embeddings) != len(chunk_objects):
            update_document_status(
                session, document_id, "error", 
                "Failed to generate embeddings for text chunks"
            )
            return
        
        logger.info(f"Document {document_id}: Generated {len(embeddings)} embeddings")
        
        # Stage 4: Store embeddings in Faiss vector database
        metadata_list = []
        for chunk in chunk_objects:
            metadata_list.append({
                'chunk_id': chunk.id,
                'document_id': document_id,
                'page_number': chunk.page_number,
                'chunk_index': chunk.chunk_index,
                'text_preview': chunk.text_chunk[:100] + "..." if len(chunk.text_chunk) > 100 else chunk.text_chunk
            })
        
        faiss_positions = faiss_service.add_embeddings(embeddings, metadata_list)
        
        if not faiss_positions:
            update_document_status(
                session, document_id, "error", 
                "Failed to store embeddings in vector database"
            )
            return
        
        # Stage 5: Update chunks with Faiss positions
        from app.crud.crud_document import update_chunk_faiss_position, update_chunk_embedding_metadata
        
        for chunk, faiss_pos in zip(chunk_objects, faiss_positions):
            update_chunk_faiss_position(session, chunk.id, faiss_pos)
            update_chunk_embedding_metadata(
                session, chunk.id, 
                embedding_service.model_name, 
                len(embeddings[0]) if embeddings else 384
            )
        
        # Stage 6: Perform semantic analysis using Challenge 1B logic
        logger.info(f"Document {document_id}: Running semantic analysis")
        
        document_chunks = get_chunks_for_semantic_analysis(session, document_id)
        structure_analysis = embedding_service.analyze_document_structure(document_chunks)
        
        # Stage 7: Update document status to ready
        processing_metadata = {
            'total_chunks': len(chunk_objects),
            'page_count': max(chunk.page_number for chunk in chunk_objects) + 1 if chunk_objects else 0,
            'document_language': structure_analysis.get('language', 'unknown'),  # Use detected language from analysis
            'extraction_method': 'challenge_1a_pipeline',
            'embedding_model': embedding_service.model_name,
            'embedding_dimension': len(embeddings[0]) if embeddings else 384
        }
        
        update_document_status(
            session, document_id, "ready", 
            processing_metadata=processing_metadata
        )
        
        logger.info(f"Document {document_id}: Processing completed successfully")
        
    except Exception as e:
        logger.error(f"Document {document_id}: Processing failed: {e}")
        update_document_status(
            session, document_id, "error", 
            f"Processing failed: {str(e)}"
        )

# Document Management Endpoints

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """
    Upload a PDF document for processing.
    
    The document will be processed using the refactored Challenge 1A and 1B logic:
    - Text extraction and heading detection using Challenge 1A pipeline
    - Semantic embedding generation using Challenge 1B all-MiniLM-L6-v2 model
    - Vector storage in Faiss index for similarity search
    """
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        # Read file content
        file_content = await file.read()
        
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        # Calculate content hash to prevent duplicates
        content_hash = calculate_file_hash(file_content)
        
        # Check if document already exists
        existing_doc = get_document_by_hash(session, content_hash)
        if existing_doc:
            return DocumentUploadResponse(
                message="Document already exists",
                document_id=existing_doc.id,
                status=existing_doc.status
            )
        
        # Create document record first to get the ID
        document_create = DocumentCreate(
            file_name=file.filename,
            content_hash=content_hash,
            file_size=len(file_content)
        )
        
        document = create_document(session, document_create)
        
        # Create uploads directory if it doesn't exist (use environment-configurable path)
        uploads_dir = os.environ.get("UPLOADS_DIR", "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Use document ID in filename to avoid conflicts
        file_extension = os.path.splitext(file.filename)[1]
        safe_filename = f"doc_{document.id}_{file.filename}"
        file_path = os.path.join(uploads_dir, safe_filename)
        
        # Save the PDF file to disk for viewing
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Update document record with the actual stored filename
        document.file_name = safe_filename
        session.add(document)
        session.commit()
        session.refresh(document)
        
        # Start background processing
        background_tasks.add_task(
            process_document_background, 
            document.id, 
            file_content, 
            session
        )
        
        return DocumentUploadResponse(
            message="Document uploaded successfully. Processing started.",
            document_id=document.id,
            status="processing"
        )
        
    except Exception as e:
        logger.error(f"Document upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/upload-multiple")
async def upload_multiple_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session)
):
    """
    Upload multiple PDF documents for processing.
    
    Accepts multiple files and processes each one individually.
    Returns a list of upload results for each file.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > settings.MAX_FILES_PER_UPLOAD:  # Use configurable limit
        raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_FILES_PER_UPLOAD} files allowed per upload")
    
    results = []
    
    for file in files:
        try:
            # Validate file type
            if not file.filename.lower().endswith('.pdf'):
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": "Only PDF files are supported",
                    "document_id": None
                })
                continue
            
            # Read file content
            file_content = await file.read()
            
            if len(file_content) == 0:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": "Uploaded file is empty",
                    "document_id": None
                })
                continue
            
            # Calculate content hash to prevent duplicates
            content_hash = calculate_file_hash(file_content)
            
            # Check if document already exists
            existing_doc = get_document_by_hash(session, content_hash)
            if existing_doc:
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "message": "Document already exists",
                    "document_id": existing_doc.id,
                    "status": existing_doc.status
                })
                continue
            
            # Create document record
            document_create = DocumentCreate(
                file_name=file.filename,
                content_hash=content_hash,
                file_size=len(file_content)
            )
            
            document = create_document(session, document_create)
            
            # Create uploads directory if it doesn't exist (use environment-configurable path)
            uploads_dir = os.environ.get("UPLOADS_DIR", "uploads")
            os.makedirs(uploads_dir, exist_ok=True)
            
            # Use document ID in filename to avoid conflicts
            file_extension = os.path.splitext(file.filename)[1]
            safe_filename = f"doc_{document.id}_{file.filename}"
            file_path = os.path.join(uploads_dir, safe_filename)
            
            # Save the PDF file to disk
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Update document record with the actual stored filename
            document.file_name = safe_filename
            session.add(document)
            session.commit()
            session.refresh(document)
            
            # Start background processing
            background_tasks.add_task(
                process_document_background, 
                document.id, 
                file_content, 
                session
            )
            
            results.append({
                "filename": file.filename,
                "success": True,
                "message": "Document uploaded successfully. Processing started.",
                "document_id": document.id,
                "status": "processing"
            })
            
        except Exception as e:
            logger.error(f"Failed to upload {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "message": f"Upload failed: {str(e)}",
                "document_id": None
            })
    
    return {
        "message": f"Processed {len(files)} files",
        "results": results,
        "total_files": len(files),
        "successful_uploads": sum(1 for r in results if r["success"]),
        "failed_uploads": sum(1 for r in results if not r["success"])
    }

@router.get("/", response_model=List[DocumentPublic])
async def list_documents(
    skip: int = Query(0, ge=0, description="Number of documents to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of documents to return"),
    status: Optional[str] = Query(None, description="Filter by processing status"),
    session: Session = Depends(get_session)
):
    """Get a list of all uploaded documents with pagination."""
    try:
        documents = get_all_documents(session, skip=skip, limit=limit, status=status)
        return [DocumentPublic.model_validate(doc) for doc in documents]
        
    except Exception as e:
        logger.error(f"Failed to list documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve documents")

@router.get("/count")
async def get_document_count(
    status: Optional[str] = Query(None, description="Filter by processing status"),
    session: Session = Depends(get_session)
):
    """Get the total count of documents."""
    try:
        count = get_documents_count(session, status=status)
        return {"total_documents": count, "status_filter": status}
        
    except Exception as e:
        logger.error(f"Failed to get document count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get document count")

@router.get("/{document_id}", response_model=DocumentPublic)
async def get_document_details(
    document_id: int,
    session: Session = Depends(get_session)
):
    """Get details for a specific document."""
    document = get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentPublic.model_validate(document)

@router.get("/{document_id}/status", response_model=DocumentProcessingStatus)
async def get_document_status(
    document_id: int,
    session: Session = Depends(get_session)
):
    """Get the processing status of a document."""
    document = get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentProcessingStatus(
        document_id=document.id,
        status=document.status,
        error_message=document.error_message
    )

@router.get("/{document_id}/statistics")
async def get_document_stats(
    document_id: int,
    session: Session = Depends(get_session)
):
    """Get comprehensive statistics for a document."""
    document = get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        stats = get_document_statistics(session, document_id)
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get document statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document statistics")

@router.get("/{document_id}/analysis", response_model=DocumentAnalysis)
async def analyze_document_structure(
    document_id: int,
    session: Session = Depends(get_session)
):
    """
    Analyze document structure using Challenge 1B semantic analysis.
    
    Returns semantic sections, clustering analysis, and document summary.
    """
    document = get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.status != "ready":
        raise HTTPException(
            status_code=400, 
            detail=f"Document is not ready for analysis. Current status: {document.status}"
        )
    
    try:
        # Get shared service instances
        services = get_services()
        embedding_service = services['embedding_service']
        
        # Get chunks for analysis
        document_chunks = get_chunks_for_semantic_analysis(session, document_id)
        
        if not document_chunks:
            raise HTTPException(status_code=404, detail="No chunks found for document")
        
        # Perform semantic analysis using Challenge 1B logic
        analysis = embedding_service.analyze_document_structure(document_chunks)
        
        return DocumentAnalysis(
            document_id=document_id,
            sections=analysis.get('sections', []),
            summary=analysis.get('summary', 'No summary available'),
            total_chunks=analysis.get('total_chunks', 0),
            embedding_dimension=analysis.get('embedding_dimension', 384),
            analysis_timestamp=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Document structure analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze document structure")

@router.delete("/clear-all")
async def clear_all_documents(
    session: Session = Depends(get_session)
):
    """
    Clear all documents and their associated data.
    
    This endpoint:
    1. Deletes all documents from the database
    2. Deletes all text chunks 
    3. Clears the Faiss vector index
    4. Removes all uploaded files from storage
    
    Use with caution - this operation cannot be undone!
    """
    try:
        logger.info("🗑️ Starting clear all documents operation...")
        
        # Get all documents first
        documents = get_all_documents(session)
        document_count = len(documents)
        logger.info(f"📊 Found {document_count} documents to delete")
        
        if document_count == 0:
            return JSONResponse(
                content={
                    "message": "No documents found to delete",
                    "deleted_count": 0,
                    "status": "success"
                }
            )
        
        # Delete all documents (this also deletes associated chunks via cascade)
        deleted_count = 0
        for document in documents:
            try:
                # Delete from database
                delete_document(session, document.id)
                deleted_count += 1
                logger.info(f"✅ Deleted document: {document.file_name}")
                
                # Clean up physical file if it exists
                # Files are stored in uploads/ directory with the document's file_name
                file_path = os.path.join("uploads", document.file_name)
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logger.info(f"🗂️ Removed file: {file_path}")
                    except Exception as file_error:
                        logger.warning(f"⚠️ Could not remove file {file_path}: {file_error}")
                        
            except Exception as doc_error:
                logger.error(f"❌ Failed to delete document {document.id}: {doc_error}")
                continue
        
        # Clear Faiss vector index
        try:
            services = get_services()
            faiss_service = services['faiss_service']
            faiss_service.clear_index()
            logger.info("🧹 Cleared Faiss vector index")
            
            # Reload the index to ensure clean state
            faiss_service.reload_index()
            logger.info("🔄 Reloaded Faiss index after clear")
        except Exception as faiss_error:
            logger.error(f"❌ Failed to clear/reload Faiss index: {faiss_error}")
        
        # Clear uploads directory
        uploads_dir = "uploads"
        if os.path.exists(uploads_dir):
            try:
                import shutil
                for filename in os.listdir(uploads_dir):
                    file_path = os.path.join(uploads_dir, filename)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                        logger.info(f"🗂️ Removed upload file: {filename}")
                logger.info("🧹 Cleared uploads directory")
            except Exception as upload_error:
                logger.warning(f"⚠️ Could not clear uploads directory: {upload_error}")
        
        logger.info(f"✅ Clear all operation completed: {deleted_count}/{document_count} documents deleted")
        
        return JSONResponse(
            content={
                "message": f"Successfully deleted all documents and cleared vector index",
                "deleted_count": deleted_count,
                "total_count": document_count,
                "status": "success"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Clear all documents failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear all documents: {str(e)}"
        )

@router.post("/reload-index")
async def reload_faiss_index():
    """
    Reload the Faiss index from disk.
    
    This is useful when the index files have been updated but the in-memory 
    service hasn't been refreshed. This can happen after clearing documents
    and uploading new ones.
    """
    try:
        logger.info("🔄 Reloading Faiss index from disk...")
        
        services = get_services()
        faiss_service = services['faiss_service']
        success = faiss_service.reload_index()
        index_size = faiss_service.get_index_size()
        
        if success:
            logger.info(f"✅ Successfully reloaded Faiss index with {index_size} vectors")
            return JSONResponse(
                content={
                    "message": f"Successfully reloaded Faiss index",
                    "vector_count": index_size,
                    "status": "success"
                }
            )
        else:
            logger.error("❌ Failed to reload Faiss index")
            raise HTTPException(status_code=500, detail="Failed to reload Faiss index")
            
    except Exception as e:
        logger.error(f"Reload index operation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to reload Faiss index")

@router.delete("/{document_id}")
async def delete_document_endpoint(
    document_id: int,
    session: Session = Depends(get_session)
):
    """Delete a document and all its associated data."""
    document = get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Get chunk Faiss positions before deletion
        from app.crud.crud_document import get_text_chunks_by_document
        chunks = get_text_chunks_by_document(session, document_id)
        faiss_positions = [chunk.faiss_index_position for chunk in chunks 
                          if chunk.faiss_index_position is not None]
        
        # Remove from Faiss index
        if faiss_positions:
            services = get_services()
            faiss_service = services['faiss_service']
            faiss_service.remove_embeddings(faiss_positions)
        
        # Delete from database
        success = delete_document(session, document_id)
        
        if success:
            return {"message": "Document deleted successfully", "document_id": document_id}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete document")
            
    except Exception as e:
        logger.error(f"Document deletion failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """Reprocess a document (useful if processing failed or needs updating)."""
    document = get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Update status to processing
        update_document_status(session, document_id, "processing")
        
        # Note: In a real implementation, we'd need to store the original file content
        # For now, we'll return an error indicating this limitation
        raise HTTPException(
            status_code=501, 
            detail="Document reprocessing requires original file content storage (not implemented in this demo)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document reprocessing failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to reprocess document")


@router.get("/view/{document_id}")
@router.head("/view/{document_id}")
async def view_document(
    document_id: int,
    session: Session = Depends(get_session)
):
    """Serve PDF file for viewing in Adobe PDF Embed API."""
    document = get_document(session, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Use configurable uploads directory
    uploads_dir = os.environ.get("UPLOADS_DIR", "uploads")
    
    # Check if file exists in uploads directory - use proper paths for different environments
    file_path = os.path.join(uploads_dir, document.file_name)
    
    # For Docker environments, also try absolute path
    if not os.path.exists(file_path):
        docker_uploads_path = os.path.join("/app", uploads_dir)
        docker_file_path = os.path.join(docker_uploads_path, document.file_name)
        if os.path.exists(docker_file_path):
            file_path = docker_file_path
        else:
            raise HTTPException(status_code=404, detail="PDF file not found on disk")
    
    # Return the PDF file with proper content type
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=document.file_name,
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD",
            "Access-Control-Allow-Headers": "*"
        }
    )
