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

# Timeout settings - Increased for large document processing
timeout = 300  # Increased from 120 to 300 seconds (5 minutes) for large PDFs
keepalive = 2

# Performance settings - Optimized for ML workloads
max_requests = 1000  # Prevent memory leaks in ML models
max_requests_jitter = 50
worker_connections = 500

# Preload the application to improve performance
preload_app = True
