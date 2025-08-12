"""
LLM-powered API endpoints for insights and podcast features.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io
import logging
from typing import Dict, Any, List

from app.services.llm_service import generate_insights, generate_podcast_script
from app.services.tts_service import generate_podcast_audio

logger = logging.getLogger(__name__)

router = APIRouter()

class InsightRequest(BaseModel):
    main_text: str
    recommendations: List[Dict[str, Any]] = []

class PodcastRequest(BaseModel):
    main_text: str
    recommendations: List[Dict[str, Any]] = []

@router.post("/insights", response_model=Dict[str, Any])
async def generate_text_insights(request: InsightRequest):
    """
    Generate intelligent insights from main content and recommendations.
    
    This endpoint uses the configured LLM provider (Gemini, Azure OpenAI, etc.)
    to analyze the main text and related recommendations, providing:
    - Key insights about the content
    - Connections between different pieces of information
    - Actionable recommendations
    - Summary of key findings
    """
    try:
        logger.info(f"Generating insights for text of length: {len(request.main_text)}")
        
        # Create context from recommendations
        context = ""
        if request.recommendations:
            context_parts = []
            for rec in request.recommendations:
                text = rec.get('text_chunk', rec.get('text', ''))
                doc_name = rec.get('document_name', 'Unknown Document')
                page = rec.get('page_number', 'N/A')
                context_parts.append(f"From '{doc_name}' (page {page}): {text[:200]}...")
            context = "\n".join(context_parts)
        
        insights = await generate_insights(request.main_text, context)
        
        logger.info("Successfully generated insights")
        return insights
        
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate insights. Please try again later."
        )

@router.post("/podcast")
async def generate_podcast_audio_endpoint(request: PodcastRequest):
    """
    Generate a podcast audio file from insights.
    
    This endpoint:
    1. Generates insights using the LLM service
    2. Formats the insights into a narrative podcast script
    3. Converts the script to speech using the configured TTS provider
    4. Returns the audio file as an MP3 stream
    
    The resulting podcast is typically 2-3 minutes long.
    """
    try:
        logger.info(f"Generating podcast for text of length: {len(request.main_text)}")
        
        # Create context from recommendations
        related_content = ""
        if request.recommendations:
            parts = []
            for rec in request.recommendations:
                text = rec.get('text_chunk', rec.get('text', ''))
                parts.append(text[:200])
            related_content = " ".join(parts)
        
        # Generate podcast script
        script = await generate_podcast_script(request.main_text, related_content)
        
        # Generate audio
        audio_result = await generate_podcast_audio(script)
        
        if audio_result[0]:  # If audio was generated successfully
            with open(audio_result[0], 'rb') as f:
                audio_content = f.read()
            
            return StreamingResponse(
                io.BytesIO(audio_content),
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": "attachment; filename=podcast.mp3",
                    "Content-Length": str(len(audio_content))
                }
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to generate podcast audio")
        
    except Exception as e:
        logger.error(f"Error generating podcast: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate podcast. Please try again later."
        )

@router.get("/insights/health")
async def insights_health():
    """Check the health of LLM services."""
    try:
        from app.services.llm_service import llm_service
        
        return {
            "status": "healthy",
            "llm_provider": llm_service.provider
        }
    except Exception as e:
        logger.error(f"LLM health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@router.get("/podcast/health")
async def podcast_health():
    """Check the health of TTS services."""
    try:
        from app.services.tts_service import tts_service
        
        return {
            "status": "healthy",
            "tts_provider": tts_service.provider
        }
    except Exception as e:
        logger.error(f"TTS health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
