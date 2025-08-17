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
async def generate_insights(text: str, context: str = "", snippets: list = None) -> Dict[str, Any]:
    """
    Enhanced insights generation using semantic search snippets as foundation.
    Implements the sophisticated "Insights Bulb" feature with structured analysis.
    
    Args:
        text: The user's selected text (main topic)
        context: Additional context (legacy parameter)
        snippets: List of relevant snippets from semantic search
    """
    # Enhanced system prompt for sophisticated analysis
    insights_system_prompt = """### ROLE

You are a meticulous Research Analyst AI. Your expertise is in performing comparative analysis of technical and business documents. You are objective, precise, and your entire analysis is based *strictly* on the evidence provided.

### TASK

You will be given a "Selected Text" from a document a user is reading. You will also be given a list of "Relevant Snippets" from other documents in their library. Your task is to analyze these snippets in relation to the selected text and generate a structured set of insights.

### INSTRUCTIONS

1. **Analyze the Core Claim:** First, deeply understand the main assertion, method, or finding presented in the "Selected Text".
2. **Comparative Analysis:** For each "Relevant Snippet", determine its relationship to the "Selected Text". Categorize it as:
   - A **Contradiction**: It presents opposing findings, challenges the assumptions, or offers a counter-argument.
   - A **Supporting Example**: It provides a concrete example, a successful implementation, or data that reinforces the core claim.
   - A **Related Concept**: It discusses a similar technique, an extension of the idea, or an alternative approach without directly contradicting or supporting it.
   - A **Key Takeaway**: It offers a high-level summary or implication derived from combining the information.
3. **Synthesize and Format:** Consolidate your findings into a single JSON object. For each insight, provide a concise explanation and cite the source PDF it came from.

### CRITICAL CONSTRAINTS

- **GROUNDING:** You MUST base your entire analysis ONLY on the "Selected Text" and "Relevant Snippets" provided.
- **NO EXTERNAL KNOWLEDGE:** Do not use any information you were trained on that is not present in the provided context. Do not invent facts, figures, or sources.
- **SOURCE CITATION:** Always cite the source document for each insight using the format "according to [document_name]"

### OUTPUT FORMAT

Provide your response as a JSON object with this exact structure:
{
    "contradictions": [
        {"insight": "Description of contradiction...", "source": "document_name.pdf", "explanation": "Why this contradicts the main text"}
    ],
    "supporting_examples": [
        {"insight": "Description of supporting example...", "source": "document_name.pdf", "explanation": "How this supports the main claim"}
    ],
    "related_concepts": [
        {"insight": "Description of related concept...", "source": "document_name.pdf", "explanation": "Connection to the main text"}
    ],
    "key_takeaways": [
        {"insight": "High-level takeaway...", "source": "Multiple sources or specific source", "explanation": "Synthesis of multiple insights"}
    ]
}"""
    
    # Prepare snippets content for analysis
    snippets_content = ""
    if snippets and len(snippets) > 0:
        snippets_content = "**<Reference_Snippets>**\n"
        for i, snippet in enumerate(snippets[:5], 1):  # Limit to top 5 as per requirements
            doc_name = snippet.get('document_name', 'Unknown Document')
            text_chunk = snippet.get('text_chunk', snippet.get('content', ''))
            snippets_content += f"{i}. Source: {doc_name}\n   Content: {text_chunk[:300]}...\n\n"
        snippets_content += "**</Reference_Snippets>**"
    else:
        snippets_content = "**<Reference_Snippets>**\nNo relevant snippets found in the document library.\n**</Reference_Snippets>**"
    
    # Enhanced user prompt following your specification
    user_content = f"""**<Main_Topic>**
{text}
**</Main_Topic>**

{snippets_content}

Please analyze the main topic in relation to the reference snippets and provide a structured set of insights following the JSON format specified."""

    messages = [
        {
            "role": "system",
            "content": insights_system_prompt
        },
        {
            "role": "user",
            "content": user_content
        }
    ]
    
    try:
        response = await llm_service.chat_with_llm(messages)
        logger.info(f"Enhanced insights response generated successfully")
        
        # TERMINAL LOG: Print raw LLM response for debugging
        print("🧠 ENHANCED INSIGHTS - Raw LLM Response:")
        print("=" * 60)
        print(response[:500] + "..." if len(response) > 500 else response)
        print("=" * 60)
        
        # Try to parse JSON response
        try:
            import json
            # Clean up any markdown formatting
            clean_response = response.strip()
            if clean_response.startswith('```json'):
                clean_response = clean_response.replace('```json', '').replace('```', '').strip()
            
            parsed_insights = json.loads(clean_response)
            
            # TERMINAL LOG: Print parsed insights structure
            print("✅ PARSED INSIGHTS:")
            for key, value in parsed_insights.items():
                if isinstance(value, list):
                    print(f"  {key}: {len(value)} items")
                    for i, item in enumerate(value[:2]):  # Show first 2 items
                        if isinstance(item, dict):
                            print(f"    {i+1}. {item.get('insight', 'N/A')[:100]}...")
                        else:
                            print(f"    {i+1}. {str(item)[:100]}...")
                else:
                    print(f"  {key}: {value}")
            print()
            
            # Validate structure
            expected_keys = ['contradictions', 'supporting_examples', 'related_concepts', 'key_takeaways']
            for key in expected_keys:
                if key not in parsed_insights:
                    parsed_insights[key] = []
            
            return {
                "insights": parsed_insights,
                "status": "success",
                "snippets_used": len(snippets) if snippets else 0
            }
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse insights JSON: {e}")
            # Fallback to structured format
            return {
                "insights": {
                    "contradictions": [],
                    "supporting_examples": [{"insight": response, "source": "AI Analysis", "explanation": "Generated analysis"}],
                    "related_concepts": [],
                    "key_takeaways": []
                },
                "status": "success",
                "snippets_used": len(snippets) if snippets else 0
            }
            
    except Exception as e:
        logger.error(f"Error generating enhanced insights: {e}")
        error_message = str(e)
        
        # User-friendly error messages
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
                "contradictions": [],
                "supporting_examples": [{"insight": user_message, "source": "System", "explanation": "Error occurred during analysis"}],
                "related_concepts": [],
                "key_takeaways": []
            },
            "status": "error",
            "error": error_message,
            "snippets_used": 0
        }

async def generate_podcast_script(content: str, related_content: str = "", insights: dict = None) -> str:
    """
    Enhanced podcast script generation for two-speaker format.
    Creates a 2-4 minute conversational script based on content, related snippets, and insights.
    
    Args:
        content: The main content/selected text
        related_content: Related snippets from the document library  
        insights: Structured insights from the insights generation step
    """
    # Enhanced system prompt for two-speaker podcast format
    podcast_system_prompt = """### ROLE

You are a professional podcast producer and scriptwriter for an acclaimed educational show. Your expertise is in transforming complex information into clear, engaging, and conversational audio scripts. Your style is informative yet accessible.

### TASK

You will be provided with a "Main Topic", a set of "Key Insights", and the "Reference Snippets" they were derived from. Your task is to write a 2-4 minute podcast script for two speakers:

- **Host:** Guides the conversation, introduces the topic, asks clarifying questions, and provides summaries.
- **Analyst:** Provides the deep-dive details, presents the evidence, and explains the contradictions and examples, citing the sources.

### SCRIPT STRUCTURE

1. **Introduction (15-20 seconds):** The Host introduces the main topic in an engaging way.
2. **Main Discussion (2-3 minutes):** The Host and Analyst discuss the key insights. The Analyst should explicitly mention the source of their information (e.g., "...according to a study in Paper_A.pdf..."). This builds credibility. The dialogue should flow logically, often presenting the core idea first, then a supporting example, and then a counterpoint or contradiction.
3. **Conclusion (15-20 seconds):** The Host summarizes the key points and concludes the segment.

### CRITICAL CONSTRAINTS

- **GROUNDING:** The entire script MUST be based ONLY on the provided Topic, Insights, and Snippets. Do not invent any information or go off-topic.
- **NO AUDIO CUES:** The script must NOT include any references to music, sound effects, jingles, intros, outros, or any audio production cues. Your output must only contain the speaker labels and their dialogue.
- **FORMAT:** The output must be plain text, strictly following the `Speaker: Dialogue` format. Do not add any other text, titles, or explanations.
- **TONE:** The dialogue must be conversational and natural, not robotic. Avoid overly academic language.
- **SOURCE CITATION:** The Analyst must cite sources naturally in conversation (e.g., "According to the research in TechReport.pdf...")"""

    # Prepare insights content for the script
    insights_content = ""
    if insights and isinstance(insights, dict):
        # Format structured insights for script generation
        insight_sections = []
        
        if insights.get('contradictions'):
            contradictions_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                           for item in insights['contradictions']])
            insight_sections.append(f"**Contradictions:**\n{contradictions_text}")
        
        if insights.get('supporting_examples'):
            examples_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                     for item in insights['supporting_examples']])
            insight_sections.append(f"**Supporting Examples:**\n{examples_text}")
        
        if insights.get('related_concepts'):
            concepts_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                     for item in insights['related_concepts']])
            insight_sections.append(f"**Related Concepts:**\n{concepts_text}")
        
        if insights.get('key_takeaways'):
            takeaways_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                      for item in insights['key_takeaways']])
            insight_sections.append(f"**Key Takeaways:**\n{takeaways_text}")
        
        insights_content = "\n\n".join(insight_sections)
    
    # Prepare reference snippets
    reference_snippets = ""
    if related_content:
        # Parse related content if it's formatted as snippets
        reference_snippets = f"**<Reference_Snippets>**\n{related_content}\n**</Reference_Snippets>**"
    
    # User prompt following your specification
    user_content = f"""**<Main_Topic>**
{content}
**</Main_Topic>**

**<Key_Insights_To_Discuss>**
{insights_content if insights_content else "No structured insights available."}
**</Key_Insights_To_Discuss>**

{reference_snippets}

Generate a 2-4 minute podcast script following the two-speaker format specified."""

    messages = [
        {
            "role": "system", 
            "content": podcast_system_prompt
        },
        {
            "role": "user",
            "content": user_content
        }
    ]
    
    try:
        script = await llm_service.chat_with_llm(messages)
        
        # TERMINAL LOG: Print podcast script for debugging
        print("🎙️ ENHANCED PODCAST - Generated Script:")
        print("=" * 60)
        print(script)
        print("=" * 60)
        
        # Clean up the script to ensure proper format
        lines = script.strip().split('\n')
        cleaned_lines = []
        
        host_count = 0
        analyst_count = 0
        
        for line in lines:
            line = line.strip()
            if line and (':' in line):
                # Ensure proper speaker format
                if line.startswith(('Host:', 'Analyst:')):
                    cleaned_lines.append(line)
                    if line.startswith('Host:'):
                        host_count += 1
                    else:
                        analyst_count += 1
                elif line.lower().startswith('host:') or line.lower().startswith('analyst:'):
                    # Fix capitalization
                    speaker, dialogue = line.split(':', 1)
                    fixed_line = f"{speaker.capitalize()}:{dialogue}"
                    cleaned_lines.append(fixed_line)
                    if speaker.lower() == 'host':
                        host_count += 1
                    else:
                        analyst_count += 1
                else:
                    # Try to detect speaker patterns
                    for speaker in ['Host', 'Analyst']:
                        if line.lower().startswith(speaker.lower() + ':'):
                            dialogue = line[len(speaker)+1:]
                            fixed_line = f"{speaker}:{dialogue}"
                            cleaned_lines.append(fixed_line)
                            if speaker == 'Host':
                                host_count += 1
                            else:
                                analyst_count += 1
                            break
                    else:
                        # If no speaker detected, treat as Analyst continuation
                        if cleaned_lines:
                            cleaned_lines.append(line)
        
        final_script = '\n'.join(cleaned_lines)
        
        # TERMINAL LOG: Print script analysis
        print(f"📊 SCRIPT ANALYSIS:")
        print(f"  Total lines: {len(cleaned_lines)}")
        print(f"  Host lines: {host_count}")
        print(f"  Analyst lines: {analyst_count}")
        print(f"  Two-speaker format: {'✅' if host_count > 0 and analyst_count > 0 else '❌'}")
        print()
        
        return final_script
        
    except Exception as e:
        logger.error(f"Error generating podcast script: {e}")
        # Fallback script
        return f"""Host: Welcome to Synapse Docs. Today we're exploring an interesting topic from your document library.

Analyst: That's right. We're looking at some fascinating content that touches on {content[:100]}...

Host: What makes this particularly noteworthy?

Analyst: Well, based on the analysis, there are several key points worth highlighting. The content reveals important insights that connect to broader themes in your document collection.

Host: That's really valuable context. Thanks for that analysis.

Analyst: My pleasure. It's always interesting to see how different pieces of information connect and inform each other.

Host: Absolutely. That wraps up our brief analysis for today."""
