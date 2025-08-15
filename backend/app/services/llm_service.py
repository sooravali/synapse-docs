"""
LLM Service for Adobe Hackathon 2025
Follows the sample script pattern from the hackathon requirements
https://github.com/rbabbar-adobe/sample-repo/blob/main/chat_with_llm.py
"""
import os
import json
import asyncio
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class LLMService:
    """
    Universal LLM service that supports multiple providers as required by Adobe Hackathon 2025.
    Supports Gemini, OpenAI, Azure OpenAI, and Ollama.
    """
    
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        logger.info(f"Initializing LLM service with provider: {self.provider}")
    
    async def chat_with_llm(self, messages: list, **kwargs) -> str:
        """
        Main method to interact with LLM based on provider configuration.
        Follows the pattern from the hackathon sample script.
        """
        try:
            if self.provider == "gemini":
                return await self._chat_with_gemini(messages, **kwargs)
            elif self.provider == "openai":
                return await self._chat_with_openai(messages, **kwargs)
            elif self.provider == "azure":
                return await self._chat_with_azure(messages, **kwargs)
            elif self.provider == "ollama":
                return await self._chat_with_ollama(messages, **kwargs)
            else:
                raise ValueError(f"Unsupported LLM provider: {self.provider}")
        except Exception as e:
            logger.error(f"Error in LLM chat: {e}")
            raise
    
    async def _chat_with_gemini(self, messages: list, **kwargs) -> str:
        """Chat with Google Gemini via Vertex AI (Adobe Hackathon 2025 Compliant)"""
        try:
            # Import Vertex AI client
            from google.cloud import aiplatform
            from vertexai.generative_models import GenerativeModel
            import vertexai
            
            # Check for service account credentials (required for hackathon)
            credentials_path = settings.GOOGLE_APPLICATION_CREDENTIALS
            api_key = settings.GOOGLE_API_KEY
            
            if not credentials_path and not api_key:
                raise ValueError("Either GOOGLE_APPLICATION_CREDENTIALS (service account) or GOOGLE_API_KEY must be set")
            
            # For hackathon compliance, prioritize service account authentication
            if credentials_path:
                # Initialize Vertex AI with service account
                # Extract project ID from service account file for Vertex AI initialization
                import json
                import tempfile
                
                try:
                    creds_data = None
                    actual_creds_path = None
                    
                    # Check if credentials_path is JSON content (starts with '{') or a file path
                    if credentials_path.strip().startswith('{'):
                        # Direct JSON content (production deployment with secrets)
                        logger.info("Using service account JSON from environment variable")
                        try:
                            creds_data = json.loads(credentials_path)
                            
                            # Create temporary file for Google Cloud SDK
                            temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json')
                            json.dump(creds_data, temp_file, indent=2)
                            temp_file.flush()
                            actual_creds_path = temp_file.name
                            temp_file.close()
                            
                            # Set environment variable for Google Cloud SDK
                            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = actual_creds_path
                            logger.info(f"Created temporary credentials file at {actual_creds_path}")
                            
                        except json.JSONDecodeError as e:
                            logger.error(f"Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS: {e}")
                            raise ValueError("GOOGLE_APPLICATION_CREDENTIALS contains invalid JSON")
                    else:
                        # File path (local development / hackathon evaluation)
                        logger.info("Using service account JSON from file path")
                        actual_creds_path = credentials_path
                        
                        # Handle both absolute paths and relative paths within Docker container
                        if not credentials_path.startswith('/'):
                            docker_path = f"/credentials/{credentials_path}"
                            if os.path.exists(docker_path):
                                actual_creds_path = docker_path
                        elif not os.path.exists(credentials_path):
                            # Try common Docker mount path
                            filename = os.path.basename(credentials_path)
                            docker_path = f"/credentials/{filename}"
                            if os.path.exists(docker_path):
                                actual_creds_path = docker_path
                        
                        # Set environment variable for Google Cloud SDK
                        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = actual_creds_path
                        
                        if not os.path.exists(actual_creds_path):
                            raise FileNotFoundError(f"Service account file not found at {actual_creds_path}")
                        
                        with open(actual_creds_path, 'r') as f:
                            creds_data = json.load(f)
                    
                    # Extract project ID from credentials data
                    project_id = creds_data.get('project_id') if creds_data else None
                    
                    if not project_id:
                        # Fallback project ID for hackathon evaluation
                        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', 'synapse-docs-468420')
                except Exception as e:
                    logger.warning(f"Could not read project ID from service account: {e}")
                    project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', 'synapse-docs-468420')
                
                # Initialize Vertex AI
                vertexai.init(project=project_id, location="us-central1")
                
                # Use Vertex AI Generative Model
                model = GenerativeModel(settings.GEMINI_MODEL)
                
                # Convert messages to Vertex AI format
                content_parts = []
                for msg in messages:
                    content_parts.append(f"{msg['role']}: {msg['content']}")
                combined_content = "\n".join(content_parts)
                
                # Generate content with retry logic
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        response = await asyncio.get_event_loop().run_in_executor(
                            None, 
                            lambda: model.generate_content(combined_content)
                        )
                        return response.text
                    except Exception as e:
                        if attempt < max_retries - 1:
                            wait_time = 2 ** attempt
                            logger.warning(f"Vertex AI Gemini error (attempt {attempt + 1}/{max_retries}), retrying in {wait_time} seconds: {e}")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Vertex AI Gemini error: {e}")
                            raise
            
            else:
                # Fallback to AI Studio API for development (when no service account)
                logger.info("Using AI Studio API as fallback (service account not available)")
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent"
                headers = {"Content-Type": "application/json"}
                params = {"key": api_key}
                
                # Convert messages to Gemini format
                content = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])
                payload = {
                    "contents": [{"parts": [{"text": content}]}],
                    "generationConfig": {
                        "temperature": 0.7,
                        "topK": 40,
                        "topP": 0.95,
                        "maxOutputTokens": 1024
                    }
                }
                
                # Retry logic for transient errors
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        async with httpx.AsyncClient() as client:
                            response = await client.post(url, headers=headers, json=payload, params=params, timeout=30)
                            response.raise_for_status()
                            result = response.json()
                            return result["candidates"][0]["content"]["parts"][0]["text"]
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code in [503, 429, 500] and attempt < max_retries - 1:
                            wait_time = 2 ** attempt
                            logger.warning(f"Gemini API error {e.response.status_code} (attempt {attempt + 1}/{max_retries}), retrying in {wait_time} seconds...")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Gemini API error: {e}")
                            if e.response.status_code == 503:
                                raise Exception("Gemini API is temporarily unavailable. Please try again in a few moments.")
                            raise
                            
        except ImportError as e:
            logger.error(f"Google Cloud Vertex AI libraries not available: {e}")
            raise ValueError("Google Cloud Vertex AI SDK is required for Gemini integration. Please install google-cloud-aiplatform.")
        except Exception as e:
            logger.error(f"Gemini chat error: {e}")
            raise
    
    async def _chat_with_openai(self, messages: list, **kwargs) -> str:
        """Chat with OpenAI API"""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")
        
        url = f"{settings.OPENAI_API_BASE or 'https://api.openai.com'}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 1000),
            "temperature": kwargs.get("temperature", 0.7)
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    
    async def _chat_with_azure(self, messages: list, **kwargs) -> str:
        """Chat with Azure OpenAI"""
        if not all([settings.AZURE_OPENAI_KEY, settings.AZURE_OPENAI_BASE, settings.AZURE_DEPLOYMENT_NAME]):
            raise ValueError("Azure OpenAI configuration incomplete")
        
        url = f"{settings.AZURE_OPENAI_BASE}/openai/deployments/{settings.AZURE_DEPLOYMENT_NAME}/chat/completions"
        headers = {
            "api-key": settings.AZURE_OPENAI_KEY,
            "Content-Type": "application/json"
        }
        
        params = {"api-version": settings.AZURE_API_VERSION or "2024-02-15-preview"}
        
        payload = {
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 1000),
            "temperature": kwargs.get("temperature", 0.7)
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, params=params, timeout=30)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    
    async def _chat_with_ollama(self, messages: list, **kwargs) -> str:
        """Chat with Ollama (local development)"""
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            return result["message"]["content"]

# Global LLM service instance
llm_service = LLMService()

# Insights generation functions for the hackathon features
async def generate_insights(text: str, context: str = "") -> Dict[str, Any]:
    """
    Generate insights using the configured LLM provider.
    This implements the "Insights Bulb" feature from the hackathon requirements.
    """
    # Get configurable system prompt from environment or use default
    base_system_prompt = os.environ.get("INSIGHTS_SYSTEM_PROMPT", 
        """You are an intelligent document analyst with access to a comprehensive document library. 
        Generate deep, context-aware insights for the given text.
        
        When analyzing the text, consider:
        1. Key themes and concepts
        2. Connections to related content from the document library
        3. Potential contradictions or nuances
        4. Surprising facts or lesser-known details
        5. Cross-references and relationships
        
        Provide your response in the following JSON structure:
        {
            "key_insights": ["insight 1", "insight 2", "insight 3"],
            "did_you_know": ["interesting fact 1", "interesting fact 2"],
            "contradictions": ["contradiction or nuance 1"],
            "connections": ["connection to related content 1", "connection 2"]
        }
        
        Make insights actionable and thought-provoking. Each insight should be 1-2 sentences maximum.
        When related content is provided, explicitly reference and analyze connections."""
    )
    
    # Enhanced user prompt that includes context
    user_content = f"""MAIN TEXT TO ANALYZE:
{text}

RELATED CONTENT FROM DOCUMENT LIBRARY:
{context if context else "No related content provided."}

Please analyze the main text and provide insights, taking into account any connections to the related content."""

    messages = [
        {
            "role": "system",
            "content": base_system_prompt
        },
        {
            "role": "user",
            "content": user_content
        }
    ]
    
    try:
        response = await llm_service.chat_with_llm(messages)
        logger.info(f"LLM insights response: {response}")
        
        # Try to parse JSON response, fallback to simple format if needed
        try:
            import json
            parsed_insights = json.loads(response)
            return {
                "insights": parsed_insights,
                "status": "success"
            }
        except json.JSONDecodeError:
            # Fallback to simple format
            return {
                "insights": {
                    "key_insights": [response],
                    "did_you_know": [],
                    "contradictions": [],
                    "connections": []
                },
                "status": "success"
            }
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        error_message = str(e)
        
        # Make error messages more user-friendly
        if "503" in error_message or "Service Unavailable" in error_message:
            user_message = "The AI service is temporarily busy. Please try again in a moment."
        elif "429" in error_message or "rate limit" in error_message.lower():
            user_message = "Too many requests. Please wait a moment and try again."
        elif "timeout" in error_message.lower():
            user_message = "The request took too long. Please try again."
        else:
            user_message = "Unable to generate insights at this time. Please try again."
        
        return {
            "insights": {
                "key_insights": [user_message],
                "did_you_know": ["AI insights are temporarily unavailable."],
                "contradictions": [],
                "connections": []
            },
            "status": "error",
            "error": error_message
        }

async def generate_podcast_script(content: str, related_content: str = "") -> str:
    """
    Generate a podcast script for the "Podcast Mode" feature.
    Creates a 2-5 minute narrated overview as required by hackathon.
    """
    # Get configurable podcast prompt from environment or use default
    system_prompt = os.environ.get("PODCAST_SYSTEM_PROMPT",
        """You are a podcast script writer. Create a 2-5 minute engaging narrated script 
        based on the provided content. The script should:
        1. Be conversational and engaging
        2. Include the main content points
        3. Incorporate related content naturally
        4. Use natural speech patterns suitable for text-to-speech
        5. Be approximately 300-500 words for 2-5 minute duration"""
    )
    
    # Get configurable duration from environment
    target_duration = os.environ.get("PODCAST_DURATION_MINUTES", "2-5")
    word_count_range = os.environ.get("PODCAST_WORD_COUNT", "300-500")
    
    # Update prompt with configurable parameters
    user_prompt = f"Main content: {content}\n\nRelated content: {related_content}\n\nPlease create a {target_duration} minute script (approximately {word_count_range} words)."
    messages = [
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user",
            "content": user_prompt
        }
    ]
    
    try:
        return await llm_service.chat_with_llm(messages)
    except Exception as e:
        logger.error(f"Error generating podcast script: {e}")
        return "Unable to generate podcast script at this time."
