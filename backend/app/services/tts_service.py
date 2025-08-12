"""
Text-to-Speech Service for Adobe Hackathon 2025
Follows the sample script pattern from the hackathon requirements
https://github.com/rbabbar-adobe/sample-repo/blob/main/generate_audio.py
"""
import os
import httpx
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class TTSService:
    """
    Text-to-Speech service that supports Azure TTS as required by Adobe Hackathon 2025.
    Falls back to local TTS for development.
    """
    
    def __init__(self):
        self.provider = settings.TTS_PROVIDER.lower()
        self._azure_available = None  # Cache Azure availability check
        logger.info(f"Initializing TTS service with provider: {self.provider}")
    
    async def test_azure_connection(self) -> bool:
        """Test Azure TTS connection and credentials with simplified approach"""
        if self._azure_available is not None:
            return self._azure_available
            
        try:
            import azure.cognitiveservices.speech as speechsdk
            
            if not settings.AZURE_TTS_KEY:
                logger.info("Azure TTS key not configured")
                self._azure_available = False
                return False
                
            # Create a minimal config to test connection
            if settings.AZURE_TTS_ENDPOINT:
                speech_config = speechsdk.SpeechConfig(
                    subscription=settings.AZURE_TTS_KEY,
                    endpoint=settings.AZURE_TTS_ENDPOINT
                )
            elif settings.AZURE_TTS_REGION:
                speech_config = speechsdk.SpeechConfig(
                    subscription=settings.AZURE_TTS_KEY,
                    region=settings.AZURE_TTS_REGION
                )
            else:
                logger.info("Azure TTS region/endpoint not configured")
                self._azure_available = False
                return False
            
            # Simple test - just try to create a synthesizer
            # Avoid calling speak_text_async for the test to prevent quota usage
            try:
                synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
                logger.info("Azure TTS synthesizer created successfully")
                self._azure_available = True
                return True
            except Exception as syn_error:
                logger.warning(f"Azure TTS synthesizer creation failed: {syn_error}")
                self._azure_available = False
                return False
            
        except ImportError:
            logger.info("Azure Speech SDK not available")
            self._azure_available = False
            return False
        except Exception as e:
            logger.warning(f"Azure TTS connection test error: {e}")
            self._azure_available = False
            return False
    
    async def generate_audio(self, text: str, output_path: str) -> bool:
        """
        Generate audio from text following the hackathon requirements.
        Returns True if successful, False otherwise.
        """
        try:
            if self.provider == "azure":
                return await self._generate_azure_audio(text, output_path)
            else:
                # Fallback for development
                return await self._generate_local_audio(text, output_path)
        except Exception as e:
            logger.error(f"Error generating audio: {e}")
            return False
    
    async def _generate_azure_audio(self, text: str, output_path: str) -> bool:
        """Generate audio using Azure Text-to-Speech service with enhanced error handling and platform compatibility"""
        if not settings.AZURE_TTS_KEY:
            logger.warning("Azure TTS key not configured, using mock audio")
            return await self._generate_mock_audio(text, output_path)
        
        # Try HTTP API first as it's more compatible with containers
        try:
            return await self._generate_azure_audio_http(text, output_path)
        except Exception as http_error:
            logger.warning(f"Azure TTS HTTP API failed: {http_error}, trying SDK approach")
        
        # Fallback to SDK approach
        try:
            return await self._generate_azure_audio_sdk(text, output_path)
        except Exception as sdk_error:
            logger.error(f"Azure TTS SDK also failed: {sdk_error}, using mock audio")
            return await self._generate_mock_audio(text, output_path)
    
    async def _generate_azure_audio_http(self, text: str, output_path: str) -> bool:
        """Generate audio using Azure TTS REST API (more container-friendly)"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Limit text length
            max_tts_chars = int(os.environ.get("MAX_TTS_CHARACTERS", "10000"))
            if len(text) > max_tts_chars:
                text = text[:max_tts_chars-100] + "... [Content truncated for audio generation]"
                logger.info(f"Text truncated to {len(text)} characters for TTS")
            
            # Construct the REST API URL - correct Azure TTS REST API endpoint
            if settings.AZURE_TTS_REGION:
                # Use the region-specific TTS endpoint (most common)
                url = f"https://{settings.AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
            elif settings.AZURE_TTS_ENDPOINT:
                # If endpoint is provided, it should be the TTS-specific endpoint
                base_url = settings.AZURE_TTS_ENDPOINT.rstrip('/')
                if not base_url.endswith('tts.speech.microsoft.com'):
                    # If it's a general cognitive services endpoint, convert to TTS endpoint
                    if 'api.cognitive.microsoft.com' in base_url:
                        region = base_url.split('.')[0].split('//')[-1]
                        url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
                    else:
                        url = f"{base_url}/cognitiveservices/v1"
                else:
                    url = f"{base_url}/cognitiveservices/v1"
            else:
                raise ValueError("Neither AZURE_TTS_REGION nor AZURE_TTS_ENDPOINT configured")
            
            # Create SSML for better voice control (configurable voice)
            voice_name = os.environ.get("AZURE_TTS_VOICE", "en-US-AriaNeural")
            voice_lang = voice_name.split('-')[0:2]  # Extract language from voice name
            voice_lang_str = '-'.join(voice_lang) if len(voice_lang) >= 2 else 'en-US'
            
            ssml = f"""
            <speak version='1.0' xml:lang='{voice_lang_str}'>
                <voice xml:lang='{voice_lang_str}' name='{voice_name}'>
                    {text}
                </voice>
            </speak>
            """
            
            headers = {
                'Ocp-Apim-Subscription-Key': settings.AZURE_TTS_KEY,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
                'User-Agent': 'SynapseDocs-AudioGeneration'
            }
            
            logger.info(f"Sending HTTP request to Azure TTS API: {url}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, content=ssml)
                
                if response.status_code == 200:
                    # Write audio content to file
                    with open(output_path, 'wb') as f:
                        f.write(response.content)
                    
                    # Verify file was created successfully
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        logger.info(f"Azure TTS HTTP audio generated successfully at {output_path} ({os.path.getsize(output_path)} bytes)")
                        return True
                    else:
                        logger.error("Azure TTS HTTP returned empty response")
                        return False
                else:
                    logger.error(f"Azure TTS HTTP API error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Azure TTS HTTP API error: {e}")
            raise
    
    async def _generate_azure_audio_sdk(self, text: str, output_path: str) -> bool:
        """Generate audio using Azure Speech SDK with platform compatibility fixes"""
        try:
            # Azure TTS API implementation with platform compatibility fixes
            import azure.cognitiveservices.speech as speechsdk
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Configure speech service - support both region and endpoint configurations
            if settings.AZURE_TTS_ENDPOINT:
                # Use endpoint-based configuration
                speech_config = speechsdk.SpeechConfig(
                    subscription=settings.AZURE_TTS_KEY,
                    endpoint=settings.AZURE_TTS_ENDPOINT
                )
                logger.info(f"Using Azure TTS endpoint: {settings.AZURE_TTS_ENDPOINT}")
            elif settings.AZURE_TTS_REGION:
                # Use region-based configuration
                speech_config = speechsdk.SpeechConfig(
                    subscription=settings.AZURE_TTS_KEY,
                    region=settings.AZURE_TTS_REGION
                )
                logger.info(f"Using Azure TTS region: {settings.AZURE_TTS_REGION}")
            else:
                logger.warning("Neither AZURE_TTS_REGION nor AZURE_TTS_ENDPOINT configured, using mock audio")
                return await self._generate_mock_audio(text, output_path)
            
            # Set voice and output format (configurable voice)
            voice_name = os.environ.get("AZURE_TTS_VOICE", "en-US-AriaNeural")
            speech_config.speech_synthesis_voice_name = voice_name
            speech_config.set_speech_synthesis_output_format(speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3)
            
            # Platform compatibility fix: Try to disable platform-specific features
            try:
                # Set platform properties to work better in containers
                speech_config.set_property(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "10000")
                speech_config.set_property(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "10000")
            except Exception as prop_error:
                logger.warning(f"Could not set speech config properties: {prop_error}")
            
            # Create synthesizer with file output
            file_config = speechsdk.audio.AudioOutputConfig(filename=output_path)
            
            # Platform compatibility: Try creating synthesizer with error handling for platform initialization
            try:
                synthesizer = speechsdk.SpeechSynthesizer(
                    speech_config=speech_config,
                    audio_config=file_config
                )
                logger.info("Azure Speech synthesizer created successfully")
            except Exception as synthesizer_error:
                logger.error(f"Failed to create Azure Speech synthesizer: {synthesizer_error}")
                if "Failed to initialize platform" in str(synthesizer_error) or "azure-c-shared" in str(synthesizer_error):
                    logger.warning("Azure Speech SDK platform initialization failed - this is common in Docker containers on ARM64 hosts. Using mock audio.")
                    return await self._generate_mock_audio(text, output_path)
                else:
                    raise synthesizer_error
            
            # Generate speech with retry logic
            logger.info(f"Generating Azure TTS audio for {len(text)} characters")
            
            # Limit text length to avoid quota issues (configurable)
            max_tts_chars = int(os.environ.get("MAX_TTS_CHARACTERS", "10000"))
            if len(text) > max_tts_chars:
                text = text[:max_tts_chars-100] + "... [Content truncated for audio generation]"
                logger.info(f"Text truncated to {len(text)} characters for TTS")
            
            # Try synthesis with platform error handling
            try:
                result = synthesizer.speak_text_async(text).get()
            except Exception as synthesis_error:
                logger.error(f"Azure TTS synthesis failed: {synthesis_error}")
                if "Failed to initialize platform" in str(synthesis_error) or "azure-c-shared" in str(synthesis_error):
                    logger.warning("Azure Speech SDK runtime platform error - using mock audio fallback")
                    return await self._generate_mock_audio(text, output_path)
                else:
                    raise synthesis_error
            
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                # Verify the file was actually created and has content
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    logger.info(f"Azure TTS audio generated successfully at {output_path} ({os.path.getsize(output_path)} bytes)")
                    return True
                else:
                    logger.error("Azure TTS reported success but no audio file was created")
                    return await self._generate_mock_audio(text, output_path)
            else:
                # Enhanced error reporting with safer error handling
                error_details = {
                    speechsdk.ResultReason.Canceled: "Request was canceled",
                    speechsdk.ResultReason.SynthesizingAudioStarted: "Audio synthesis started but not completed",
                }
                error_msg = error_details.get(result.reason, f"Unknown error: {result.reason}")
                
                # Get cancellation details if available - with safer approach
                if result.reason == speechsdk.ResultReason.Canceled:
                    try:
                        # Access cancellation details directly from result
                        cancellation = result.cancellation_details
                        
                        if hasattr(cancellation, 'reason') and cancellation.reason == speechsdk.CancellationReason.Error:
                            if hasattr(cancellation, 'error_code') and hasattr(cancellation, 'error_details'):
                                error_msg += f" - Error code: {cancellation.error_code}, Details: {cancellation.error_details}"
                                logger.error(f"Azure TTS cancellation details: {cancellation.error_details}")
                                
                                # Check for platform errors in cancellation details
                                if "Failed to initialize platform" in cancellation.error_details or "azure-c-shared" in cancellation.error_details:
                                    logger.warning("Platform initialization error detected in cancellation details - using mock audio")
                                    return await self._generate_mock_audio(text, output_path)
                                    
                        elif hasattr(cancellation, 'reason') and cancellation.reason == speechsdk.CancellationReason.EndOfStream:
                            error_msg += " - End of stream reached"
                    except Exception as detail_error:
                        logger.warning(f"Could not get detailed cancellation info: {detail_error}")
                        error_msg += " - Detailed error info unavailable"
                
                logger.error(f"Azure TTS failed: {error_msg}")
                return await self._generate_mock_audio(text, output_path)
                
        except ImportError:
            logger.warning("Azure Speech SDK not installed, using mock audio. Install with: pip install azure-cognitiveservices-speech")
            return await self._generate_mock_audio(text, output_path)
        except Exception as e:
            logger.error(f"Azure TTS error: {e}")
            return await self._generate_mock_audio(text, output_path)
    
    async def _generate_local_audio(self, text: str, output_path: str) -> bool:
        """Generate audio using local TTS (development fallback)"""
        try:
            # For development, create a simple text file as placeholder
            # In production, this could use local TTS libraries
            logger.info("Using local TTS placeholder for development")
            return await self._generate_mock_audio(text, output_path)
        except Exception as e:
            logger.error(f"Local TTS error: {e}")
            return False
    
    async def _generate_mock_audio(self, text: str, output_path: str) -> bool:
        """Generate a mock audio file for development with clear identification"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Create a more realistic mock MP3 file
            # This creates a short silent MP3 file with proper headers and structure
            mp3_header = bytes([
                # MP3 frame header (11111111 11111011 1001xxxx xxxxxxxx)
                0xFF, 0xFB, 0x90, 0x00,
                # Additional header info for stereo, 44.1kHz, 128kbps
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ])
            
            # Create a smaller mock file (~10KB) for easy identification
            with open(output_path, 'wb') as f:
                # Write MP3 frames to create a proper short audio file
                for _ in range(25):  # Create smaller mock file
                    f.write(mp3_header)
                    # Add some padding data to make frames more realistic
                    f.write(b'\x00' * 400)  # Silent audio data
            
            # Mark this as mock audio with metadata
            with open(output_path + ".meta", 'w') as f:
                f.write("mock_audio=true\n")
                f.write(f"generated_at={os.path.getmtime(output_path)}\n")
                f.write(f"content_length={len(text)}\n")
            
            # Also create a text file with the content for debugging
            with open(output_path.replace('.mp3', '.txt'), 'w') as f:
                f.write(f"Mock audio content: {text}")
            
            logger.info(f"Mock audio generated at {output_path} (size: {os.path.getsize(output_path)} bytes)")
            return True
        except Exception as e:
            logger.error(f"Error creating mock audio: {e}")
            return False

    def is_real_audio(self, audio_path: str) -> bool:
        """Check if an audio file is real (not mock) based on size and metadata"""
        try:
            if not os.path.exists(audio_path):
                return False
            
            # Check for mock metadata file
            if os.path.exists(audio_path + ".meta"):
                return False
            
            # Check file size - real TTS audio should be much larger than mock
            file_size = os.path.getsize(audio_path)
            if file_size < 50000:  # Less than 50KB is likely mock
                return False
            
            # Additional check: real MP3 files from Azure TTS should have proper headers
            with open(audio_path, 'rb') as f:
                header = f.read(10)
                # Check for proper MP3 header or ID3 tag
                if header.startswith(b'ID3') or (header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking audio file: {e}")
            return False

# Global TTS service instance
tts_service = TTSService()

async def generate_podcast_audio(script: str, output_filename: str = "podcast.mp3") -> tuple[Optional[str], bool]:
    """
    Generate podcast audio from script text.
    Returns tuple of (path to audio file or None, is_real_audio boolean).
    """
    try:
        # Use configurable audio directory
        audio_dir = os.environ.get("AUDIO_DIR", "./data/audio")
        output_path = os.path.join(audio_dir, output_filename)
        success = await tts_service.generate_audio(script, output_path)
        
        if success:
            is_real = tts_service.is_real_audio(output_path)
            logger.info(f"Audio generated at {output_path}, real_audio: {is_real}")
            return output_path, is_real
        else:
            return None, False
    except Exception as e:
        logger.error(f"Error generating podcast audio: {e}")
        return None, False
