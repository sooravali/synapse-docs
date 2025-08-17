"""
API v1 Router Configuration

Configures all v1 API endpoints for the Synapse-Docs service.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import documents, search, system, llm, graph
from app.api.v1 import insights, config

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(
    documents.router,
    prefix="/documents",
    tags=["documents"]
)

api_router.include_router(
    config.router,
    prefix="/config",
    tags=["config"]
)

api_router.include_router(
    search.router,
    prefix="/search",
    tags=["search"]
)

api_router.include_router(
    system.router,
    prefix="/system",
    tags=["system"]
)

api_router.include_router(
    graph.router,
    prefix="/graph",
    tags=["knowledge-graph"]
)

api_router.include_router(
    llm.router,
    prefix="",  # Mount directly under /api/v1/ for /insights and /podcast endpoints
    tags=["llm"]
)

# Add hackathon features
api_router.include_router(
    insights.router,
    prefix="",  # Mount directly under /api/v1/
    tags=["hackathon-features"]
)
