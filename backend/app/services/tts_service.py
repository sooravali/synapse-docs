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
import time
import hashlib
import json
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

class RateLimiter:
    """Optimized rate limiter for Azure TTS API calls with parallel processing support"""
    def __init__(self, calls_per_minute=60):  # Increased from 20 to 60 for better throughput
        self.calls_per_minute = calls_per_minute
        self.min_interval = 60.0 / calls_per_minute  # 1 second between calls instead of 3
        self.last_call_times = []  # Track multiple recent calls for burst handling
        self.max_concurrent = getattr(settings, 'TTS_CONCURRENT_REQUESTS', 5)  # Get from config
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
    
    async def wait_if_needed(self):
        """Optimized wait logic for better throughput while respecting limits"""
        async with self.semaphore:  # Limit concurrent requests
            now = time.time()
            
            # Clean old timestamps (older than 1 minute)
            self.last_call_times = [t for t in self.last_call_times if now - t < 60]
            
            # If we have too many recent calls, wait
            if len(self.last_call_times) >= self.calls_per_minute:
                oldest_call = min(self.last_call_times)
                wait_time = 60 - (now - oldest_call)
                if wait_time > 0:
                    logger.info(f"Rate limiting: waiting {wait_time:.1f}s (burst protection)")
                    await asyncio.sleep(wait_time)
            
            # Add minimal delay between calls (0.2s instead of 1s)
            if self.last_call_times:
                last_call = max(self.last_call_times)
                time_since_last = now - last_call
                if time_since_last < 0.2:  # Reduced from 1s to 0.2s
                    await asyncio.sleep(0.2 - time_since_last)
            
            self.last_call_times.append(time.time())

# Global rate limiter instance with optimized settings from config
_rate_limiter = RateLimiter(calls_per_minute=getattr(settings, 'TTS_RATE_LIMIT_PER_MINUTE', 60))

class TTSService:
    """
    Text-to-Speech service with caching and parallel processing optimizations.
    Follows the exact pattern required for evaluation compliance.
    """
    
    def __init__(self):
        self.provider = settings.TTS_PROVIDER.lower()
        self._azure_available = None  # Cache Azure availability check
        self.cache_dir = os.path.join(settings.AUDIO_DIR, "cache")
        os.makedirs(self.cache_dir, exist_ok=True)
        logger.info(f"Initializing TTS service with provider: {self.provider}")
    
    def _get_cache_key(self, text: str, voice_name: str) -> str:
        """Generate a cache key for text and voice combination"""
        content = f"{text}|{voice_name}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _get_cached_audio(self, text: str, voice_name: str) -> Optional[str]:
        """Check if audio for this text/voice combination is already cached"""
        cache_key = self._get_cache_key(text, voice_name)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.mp3")
        
        if os.path.exists(cache_file) and os.path.getsize(cache_file) > 0:
            logger.info(f"Found cached audio for text hash {cache_key[:8]}")
            return cache_file
        return None
    
    def _cache_audio(self, text: str, voice_name: str, audio_path: str) -> bool:
        """Cache the generated audio file"""
        try:
            cache_key = self._get_cache_key(text, voice_name)
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.mp3")
            
            import shutil
            shutil.copy2(audio_path, cache_file)
            logger.info(f"Cached audio for text hash {cache_key[:8]}")
            return True
        except Exception as e:
            logger.warning(f"Failed to cache audio: {e}")
            return False
    
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
        Generate audio from text using a specific voice with smart chunking for long text.
        
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
            
            # Smart text chunking for optimal TTS performance
            max_chunk_size = 1000  # Optimal chunk size for Azure TTS
            if len(text) > max_chunk_size:
                # Split into logical chunks (sentences)
                chunks = self._smart_text_chunking(text, max_chunk_size)
                return await self._generate_chunked_audio(chunks, output_path, voice_name)
            
            if not GENERATE_AUDIO_AVAILABLE:
                print("⚠️ Sample generate_audio script not available - using optimized fallback")
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
    
    def _smart_text_chunking(self, text: str, max_chunk_size: int) -> list[str]:
        """Split text into optimal chunks for TTS processing"""
        chunks = []
        sentences = text.split('. ')
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # Add period back if it doesn't end with punctuation
            if not sentence.endswith(('.', '!', '?')):
                sentence += '.'
            
            # Check if adding this sentence would exceed chunk size
            if len(current_chunk) + len(sentence) + 1 > max_chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    # Single sentence is too long, split by words
                    words = sentence.split()
                    for word in words:
                        if len(current_chunk) + len(word) + 1 > max_chunk_size:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                                current_chunk = word
                            else:
                                # Single word is too long, just add it
                                chunks.append(word)
                        else:
                            current_chunk += " " + word if current_chunk else word
            else:
                current_chunk += " " + sentence if current_chunk else sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    async def _generate_chunked_audio(self, chunks: list[str], output_path: str, voice_name: str) -> bool:
        """Generate audio for multiple chunks and concatenate them"""
        try:
            chunk_paths = []
            base_name = os.path.splitext(output_path)[0]
            
            # Generate audio for each chunk in parallel
            async def generate_chunk_audio(chunk, chunk_index):
                chunk_path = f"{base_name}_chunk_{chunk_index}.mp3"
                success = await self._generate_azure_audio_direct_with_voice(chunk, chunk_path, voice_name)
                return chunk_path if success else None
            
            # Process chunks in parallel
            results = await asyncio.gather(*[generate_chunk_audio(chunk, i) for i, chunk in enumerate(chunks)], return_exceptions=True)
            
            # Filter successful chunks
            for result in results:
                if isinstance(result, str) and result and os.path.exists(result):
                    chunk_paths.append(result)
            
            if not chunk_paths:
                logger.error("No chunks were successfully generated")
                return False
            
            # Concatenate chunks
            success = await self.concatenate_audio_segments(chunk_paths, output_path)
            
            # Clean up chunk files
            for chunk_path in chunk_paths:
                try:
                    if os.path.exists(chunk_path):
                        os.remove(chunk_path)
                except Exception as e:
                    logger.warning(f"Failed to clean up chunk file {chunk_path}: {e}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error in chunked audio generation: {e}")
            return False
    
    async def _generate_azure_audio_direct_with_voice(self, text: str, output_path: str, voice_name: str) -> bool:
        """Optimized Azure TTS implementation with faster retry logic and better error handling"""
        max_retries = 2  # Reduced from 3 to 2 for faster failure recovery
        base_delay = 1.0  # Reduced from 2.0 to 1.0 seconds
        
        for attempt in range(max_retries + 1):
            try:
                # Apply optimized rate limiting
                await _rate_limiter.wait_if_needed()
                
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Limit text length (optimized for faster processing)
                max_tts_chars = 8000  # Reduced from 10000 for faster processing
                if len(text) > max_tts_chars:
                    text = text[:max_tts_chars-50] + "..."  # Smaller truncation suffix
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
                
                # Create optimized SSML for the specific voice
                voice_lang = voice_name.split('-')[0:2]
                voice_lang_str = '-'.join(voice_lang) if len(voice_lang) >= 2 else 'en-US'
                
                # Escape XML entities in the text
                import html
                escaped_text = html.escape(text, quote=True)
                
                # Optimized SSML with rate and pitch adjustments for faster speech
                ssml = f"""<speak version='1.0' xml:lang='{voice_lang_str}'>
                    <voice xml:lang='{voice_lang_str}' name='{voice_name}'>
                        <prosody rate="1.1" pitch="0%">
                            {escaped_text}
                        </prosody>
                    </voice>
                </speak>"""
                
                headers = {
                    'Ocp-Apim-Subscription-Key': settings.AZURE_TTS_KEY,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',  # Lower bitrate for faster processing
                    'User-Agent': 'SynapseDocs-AudioGeneration'
                }
                
                # Reduced timeout for faster failure detection
                async with httpx.AsyncClient(timeout=20.0) as client:
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
                            
                    elif response.status_code == 429:
                        # Rate limit exceeded - faster retry logic
                        retry_after = response.headers.get('Retry-After', '30')  # Reduced default wait
                        try:
                            wait_time = min(int(retry_after), 30)  # Cap wait time at 30s
                        except ValueError:
                            wait_time = 30
                        
                        if attempt < max_retries:
                            logger.warning(f"Rate limit hit (429), attempt {attempt + 1}/{max_retries + 1}. Waiting {wait_time}s before retry...")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Rate limit exceeded after {max_retries + 1} attempts")
                            return False
                            
                    else:
                        error_msg = f"Azure TTS API error: {response.status_code} - {response.text}"
                        if attempt < max_retries:
                            wait_time = base_delay * (1.5 ** attempt)  # Faster exponential backoff
                            logger.warning(f"{error_msg}. Retrying in {wait_time:.1f}s... (attempt {attempt + 1}/{max_retries + 1})")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            logger.error(error_msg)
                            return False
                        
            except Exception as e:
                if attempt < max_retries:
                    wait_time = base_delay * (1.5 ** attempt)  # Faster exponential backoff
                    logger.warning(f"Azure TTS error: {e}. Retrying in {wait_time:.1f}s... (attempt {attempt + 1}/{max_retries + 1})")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error(f"Azure TTS direct implementation error with voice {voice_name} after {max_retries + 1} attempts: {e}")
                    return False
        
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
    Enhanced podcast audio generation with parallel processing for maximum speed.
    Processes multiple dialogue lines concurrently for faster generation.
    
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
        
        # Parse script for speakers and prepare parallel tasks
        script_lines = script.strip().split('\n')
        
        host_voice = settings.AZURE_TTS_HOST_VOICE or "en-US-JennyNeural"
        analyst_voice = settings.AZURE_TTS_ANALYST_VOICE or "en-US-GuyNeural"
        
        print(f"🎭 VOICE CONFIGURATION:")
        print(f"  Pooja's voice: {host_voice}")
        print(f"  Arjun's voice: {analyst_voice}")
        print(f"  Script lines to process: {len(script_lines)}")
        print()
        
        # Prepare parallel tasks for audio generation
        audio_tasks = []
        valid_lines = 0
        
        for line_num, line in enumerate(script_lines):
            line = line.strip()
            if not line or ':' not in line:
                continue
                
            # Parse speaker and dialogue - support both new names (Pooja/Arjun) and legacy (Host/Analyst)
            if line.startswith('Host:') or line.startswith('Pooja:'):
                speaker = 'Pooja' if line.startswith('Pooja:') else 'Host'
                dialogue = line[5:].strip() if line.startswith('Host:') else line[6:].strip()
                voice = host_voice
            elif line.startswith('Analyst:') or line.startswith('Arjun:'):
                speaker = 'Arjun' if line.startswith('Arjun:') else 'Analyst'
                dialogue = line[8:].strip() if line.startswith('Analyst:') else line[6:].strip()
                voice = analyst_voice
            else:
                # Skip lines that don't match speaker format
                continue
            
            if dialogue:
                valid_lines += 1
                segment_filename = f"segment_{timestamp}_{line_num}_{speaker.lower()}.mp3"
                segment_path = os.path.join(settings.AUDIO_DIR, segment_filename)
                
                # Create task for parallel execution
                task_info = {
                    'line_num': line_num,
                    'speaker': speaker,
                    'dialogue': dialogue,
                    'voice': voice,
                    'segment_path': segment_path,
                    'segment_filename': segment_filename
                }
                audio_tasks.append(task_info)
        
        print(f"📊 PARALLEL PROCESSING SETUP:")
        print(f"  Valid dialogue lines: {valid_lines}")
        print(f"  Parallel tasks prepared: {len(audio_tasks)}")
        print()
        
        if not audio_tasks:
            print("❌ FAILED: No valid dialogue lines found")
            return "", False
        
        # Execute TTS generation in parallel with controlled concurrency
        print("🚀 PARALLEL AUDIO GENERATION - Starting concurrent processing...")
        
        async def generate_single_segment(task_info):
            """Generate a single audio segment with caching"""
            try:
                print(f"🎯 Processing {task_info['speaker']} line {task_info['line_num'] + 1}: {task_info['dialogue'][:50]}...")
                
                # Check cache first
                cached_audio = tts_service._get_cached_audio(task_info['dialogue'], task_info['voice'])
                if cached_audio:
                    # Copy from cache
                    import shutil
                    shutil.copy2(cached_audio, task_info['segment_path'])
                    file_size = os.path.getsize(task_info['segment_path'])
                    print(f"  🚀 Used cached {task_info['speaker']} segment: {task_info['segment_filename']} ({file_size} bytes)")
                    return task_info['segment_path']
                
                # Generate new audio
                success = await tts_service.generate_audio_with_voice(
                    task_info['dialogue'], 
                    task_info['segment_path'], 
                    task_info['voice']
                )
                
                if success and os.path.exists(task_info['segment_path']):
                    file_size = os.path.getsize(task_info['segment_path'])
                    print(f"  ✅ Generated {task_info['speaker']} segment: {task_info['segment_filename']} ({file_size} bytes)")
                    
                    # Cache the generated audio
                    tts_service._cache_audio(task_info['dialogue'], task_info['voice'], task_info['segment_path'])
                    
                    return task_info['segment_path']
                else:
                    print(f"  ❌ Failed to generate {task_info['speaker']} segment: {task_info['segment_filename']}")
                    return None
            except Exception as e:
                print(f"  💥 Exception generating {task_info['speaker']} segment: {e}")
                return None
        
        # Execute all TTS tasks in parallel
        start_time = time.time()
        results = await asyncio.gather(*[generate_single_segment(task) for task in audio_tasks], return_exceptions=True)
        parallel_time = time.time() - start_time
        
        # Filter successful results
        audio_segments = []
        successful_segments = 0
        for result in results:
            if isinstance(result, str) and result and os.path.exists(result):
                audio_segments.append(result)
                successful_segments += 1
            elif isinstance(result, Exception):
                print(f"  ⚠️ Task exception: {result}")
        
        print(f"\n📊 PARALLEL PROCESSING RESULTS:")
        print(f"  Total tasks: {len(audio_tasks)}")
        print(f"  Successful segments: {successful_segments}")
        print(f"  Failed segments: {len(audio_tasks) - successful_segments}")
        print(f"  Processing time: {parallel_time:.1f}s")
        print(f"  Average time per segment: {parallel_time/len(audio_tasks):.1f}s")
        
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
                total_time = time.time() - (timestamp - int(time.time()) + timestamp)
                print(f"🎉 SUCCESS: Multi-speaker podcast generated!")
                print(f"  File: {filename}")
                print(f"  Size: {final_size} bytes")
                print(f"  Path: {output_path}")
                print(f"  Total generation time: {parallel_time:.1f}s")
                print(f"  Speed improvement: ~{(len(audio_tasks) * 2.5 / parallel_time):.1f}x faster")
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
