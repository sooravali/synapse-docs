# Synapse-Docs - Adobe Hackathon 2025

An intelligent document experience platform that transforms static PDFs into interactive, queryable knowledge bases with LLM-powered insights and podcast generation.

## Features

- **Interactive PDF Viewing**: Adobe PDF Embed API integration
- **Smart Document Search**: Vector-based semantic search with Faiss
- **AI Insights**: LLM-powered analysis with Google Gemini
- **Podcast Generation**: Text-to-speech with Azure Cognitive Services
- **Real-time Connections**: Live content discovery and cross-references

## Docker Deployment (Recommended)

### Build

```bash
docker build --platform linux/amd64 -t yourimageidentifier .
```

### Run

```bash
docker run \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=<YOUR_GOOGLE_API_KEY> \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<YOUR_AZURE_TTS_KEY> \
  -e AZURE_TTS_ENDPOINT=<YOUR_AZURE_TTS_ENDPOINT> \
  -e ADOBE_CLIENT_ID=<YOUR_ADOBE_CLIENT_ID> \
  -p 8080:8080 \
  yourimageidentifier
```

The application will be available at: http://localhost:8080

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LLM_PROVIDER` | LLM provider (set to "gemini") | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Gemini API key | Yes |
| `GEMINI_MODEL` | Gemini model version | Yes |
| `TTS_PROVIDER` | TTS provider (set to "azure") | Yes |
| `AZURE_TTS_KEY` | Azure Speech Services subscription key | Yes |
| `AZURE_TTS_ENDPOINT` | Azure Speech Services endpoint URL | Yes |
| `ADOBE_CLIENT_ID` | Adobe PDF Embed API client ID | Yes |

### Getting API Keys

1. **Google Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
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
