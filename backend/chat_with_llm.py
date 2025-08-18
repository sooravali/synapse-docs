import os
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chat_models import ChatOllama

# Python libraries to be installed: langchain, langchain-openai, langchain-google-genai, langchain-community

"""
LLM Chat Interface with Multi-Provider Support

This module provides a unified interface for chatting with various LLM providers
including Google Gemini, Azure OpenAI, OpenAI, and Ollama.

SETUP:
Users are expected to set appropriate environment variables for their chosen LLM provider
before calling the get_llm_response function.

Environment Variables:

LLM_PROVIDER (default: "gemini")
    - "gemini": Google Gemini (default)
    - "azure": Azure OpenAI
    - "openai": OpenAI API
    - "ollama": Local Ollama models

For Gemini (Google Generative AI):
    GOOGLE_API_KEY: Your Google API key (recommended)
    GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON file (alternative)
    GEMINI_MODEL (default: "gemini-2.0-flash-exp"): Model name to use

For Azure OpenAI:
    AZURE_OPENAI_KEY: Your Azure OpenAI API key
    AZURE_OPENAI_BASE: Azure OpenAI endpoint URL
    AZURE_API_VERSION: API version (e.g., "2024-02-15-preview")
    AZURE_DEPLOYMENT_NAME (default: "gpt-4o"): Deployment name

For OpenAI:
    OPENAI_API_KEY: Your OpenAI API key
    OPENAI_API_BASE (default: "https://api.openai.com/v1"): API base URL
    OPENAI_MODEL (default: "gpt-4o"): Model name

For Ollama:
    OLLAMA_BASE_URL (default: "http://localhost:11434"): Ollama server URL
    OLLAMA_MODEL (default: "llama3"): Model name

Usage:
    # Set your environment variables first, then use the function
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ]
    response = get_llm_response(messages)
"""

def get_llm_response(messages):
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()

    # Use messages in current format directly

    if provider == "gemini":
        api_key = os.getenv("GOOGLE_API_KEY")
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")

        if not api_key and not credentials_path:
            raise ValueError("Either GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS must be set.")

        # Use API key if available, otherwise use service account credentials
        if api_key:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=api_key,
                temperature=0.7
            )
        else:
            # For service account credentials, we need to set the environment variable
            # and let the Google client library handle authentication
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0.7
            )

        try:
            response = llm.invoke(messages)
            return response.content
        except Exception as e:
            raise RuntimeError(f"Gemini call failed: {e}")

    elif provider == "azure":
        api_key = os.getenv("AZURE_OPENAI_KEY")
        api_base = os.getenv("AZURE_OPENAI_BASE")
        api_version = os.getenv("AZURE_API_VERSION")
        deployment_name = os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-4o")

        if not all([api_key, api_base, api_version]):
            raise ValueError("Missing one of AZURE_OPENAI_KEY, AZURE_OPENAI_BASE, or AZURE_API_VERSION.")

        llm = AzureChatOpenAI(
            azure_deployment=deployment_name,
            openai_api_version=api_version,
            azure_endpoint=api_base,
            api_key=api_key,
            temperature=0.7
        )

        try:
            response = llm.invoke(messages)
            return response.content
        except Exception as e:
            raise RuntimeError(f"Azure OpenAI call failed: {e}")

    elif provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        api_base = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o")

        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set.")

        llm = ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=api_base,
            temperature=0.7
        )

        try:
            response = llm.invoke(messages)
            return response.content
        except Exception as e:
            raise RuntimeError(f"OpenAI call failed: {e}")

    elif provider == "ollama":
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "llama3")

        llm = ChatOllama(
            model=model,
            base_url=ollama_url,
            temperature=0.7
        )

        try:
            response = llm.invoke(messages)
            return response.content
        except Exception as e:
            raise RuntimeError(f"Ollama call failed: {e}")

    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {provider}")

if __name__ == "__main__":
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
    ]

    try:
        reply = get_llm_response(messages)
        print("LLM Response:", reply)
    except Exception as e:
        print("Error:", str(e))
