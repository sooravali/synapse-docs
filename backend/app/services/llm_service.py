"""
LLM Service for Adobe Hackathon 2025
Follows the sample script pattern from the hackathon requirements
https://github.com/rbabbar-adobe/sample-repo/blob/main/chat_with_llm.py

CRITICAL: Uses the provided sample script for compliance
"""
import os
import sys
import json
import asyncio
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings
import logging

# Add the root directory to the Python path to import the sample script
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

try:
    # Import the required sample script function
    from chat_with_llm import get_llm_response
    CHAT_WITH_LLM_AVAILABLE = True
except ImportError as e:
    print(f"Sample chat_with_llm script not available: {e}")
    CHAT_WITH_LLM_AVAILABLE = False

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
        Main method to interact with LLM using the hackathon sample script.
        CRITICAL: Uses the provided sample script for compliance.
        """
        try:
            if not CHAT_WITH_LLM_AVAILABLE:
                logger.error("Sample chat_with_llm script not available - using fallback")
                return await self._chat_with_fallback(messages, **kwargs)
            
            # Set environment variables for the sample script
            os.environ["LLM_PROVIDER"] = self.provider
            
            if self.provider == "gemini":
                if settings.GOOGLE_API_KEY:
                    os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
                if settings.GOOGLE_APPLICATION_CREDENTIALS:
                    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
                os.environ["GEMINI_MODEL"] = settings.GEMINI_MODEL
            elif self.provider == "azure":
                if settings.AZURE_OPENAI_KEY:
                    os.environ["AZURE_OPENAI_KEY"] = settings.AZURE_OPENAI_KEY
                if settings.AZURE_OPENAI_BASE:
                    os.environ["AZURE_OPENAI_BASE"] = settings.AZURE_OPENAI_BASE
                if settings.AZURE_API_VERSION:
                    os.environ["AZURE_API_VERSION"] = settings.AZURE_API_VERSION
                if settings.AZURE_DEPLOYMENT_NAME:
                    os.environ["AZURE_DEPLOYMENT_NAME"] = settings.AZURE_DEPLOYMENT_NAME
            elif self.provider == "openai":
                if settings.OPENAI_API_KEY:
                    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
                if settings.OPENAI_API_BASE:
                    os.environ["OPENAI_API_BASE"] = settings.OPENAI_API_BASE
                os.environ["OPENAI_MODEL"] = settings.OPENAI_MODEL
            elif self.provider == "ollama":
                os.environ["OLLAMA_BASE_URL"] = settings.OLLAMA_BASE_URL
                os.environ["OLLAMA_MODEL"] = settings.OLLAMA_MODEL
            
            # Use the sample script function
            result = await asyncio.get_event_loop().run_in_executor(
                None, 
                get_llm_response, 
                messages
            )
            
            logger.info(f"Sample script LLM call successful for provider: {self.provider}")
            return result
            
        except Exception as e:
            logger.error(f"Error using sample chat_with_llm script: {e}")
            # Fallback to direct implementation
            return await self._chat_with_fallback(messages, **kwargs)
    
    async def _chat_with_fallback(self, messages: list, **kwargs) -> str:
        """Fallback implementation when sample script is not available"""
        try:
            if self.provider == "gemini":
                return await self._chat_with_gemini_direct(messages, **kwargs)
            elif self.provider == "openai":
                return await self._chat_with_openai_direct(messages, **kwargs)
            elif self.provider == "azure":
                return await self._chat_with_azure_direct(messages, **kwargs)
            elif self.provider == "ollama":
                return await self._chat_with_ollama_direct(messages, **kwargs)
            else:
                raise ValueError(f"Unsupported LLM provider: {self.provider}")
        except Exception as e:
            logger.error(f"Error in fallback LLM chat: {e}")
            raise
    
    async def _chat_with_gemini_direct(self, messages: list, **kwargs) -> str:
        """Direct Gemini implementation for fallback"""
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
                        "temperature": 1.0,  # Gemini 2.5 Flash default
                        "topK": 64,         # Gemini 2.5 Flash fixed value
                        "topP": 0.95,       # Gemini 2.5 Flash default
                        "maxOutputTokens": 4096  # Increased for better responses
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
    
    async def _chat_with_openai_direct(self, messages: list, **kwargs) -> str:
        """Direct OpenAI implementation for fallback"""
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
    
    async def _chat_with_azure_direct(self, messages: list, **kwargs) -> str:
        """Direct Azure OpenAI implementation for fallback"""
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
    
    async def _chat_with_ollama_direct(self, messages: list, **kwargs) -> str:
        """Direct Ollama implementation for fallback"""
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

### REQUIRED INSIGHT TYPES

You MUST generate insights in ALL of these categories (even if some are empty arrays):

1. **Contradictions**: Opposing findings, challenges to assumptions, or counter-arguments
2. **Supporting Examples**: Concrete examples, successful implementations, or reinforcing data  
3. **Related Concepts**: Similar techniques, extensions, or alternative approaches
4. **Key Takeaways**: High-level summaries or implications from combining information
5. **Did You Know Facts**: Interesting, surprising, or lesser-known details from the content

### INSTRUCTIONS

1. **Analyze the Core Claim:** First, deeply understand the main assertion, method, or finding presented in the "Selected Text".
2. **Comparative Analysis:** For each "Relevant Snippet", determine its relationship to the "Selected Text".
3. **Content-Based Analysis:** Even if no relevant snippets are provided, analyze the selected text itself to extract interesting facts, implications, and insights.
4. **Synthesize and Format:** Consolidate your findings into a JSON object with ALL required categories.

### CRITICAL CONSTRAINTS

- **GROUNDING:** Base your analysis ONLY on the "Selected Text" and "Relevant Snippets" provided.
- **NO EXTERNAL KNOWLEDGE:** Do not use information not present in the provided context.
- **SOURCE CITATION:** Always cite the source document for each insight
- **COMPLETENESS:** Always return ALL 5 insight categories, even if some are empty arrays

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
        {"insight": "High-level takeaway...", "source": "document_name.pdf", "explanation": "Synthesis of insights"}
    ],
    "did_you_know": [
        {"insight": "Interesting or surprising fact...", "source": "document_name.pdf", "explanation": "Why this fact is noteworthy"}
    ]
}"""
    
    # Prepare snippets content for analysis
    snippets_content = ""
    has_snippets = snippets and len(snippets) > 0
    
    if has_snippets:
        snippets_content = "**<Reference_Snippets>**\n"
        for i, snippet in enumerate(snippets[:5], 1):  # Limit to top 5 as per requirements
            doc_name = snippet.get('document_name', 'Unknown Document')
            text_chunk = snippet.get('text_chunk', snippet.get('content', ''))
            snippets_content += f"{i}. Source: {doc_name}\n   Content: {text_chunk[:300]}...\n\n"
        snippets_content += "**</Reference_Snippets>**"
    else:
        snippets_content = "**<Reference_Snippets>**\nNo relevant snippets found in the document library. Focus on analyzing the main topic itself to extract insights, patterns, implications, and interesting facts.\n**</Reference_Snippets>**"
    
    # Enhanced user prompt following your specification
    analysis_instruction = ""
    if has_snippets:
        analysis_instruction = "Please analyze the main topic in relation to the reference snippets and provide a structured set of insights."
    else:
        analysis_instruction = """Please analyze the main topic itself and provide structured insights. Even without reference snippets, you should:
- Look for implicit contradictions or tensions within the topic
- Identify concrete examples or applications mentioned
- Find related concepts or themes that emerge
- Extract key takeaways and implications
- Discover interesting or surprising facts embedded in the content"""

    user_content = f"""**<Main_Topic>**
{text}
**</Main_Topic>**

{snippets_content}

{analysis_instruction}

IMPORTANT: You MUST generate insights for ALL 5 categories (contradictions, supporting_examples, related_concepts, key_takeaways, did_you_know) even if some are empty arrays. Generate meaningful insights based on the available content."""

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
            
            # Validate structure - ensure ALL required insight categories are present
            expected_keys = ['contradictions', 'supporting_examples', 'related_concepts', 'key_takeaways', 'did_you_know']
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
                    "key_takeaways": [],
                    "did_you_know": []
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
                "key_takeaways": [],
                "did_you_know": []
            },
            "status": "error",
            "error": error_message,
            "snippets_used": 0
        }

async def generate_podcast_script(content: str, related_content: str = "", insights: dict = None) -> str:
    """
    Enhanced podcast script generation for two-speaker format.
    Creates a 3-5 minute conversational script focused on discussing actual content, 
    findings, and insights from documents rather than document analysis process.
    
    Args:
        content: The main content/selected text to discuss
        related_content: Related snippets from the document library  
        insights: Structured insights from the insights generation step
    """
    # Enhanced system prompt for insight-focused podcast with Indian speakers
    podcast_system_prompt = """### ROLE

You are an expert podcast scriptwriter who specializes in creating engaging 3-5 minute conversations that transform research insights into compelling discussions between two knowledgeable friends.

### TASK

Create a 3-5 minute conversational podcast script where two speakers focus primarily on discussing the KEY INSIGHTS and DISCOVERIES from the provided analysis. Make the conversation natural, engaging, and insight-driven.

**Speakers:**
- **Pooja:** Curious host who asks insightful questions, connects different insights, and helps uncover the "so what" of the findings
- **Arjun:** Research analyst who presents the key insights clearly, explains their significance, and provides context from the analysis

### INSIGHT-DRIVEN FOCUS PRINCIPLES

1. **LEAD WITH INSIGHTS:** Start with the most compelling discovery, contradiction, or key takeaway from the analysis
2. **DISCUSS SIGNIFICANCE:** Explain why these insights matter and what they reveal
3. **HIGHLIGHT SURPRISES:** Focus on contradictions, unexpected findings, or "did you know" facts
4. **CONNECT THE DOTS:** Show how different insights relate to each other
5. **PRACTICAL IMPLICATIONS:** Discuss what these insights mean in practical terms

### SCRIPT STRUCTURE (3-5 minutes)

**Opening (30 seconds):** Pooja introduces the most intriguing insight or discovery
**Main Discussion (3-4 minutes):** Deep dive into 2-3 key insight categories:
- Most surprising contradictions or unexpected findings
- Compelling supporting examples with specific details
- Key takeaways and their broader implications
- Interesting "did you know" facts that emerge from the analysis
**Wrap-up (30 seconds):** Pooja summarizes the most valuable insights and their significance

### CRITICAL REQUIREMENTS

- **INSIGHT-CENTRIC:** Focus on the analyzed insights, not just raw content
- **SIGNIFICANCE-DRIVEN:** Explain why each insight matters, not just what it says
- **DISCOVERY-FOCUSED:** Highlight what was learned through the analysis process
- **FORMAT:** Use exactly "Pooja:" and "Arjun:" followed by their dialogue - no other formatting
- **NATURAL CONVERSATION:** Include genuine reactions to surprising insights ("Really? That's fascinating!")
- **SYNTHESIS:** Connect insights from different categories to tell a coherent story
- **GROUNDED:** Use ONLY the provided insights and analysis - no external information"""

    # Prepare insights content for the script
    insights_content = ""
    if insights and isinstance(insights, dict):
        # Format all insight categories for content-focused conversation
        insight_sections = []
        
        if insights.get('key_takeaways'):
            takeaways_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                      for item in insights['key_takeaways']])
            insight_sections.append(f"**Key Takeaways:**\n{takeaways_text}")
        
        if insights.get('did_you_know'):
            did_you_know_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                         for item in insights['did_you_know']])
            insight_sections.append(f"**Interesting Facts:**\n{did_you_know_text}")
        
        if insights.get('supporting_examples'):
            examples_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                     for item in insights['supporting_examples']])
            insight_sections.append(f"**Specific Examples:**\n{examples_text}")
        
        if insights.get('contradictions'):
            contradictions_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                           for item in insights['contradictions']])
            insight_sections.append(f"**Contradictions & Different Perspectives:**\n{contradictions_text}")
        
        if insights.get('related_concepts'):
            concepts_text = "\n".join([f"- {item.get('insight', '')} (from {item.get('source', 'unknown source')})" 
                                     for item in insights['related_concepts']])
            insight_sections.append(f"**Connected Ideas:**\n{concepts_text}")
        
        insights_content = "\n\n".join(insight_sections)
    
    # Prepare reference snippets with emphasis on content
    reference_snippets = ""
    if related_content:
        # Make sure snippets are prominently featured for content discussion
        reference_snippets = f"""**RELATED CONTENT FROM YOUR DOCUMENT LIBRARY:**
{related_content}

"""
    
    # User prompt focused on insights with clear instructions for natural conversation
    user_content = f"""**ORIGINAL TOPIC:**
{content}

{reference_snippets}**KEY INSIGHTS FROM ANALYSIS:**
{insights_content if insights_content else "No specific insights generated. Focus on analyzing the topic itself and discussing interesting patterns, implications, or discoveries."}

**INSTRUCTIONS FOR POOJA AND ARJUN:**
Create a 3-5 minute natural conversation that:

1. **Leads with the most compelling insight** - Start with what's most surprising, contradictory, or significant
2. **Focuses on the "why this matters"** - Don't just state insights, discuss their implications and significance  
3. **Highlights discoveries** - Emphasize what was learned through analysis, especially:
   - Surprising contradictions or unexpected findings
   - Supporting examples that reinforce key points
   - Connections between related concepts
   - "Did you know" facts that are genuinely interesting
   - Key takeaways that have practical value

4. **Makes it conversational** - Pooja should react with genuine curiosity ("Wait, really?" "That's fascinating!" "So what does that mean?")
5. **Connects the dots** - Show how different insights relate to create a bigger picture
6. **Stays grounded** - Only discuss the insights and analysis provided, no external knowledge

Remember: This is about the INSIGHTS and what they REVEAL, not just summarizing content. Focus on the analytical discoveries and their significance."""

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
        print("🎙️ INSIGHTS-DRIVEN PODCAST - Generated Script:")
        print("=" * 60)
        if insights and isinstance(insights, dict):
            insight_summary = []
            for category, items in insights.items():
                if isinstance(items, list) and len(items) > 0:
                    insight_summary.append(f"{category}: {len(items)} items")
            print(f"📊 Insights used: {', '.join(insight_summary) if insight_summary else 'No structured insights available'}")
            print("-" * 40)
        print(script)
        print("=" * 60)
        
        # Enhanced script parsing to handle multiple formats
        lines = script.strip().split('\n')
        cleaned_lines = []
        
        host_count = 0
        analyst_count = 0
        
        for line in lines:
            line = line.strip()
            if line and (':' in line):
                # Remove markdown formatting and detect speaker patterns
                cleaned_line = line
                
                # Handle markdown bold formatting: **Pooja:** or **Arjun:**
                if line.startswith('**Pooja:**') or line.startswith('**Arjun:**'):
                    # Extract speaker and dialogue, removing markdown
                    if line.startswith('**Pooja:**'):
                        dialogue = line[10:].strip()  # Remove "**Pooja:**"
                        cleaned_line = f"Pooja: {dialogue}"
                        host_count += 1
                    else:  # **Arjun:**
                        dialogue = line[10:].strip()  # Remove "**Arjun:**"
                        cleaned_line = f"Arjun: {dialogue}"
                        analyst_count += 1
                    cleaned_lines.append(cleaned_line)
                    
                # Handle standard format: Pooja: or Arjun:
                elif line.startswith(('Pooja:', 'Arjun:')):
                    cleaned_lines.append(line)
                    if line.startswith('Pooja:'):
                        host_count += 1
                    else:
                        analyst_count += 1
                        
                # Handle case variations: Pooja:, arjun:, Pooja:, ARJUN:
                elif line.lower().startswith('Pooja:') or line.lower().startswith('arjun:'):
                    speaker, dialogue = line.split(':', 1)
                    fixed_line = f"{speaker.capitalize()}:{dialogue}"
                    cleaned_lines.append(fixed_line)
                    if speaker.lower() == 'Pooja':
                        host_count += 1
                    else:
                        analyst_count += 1
                        
                # Try to detect any other speaker patterns (legacy support)
                else:
                    detected = False
                    for speaker_name, speaker_type in [('Pooja', 'Host'), ('Arjun', 'Analyst'), ('Host', 'Host'), ('Analyst', 'Analyst')]:
                        speaker_patterns = [
                            f"{speaker_name.lower()}:",
                            f"{speaker_name.upper()}:",
                            f"*{speaker_name}:*",  # Italic markdown
                            f"_{speaker_name}:_",  # Alternative italic
                        ]
                        
                        for pattern in speaker_patterns:
                            if line.lower().startswith(pattern.lower()):
                                dialogue = line[len(pattern):].strip()
                                # Convert to standard names
                                standard_name = "Pooja" if speaker_type == "Host" else "Arjun"
                                fixed_line = f"{standard_name}: {dialogue}"
                                cleaned_lines.append(fixed_line)
                                if speaker_type == 'Host':
                                    host_count += 1
                                else:
                                    analyst_count += 1
                                detected = True
                                break
                        if detected:
                            break
                    
                    # If no speaker detected but contains colon, might be continuation
                    if not detected and cleaned_lines:
                        cleaned_lines.append(line)
            elif line and cleaned_lines:
                # Non-empty line without colon - might be continuation of dialogue
                cleaned_lines.append(line)
        
        final_script = '\n'.join(cleaned_lines)
        
        # TERMINAL LOG: Print script analysis
        print(f"📊 SCRIPT ANALYSIS:")
        print(f"  Total lines: {len(cleaned_lines)}")
        print(f"  Pooja lines: {host_count}")
        print(f"  Arjun lines: {analyst_count}")
        print(f"  Two-speaker format: {'✅' if host_count > 0 and analyst_count > 0 else '❌'}")
        print()
        
        return final_script
        
    except Exception as e:
        logger.error(f"Error generating podcast script: {e}")
        # Insights-focused fallback script with Indian names
        content_preview = content[:100] if len(content) > 100 else content
        return f"""Pooja: Hey Arjun, I just went through some really interesting analysis on this topic: {content_preview}... What stood out to you from the insights?

Arjun: That's a great question, Pooja! There are some fascinating discoveries here. The analysis revealed some patterns and connections that aren't immediately obvious when you first look at this material.

Pooja: Really? That sounds intriguing! What kind of discoveries are we talking about?

Arjun: Well, the most significant finding is how the analysis uncovered relationships and implications that go beyond what's on the surface. There are some practical takeaways that could be really valuable.

Pooja: I love that! So what would you say is the key insight someone should walk away with?

Arjun: The biggest takeaway is that this analysis helps us understand not just what the information says, but what it means in a broader context. It's about seeing the connections and implications that make this knowledge actionable.

Pooja: That's exactly the kind of insight that makes research so valuable - when you can see the bigger picture and understand why it matters. Thanks for that perspective, Arjun!"""
