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
        if not settings.adobe_client_id:
            logger.warning("Adobe Client ID not configured (checked both ADOBE_CLIENT_ID and ADOBE_EMBED_API_KEY)")
            return ConfigResponse(adobe_client_id="")
        
        return ConfigResponse(adobe_client_id=settings.adobe_client_id)
    except Exception as e:
        logger.error(f"Error getting configuration: {e}")
        return ConfigResponse(adobe_client_id="")
