"""
LLM Services Module

Handles all interactions with external LLM and TTS APIs.
Supports multiple providers based on environment configuration:
- LLM: Gemini, Azure OpenAI, etc.
- TTS: Azure TTS, Google TTS, etc.
"""
import os
import json
import httpx
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class InsightRequest(BaseModel):
    """Request model for insights generation."""
    main_text: str
    recommendations: List[Dict[str, Any]]

class PodcastRequest(BaseModel):
    """Request model for podcast generation."""
    main_text: str
    recommendations: List[Dict[str, Any]]

class LLMService:
    """Service for interacting with Large Language Models."""
    
    def __init__(self):
        self.llm_provider = os.getenv("LLM_PROVIDER", "gemini")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.azure_openai_key = os.getenv("AZURE_OPENAI_KEY")
        
        # Insights Bulb Prompt Template
        self.insights_prompt = """
        Based on the main content and related recommendations, provide intelligent insights.
        
        MAIN CONTENT:
        {main_text}
        
        RELATED RECOMMENDATIONS:
        {recommendations_text}
        
        Please provide:
        1. Key insights about the main content
        2. How the recommendations relate to and enhance the main content
        3. Actionable suggestions for the user
        4. Connections between different pieces of information
        
        Respond in JSON format:
        {{
            "insights": ["insight1", "insight2", "insight3"],
            "connections": ["connection1", "connection2"],
            "recommendations": ["action1", "action2", "action3"],
            "summary": "Brief summary of key findings"
        }}
        """
    
    async def generate_insights(self, request: InsightRequest) -> Dict[str, Any]:
        """Generate insights using the configured LLM provider."""
        try:
            # Format recommendations text
            recommendations_text = "\n".join([
                f"Document: {rec.get('document', 'Unknown')}, "
                f"Page: {rec.get('page_number', 'N/A')}, "
                f"Text: {rec.get('text', '')[:500]}..."
                for rec in request.recommendations
            ])
            
            # Format the prompt
            prompt = self.insights_prompt.format(
                main_text=request.main_text[:2000],  # Limit main text length
                recommendations_text=recommendations_text
            )
            
            if self.llm_provider.lower() == "gemini":
                return await self._call_gemini(prompt)
            elif self.llm_provider.lower() == "azure":
                return await self._call_azure_openai(prompt)
            else:
                raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")
                
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return {
                "insights": ["Unable to generate insights at this time"],
                "connections": [],
                "recommendations": ["Please try again later"],
                "summary": "Error occurred during insight generation"
            }
    
    async def _call_gemini(self, prompt: str) -> Dict[str, Any]:
        """Call Google Gemini API."""
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY not configured")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"
        
        headers = {
            "Content-Type": "application/json",
        }
        
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 1024,
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
                params={"key": self.gemini_api_key},
                timeout=30.0
            )
            response.raise_for_status()
            
            result = response.json()
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Try to parse as JSON, fallback to structured response
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {
                    "insights": [content[:200] + "..."],
                    "connections": [],
                    "recommendations": ["Review the generated content"],
                    "summary": "Generated insights (not in JSON format)"
                }
    
    async def _call_azure_openai(self, prompt: str) -> Dict[str, Any]:
        """Call Azure OpenAI API."""
        if not self.azure_openai_endpoint or not self.azure_openai_key:
            raise ValueError("Azure OpenAI credentials not configured")
        
        url = f"{self.azure_openai_endpoint}/openai/deployments/gpt-35-turbo/chat/completions"
        
        headers = {
            "Content-Type": "application/json",
            "api-key": self.azure_openai_key
        }
        
        payload = {
            "messages": [
                {"role": "system", "content": "You are an AI assistant that provides intelligent insights about documents."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1024
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # Try to parse as JSON, fallback to structured response
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {
                    "insights": [content[:200] + "..."],
                    "connections": [],
                    "recommendations": ["Review the generated content"],
                    "summary": "Generated insights (not in JSON format)"
                }

class TTSService:
    """Service for Text-to-Speech conversion."""
    
    def __init__(self):
        self.tts_provider = os.getenv("TTS_PROVIDER", "azure")
        self.azure_tts_key = os.getenv("AZURE_TTS_KEY")
        self.azure_tts_region = os.getenv("AZURE_TTS_REGION", "eastus")
        self.google_tts_key = os.getenv("GOOGLE_TTS_KEY")
    
    async def text_to_speech(self, text: str, voice: str = "en-US-AriaNeural") -> bytes:
        """Convert text to speech using the configured TTS provider."""
        try:
            if self.tts_provider.lower() == "azure":
                return await self._call_azure_tts(text, voice)
            elif self.tts_provider.lower() == "google":
                return await self._call_google_tts(text, voice)
            else:
                raise ValueError(f"Unsupported TTS provider: {self.tts_provider}")
                
        except Exception as e:
            logger.error(f"Error in text-to-speech conversion: {e}")
            raise
    
    async def _call_azure_tts(self, text: str, voice: str) -> bytes:
        """Call Azure Text-to-Speech API."""
        if not self.azure_tts_key:
            raise ValueError("AZURE_TTS_KEY not configured")
        
        url = f"https://{self.azure_tts_region}.tts.speech.microsoft.com/cognitiveservices/v1"
        
        headers = {
            "Ocp-Apim-Subscription-Key": self.azure_tts_key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3"
        }
        
        ssml = f"""
        <speak version='1.0' xml:lang='en-US'>
            <voice xml:lang='en-US' xml:gender='Female' name='{voice}'>
                {text}
            </voice>
        </speak>
        """
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                content=ssml,
                timeout=60.0
            )
            response.raise_for_status()
            return response.content
    
    async def _call_google_tts(self, text: str, voice: str) -> bytes:
        """Call Google Text-to-Speech API."""
        if not self.google_tts_key:
            raise ValueError("GOOGLE_TTS_KEY not configured")
        
        url = "https://texttospeech.googleapis.com/v1/text:synthesize"
        
        headers = {
            "Content-Type": "application/json",
        }
        
        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": "en-US",
                "name": voice,
                "ssmlGender": "FEMALE"
            },
            "audioConfig": {
                "audioEncoding": "MP3"
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
                params={"key": self.google_tts_key},
                timeout=60.0
            )
            response.raise_for_status()
            
            result = response.json()
            import base64
            return base64.b64decode(result["audioContent"])

class PodcastService:
    """Service for generating podcast content."""
    
    def __init__(self):
        self.llm_service = LLMService()
        self.tts_service = TTSService()
    
    async def generate_podcast(self, request: PodcastRequest) -> bytes:
        """Generate a podcast audio file from insights."""
        try:
            # First, generate insights
            insights = await self.llm_service.generate_insights(
                InsightRequest(
                    main_text=request.main_text,
                    recommendations=request.recommendations
                )
            )
            
            # Format insights into a podcast script
            script = self._format_podcast_script(insights)
            
            # Convert to speech
            audio_content = await self.tts_service.text_to_speech(script)
            
            return audio_content
            
        except Exception as e:
            logger.error(f"Error generating podcast: {e}")
            raise
    
    def _format_podcast_script(self, insights: Dict[str, Any]) -> str:
        """Format insights into a narrative podcast script."""
        script_parts = [
            "Welcome to your personalized document insights podcast.",
            "",
            "Let me share some key insights from your documents.",
            ""
        ]
        
        # Add insights
        if insights.get("insights"):
            script_parts.append("Here are the main insights I discovered:")
            for i, insight in enumerate(insights["insights"], 1):
                script_parts.append(f"{i}. {insight}")
            script_parts.append("")
        
        # Add connections
        if insights.get("connections"):
            script_parts.append("I also found some interesting connections:")
            for connection in insights["connections"]:
                script_parts.append(f"- {connection}")
            script_parts.append("")
        
        # Add recommendations
        if insights.get("recommendations"):
            script_parts.append("Based on this analysis, here are my recommendations:")
            for i, rec in enumerate(insights["recommendations"], 1):
                script_parts.append(f"{i}. {rec}")
            script_parts.append("")
        
        # Add summary
        if insights.get("summary"):
            script_parts.append(f"To summarize: {insights['summary']}")
            script_parts.append("")
        
        script_parts.append("Thank you for listening to your document insights podcast!")
        
        return " ".join(script_parts)

# Global service instances
llm_service = LLMService()
tts_service = TTSService()
podcast_service = PodcastService()
