import multiprocessing

# Server socket
bind = "0.0.0.0:8080"

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"

# Logging
loglevel = "info"
accesslog = "-"
errorlog = "-"

# Timeout settings
timeout = 120
keepalive = 2

# Performance settings
max_requests = 5000  # Increased to handle more audio range requests
max_requests_jitter = 100
worker_connections = 1000

# Keep workers alive longer to avoid frequent restarts
preload_app = True
