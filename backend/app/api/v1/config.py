"""
Configuration API for Adobe Hackathon 2025
Provides runtime configuration to the frontend
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["config"])

class ConfigResponse(BaseModel):
    adobe_client_id: str

@router.get("/", response_model=ConfigResponse)
async def get_config():
    """
    Get runtime configuration for the frontend.
    This allows the frontend to get Adobe Client ID at runtime instead of build time.
    """
    try:
        adobe_client_id = settings.adobe_client_id
        
        if not adobe_client_id:
            logger.warning("Adobe Client ID not configured - checked ADOBE_CLIENT_ID and ADOBE_EMBED_API_KEY environment variables")
            logger.warning("Available environment variables: ADOBE_CLIENT_ID=%s, ADOBE_EMBED_API_KEY=%s", 
                         bool(settings.ADOBE_CLIENT_ID), bool(settings.ADOBE_EMBED_API_KEY))
        else:
            logger.info("Adobe Client ID loaded successfully (length: %d characters)", len(adobe_client_id))
        
        return ConfigResponse(adobe_client_id=adobe_client_id or "")
    except Exception as e:
        logger.error(f"Error getting configuration: {e}")
        return ConfigResponse(adobe_client_id="")
