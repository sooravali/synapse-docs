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
        """Chat with Google Gemini"""
        api_key = settings.GOOGLE_APPLICATION_CREDENTIALS or settings.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("Gemini API key not configured")
        
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
    # Enhanced system prompt for context-rich insights
    system_prompt = """You are an intelligent document analyst with access to a comprehensive document library. 
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
    
    # Enhanced user prompt that includes context
    user_content = f"""MAIN TEXT TO ANALYZE:
{text}

RELATED CONTENT FROM DOCUMENT LIBRARY:
{context if context else "No related content provided."}

Please analyze the main text and provide insights, taking into account any connections to the related content."""

    messages = [
        {
            "role": "system",
            "content": system_prompt
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
    messages = [
        {
            "role": "system",
            "content": """You are a podcast script writer. Create a 2-5 minute engaging narrated script 
            based on the provided content. The script should:
            1. Be conversational and engaging
            2. Include the main content points
            3. Incorporate related content naturally
            4. Use natural speech patterns suitable for text-to-speech
            5. Be approximately 300-500 words for 2-5 minute duration"""
        },
        {
            "role": "user",
            "content": f"Main content: {content}\n\nRelated content: {related_content}"
        }
    ]
    
    try:
        return await llm_service.chat_with_llm(messages)
    except Exception as e:
        logger.error(f"Error generating podcast script: {e}")
        return "Unable to generate podcast script at this time."
