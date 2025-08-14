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
    Background task to process uploaded document with optimized memory management.
    
    This implements the complete pipeline with chunked processing for large documents:
    1. Parse PDF using Challenge 1A logic (DocumentParser) - streaming approach
    2. Generate embeddings using Challenge 1B logic (EmbeddingService) - batched processing
    3. Store in Faiss vector database - incremental updates
    4. Update database with results - transaction management
    """
    try:
        logger.info(f"🚀 Document {document_id}: Starting optimized background processing pipeline")
        
        # Get shared service instances
        services = get_services()
        document_parser = services['document_parser']
        embedding_service = services['embedding_service']
        faiss_service = services['faiss_service']
        
        file_size_mb = len(file_content) / (1024 * 1024)
        logger.info(f"Document {document_id}: Processing {file_size_mb:.1f}MB PDF with optimized pipeline")
        
        # Step 1: Extract text chunks using Challenge 1A pipeline (optimized for large files)
        logger.info(f"Document {document_id}: Step 1 - Starting optimized text extraction (Challenge 1A)")
        
        try:
            text_chunks = document_parser.get_text_chunks(file_content)
        except Exception as extraction_error:
            logger.error(f"Document {document_id}: Text extraction failed: {extraction_error}")
            update_document_status(
                session, document_id, "error", 
                f"Text extraction failed: {str(extraction_error)}"
            )
            return
        
        if not text_chunks:
            update_document_status(
                session, document_id, "error", 
                "No text could be extracted from the PDF"
            )
            return
        
        logger.info(f"Document {document_id}: Step 1 - Extracted {len(text_chunks)} text chunks successfully")
        
        # Step 2: Process chunks in batches to manage memory (optimized for large documents)
        CHUNK_BATCH_SIZE = 50  # Process 50 chunks at a time to prevent memory issues
        chunk_objects = []
        total_batches = (len(text_chunks) + CHUNK_BATCH_SIZE - 1) // CHUNK_BATCH_SIZE
        
        logger.info(f"Document {document_id}: Step 2 - Processing {len(text_chunks)} chunks in {total_batches} batches")
        
        for batch_idx in range(total_batches):
            start_idx = batch_idx * CHUNK_BATCH_SIZE
            end_idx = min((batch_idx + 1) * CHUNK_BATCH_SIZE, len(text_chunks))
            batch_chunks = text_chunks[start_idx:end_idx]
            
            logger.info(f"Document {document_id}: Processing batch {batch_idx + 1}/{total_batches} ({len(batch_chunks)} chunks)")
            
            # Process batch of chunks
            for i, chunk_data in enumerate(batch_chunks):
                try:
                    from app.crud.crud_document import create_text_chunk
                    from app.schemas.document import TextChunkCreate
                    
                    # Extract enhanced metadata from our improved parser
                    chunk_type = chunk_data.get('chunk_type', 'content')
                    heading_level = chunk_data.get('heading_level', 0)
                    section_title = chunk_data.get('section_title', '')
                    extraction_method = chunk_data.get('extraction_method', 'enhanced_pipeline')
                    content_quality_score = chunk_data.get('content_quality_score', 0.5)
                    semantic_markers = chunk_data.get('semantic_markers', [])
                    
                    chunk_create = TextChunkCreate(
                        document_id=document_id,
                        page_number=chunk_data.get('page_number', 0),
                        text_chunk=chunk_data.get('text_chunk', ''),
                        chunk_index=start_idx + i,  # Global chunk index
                        chunk_type=chunk_type,
                        heading_level=heading_level if heading_level else None,
                        section_title=section_title if section_title else None
                    )
                    
                    chunk_obj = create_text_chunk(session, chunk_create)
                    
                    # Store enhanced metadata as chunk attributes (if the model supports it)
                    if hasattr(chunk_obj, '__dict__'):
                        chunk_obj.__dict__.update({
                            'extraction_method': extraction_method,
                            'content_quality_score': content_quality_score,
                            'semantic_markers': semantic_markers
                        })
                    
                    chunk_objects.append(chunk_obj)
                    
                except Exception as e:
                    logger.error(f"Failed to create chunk {start_idx + i} for document {document_id}: {e}")
            
            # Commit batch to prevent memory buildup
            try:
                session.commit()
                logger.info(f"Document {document_id}: Batch {batch_idx + 1} committed to database")
            except Exception as commit_error:
                logger.error(f"Document {document_id}: Failed to commit batch {batch_idx + 1}: {commit_error}")
                session.rollback()
        
        logger.info(f"Document {document_id}: Step 2 - Created {len(chunk_objects)} text chunks in database")
        
        if not chunk_objects:
            update_document_status(
                session, document_id, "error", 
                "Failed to store text chunks in database"
            )
            return
        
        # Step 3: Generate embeddings using Challenge 1B logic (optimized batching)
        logger.info(f"Document {document_id}: Step 3 - Starting optimized embedding generation (Challenge 1B)")
        
        # Process embeddings in smaller batches to prevent memory issues
        EMBEDDING_BATCH_SIZE = 32  # Optimal batch size for all-MiniLM-L6-v2
        all_embeddings = []
        total_embedding_batches = (len(chunk_objects) + EMBEDDING_BATCH_SIZE - 1) // EMBEDDING_BATCH_SIZE
        
        logger.info(f"Document {document_id}: Generating embeddings in {total_embedding_batches} batches")
        
        for batch_idx in range(total_embedding_batches):
            start_idx = batch_idx * EMBEDDING_BATCH_SIZE
            end_idx = min((batch_idx + 1) * EMBEDDING_BATCH_SIZE, len(chunk_objects))
            batch_chunks = chunk_objects[start_idx:end_idx]
            
            batch_texts = [chunk.text_chunk for chunk in batch_chunks]
            
            try:
                batch_embeddings = embedding_service.create_embeddings_batch(batch_texts)
                if batch_embeddings and len(batch_embeddings) == len(batch_chunks):
                    all_embeddings.extend(batch_embeddings)
                    logger.info(f"Document {document_id}: Generated embeddings for batch {batch_idx + 1}/{total_embedding_batches}")
                else:
                    logger.error(f"Document {document_id}: Embedding generation failed for batch {batch_idx + 1}")
                    update_document_status(
                        session, document_id, "error", 
                        f"Failed to generate embeddings for batch {batch_idx + 1}"
                    )
                    return
            except Exception as embedding_error:
                logger.error(f"Document {document_id}: Embedding generation error in batch {batch_idx + 1}: {embedding_error}")
                update_document_status(
                    session, document_id, "error", 
                    f"Embedding generation failed: {str(embedding_error)}"
                )
                return
        
        if not all_embeddings or len(all_embeddings) != len(chunk_objects):
            update_document_status(
                session, document_id, "error", 
                "Failed to generate embeddings for all text chunks"
            )
            return
        
        logger.info(f"Document {document_id}: Step 3 - Generated {len(all_embeddings)} embeddings successfully")
        
        # Step 4: Store embeddings in Faiss vector database (incremental updates)
        logger.info(f"Document {document_id}: Step 4 - Building metadata for vector storage")
        metadata_list = []
        for chunk in chunk_objects:
            chunk_metadata = {
                'chunk_id': chunk.id,
                'document_id': document_id,
                'page_number': chunk.page_number or 0,  # Handle None page numbers
                'chunk_index': chunk.chunk_index,
                'chunk_type': getattr(chunk, 'chunk_type', 'content'),
                'heading_level': getattr(chunk, 'heading_level', 0),
                'section_title': getattr(chunk, 'section_title', ''),
                'extraction_method': getattr(chunk, 'extraction_method', 'enhanced_pipeline'),
                'content_quality_score': getattr(chunk, 'content_quality_score', 0.5),
                'text_preview': chunk.text_chunk[:100] + "..." if len(chunk.text_chunk) > 100 else chunk.text_chunk
            }
            metadata_list.append(chunk_metadata)
        
        try:
            faiss_positions = faiss_service.add_embeddings(all_embeddings, metadata_list)
            
            if not faiss_positions:
                update_document_status(
                    session, document_id, "error", 
                    "Failed to store embeddings in vector database"
                )
                return
            
            logger.info(f"Document {document_id}: Step 4 - Added {len(faiss_positions)} vectors to Faiss index")
        except Exception as faiss_error:
            logger.error(f"Document {document_id}: Faiss storage error: {faiss_error}")
            update_document_status(
                session, document_id, "error", 
                f"Vector database storage failed: {str(faiss_error)}"
            )
            return
        
        # Step 5: Update chunks with Faiss positions and embedding metadata (batched updates)
        from app.crud.crud_document import update_chunk_faiss_position, update_chunk_embedding_metadata
        
        METADATA_BATCH_SIZE = 100  # Update metadata in batches
        total_metadata_batches = (len(chunk_objects) + METADATA_BATCH_SIZE - 1) // METADATA_BATCH_SIZE
        
        logger.info(f"Document {document_id}: Step 5 - Updating chunk metadata in {total_metadata_batches} batches")
        
        for batch_idx in range(total_metadata_batches):
            start_idx = batch_idx * METADATA_BATCH_SIZE
            end_idx = min((batch_idx + 1) * METADATA_BATCH_SIZE, len(chunk_objects))
            
            for i in range(start_idx, end_idx):
                chunk = chunk_objects[i]
                faiss_pos = faiss_positions[i]
                
                try:
                    update_chunk_faiss_position(session, chunk.id, faiss_pos)
                    update_chunk_embedding_metadata(
                        session, chunk.id, 
                        embedding_service.model_name, 
                        len(all_embeddings[0]) if all_embeddings else 384
                    )
                except Exception as metadata_error:
                    logger.warning(f"Failed to update metadata for chunk {chunk.id}: {metadata_error}")
            
            # Commit metadata batch
            try:
                session.commit()
                logger.info(f"Document {document_id}: Metadata batch {batch_idx + 1}/{total_metadata_batches} committed")
            except Exception as commit_error:
                logger.error(f"Document {document_id}: Failed to commit metadata batch: {commit_error}")
                session.rollback()
        
        logger.info(f"Document {document_id}: Step 5 - Updated chunk metadata and positions")
        
        # Step 6: Analyze document structure for enhanced metadata (optimized)
        try:
            document_chunks = get_chunks_for_semantic_analysis(session, document_id)
            logger.info(f"Document {document_id}: Step 6a - Retrieved {len(document_chunks)} chunks for structure analysis")
            
            # For very large documents, limit structure analysis to prevent timeout
            if len(document_chunks) > 1000:  # If more than 1000 chunks, sample for analysis
                import random
                sample_size = min(500, len(document_chunks))  # Analyze up to 500 chunks
                sampled_chunks = random.sample(document_chunks, sample_size)
                logger.info(f"Document {document_id}: Large document detected, sampling {sample_size} chunks for analysis")
                structure_analysis = embedding_service.analyze_document_structure(sampled_chunks)
            else:
                structure_analysis = embedding_service.analyze_document_structure(document_chunks)
                
            logger.info(f"Document {document_id}: Step 6b - Structure analysis completed successfully")
        except Exception as semantic_error:
            logger.error(f"Document {document_id}: Step 6 failed - Structure analysis error: {semantic_error}")
            # Continue with a basic structure_analysis
            structure_analysis = {"language": "unknown", "sections": []}
        
        # Step 7: Update document status to ready with enhanced metadata
        # Calculate page count from chunks
        page_numbers = [chunk.page_number for chunk in chunk_objects if chunk.page_number is not None]
        page_count = max(page_numbers) + 1 if page_numbers else 1
        logger.info(f"Document {document_id}: Step 6c - Calculated page_count={page_count}")
        
        # Step 8: Create processing metadata
        language = structure_analysis.get('language', 'unknown') if structure_analysis else 'unknown'
        section_count = len(structure_analysis.get('sections', [])) if structure_analysis else 0
        logger.info(f"Document {document_id}: Step 7a - Analysis results: language={language}, sections={section_count}")
        
        processing_metadata = {
            'total_chunks': len(chunk_objects),
            'page_count': page_count,
            'document_language': language,
            'extraction_method': 'optimized_challenge_1a_pipeline',
            'embedding_model': embedding_service.model_name,
            'embedding_dimension': len(all_embeddings[0]) if all_embeddings else 384,
            'processing_quality': 'optimized_for_large_documents',
            'semantic_analysis_available': True,
            'file_size_mb': file_size_mb,
            'processing_batches': {
                'chunk_batches': total_batches,
                'embedding_batches': total_embedding_batches,
                'metadata_batches': total_metadata_batches
            }
        }
        
        logger.info(f"Document {document_id}: Step 7b - Processing metadata created successfully")
        
        # Step 9: Update document status and finalize processing
        update_document_status(
            session, document_id, "ready",
            processing_metadata=processing_metadata
        )
        
        logger.info(f"Document {document_id}: Step 8 - Processing completed successfully")
        logger.info(f"Document {document_id}: Final status: READY ({len(chunk_objects)} chunks, {page_count} pages, {file_size_mb:.1f}MB)")
        
    except Exception as e:
        logger.error(f"Document {document_id}: Processing failed with error: {e}")
        update_document_status(
            session, document_id, "error", 
            f"Processing failed: {str(e)}"
        )# Document Management Endpoints

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
        logger.info(f"📄 Upload initiated: {file.filename}")
        
        # Read file content
        file_content = await file.read()
        
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        file_size_mb = len(file_content) / (1024 * 1024)
        logger.info(f"📄 File validated: {file.filename} ({file_size_mb:.1f}MB)")
        
        # Validate file size against limit
        if file_size_mb > settings.MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413, 
                detail=f"File size {file_size_mb:.1f}MB exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB. Please use a smaller file or contact support for large document processing."
            )
        
        # Calculate content hash to prevent duplicates
        content_hash = calculate_file_hash(file_content)
        
        # Check if document already exists
        existing_doc = get_document_by_hash(session, content_hash)
        if existing_doc:
            logger.info(f"📄 Duplicate detected: {file.filename} (returning existing document {existing_doc.id})")
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
        logger.info(f"📄 Document created: {file.filename} (ID: {document.id})")
        
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
    
    logger.info(f"📄 Batch upload initiated: {len(files)} files")
    results = []
    
    for i, file in enumerate(files, 1):
        try:
            logger.info(f"📄 Processing file {i}/{len(files)}: {file.filename}")
            
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
            
            # Validate file size
            file_size_mb = len(file_content) / (1024 * 1024)
            if file_size_mb > settings.MAX_FILE_SIZE_MB:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": f"File size {file_size_mb:.1f}MB exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB",
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
    
    successful_uploads = sum(1 for r in results if r["success"])
    failed_uploads = sum(1 for r in results if not r["success"])
    
    logger.info(f"📄 Batch upload completed: {successful_uploads} successful, {failed_uploads} failed")
    
    return {
        "message": f"Processed {len(files)} files",
        "results": results,
        "total_files": len(files),
        "successful_uploads": successful_uploads,
        "failed_uploads": failed_uploads
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

@router.get("/processing-status/{document_id}")
async def get_processing_status(
    document_id: int,
    session: Session = Depends(get_session)
):
    """
    Get detailed processing status for a document.
    Useful for monitoring large document processing progress.
    """
    try:
        document = get_document(session, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get chunk count for progress indication
        from app.crud.crud_document import get_document_chunk_count
        try:
            chunk_count = get_document_chunk_count(session, document_id)
        except:
            chunk_count = 0
        
        # Parse processing metadata if available
        processing_info = {}
        if document.processing_metadata:
            try:
                import json
                processing_info = json.loads(document.processing_metadata)
            except:
                processing_info = {}
        
        return {
            "document_id": document_id,
            "file_name": document.file_name,
            "status": document.status,
            "file_size_mb": round((document.file_size or 0) / (1024 * 1024), 2),
            "chunk_count": chunk_count,
            "error_message": document.error_message,
            "processing_info": processing_info,
            "created_at": document.created_at,
            "updated_at": document.updated_at
        }
        
    except Exception as e:
        logger.error(f"Failed to get processing status for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get processing status: {str(e)}")
