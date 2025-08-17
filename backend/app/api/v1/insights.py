"""
Insights API for Adobe Hackathon 2025
Implements the "Insights Bulb" and "Podcast Mode" features
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Depends
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, validator
from typing import Dict, Any, Optional, List
import logging
import os

from sqlmodel import Session
from app.core.database import get_session
from app.crud.crud_document import get_document, get_text_chunks_by_document
from app.services.llm_service import generate_insights, generate_podcast_script
from app.services.tts_service import generate_podcast_audio
from app.services.shared import get_embedding_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["insights"])

class InsightsRequest(BaseModel):
    text: str
    context: Optional[str] = ""

class DocumentInsightsRequest(BaseModel):
    document_id: int
    analysis_type: Optional[str] = "comprehensive"  # "structure", "themes", "quality", "comprehensive"

class PodcastRequest(BaseModel):
    content: str
    related_content: Optional[str] = ""
    generate_audio: Optional[bool] = True

class InsightsResponse(BaseModel):
    insights: str
    status: str
    error: Optional[str] = None

class DocumentInsightsResponse(BaseModel):
    document_id: int
    document_name: str
    insights: List[Dict[str, Any]]
    summary: str
    total_chunks: int
    processing_quality: str
    status: str
    error: Optional[str] = None

    @validator('document_name')
    def clean_document_name(cls, v):
        """Remove doc_X_ prefix from document name for frontend display."""
        if isinstance(v, str) and v.startswith('doc_') and '_' in v:
            # Remove "doc_X_" prefix: "doc_5_filename.pdf" -> "filename.pdf"
            parts = v.split('_', 2)  # Split on first 2 underscores
            if len(parts) >= 3:
                return parts[2]  # Return everything after "doc_X_"
        return v

class PodcastResponse(BaseModel):
    script: str
    audio_url: Optional[str] = None
    status: str
    error: Optional[str] = None
    message: Optional[str] = None

@router.post("/generate", response_model=InsightsResponse)
async def generate_text_insights(request: InsightsRequest, session: Session = Depends(get_session)):
    """
    Enhanced insights generation using semantic search foundation.
    Implements the sophisticated "Insights Bulb" feature following the chain:
    1. Perform semantic search to get Top 5 relevant snippets
    2. Use snippets as input for LLM-based insight analysis
    3. Return structured insights with citations
    """
    try:
        logger.info(f"Generating enhanced insights for text: {request.text[:100]}...")
        
        # STAGE 1: Perform semantic search to get relevant snippets
        from app.services.shared import get_embedding_service
        from app.crud.crud_document import get_text_chunks_by_faiss_positions
        
        embedding_service = get_embedding_service()
        
        # Generate embedding for the user's selected text
        query_embedding = embedding_service.create_embedding(request.text)
        
        if not query_embedding:
            logger.warning("Failed to generate embedding, proceeding without snippets")
            print("⚠️ INSIGHTS GENERATION - Failed to generate embedding")
            snippets = []
        else:
            # Search for relevant snippets using Faiss
            from app.services.shared import get_faiss_service
            faiss_service = get_faiss_service()
            
            print("🔍 INSIGHTS GENERATION - Performing semantic search...")
            print(f"  📝 Query text: {request.text[:100]}...")
            
            # Search across ALL documents to find connections between different documents
            # This is crucial for insights generation - we want to find relationships
            # between documents (e.g., breakfast ideas vs dinner ideas, etc.)
            faiss_results = faiss_service.search(
                query_embedding=query_embedding,
                top_k=5,  # Get top 5 snippets as per requirements
                similarity_threshold=0.2,  # Lower threshold to catch more potential connections
                session_id=None  # Search across all documents, not just current session
            )
            
            print(f"  📊 Found {len(faiss_results) if faiss_results else 0} FAISS results")
            
            # Get chunk details from database
            snippets = []
            if faiss_results:
                faiss_positions = [result['faiss_index_position'] for result in faiss_results]
                chunks = get_text_chunks_by_faiss_positions(session, faiss_positions)
                
                print(f"  📄 Retrieved {len(chunks)} chunks from database")
                
                # Create snippet objects with similarity scores
                for i, chunk in enumerate(chunks):
                    if i < len(faiss_results):
                        from app.crud.crud_document import get_document
                        document = get_document(session, chunk.document_id)
                        document_name = document.file_name if document else "Unknown Document"
                        
                        snippet = {
                            'document_name': document_name,
                            'text_chunk': chunk.text_chunk,
                            'page_number': chunk.page_number,
                            'similarity_score': faiss_results[i]['similarity_score']
                        }
                        snippets.append(snippet)
                        
                        print(f"    📋 {i+1}. {document_name} (similarity: {faiss_results[i]['similarity_score']:.3f})")
                        print(f"       📝 {chunk.text_chunk[:100]}...")
            else:
                print("  ❌ No FAISS results found")
        
        print(f"✅ INSIGHTS GENERATION - Found {len(snippets)} total snippets")
        logger.info(f"Found {len(snippets)} relevant snippets for insights generation")
        
        # STAGE 2: Generate insights using LLM with snippets as context
        result = await generate_insights(request.text, request.context, snippets)
        
        # Convert insights dict to JSON string for response
        insights_str = result["insights"]
        if isinstance(insights_str, dict):
            import json
            insights_str = json.dumps(insights_str, indent=2)
        
        return InsightsResponse(
            insights=insights_str,
            status=result["status"],
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in enhanced insights generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/document", response_model=DocumentInsightsResponse)
async def generate_document_insights(
    request: DocumentInsightsRequest, 
    session: Session = Depends(get_session)
):
    """
    Generate comprehensive insights for a document using enhanced semantic analysis.
    Leverages the improved Challenge 1A + 1B processing for better document intelligence.
    """
    try:
        logger.info(f"Generating insights for document ID: {request.document_id}")
        
        # Get document
        document = get_document(session, request.document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get document chunks
        chunks = get_text_chunks_by_document(session, request.document_id)
        if not chunks:
            return DocumentInsightsResponse(
                document_id=request.document_id,
                document_name=document.file_name,
                insights=[],
                summary="No content available for analysis",
                total_chunks=0,
                processing_quality="none",
                status="empty",
                error="No text chunks found for document"
            )
        
        # Convert chunks to format expected by embedding service
        document_chunks = []
        for chunk in chunks:
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
            document_chunks.append(chunk_data)
        
        # Generate enhanced insights using improved semantic analysis
        embedding_service = get_embedding_service()
        insights_result = embedding_service.generate_document_insights(document_chunks)
        
        return DocumentInsightsResponse(
            document_id=request.document_id,
            document_name=document.file_name,
            insights=insights_result.get("insights", []),
            summary=insights_result.get("summary", "Analysis completed"),
            total_chunks=insights_result.get("total_chunks", len(chunks)),
            processing_quality=insights_result.get("processing_quality", "standard"),
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating document insights: {e}")
        return DocumentInsightsResponse(
            document_id=request.document_id,
            document_name="Unknown",
            insights=[],
            summary="Analysis failed",
            total_chunks=0,
            processing_quality="error",
            status="error",
            error=str(e)
        )

@router.post("/podcast", response_model=PodcastResponse)
async def generate_podcast(request: PodcastRequest, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    """
    Enhanced podcast generation using the full chain approach:
    1. Get related snippets via semantic search (if not provided)
    2. Generate insights from content + snippets 
    3. Create two-speaker podcast script using insights
    4. Generate multi-voice audio
    
    Implements the sophisticated "Podcast Mode" feature from hackathon requirements.
    """
    try:
        logger.info(f"Generating enhanced podcast for content: {request.content[:100]}...")
        
        # TERMINAL LOG - Request details
        print("=" * 60)
        print("🎧 PODCAST GENERATION REQUEST")
        print("=" * 60)
        print(f"📝 Content length: {len(request.content)} characters")
        print(f"🔗 Related content provided: {'Yes' if request.related_content else 'No'}")
        print(f"🎵 Generate audio requested: {request.generate_audio}")
        print(f"🎬 Content preview: {request.content[:150]}...")
        if request.related_content:
            print(f"🔗 Related content preview: {request.related_content[:150]}...")
        print("-" * 60)
        
        # STAGE 1: Get related snippets if not provided
        snippets = []
        if not request.related_content:
            logger.info("No related content provided, performing semantic search...")
            
            # TERMINAL LOG
            print("🔍 PODCAST GENERATION - Performing semantic search for snippets...")
            
            from app.services.shared import get_embedding_service, get_faiss_service
            from app.crud.crud_document import get_text_chunks_by_faiss_positions, get_document
            
            embedding_service = get_embedding_service()
            query_embedding = embedding_service.create_embedding(request.content)
            
            if query_embedding:
                faiss_service = get_faiss_service()
                faiss_results = faiss_service.search(
                    query_embedding=query_embedding,
                    top_k=5,
                    similarity_threshold=0.3,
                    session_id=None  # Search across all documents
                )
                
                print(f"  Found {len(faiss_results) if faiss_results else 0} FAISS results")
                
                if faiss_results:
                    faiss_positions = [result['faiss_index_position'] for result in faiss_results]
                    chunks = get_text_chunks_by_faiss_positions(session, faiss_positions)
                    
                    # Format snippets for script generation
                    snippet_texts = []
                    for i, chunk in enumerate(chunks):
                        if i < len(faiss_results):
                            document = get_document(session, chunk.document_id)
                            document_name = document.file_name if document else "Unknown Document"
                            snippet_texts.append(f"From {document_name}: {chunk.text_chunk[:200]}...")
                    
                    request.related_content = "\n\n".join(snippet_texts)
                    print(f"  Prepared {len(snippet_texts)} related content snippets")
                    logger.info(f"Found {len(snippet_texts)} related snippets for podcast")
            else:
                print("  Failed to generate query embedding")
        else:
            print("🔍 PODCAST GENERATION - Using provided related content")
        
        # STAGE 2: Generate insights for structured content
        insights = None
        try:
            print("🧠 PODCAST GENERATION - Generating insights...")
            insights_result = await generate_insights(request.content, request.related_content, snippets)
            if insights_result.get("status") == "success":
                insights = insights_result.get("insights")
                print("  ✅ Insights generated successfully for podcast")
                logger.info("Generated insights for podcast script")
            else:
                print(f"  ⚠️ Insights generation failed: {insights_result.get('error', 'Unknown error')}")
        except Exception as e:
            print(f"  💥 Exception generating insights: {e}")
            logger.warning(f"Failed to generate insights for podcast: {e}")
        
        # STAGE 3: Generate enhanced podcast script using insights
        print("📝 PODCAST GENERATION - Generating script...")
        script = await generate_podcast_script(request.content, request.related_content, insights)
        
        # STAGE 4: Generate multi-speaker audio
        print("🎙️ PODCAST GENERATION - Generating audio...")
        audio_path = None
        audio_url = None
        message = "Enhanced podcast script generated successfully."
        
        if request.generate_audio:
            try:
                print("🎵 PODCAST GENERATION - Attempting audio generation...")
                from app.services.tts_service import generate_podcast_audio
                print(f"  📝 Script length: {len(script)} characters")
                print(f"  🎬 Script preview: {script[:200]}...")
                
                audio_result = await generate_podcast_audio(script)
                print(f"  📊 Audio result type: {type(audio_result)}")
                print(f"  📊 Audio result: {audio_result}")
                
                if isinstance(audio_result, tuple) and len(audio_result) == 2:
                    audio_path, is_real_audio = audio_result
                    print(f"  📁 Audio path: {audio_path}")
                    print(f"  ✅ Is real audio: {is_real_audio}")
                    
                    if audio_path and is_real_audio:
                        # Real multi-speaker audio was generated successfully
                        import os
                        filename = os.path.basename(audio_path)
                        audio_url = f"/api/v1/insights/audio/{filename}"
                        message = "Enhanced podcast script and high-quality multi-speaker audio generated successfully."
                        
                        print(f"  🎉 SUCCESS: Audio file created at {audio_path}")
                        print(f"  🌐 Audio URL: {audio_url}")
                        logger.info(f"Multi-speaker audio generated successfully: {filename}")
                    elif audio_path and not is_real_audio:
                        # Audio generation failed
                        audio_url = None
                        message = "Enhanced podcast script generated. Multi-speaker audio generation failed, using text-only mode."
                        
                        print(f"  ⚠️ PARTIAL SUCCESS: Audio path exists but not real audio")
                        logger.warning("Multi-speaker audio generation failed")
                    else:
                        # No audio generated at all
                        message = "Enhanced podcast script generated. Audio generation currently unavailable."
                        
                        print(f"  ❌ FAILURE: No audio path or real audio flag false")
                        logger.error("No audio generated")
                else:
                    print(f"  💥 UNEXPECTED RESULT: Expected tuple with 2 elements, got {audio_result}")
                    message = "Enhanced podcast script generated. Audio generation returned unexpected result."
                        
            except Exception as audio_error:
                print(f"  💥 EXCEPTION during audio generation: {audio_error}")
                print(f"  🔍 Exception type: {type(audio_error)}")
                import traceback
                print(f"  📋 Traceback: {traceback.format_exc()}")
                logger.warning(f"Audio generation failed: {audio_error}")
                message = "Enhanced podcast script generated. Audio generation encountered an error."
        else:
            print("🔇 PODCAST GENERATION - Audio generation disabled (generate_audio=False)")
        
        return PodcastResponse(
            script=script,
            audio_url=audio_url,
            status="success",
            message=message
        )
        
    except Exception as e:
        logger.error(f"Error in enhanced podcast generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/audio/status")
async def get_audio_status():
    """
    Check the status of the latest generated audio file.
    """
    try:
        from app.services.tts_service import tts_service
        
        # Use configurable audio directory
        audio_dir = os.environ.get("AUDIO_DIR", "./data/audio")
        audio_path = os.path.join(audio_dir, "latest_podcast.mp3")
        
        if not os.path.exists(audio_path):
            return {
                "status": "no_audio",
                "message": "No audio file found",
                "audio_available": False
            }
        
        file_size = os.path.getsize(audio_path)
        is_real = tts_service.is_real_audio(audio_path)
        
        return {
            "status": "real_audio" if is_real else "mock_audio",
            "message": "High-quality audio available" if is_real else "Mock audio only (TTS unavailable)",
            "audio_available": is_real,
            "file_size": file_size,
            "audio_url": "/api/v1/insights/audio/latest_podcast.mp3" if is_real else None
        }
        
    except Exception as e:
        logger.error(f"Error checking audio status: {e}")
        return {
            "status": "error",
            "message": f"Error checking audio: {str(e)}",
            "audio_available": False
        }

@router.get("/audio/{filename}")
async def get_podcast_audio(filename: str, request: Request):
    """
    Serve generated podcast audio files with proper range request support.
    """
    try:
        # Use configurable audio directory
        audio_dir = os.environ.get("AUDIO_DIR", "./data/audio")
        audio_path = os.path.join(audio_dir, filename)
        
        # Check if the actual MP3 file exists
        if os.path.exists(audio_path):
            # Get file size for range requests
            file_size = os.path.getsize(audio_path)
            
            # Handle range requests (required for audio streaming)
            range_header = request.headers.get('range')
            if range_header:
                # Parse range header (format: "bytes=start-end")
                try:
                    range_match = range_header.replace('bytes=', '').split('-')
                    start = int(range_match[0]) if range_match[0] else 0
                    end = int(range_match[1]) if range_match[1] else file_size - 1
                    
                    # Ensure valid range
                    start = max(0, start)
                    end = min(file_size - 1, end)
                    content_length = end - start + 1
                    
                    # Prevent excessive small range requests
                    if content_length < 1024 and file_size > 1024:
                        # If requesting very small chunks, serve larger chunks
                        end = min(start + 8192, file_size - 1)  # Serve at least 8KB chunks
                        content_length = end - start + 1
                    
                    # Read the specified range
                    with open(audio_path, 'rb') as f:
                        f.seek(start)
                        data = f.read(content_length)
                    
                    return Response(
                        content=data,
                        status_code=206,  # Partial Content
                        headers={
                            "Content-Type": "audio/mpeg",
                            "Accept-Ranges": "bytes",
                            "Content-Range": f"bytes {start}-{end}/{file_size}",
                            "Content-Length": str(content_length),
                            "Cache-Control": "public, max-age=3600",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "Range"
                        }
                    )
                except (ValueError, IndexError):
                    # Invalid range, fall back to full file
                    pass
            
            # Serve full file
            return FileResponse(
                audio_path,
                media_type="audio/mpeg",
                filename=filename,
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(file_size),
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*"
                }
            )
        
        # File not found
        raise HTTPException(status_code=404, detail="Audio file not found")
    except Exception as e:
        logger.error(f"Error serving audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))
