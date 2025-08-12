"""
Insights API for Adobe Hackathon 2025
Implements the "Insights Bulb" and "Podcast Mode" features
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging
import os

from app.services.llm_service import generate_insights, generate_podcast_script
from app.services.tts_service import generate_podcast_audio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["insights"])

class InsightsRequest(BaseModel):
    text: str
    context: Optional[str] = ""

class PodcastRequest(BaseModel):
    content: str
    related_content: Optional[str] = ""

class InsightsResponse(BaseModel):
    insights: str
    status: str
    error: Optional[str] = None

class PodcastResponse(BaseModel):
    script: str
    audio_url: Optional[str] = None
    status: str
    error: Optional[str] = None
    message: Optional[str] = None

@router.post("/generate", response_model=InsightsResponse)
async def generate_text_insights(request: InsightsRequest):
    """
    Generate insights for the given text using LLM.
    Implements the "Insights Bulb" feature from hackathon requirements.
    """
    try:
        logger.info(f"Generating insights for text: {request.text[:100]}...")
        result = await generate_insights(request.text, request.context)
        
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
        logger.error(f"Error in insights generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/podcast", response_model=PodcastResponse)
async def generate_podcast(request: PodcastRequest, background_tasks: BackgroundTasks):
    """
    Generate podcast script and audio for the given content.
    Implements the "Podcast Mode" feature from hackathon requirements.
    """
    try:
        logger.info(f"Generating podcast for content: {request.content[:100]}...")
        
        # Generate script
        script = await generate_podcast_script(request.content, request.related_content)
        
        # Generate audio
        audio_path = None
        audio_url = None
        message = "Podcast script generated successfully."
        
        try:
            audio_result = await generate_podcast_audio(script, "latest_podcast.mp3")
            audio_path, is_real_audio = audio_result
            
            if audio_path and is_real_audio:
                # Real audio was generated successfully
                audio_url = "/api/v1/insights/audio/latest_podcast.mp3"
                message = "Podcast script and high-quality audio generated successfully."
                logger.info("Real audio generated successfully, enabling audio URL")
            elif audio_path and not is_real_audio:
                # Mock audio was generated (Azure TTS failed)
                audio_url = None  # Don't serve mock audio to prevent confusion
                message = "Podcast script generated. Audio generation failed, using text-only mode."
                logger.warning("Mock audio generated due to TTS failure, disabling audio URL")
            else:
                # No audio generated at all
                message = "Podcast script generated. Audio generation currently unavailable."
                logger.error("No audio generated")
                
        except Exception as audio_error:
            logger.warning(f"Audio generation failed: {audio_error}")
            message = "Podcast script generated. Audio generation encountered an error."
        
        return PodcastResponse(
            script=script,
            audio_url=audio_url,
            status="success",
            message=message
        )
    except Exception as e:
        logger.error(f"Error in podcast generation: {e}")
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
