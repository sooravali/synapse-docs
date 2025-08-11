#!/bin/bash

# This script automates the process of staging and committing
# specific project files and directories to a Git repository.

echo "Starting the commit process..."

# Add Docker ignore file
echo "Adding .dockerignore..."
git add .dockerignore
git commit -m "build: add Docker ignore configuration"

# Add backend environment configuration
echo "Adding backend environment configuration..."
git add backend/.env.example
git commit -m "config: add backend environment variables template"

# Add backend data directory
echo "Adding backend data directory..."
git add backend/data/
git commit -m "chore: add data directory structure"

# Add backend Python dependencies
echo "Adding backend Python dependencies..."
git add backend/requirements.txt
git commit -m "build: add Python dependencies for backend"

# Add uploads directory
echo "Adding uploads directory..."
git add backend/uploads/
git commit -m "feat: add uploads directory for document storage"

# Add frontend environment configuration
echo "Adding frontend environment configuration..."
git add frontend/.env.example
git commit -m "config: add frontend environment variables template"

# Add frontend documentation
echo "Adding frontend documentation..."
git add frontend/README.md
git commit -m "docs: add frontend README with setup instructions"

# Add setup script
echo "Adding setup script..."
git add setup.sh
git commit -m "build: add project setup script"

echo "All specified files have been committed."

# Final check for any remaining files
echo "Running final git status check:"
git status

