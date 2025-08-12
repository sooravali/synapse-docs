# Adobe Hackathon 2025 - Ultra-Optimized Dockerfile for Synapse-Docs
# Target: Reduce from ~12GB to ~3-4GB with full functionality preservation

# Stage 1: Frontend Build (minimal Alpine)
FROM node:18-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Dependencies (optimized compilation)
FROM python:3.11-slim AS python-deps
WORKDIR /deps

# Critical: Install minimal build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libc6-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install to user directory for isolation
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --user --no-warn-script-location \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.5.0+cpu torchvision==0.20.0+cpu
RUN pip install --no-cache-dir --user --no-warn-script-location \
    -r requirements.txt
RUN find /root/.local -name "*.pyc" -delete || true && \
    find /root/.local -name "__pycache__" -exec rm -rf {} + || true

# Stage 3: Minimal Runtime (ultra-slim)
FROM python:3.11-slim AS runtime
WORKDIR /app

# Production environment optimization
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/root/.local/bin:$PATH \
    MALLOC_TRIM_THRESHOLD_=100000

# Install absolute minimal runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libblas3 \
    liblapack3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /tmp/* /var/tmp/*

# Copy optimized Python environment
COPY --from=python-deps /root/.local /root/.local

# Copy minimal application files only
COPY backend/app /app/app
COPY backend/gunicorn_conf.py /app/
COPY --from=frontend /frontend/dist /app/static

# Create required directories with proper permissions
RUN mkdir -p /app/data/audio /app/uploads

# Use optimized startup
EXPOSE 8080
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
