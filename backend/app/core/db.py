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
    """
    with Session(engine) as session:
        yield session
