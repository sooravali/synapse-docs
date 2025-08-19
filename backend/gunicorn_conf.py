import multiprocessing
import os

# Server socket
# Reads the PORT from the environment; defaults to 8080 if not set.
port = os.getenv("PORT", "8080")
bind = f"0.0.0.0:{port}"

# Worker processes
# Use only 1 worker for ML workloads to prevent memory exhaustion
# Each worker loads the entire sentence transformer model (~400MB)
workers = 1
worker_class = "uvicorn.workers.UvicornWorker"

# Logging
loglevel = "info"
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr

# Timeout settings - Increased for Cloud Run and large document processing
timeout = 600  # Increased to 600 seconds (10 minutes) for Cloud Run startup
keepalive = 2
graceful_timeout = 120  # Allow graceful shutdown

# Performance settings - Optimized for ML workloads and Cloud Run
max_requests = 1000  # Prevent memory leaks in ML models
max_requests_jitter = 50
worker_connections = 500

# Don't preload the application to allow faster startup in Cloud Run
# ML models will be loaded lazily on first use
preload_app = False
