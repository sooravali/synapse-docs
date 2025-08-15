# Synapse-Docs - Adobe Hackathon 2025

An intelligent document experience platform that transforms static PDFs into interactive, queryable knowledge bases with LLM-powered insights and podcast generation.

## Features

- **Interactive PDF Viewing**: Adobe PDF Embed API integration
- **Smart Document Search**: Vector-based semantic search with Faiss
- **AI Insights**: LLM-powered analysis with Google Gemini
- **Podcast Generation**: Text-to-speech with Azure Cognitive Services
- **Real-time Connections**: Live content discovery and cross-references

## Docker Deployment (Adobe Hackathon 2025)

### Build

```bash
docker build --platform linux/amd64 -t synapse-docs:latest .
```

### Run with Service Account (Required for Evaluation)

**CORRECT FORMAT** (as specified in hackathon requirements):

```bash
docker run \
  -v ~/hackathon-credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=<YOUR_ADOBE_CLIENT_ID> \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/synapse-docs-468420-fa617ac6066f.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<YOUR_AZURE_TTS_KEY> \
  -e AZURE_TTS_ENDPOINT=<YOUR_AZURE_TTS_ENDPOINT> \
  -p 8080:8080 \
  synapse-docs:latest
```

### Development Mode (with API Key)

```bash
docker run \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_API_KEY=<YOUR_GOOGLE_API_KEY> \
  -e GEMINI_MODEL=gemini-1.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<YOUR_AZURE_TTS_KEY> \
  -e AZURE_TTS_ENDPOINT=<YOUR_AZURE_TTS_ENDPOINT> \
  -e ADOBE_EMBED_API_KEY=<YOUR_ADOBE_CLIENT_ID> \
  -p 8080:8080 \
  synapse-docs:latest
```

The application will be available at: http://localhost:8080

### Required Environment Variables

| Variable | Description | Hackathon Evaluation |
|----------|-------------|----------------------|
| `ADOBE_EMBED_API_KEY` | Adobe PDF Embed API client ID | Optional |
| `LLM_PROVIDER` | LLM provider (set to "gemini") | Set by Adobe |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Service Account JSON file (for Vertex AI) | **PROVIDED BY ADOBE** |
| `GEMINI_MODEL` | Gemini model version (evaluation uses "gemini-2.5-flash") | Set by Adobe |
| `TTS_PROVIDER` | TTS provider (set to "azure") | Set by Adobe |
| `AZURE_TTS_KEY` | Azure Speech Services subscription key | **PROVIDED BY ADOBE** |
| `AZURE_TTS_ENDPOINT` | Azure Speech Services endpoint URL | **PROVIDED BY ADOBE** |

## ⚠️ CRITICAL AUTHENTICATION NOTES

### For Hackathon Compliance

1. **Service Account Authentication**: The application uses **Vertex AI SDK** with service account JSON files, NOT the AI Studio API with simple API keys.

2. **Volume Mount Required**: The Docker command MUST include volume mount:
   ```bash
   -v ~/hackathon-credentials:/credentials
   ```

3. **Correct Path Format**: The `GOOGLE_APPLICATION_CREDENTIALS` should point to the file INSIDE the container:
   ```bash
   -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/your-service-account.json
   ```

4. **WRONG** ❌: 
   ```bash
   -e GOOGLE_APPLICATION_CREDENTIALS=AIzaSyBAHQV75TUJnIfS1f9GfTOnnhwKJleYhpM  # This is an API key, not a path!
   ```

5. **CORRECT** ✅:
   ```bash
   -v ~/hackathon-credentials:/credentials \
   -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/synapse-docs-468420-fa617ac6066f.json
   ```

### Getting API Keys

1. **Google Vertex AI Service Account**: Create in [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts
   - Enable Vertex AI API for your project
   - Create a service account with "Vertex AI User" role
   - Download the JSON key file
2. **Azure Speech Services**: Create in [Azure Portal](https://portal.azure.com) → Speech Services
3. **Adobe PDF Embed API**: Get from [Adobe Developer Console](https://developer.adobe.com/document-services/apis/pdf-embed/)

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker (for deployment)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Run backend
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

### Frontend Setup

```bash
cd frontend
npm install

# Copy and configure environment
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Run frontend
npm run dev
```

## Architecture

### Tech Stack

- **Frontend**: React + Vite, Adobe PDF Embed API
- **Backend**: FastAPI + Python
- **Database**: SQLite with Faiss vector search
- **LLM**: Google Gemini 1.5 Flash
- **TTS**: Azure Cognitive Services Speech
- **Deployment**: Docker + Gunicorn

### Project Structure

```
synapse-docs/
├── frontend/              # React frontend
├── backend/               # FastAPI backend
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Docker Compose (optional)
├── build.sh              # Build script
└── run.sh                # Run script
```

## Security

- All API keys are managed via environment variables
- No hardcoded secrets in source code
- `.env` files are excluded from version control
- Production-ready Docker configuration

## License

Adobe Hackathon 2025
