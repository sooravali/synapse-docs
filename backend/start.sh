#!/bin/bash
# Startup script for Synapse-Docs Docker container

# Set default values for environment variables
export PORT=${PORT:-8080}
export WORKERS=${WORKERS:-1}

# Ensure data directory exists
mkdir -p /app/data/audio

# Initialize database and run the application
exec gunicorn -c gunicorn_conf.py -b "0.0.0.0:${PORT}" --workers "${WORKERS}" "app.main:app"
