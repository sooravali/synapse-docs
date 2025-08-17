"""
Text-to-Speech Service for Adobe Hackathon 2025
Follows the sample script pattern from the hackathon requirements
https://github.com/rbabbar-adobe/sample-repo/blob/main/generate_audio.py

Uses the included sample script for hackathon compliance.
"""
import os
import sys
import asyncio
import httpx
from typing import Optional
from app.core.config import settings
import logging

# Add the root directory to the Python path to import the sample script
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

try:
    # Import the required sample script function
    from generate_audio import generate_audio
    GENERATE_AUDIO_AVAILABLE = True
except ImportError as e:
    print(f"Sample generate_audio script not available: {e}")
    GENERATE_AUDIO_AVAILABLE = False

logger = logging.getLogger(__name__)

class TTSService:
    """
    Text-to-Speech service that uses the Adobe Hackathon 2025 sample script.
    Follows the exact pattern required for evaluation compliance.
    """
    
    def __init__(self):
        self.provider = settings.TTS_PROVIDER.lower()
        self._azure_available = None  # Cache Azure availability check
        logger.info(f"Initializing TTS service with provider: {self.provider}")
    
    async def test_azure_connection(self) -> bool:
        """Test Azure TTS connection using the sample script approach"""
        if self._azure_available is not None:
            return self._azure_available
            
        try:
            # Use environment variables as expected by the sample script
            has_azure_key = bool(settings.AZURE_TTS_KEY)
            has_azure_endpoint = bool(settings.AZURE_TTS_ENDPOINT)
            
            if has_azure_key and has_azure_endpoint:
                logger.info("Azure TTS credentials available")
                self._azure_available = True
                return True
            else:
                logger.info("Azure TTS credentials not fully configured")
                self._azure_available = False
                return False
                
        except Exception as e:
            logger.warning(f"Azure TTS connection test error: {e}")
            self._azure_available = False
            return False
    
    async def generate_audio(self, text: str, output_path: str) -> bool:
        """
        Generate audio from text using the hackathon sample script.
        Returns True if successful, False otherwise.
        """
        try:
            if not GENERATE_AUDIO_AVAILABLE:
                logger.error("Sample generate_audio script not available - using fallback")
                return await self._generate_fallback_audio(text, output_path)
            
            # Set environment variables for the sample script
            os.environ["TTS_PROVIDER"] = self.provider
            if settings.AZURE_TTS_KEY:
                os.environ["AZURE_TTS_KEY"] = settings.AZURE_TTS_KEY
            if settings.AZURE_TTS_ENDPOINT:
                os.environ["AZURE_TTS_ENDPOINT"] = settings.AZURE_TTS_ENDPOINT
            if settings.AZURE_TTS_VOICE:
                os.environ["AZURE_TTS_VOICE"] = settings.AZURE_TTS_VOICE
            
            # Use the sample script function
            result = await asyncio.get_event_loop().run_in_executor(
                None, 
                generate_audio, 
                text, 
                output_path, 
                self.provider
            )
            
            # Check if file was created successfully
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                logger.info(f"Audio generated successfully using sample script: {output_path}")
                return True
            else:
                logger.error("Sample script did not create valid audio file")
                return False
                
        except Exception as e:
            logger.error(f"Error using sample generate_audio script: {e}")
            # Fallback to direct implementation
            return await self._generate_fallback_audio(text, output_path)
    
    async def _generate_fallback_audio(self, text: str, output_path: str) -> bool:
        """Fallback implementation when sample script is not available"""
        try:
            if self.provider == "azure":
                return await self._generate_azure_audio_direct(text, output_path)
            else:
                logger.warning("Only Azure TTS is supported in fallback mode")
                return await self._generate_mock_audio(text, output_path)
        except Exception as e:
            logger.error(f"Error in fallback audio generation: {e}")
            return False

    async def _generate_azure_audio_direct(self, text: str, output_path: str) -> bool:
        """Direct Azure TTS implementation for fallback"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Limit text length
            max_tts_chars = int(os.environ.get("MAX_TTS_CHARACTERS", "10000"))
            if len(text) > max_tts_chars:
                text = text[:max_tts_chars-100] + "... [Content truncated for audio generation]"
                logger.info(f"Text truncated to {len(text)} characters for TTS")
            
            # Construct the REST API URL
            if settings.AZURE_TTS_ENDPOINT:
                base_url = settings.AZURE_TTS_ENDPOINT.rstrip('/')
                if 'cognitiveservices/v1' not in base_url:
                    url = f"{base_url}/tts/cognitiveservices/v1"
                else:
                    url = base_url
            else:
                raise ValueError("AZURE_TTS_ENDPOINT not configured")
            
            # Create SSML for better voice control
            voice_name = settings.AZURE_TTS_VOICE or "en-US-AriaNeural"
            voice_lang = voice_name.split('-')[0:2]
            voice_lang_str = '-'.join(voice_lang) if len(voice_lang) >= 2 else 'en-US'
            
            # Escape XML entities in the text
            import html
            escaped_text = html.escape(text, quote=True)
            
            ssml = f"""<speak version='1.0' xml:lang='{voice_lang_str}'>
                <voice xml:lang='{voice_lang_str}' name='{voice_name}'>
                    {escaped_text}
                </voice>
            </speak>"""
            
            headers = {
                'Ocp-Apim-Subscription-Key': settings.AZURE_TTS_KEY,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
                'User-Agent': 'SynapseDocs-AudioGeneration'
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, content=ssml)
                
                if response.status_code == 200:
                    with open(output_path, 'wb') as f:
                        f.write(response.content)
                    
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        logger.info(f"Azure TTS audio generated successfully: {output_path}")
                        return True
                    else:
                        logger.error("Azure TTS returned empty response")
                        return False
                else:
                    logger.error(f"Azure TTS API error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Azure TTS direct implementation error: {e}")
            return await self._generate_mock_audio(text, output_path)
    
    async def generate_audio_with_voice(self, text: str, output_path: str, voice_name: str) -> bool:
        """
        Generate audio from text using a specific voice.
        
        Args:
            text: Text to convert to speech
            output_path: Path where the audio file will be saved
            voice_name: Azure TTS voice name (e.g., "en-US-JennyNeural")
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            print(f"🔊 TTS: Generating audio with voice {voice_name}")
            print(f"    Text: {text[:100]}...")
            print(f"    Output: {os.path.basename(output_path)}")
            
            if not GENERATE_AUDIO_AVAILABLE:
                print("⚠️ Sample generate_audio script not available - using fallback")
                return await self._generate_azure_audio_direct_with_voice(text, output_path, voice_name)
            
            # Set environment variables for the sample script with specific voice
            os.environ["TTS_PROVIDER"] = self.provider
            if settings.AZURE_TTS_KEY:
                os.environ["AZURE_TTS_KEY"] = settings.AZURE_TTS_KEY
            if settings.AZURE_TTS_ENDPOINT:
                os.environ["AZURE_TTS_ENDPOINT"] = settings.AZURE_TTS_ENDPOINT
            os.environ["AZURE_TTS_VOICE"] = voice_name  # Override with specific voice
            
            print(f"🔧 TTS Config:")
            print(f"    Provider: {self.provider}")
            print(f"    Key: {'***' + settings.AZURE_TTS_KEY[-4:] if settings.AZURE_TTS_KEY else 'NOT SET'}")
            print(f"    Endpoint: {settings.AZURE_TTS_ENDPOINT or 'NOT SET'}")
            print(f"    Voice: {voice_name}")
            
            # Use the sample script function
            result = await asyncio.get_event_loop().run_in_executor(
                None, 
                generate_audio, 
                text, 
                output_path, 
                self.provider
            )
            
            # Check if file was created successfully
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                file_size = os.path.getsize(output_path)
                print(f"    ✅ Success: {file_size} bytes generated")
                return True
            else:
                print(f"    ❌ Failed: No file created or empty file")
                return False
                
        except Exception as e:
            print(f"    💥 Exception in sample script: {e}")
            logger.error(f"Error using sample generate_audio script with voice {voice_name}: {e}")
            # Fallback to direct implementation
            return await self._generate_azure_audio_direct_with_voice(text, output_path, voice_name)
    
    async def _generate_azure_audio_direct_with_voice(self, text: str, output_path: str, voice_name: str) -> bool:
        """Direct Azure TTS implementation with specific voice for fallback"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Limit text length
            max_tts_chars = int(os.environ.get("MAX_TTS_CHARACTERS", "10000"))
            if len(text) > max_tts_chars:
                text = text[:max_tts_chars-100] + "... [Content truncated for audio generation]"
                logger.info(f"Text truncated to {len(text)} characters for TTS")
            
            # Construct the REST API URL
            if settings.AZURE_TTS_ENDPOINT:
                base_url = settings.AZURE_TTS_ENDPOINT.rstrip('/')
                if 'cognitiveservices/v1' not in base_url:
                    url = f"{base_url}/tts/cognitiveservices/v1"
                else:
                    url = base_url
            else:
                raise ValueError("AZURE_TTS_ENDPOINT not configured")
            
            # Create SSML for the specific voice
            voice_lang = voice_name.split('-')[0:2]
            voice_lang_str = '-'.join(voice_lang) if len(voice_lang) >= 2 else 'en-US'
            
            # Escape XML entities in the text
            import html
            escaped_text = html.escape(text, quote=True)
            
            ssml = f"""<speak version='1.0' xml:lang='{voice_lang_str}'>
                <voice xml:lang='{voice_lang_str}' name='{voice_name}'>
                    {escaped_text}
                </voice>
            </speak>"""
            
            headers = {
                'Ocp-Apim-Subscription-Key': settings.AZURE_TTS_KEY,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
                'User-Agent': 'SynapseDocs-AudioGeneration'
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, content=ssml)
                
                if response.status_code == 200:
                    with open(output_path, 'wb') as f:
                        f.write(response.content)
                    
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                        logger.info(f"Azure TTS audio with voice {voice_name} generated successfully: {output_path}")
                        return True
                    else:
                        logger.error("Azure TTS returned empty response")
                        return False
                else:
                    logger.error(f"Azure TTS API error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Azure TTS direct implementation error with voice {voice_name}: {e}")
            return False
    
    async def concatenate_audio_segments(self, segment_paths: list, output_path: str) -> bool:
        """
        Concatenate multiple audio segments into a single file.
        
        Args:
            segment_paths: List of paths to audio segments
            output_path: Path where the concatenated audio will be saved
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Try using ffmpeg if available
            import subprocess
            
            # Check if ffmpeg is available
            try:
                subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
                ffmpeg_available = True
            except (subprocess.CalledProcessError, FileNotFoundError):
                ffmpeg_available = False
            
            if ffmpeg_available and len(segment_paths) > 1:
                # Create a temporary file list for ffmpeg
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
                    for segment_path in segment_paths:
                        f.write(f"file '{segment_path}'\n")
                    filelist_path = f.name
                
                try:
                    # Use ffmpeg to concatenate
                    cmd = [
                        'ffmpeg', '-f', 'concat', '-safe', '0', 
                        '-i', filelist_path, '-c', 'copy', output_path, '-y'
                    ]
                    
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    
                    if result.returncode == 0 and os.path.exists(output_path):
                        logger.info(f"Audio segments concatenated successfully using ffmpeg: {output_path}")
                        return True
                    else:
                        logger.warning(f"ffmpeg concatenation failed: {result.stderr}")
                        
                finally:
                    # Clean up temporary file list
                    try:
                        os.unlink(filelist_path)
                    except:
                        pass
            
            # Fallback: Simple binary concatenation (works for some MP3s)
            if len(segment_paths) == 1:
                # Just copy the single file
                import shutil
                shutil.copy2(segment_paths[0], output_path)
                return True
            else:
                # Simple binary concatenation
                logger.info("Using simple binary concatenation as fallback")
                with open(output_path, 'wb') as outfile:
                    for segment_path in segment_paths:
                        if os.path.exists(segment_path):
                            with open(segment_path, 'rb') as infile:
                                outfile.write(infile.read())
                
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    logger.info(f"Audio segments concatenated using binary method: {output_path}")
                    return True
                else:
                    logger.error("Binary concatenation failed")
                    return False
                    
        except Exception as e:
            logger.error(f"Error concatenating audio segments: {e}")
            return False


async def generate_podcast_audio(script: str) -> tuple[str, bool]:
    """
    Enhanced podcast audio generation with two-speaker support.
    Parses script for Host/Analyst speakers and generates multi-voice audio.
    
    Args:
        script: The podcast script with speaker labels (Host: / Analyst:)
        
    Returns:
        tuple: (audio_file_path, success_boolean)
    """
    try:
        # TERMINAL LOG: Print audio generation start
        print("🔊 AUDIO GENERATION - Starting...")
        print("=" * 50)
        
        tts_service = TTSService()
        
        # Generate unique filename for this podcast
        import hashlib
        import time
        
        script_hash = hashlib.md5(script.encode()).hexdigest()[:8]
        timestamp = int(time.time())
        filename = f"podcast_{timestamp}_{script_hash}.mp3"
        output_path = os.path.join(settings.AUDIO_DIR, filename)
        
        # Ensure audio directory exists
        os.makedirs(settings.AUDIO_DIR, exist_ok=True)
        
        # Parse script for speakers
        script_lines = script.strip().split('\n')
        audio_segments = []
        
        host_voice = settings.AZURE_TTS_HOST_VOICE or "en-US-JennyNeural"
        analyst_voice = settings.AZURE_TTS_ANALYST_VOICE or "en-US-GuyNeural"
        
        print(f"🎭 VOICE CONFIGURATION:")
        print(f"  Host voice: {host_voice}")
        print(f"  Analyst voice: {analyst_voice}")
        print(f"  Script lines to process: {len(script_lines)}")
        print()
        
        valid_lines = 0
        for line_num, line in enumerate(script_lines):
            line = line.strip()
            if not line or ':' not in line:
                continue
                
            # Parse speaker and dialogue
            if line.startswith('Host:'):
                speaker = 'Host'
                dialogue = line[5:].strip()
                voice = host_voice
            elif line.startswith('Analyst:'):
                speaker = 'Analyst'
                dialogue = line[8:].strip()
                voice = analyst_voice
            else:
                # Skip lines that don't match speaker format
                continue
            
            if dialogue:
                valid_lines += 1
                print(f"🎯 Processing {speaker} line {valid_lines}: {dialogue[:50]}...")
                
                # Generate individual audio segment
                segment_filename = f"segment_{timestamp}_{line_num}_{speaker.lower()}.mp3"
                segment_path = os.path.join(settings.AUDIO_DIR, segment_filename)
                
                # Generate audio for this segment with specific voice
                success = await tts_service.generate_audio_with_voice(dialogue, segment_path, voice)
                
                if success and os.path.exists(segment_path):
                    file_size = os.path.getsize(segment_path)
                    audio_segments.append(segment_path)
                    print(f"  ✅ Generated {speaker} segment: {segment_filename} ({file_size} bytes)")
                else:
                    print(f"  ❌ Failed to generate {speaker} segment: {segment_filename}")
        
        print(f"\n📊 AUDIO GENERATION SUMMARY:")
        print(f"  Valid dialogue lines: {valid_lines}")
        print(f"  Audio segments created: {len(audio_segments)}")
        
        if audio_segments:
            print(f"🔗 CONCATENATING {len(audio_segments)} segments...")
            # Concatenate all segments using ffmpeg or fallback method
            success = await tts_service.concatenate_audio_segments(audio_segments, output_path)
            
            # Clean up individual segments
            print("🧹 Cleaning up temporary segments...")
            for segment_path in audio_segments:
                try:
                    if os.path.exists(segment_path):
                        os.remove(segment_path)
                        print(f"  🗑️ Removed: {os.path.basename(segment_path)}")
                except Exception as e:
                    print(f"  ⚠️ Failed to clean up {segment_path}: {e}")
            
            if success and os.path.exists(output_path):
                final_size = os.path.getsize(output_path)
                print(f"🎉 SUCCESS: Multi-speaker podcast generated!")
                print(f"  File: {filename}")
                print(f"  Size: {final_size} bytes")
                print(f"  Path: {output_path}")
                return output_path, True
            else:
                print("❌ FAILED: Could not concatenate audio segments")
                return "", False
        else:
            print("❌ FAILED: No audio segments were generated")
            print("   This could be due to:")
            print("   - TTS service configuration issues")
            print("   - Invalid Azure TTS credentials")
            print("   - Network connectivity problems")
            print("   - Script format issues")
            return "", False
            
    except Exception as e:
        print(f"💥 EXCEPTION in generate_podcast_audio: {e}")
        logger.error(f"Error in generate_podcast_audio: {e}")
        return "", False
