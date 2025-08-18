"""
Search endpoints for the Synapse-Docs API.

Implements semantic search using the refactored Challenge 1B logic with Faiss vector database.
"""
import time
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session

from app.core.database import get_session
from app.models.document import Document, TextChunk
from app.schemas.document import (
    SearchQuery, SearchResponse, SearchResultItem, ErrorResponse
)
from app.crud.crud_document import (
    get_text_chunks_by_faiss_positions, search_chunks_by_text, get_document,
    get_text_chunks_by_document
)
from app.services.shared import get_embedding_service, get_faiss_service

logger = logging.getLogger(__name__)

router = APIRouter()

def get_session_id(request: Request) -> str:
    """Extract session ID from request headers."""
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID is required")
    return session_id

@router.post("/semantic", response_model=SearchResponse)
async def semantic_search(
    request: Request,
    search_query: SearchQuery,
    session: Session = Depends(get_session)
):
    """
    Perform semantic search using Challenge 1B embedding logic and Faiss vector database.
    
    This endpoint:
    1. Generates embeddings for the query using the all-MiniLM-L6-v2 model
    2. Searches the Faiss vector index for similar content
    3. Returns ranked results with similarity scores
    """
    start_time = time.time()
    
    try:
        # Get shared service instances
        embedding_service = get_embedding_service()
        faiss_service = get_faiss_service()
        
        # Stage 1: Generate query embedding using Challenge 1B logic
        embedding_start = time.time()
        query_embedding = embedding_service.create_embedding(search_query.query_text)
        embedding_time = (time.time() - embedding_start) * 1000
        
        if not query_embedding:
            raise HTTPException(
                status_code=500, 
                detail="Failed to generate embedding for query"
            )
        
        # Get session ID for session-aware search
        session_id = get_session_id(request)
        
        # Stage 2: Search session-specific Faiss vector database  
        faiss_results = faiss_service.search(
            query_embedding=query_embedding,
            top_k=search_query.top_k * 2,  # Get more results for filtering
            similarity_threshold=search_query.similarity_threshold,
            session_id=session_id  # Use session-aware search
        )
        
        if not faiss_results:
            return SearchResponse(
                query=search_query.query_text,
                total_results=0,
                results=[],
                search_time_ms=(time.time() - start_time) * 1000,
                embedding_time_ms=embedding_time
            )
        
        # Stage 3: Get chunk details from database with session filtering
        faiss_positions = [result['faiss_index_position'] for result in faiss_results]
        from app.crud.crud_document import get_text_chunks_by_faiss_positions_with_session
        chunks = get_text_chunks_by_faiss_positions_with_session(session, faiss_positions, session_id)
        
        # Create lookup for chunks by Faiss position
        chunk_lookup = {chunk.faiss_index_position: chunk for chunk in chunks}
        
        # Stage 4: Build enhanced search results using improved semantic analysis
        search_results = []
        
        # Convert chunks to the format expected by embedding service
        document_chunks = []
        for faiss_result in faiss_results:
            faiss_pos = faiss_result['faiss_index_position']
            chunk = chunk_lookup.get(faiss_pos)
            
            if not chunk:
                continue
                
            # Filter by document IDs if specified
            if (search_query.document_ids and 
                chunk.document_id not in search_query.document_ids):
                continue
                
            # Create enhanced chunk data
            chunk_data = {
                'text_chunk': chunk.text_chunk,
                'page_number': chunk.page_number,
                'chunk_index': chunk.chunk_index,
                'chunk_type': chunk.chunk_type,
                'heading_level': chunk.heading_level,
                'semantic_cluster': chunk.semantic_cluster,
                'content_quality_score': getattr(chunk, 'content_quality_score', 0.5),
                'semantic_markers': getattr(chunk, 'semantic_markers', []),
                'extraction_method': getattr(chunk, 'extraction_method', 'standard'),
                'section_title': getattr(chunk, 'section_title', ''),
                'similarity_score': faiss_result['similarity_score'],
                'chunk_obj': chunk  # Keep reference to original chunk
            }
            document_chunks.append(chunk_data)
        
        # Use enhanced semantic content extraction
        enhanced_results = embedding_service.extract_semantic_content(
            document_chunks, search_query.query_text, search_query.top_k, search_query.similarity_threshold
        )
        
        # Build final search results with enhanced information
        for enhanced_result in enhanced_results:
            chunk = enhanced_result['chunk_obj']
            
            # Get document info
            document = get_document(session, chunk.document_id)
            if not document:
                continue
            
            # Create enhanced search result item with focused preview optimized for hackathon snippets
            result_item = SearchResultItem(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_name=document.file_name,
                similarity_score=enhanced_result.get('enhanced_score', enhanced_result.get('similarity_score', 0.0)),
                text_chunk=enhanced_result.get('content_preview', chunk.text_chunk),  # Use full preview for better snippets
                page_number=chunk.page_number,
                chunk_index=chunk.chunk_index,
                chunk_type=chunk.chunk_type,
                heading_level=chunk.heading_level,
                semantic_cluster=chunk.semantic_cluster
            )
            
            # Add enhanced metadata if available
            if hasattr(result_item, '__dict__'):
                result_item.__dict__.update({
                    'match_explanation': enhanced_result.get('match_explanation', ''),
                    'key_phrases': enhanced_result.get('key_phrases', []),
                    'content_preview': enhanced_result.get('content_preview', ''),
                    'extraction_quality': enhanced_result.get('extraction_method', 'standard')
                })
            
            search_results.append(result_item)
        
        total_time = (time.time() - start_time) * 1000
        
        logger.info(f"Semantic search completed: {len(search_results)} results in {total_time:.2f}ms")
        
        return SearchResponse(
            query=search_query.query_text,
            total_results=len(search_results),
            results=search_results,
            search_time_ms=total_time,
            embedding_time_ms=embedding_time
        )
        
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.get("/text", response_model=List[SearchResultItem])
async def text_search(
    query: str = Query(..., min_length=1, description="Text to search for"),
    document_ids: Optional[List[int]] = Query(None, description="Limit search to specific documents"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results"),
    session: Session = Depends(get_session)
):
    """
    Perform simple text-based search (fallback when vector search is unavailable).
    
    This searches for exact text matches within document chunks.
    """
    try:
        chunks = search_chunks_by_text(
            session, 
            search_text=query, 
            document_ids=document_ids, 
            limit=limit
        )
        
        results = []
        for chunk in chunks:
            document = get_document(session, chunk.document_id)
            if document:
                result_item = SearchResultItem(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    document_name=document.file_name,
                    similarity_score=1.0,  # Text search doesn't have similarity scores
                    text_chunk=chunk.text_chunk,
                    page_number=chunk.page_number,
                    chunk_index=chunk.chunk_index,
                    chunk_type=chunk.chunk_type,
                    heading_level=chunk.heading_level,
                    semantic_cluster=chunk.semantic_cluster
                )
                results.append(result_item)
        
        logger.info(f"Text search for '{query}' returned {len(results)} results")
        return results
        
    except Exception as e:
        logger.error(f"Text search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text search failed: {str(e)}")

@router.get("/similar/{chunk_id}", response_model=List[SearchResultItem])
async def find_similar_chunks(
    request: Request,
    chunk_id: int,
    top_k: int = Query(5, ge=1, le=20, description="Number of similar chunks to return"),
    similarity_threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score"),
    session: Session = Depends(get_session)
):
    """
    Find chunks similar to a specific chunk using vector similarity.
    
    Uses the Challenge 1B semantic analysis to find related content.
    """
    try:
        # Get session ID for session-aware operations
        session_id = get_session_id(request)
        
        # Get shared service instances
        faiss_service = get_faiss_service()
        faiss_service.set_session(session_id)
        
        # Get the reference chunk (note: we'll use existing method but it should be session-filtered)
        from app.crud.crud_document import get_text_chunk
        reference_chunk = get_text_chunk(session, chunk_id)
        
        if not reference_chunk:
            raise HTTPException(status_code=404, detail="Chunk not found")
        
        if reference_chunk.faiss_index_position is None:
            raise HTTPException(
                status_code=400, 
                detail="Chunk does not have vector embedding"
            )
        
        # Get the embedding from session-specific Faiss
        embedding_data = faiss_service.get_embedding_by_position(
            reference_chunk.faiss_index_position
        )
        
        if not embedding_data:
            raise HTTPException(
                status_code=500, 
                detail="Failed to retrieve chunk embedding"
            )
        
        reference_embedding, _ = embedding_data
        
        # Search for similar embeddings in session-specific index
        faiss_results = faiss_service.search(
            query_embedding=reference_embedding,
            top_k=top_k + 1,  # +1 to exclude the reference chunk itself
            similarity_threshold=similarity_threshold,
            session_id=session_id
        )
        
        # Filter out the reference chunk and build results
        results = []
        for faiss_result in faiss_results:
            if faiss_result['faiss_index_position'] == reference_chunk.faiss_index_position:
                continue  # Skip the reference chunk itself
            
            chunk = get_text_chunks_by_faiss_positions(
                session, [faiss_result['faiss_index_position']]
            )
            
            if not chunk:
                continue
            
            chunk = chunk[0]
            document = get_document(session, chunk.document_id)
            
            if document:
                result_item = SearchResultItem(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    document_name=document.file_name,
                    similarity_score=faiss_result['similarity_score'],
                    text_chunk=chunk.text_chunk,
                    page_number=chunk.page_number,
                    chunk_index=chunk.chunk_index,
                    chunk_type=chunk.chunk_type,
                    heading_level=chunk.heading_level,
                    semantic_cluster=chunk.semantic_cluster
                )
                results.append(result_item)
            
            if len(results) >= top_k:
                break
        
        logger.info(f"Found {len(results)} similar chunks for chunk {chunk_id}")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similar chunks search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Similar chunks search failed: {str(e)}")

@router.get("/related/{chunk_id}", response_model=List[SearchResultItem])
async def find_related_content(
    chunk_id: int,
    threshold: float = Query(0.7, ge=0.1, le=1.0, description="Similarity threshold for related content"),
    max_results: int = Query(3, ge=1, le=10, description="Maximum number of related chunks to return"),
    session: Session = Depends(get_session)
):
    """
    Find content related to a specific chunk using enhanced semantic analysis.
    Implements the "Connect the Dots" feature for better document intelligence.
    """
    try:
        # Get the reference chunk
        from app.crud.crud_document import get_text_chunk
        reference_chunk = get_text_chunk(session, chunk_id)
        if not reference_chunk:
            raise HTTPException(status_code=404, detail="Chunk not found")
        
        # Get all chunks from the same document
        document_chunks = get_text_chunks_by_document(session, reference_chunk.document_id)
        if not document_chunks:
            return []
        
        # Convert chunks to format expected by embedding service
        chunk_data_list = []
        chunk_lookup = {}
        
        for chunk in document_chunks:
            chunk_data = {
                'text_chunk': chunk.text_chunk,
                'page_number': chunk.page_number,
                'chunk_index': chunk.chunk_index,
                'chunk_type': chunk.chunk_type or 'content',
                'heading_level': chunk.heading_level,
                'semantic_cluster': chunk.semantic_cluster,
                'content_quality_score': getattr(chunk, 'content_quality_score', 0.5),
                'semantic_markers': getattr(chunk, 'semantic_markers', []),
                'extraction_method': getattr(chunk, 'extraction_method', 'standard'),
                'section_title': getattr(chunk, 'section_title', '')
            }
            chunk_data_list.append(chunk_data)
            chunk_lookup[f"{chunk.page_number}_{chunk.chunk_index}"] = chunk
        
        # Create reference chunk data
        reference_chunk_data = {
            'text_chunk': reference_chunk.text_chunk,
            'page_number': reference_chunk.page_number,
            'chunk_index': reference_chunk.chunk_index,
            'chunk_type': reference_chunk.chunk_type or 'content',
            'heading_level': reference_chunk.heading_level,
            'semantic_cluster': reference_chunk.semantic_cluster,
            'content_quality_score': getattr(reference_chunk, 'content_quality_score', 0.5),
            'semantic_markers': getattr(reference_chunk, 'semantic_markers', []),
            'extraction_method': getattr(reference_chunk, 'extraction_method', 'standard'),
            'section_title': getattr(reference_chunk, 'section_title', '')
        }
        
        # Find related content using enhanced semantic analysis
        embedding_service = get_embedding_service()
        related_chunks = embedding_service.find_related_content(
            reference_chunk_data, chunk_data_list, threshold, max_results
        )
        
        # Convert to search result items
        search_results = []
        document = get_document(session, reference_chunk.document_id)
        
        for related_chunk in related_chunks:
            # Find the corresponding database chunk
            chunk_key = f"{related_chunk['page_number']}_{related_chunk['chunk_index']}"
            db_chunk = chunk_lookup.get(chunk_key)
            
            if not db_chunk:
                continue
                
            result_item = SearchResultItem(
                chunk_id=db_chunk.id,
                document_id=db_chunk.document_id,
                document_name=document.file_name if document else "Unknown",
                similarity_score=related_chunk.get('similarity_score', 0.0),
                text_chunk=db_chunk.text_chunk,
                page_number=db_chunk.page_number,
                chunk_index=db_chunk.chunk_index,
                chunk_type=db_chunk.chunk_type,
                heading_level=db_chunk.heading_level,
                semantic_cluster=db_chunk.semantic_cluster
            )
            
            # Add relationship information if available
            if hasattr(result_item, '__dict__'):
                result_item.__dict__.update({
                    'relationship_type': related_chunk.get('relationship_type', 'related'),
                    'content_preview': related_chunk.get('content_preview', ''),
                    'extraction_quality': related_chunk.get('extraction_method', 'standard')
                })
            
            search_results.append(result_item)
        
        logger.info(f"Found {len(search_results)} related chunks for chunk {chunk_id}")
        return search_results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to find related content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to find related content: {str(e)}")

@router.get("/suggest")
async def search_suggestions(
    query: str = Query(..., min_length=1, max_length=100, description="Partial query for suggestions"),
    limit: int = Query(5, ge=1, le=10, description="Number of suggestions"),
    session: Session = Depends(get_session)
):
    """
    Get search suggestions based on existing document content.
    
    This is a simple implementation that finds common phrases in documents.
    """
    try:
        # This is a simplified suggestion implementation
        # In a full production system, you might use:
        # - Pre-computed phrase frequency indices
        # - Search analytics to suggest popular queries
        # - Auto-completion based on document titles and headings
        
        # For now, we'll search for text chunks that contain the query
        # and extract potential suggestions from headings and key phrases
        
        chunks = search_chunks_by_text(session, query, limit=limit * 3)
        
        suggestions = set()
        
        for chunk in chunks:
            # Extract potential suggestions from headings
            if chunk.heading_level:
                text = chunk.text_chunk.strip()
                if len(text) <= 100 and query.lower() in text.lower():
                    suggestions.add(text)
            
            # Extract phrases that contain the query
            words = chunk.text_chunk.split()
            for i in range(len(words) - 2):
                phrase = " ".join(words[i:i+3])
                if query.lower() in phrase.lower() and len(phrase) <= 50:
                    suggestions.add(phrase)
            
            if len(suggestions) >= limit:
                break
        
        return {
            "query": query,
            "suggestions": list(suggestions)[:limit]
        }
        
    except Exception as e:
        logger.error(f"Search suggestions failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate suggestions")

@router.get("/analytics")
async def search_analytics(
    session: Session = Depends(get_session)
):
    """
    Get search and content analytics.
    
    Provides insights into the document corpus and search patterns.
    """
    try:
        # Get shared service instances
        faiss_service = get_faiss_service()
        embedding_service = get_embedding_service()
        
        # Get database statistics
        from app.crud.crud_document import get_database_health
        db_health = get_database_health(session)
        
        # Get Faiss index information
        faiss_info = faiss_service.get_index_info()
        
        # Get embedding service information
        embedding_info = embedding_service.get_model_info()
        
        return {
            "database_statistics": db_health,
            "vector_index_statistics": faiss_info,
            "embedding_model_info": embedding_info,
            "search_capabilities": {
                "semantic_search_available": faiss_info.get('faiss_available', False) and embedding_info.get('model_loaded', False),
                "text_search_available": True,
                "similarity_search_available": faiss_info.get('index_size', 0) > 0
            }
        }
        
    except Exception as e:
        logger.error(f"Search analytics failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")
