"""
Database configuration and session management.

Provides database engine and session dependencies for the FastAPI application.
"""
from sqlmodel import create_engine, Session
from app.core.config import settings

# Create database engine
engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Required for SQLite with FastAPI
)

def get_session():
    """
    Dependency to get database session.
    
    Yields a database session that automatically handles cleanup.
    """
    with Session(engine) as session:
        yield session
