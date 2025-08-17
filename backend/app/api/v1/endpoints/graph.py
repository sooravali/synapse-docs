"""
Knowledge Graph endpoints@router.get("/connectivity")
async def get_document_connectivity_graph(
    request: Request,
    session: Session = Depends(get_session),
    similarity_threshold: float = 0.15,  # Much lower threshold based on search defaults
    max_connections_per_doc: int = 8     # More connections for richer graph
):cument connectivity visualization.

This endpoint generates graph data for visualizing relationships between documents
using semantic similarity calculated from existing embeddings in the Faiss index.
"""
import logging
from typing import List, Dict, Any, Optional
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from app.core.database import get_session
from app.services.shared import get_faiss_service, get_embedding_service
from app.crud.crud_document import get_all_documents, get_text_chunks_by_document
from app.models.document import Document

logger = logging.getLogger(__name__)

router = APIRouter()

def get_session_id(request: Request) -> str:
    """Extract session ID from request headers."""
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID is required")
    return session_id

@router.get("/connectivity")
async def get_document_connectivity_graph(
    request: Request,
    session: Session = Depends(get_session),
    similarity_threshold: float = 0.4,  # Lower threshold for better connections
    max_connections_per_doc: int = 8    # More connections for richer graph
):
    """
    Generate knowledge graph data showing connections between documents.
    
    This endpoint:
    1. Fetches all documents for the current session
    2. Calculates pairwise semantic similarity between documents
    3. Returns graph data with nodes (documents) and edges (relationships)
    
    Args:
        similarity_threshold: Minimum similarity score to create a connection (0.0-1.0)
        max_connections_per_doc: Maximum number of connections per document
        
    Returns:
        Graph data in format compatible with react-force-graph-2d:
        {
            "nodes": [{"id": "doc_id", "name": "filename", "size": page_count}],
            "links": [{"source": "doc_id_1", "target": "doc_id_2", "weight": 0.85}]
        }
    """
    start_time = time.time()
    session_id = get_session_id(request)
    
    logger.info(f"Generating knowledge graph for session {session_id}")
    
    try:
        # Get services
        faiss_service = get_faiss_service()
        embedding_service = get_embedding_service()
        
        # Set session for Faiss service
        faiss_service.set_session(session_id)
        
        # Get all documents for this session
        documents = get_all_documents(session, session_id)
        
        logger.info(f"Found {len(documents)} documents for session {session_id}")
        for doc in documents:
            logger.info(f"  - Document {doc.id}: {doc.file_name} (status: {doc.status}, chunks: {doc.total_chunks})")
        
        if len(documents) < 2:
            logger.info(f"Only {len(documents)} documents found - need at least 2 for graph")
            return {
                "nodes": [
                    {
                        "id": f"doc_{doc.id}",
                        "name": _clean_filename(doc.file_name),
                        "size": doc.page_count or 10,
                        "status": doc.status,
                        "document_id": doc.id
                    } for doc in documents
                ],
                "links": []
            }
        
        logger.info(f"Processing {len(documents)} documents for graph generation")
        
        # Create nodes for all documents
        nodes = []
        document_chunks = {}  # Cache chunks for each document
        
        for doc in documents:
            node = {
                "id": f"doc_{doc.id}",
                "name": _clean_filename(doc.file_name),
                "size": max(doc.page_count or 10, 10),  # Minimum size for visibility
                "status": doc.status,
                "document_id": doc.id,
                "total_chunks": doc.total_chunks or 0
            }
            nodes.append(node)
            
            # Get chunks for this document (needed for similarity calculation)
            if doc.status == "ready":
                chunks = get_text_chunks_by_document(session, doc.id)
                document_chunks[doc.id] = chunks
            else:
                document_chunks[doc.id] = []
        
        # Calculate pairwise document similarity
        links = []
        processed_pairs = set()
        
        logger.info("Calculating pairwise document similarities...")
        
        for i, doc_a in enumerate(documents):
            if doc_a.status != "ready" or doc_a.id not in document_chunks:
                continue
                
            chunks_a = document_chunks[doc_a.id]
            if not chunks_a:
                continue
            
            # Track connections for this document to limit max connections
            doc_connections = []
            
            for j, doc_b in enumerate(documents):
                if i >= j:  # Skip self and already processed pairs
                    continue
                    
                if doc_b.status != "ready" or doc_b.id not in document_chunks:
                    continue
                    
                chunks_b = document_chunks[doc_b.id]
                if not chunks_b:
                    continue
                
                pair_key = tuple(sorted([doc_a.id, doc_b.id]))
                if pair_key in processed_pairs:
                    continue
                
                processed_pairs.add(pair_key)
                
                # Calculate similarity between documents
                similarity_score = await _calculate_document_similarity(
                    chunks_a, chunks_b, faiss_service, embedding_service
                )
                
                if similarity_score >= similarity_threshold:
                    doc_connections.append((doc_b.id, similarity_score))
            
            # Sort connections by similarity and take top max_connections_per_doc
            doc_connections.sort(key=lambda x: x[1], reverse=True)
            doc_connections = doc_connections[:max_connections_per_doc]
            
            # Create links for this document's connections
            for doc_b_id, similarity_score in doc_connections:
                link = {
                    "source": f"doc_{doc_a.id}",
                    "target": f"doc_{doc_b_id}",
                    "weight": round(similarity_score, 3),
                    "strength": _calculate_link_strength(similarity_score)
                }
                links.append(link)
        
        # Remove any orphaned nodes (nodes with no connections) if there are many documents
        if len(documents) > 5:
            connected_node_ids = set()
            for link in links:
                connected_node_ids.add(link["source"])
                connected_node_ids.add(link["target"])
            
            # Keep all nodes if less than half are connected, otherwise filter
            if len(connected_node_ids) >= len(nodes) / 2:
                nodes = [node for node in nodes if node["id"] in connected_node_ids]
        
        elapsed_time = time.time() - start_time
        
        logger.info(f"Graph generation completed in {elapsed_time:.2f}s: {len(nodes)} nodes, {len(links)} links")
        
        return {
            "nodes": nodes,
            "links": links,
            "metadata": {
                "total_documents": len(documents),
                "connected_documents": len(nodes),
                "total_connections": len(links),
                "similarity_threshold": similarity_threshold,
                "generation_time": round(elapsed_time, 2)
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating knowledge graph: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate knowledge graph: {str(e)}"
        )

async def _calculate_document_similarity(
    chunks_a: List, chunks_b: List, faiss_service, embedding_service
) -> float:
    """
    Calculate semantic similarity between two documents based on their chunks.
    
    Strategy: Use a simpler approach based on existing embeddings in Faiss
    1. For each chunk from document A, find the most similar chunk from document B
    2. Calculate average similarity across all chunk pairs
    3. Weight by chunk importance (longer chunks = more weight)
    """
    if not chunks_a or not chunks_b:
        return 0.0
    
    doc_b_id = chunks_b[0].document_id
    total_similarity = 0.0
    total_weight = 0.0
    
    # Sample chunks to avoid expensive computation for large documents
    max_chunks_to_compare = 8
    sample_chunks_a = chunks_a[:max_chunks_to_compare] if len(chunks_a) > max_chunks_to_compare else chunks_a
    
    try:
        for chunk_a in sample_chunks_a:
            if not chunk_a.text_chunk or len(chunk_a.text_chunk.strip()) < 30:
                continue
            
            # Calculate weight based on chunk length (longer chunks are more important)
            chunk_weight = min(len(chunk_a.text_chunk) / 200.0, 3.0)  # Cap at 3x weight
            
            try:
                # Generate embedding for this chunk
                embedding = embedding_service.create_embedding(chunk_a.text_chunk)
                if not embedding:
                    continue
                
                # Search for similar chunks using Faiss
                search_results = faiss_service.search(
                    embedding, 
                    top_k=15,  # Get more results to find document B chunks
                    similarity_threshold=0.1  # Very low threshold for initial search
                )
                
                # Find the best match from document B
                best_similarity = 0.0
                doc_b_matches = 0
                
                for result in search_results:
                    result_doc_id = result.get('document_id')
                    if result_doc_id == doc_b_id:
                        similarity_score = result.get('similarity_score', 0.0)
                        best_similarity = max(best_similarity, similarity_score)
                        doc_b_matches += 1
                
                if best_similarity > 0:
                    # Boost similarity if multiple chunks match (indicates stronger connection)
                    boost_factor = min(1.0 + (doc_b_matches - 1) * 0.1, 1.5)
                    weighted_similarity = best_similarity * boost_factor * chunk_weight
                    total_similarity += weighted_similarity
                    total_weight += chunk_weight
                
            except Exception as e:
                logger.warning(f"Error processing chunk similarity: {e}")
                continue
        
        if total_weight == 0:
            return 0.0
        
        # Average similarity weighted by chunk importance
        avg_similarity = total_similarity / total_weight
        
        # Apply scaling to make similarity scores more meaningful
        # Scale up weaker connections to account for the fact that even related documents
        # might not have very high individual chunk similarities
        scaled_similarity = min(avg_similarity * 1.5, 1.0)
        
        logger.debug(f"Document similarity calculation: total_sim={total_similarity:.3f}, total_weight={total_weight:.3f}, avg={avg_similarity:.3f}, scaled={scaled_similarity:.3f}")
        
        return scaled_similarity
        
    except Exception as e:
        logger.error(f"Error calculating document similarity: {e}")
        return 0.0

def _calculate_link_strength(similarity_score: float) -> str:
    """Convert similarity score to visual link strength category."""
    if similarity_score >= 0.8:
        return "strong"
    elif similarity_score >= 0.65:
        return "medium"
    else:
        return "weak"

def _clean_filename(filename: str) -> str:
    """Clean filename for display in the graph."""
    if not filename:
        return "Unknown Document"
    
    # Remove common prefixes and extensions
    cleaned = filename.replace("doc_", "").replace(".pdf", "")
    
    # Truncate very long filenames
    if len(cleaned) > 30:
        cleaned = cleaned[:27] + "..."
    
    return cleaned
