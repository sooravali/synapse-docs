"""
LLM-powered API endpoints for insights and podcast features.
"""
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
import io
import logging
from typing import Dict, Any

from app.core.llm_services import llm_service, podcast_service, InsightRequest, PodcastRequest

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/insights", response_model=Dict[str, Any])
async def generate_insights(request: InsightRequest):
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
        
        insights = await llm_service.generate_insights(request)
        
        logger.info("Successfully generated insights")
        return insights
        
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate insights. Please try again later."
        )

@router.post("/podcast")
async def generate_podcast(request: PodcastRequest):
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
        
        # Generate podcast audio
        audio_content = await podcast_service.generate_podcast(request)
        
        logger.info(f"Successfully generated podcast audio ({len(audio_content)} bytes)")
        
        # Return audio as streaming response
        audio_stream = io.BytesIO(audio_content)
        
        return StreamingResponse(
            io.BytesIO(audio_content),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "attachment; filename=podcast.mp3",
                "Content-Length": str(len(audio_content))
            }
        )
        
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
        # Simple health check - verify configuration
        provider = llm_service.llm_provider
        has_key = bool(llm_service.gemini_api_key or llm_service.azure_openai_key)
        
        return {
            "status": "healthy" if has_key else "configuration_missing",
            "llm_provider": provider,
            "configured": has_key
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
        # Simple health check - verify configuration
        provider = podcast_service.tts_service.tts_provider
        has_key = bool(
            podcast_service.tts_service.azure_tts_key or 
            podcast_service.tts_service.google_tts_key
        )
        
        return {
            "status": "healthy" if has_key else "configuration_missing",
            "tts_provider": provider,
            "configured": has_key
        }
    except Exception as e:
        logger.error(f"TTS health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
