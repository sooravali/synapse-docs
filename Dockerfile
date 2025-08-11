# Adobe Hackathon 2025 - Dockerfile for Synapse-Docs
# Builds for linux/amd64 platform as required

# Stage 1: Build the React frontend
FROM node:18-alpine AS builder
WORKDIR /app/frontend

# Copy package files and install dependencies to leverage Docker layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the application for production
# The frontend will use relative API URLs since it's served from the same domain
RUN npm run build

# Stage 2: Build the final Python application image
FROM python:3.11-slim
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for audio processing and Python packages
RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY backend/ /app

# Copy the compiled frontend assets from the builder stage
COPY --from=builder /app/frontend/dist /app/static

# Create data directory for SQLite, Faiss index, and audio files
RUN mkdir -p /app/data/audio

# Make startup script executable
RUN chmod +x /app/start.sh

# Expose port 8080 as required by Adobe Hackathon 2025
EXPOSE 8080

# Use the startup script
CMD ["/app/start.sh"]
