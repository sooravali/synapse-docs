"""
Embedding Service - Refactored from Challenge 1B Logic

This service contains the surgically refactored logic from:
- connect-the-dots-pdf-challenge-1b/semantic_analyzer.py

Implements the sophisticated semantic analysis approach from the winning Challenge 1B submission.
"""
import logging
import os
import json
import numpy as np
from typing import List, Dict, Tuple, Optional, Any, Union
from pathlib import Path
import hashlib
import time

# Sentence Transformers for embeddings
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

# Sklearn for similarity computations
try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Embedding service implementing the sophisticated semantic analysis from Challenge 1B.
    
    Key features refactored from the winning submission:
    - all-MiniLM-L6-v2 sentence transformer model 
    - Tiered extraction strategy
    - Semantic clustering and relevance scoring
    - Efficient caching and batch processing
    - Persona-aware content analysis
    
    This service provides a singleton pattern for efficient model loading and reuse.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern to ensure single model instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the embedding service with Challenge 1B semantic analyzer logic."""
        if not self._initialized:
            self.model_name = "all-MiniLM-L6-v2"  # Exact model from Challenge 1B
            self.model = None
            self.device = "cpu"  # Use CPU for compatibility
            
            # Caching for efficiency
            self.embedding_cache = {}
            self.cache_max_size = 10000
            
            # Initialize model
            self._load_model()
            
            # Configuration from Challenge 1B
            self.chunk_overlap = 50
            self.min_chunk_size = 100
            self.max_chunk_size = 1000
            self.similarity_threshold = 0.7
            
            EmbeddingService._initialized = True
            logger.info("EmbeddingService initialized with Challenge 1B logic")
    
    def _load_model(self):
        """Load the sentence transformer model (from Challenge 1B)."""
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            logger.error("sentence-transformers not available")
            return
        
        try:
            logger.info(f"Loading model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            self.model.eval()  # Set to evaluation mode
            logger.info(f"Model loaded successfully on device: {self.device}")
            
        except Exception as e:
            logger.error(f"Failed to load model {self.model_name}: {e}")
            self.model = None
    
    def create_embedding(self, text: str) -> List[float]:
        """
        Create embedding for a single text string.
        
        Args:
            text: Input text to embed
            
        Returns:
            List of float values representing the embedding vector
        """
        # Temporary fallback for development
        if not self.model:
            logger.warning("Model not loaded, returning mock embedding for development")
            return [0.0] * 384  # Return mock embedding with correct dimensions
        
        try:
            # Check cache first
            text_hash = self._get_text_hash(text)
            if text_hash in self.embedding_cache:
                return self.embedding_cache[text_hash]
            
            # Preprocess text
            processed_text = self._preprocess_text(text)
            
            if not processed_text.strip():
                return [0.0] * 384  # Return zero vector for empty text (all-MiniLM-L6-v2 dimension)
            
            # Generate embedding
            embedding = self.model.encode(processed_text, convert_to_tensor=False)
            
            # Convert to list and cache
            embedding_list = embedding.tolist()
            self._cache_embedding(text_hash, embedding_list)
            
            return embedding_list
            
        except Exception as e:
            logger.error(f"Failed to create embedding: {e}")
            return []
    
    def create_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Create embeddings for multiple texts efficiently.
        Enhanced for large document processing with memory optimization.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            List of embedding vectors
        """
        # Temporary fallback for development
        if not self.model:
            logger.warning("Model not loaded, returning mock embeddings for development")
            # Return mock embeddings with correct dimensions (384 for all-MiniLM-L6-v2)
            return [[0.0] * 384 for _ in texts]
        
        try:
            # For very large batches, process in smaller sub-batches to prevent memory issues
            if len(texts) > 100:
                logger.info(f"Large batch detected ({len(texts)} texts), processing in sub-batches for memory optimization")
                all_embeddings = []
                sub_batch_size = 50  # Smaller sub-batches for memory efficiency
                
                for i in range(0, len(texts), sub_batch_size):
                    sub_batch = texts[i:i + sub_batch_size]
                    sub_embeddings = self._process_embedding_batch(sub_batch)
                    if sub_embeddings:
                        all_embeddings.extend(sub_embeddings)
                    else:
                        # If sub-batch fails, add zero vectors to maintain alignment
                        all_embeddings.extend([[0.0] * 384 for _ in sub_batch])
                
                return all_embeddings
            else:
                # For smaller batches, process normally
                return self._process_embedding_batch(texts)
            
        except Exception as e:
            logger.error(f"Failed to create batch embeddings: {e}")
            return []
    
    def _process_embedding_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Process a single batch of embeddings with caching.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            List of embedding vectors
        """
        try:
            # Check cache and prepare uncached texts
            embeddings = []
            uncached_indices = []
            uncached_texts = []
            
            for i, text in enumerate(texts):
                text_hash = self._get_text_hash(text)
                if text_hash in self.embedding_cache:
                    embeddings.append(self.embedding_cache[text_hash])
                else:
                    embeddings.append(None)  # Placeholder
                    uncached_indices.append(i)
                    uncached_texts.append(self._preprocess_text(text))
            
            # Generate embeddings for uncached texts
            if uncached_texts:
                logger.info(f"Generating embeddings for {len(uncached_texts)} uncached texts")
                # Use smaller batch size for memory efficiency with large documents
                model_batch_size = min(16, len(uncached_texts))  # Reduced from 32 to 16
                batch_embeddings = self.model.encode(
                    uncached_texts, 
                    convert_to_tensor=False, 
                    batch_size=model_batch_size,
                    show_progress_bar=len(uncached_texts) > 20  # Show progress for large batches
                )
                
                # Fill in the uncached embeddings and cache them
                for idx, embedding in zip(uncached_indices, batch_embeddings):
                    embedding_list = embedding.tolist()
                    embeddings[idx] = embedding_list
                    
                    text_hash = self._get_text_hash(texts[idx])
                    self._cache_embedding(text_hash, embedding_list)
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Failed to process embedding batch: {e}")
            return []
    
    def extract_semantic_content(self, document_chunks: List[Dict], query: str, max_chunks: int = 10, query_threshold: float = None) -> List[Dict]:
        """
        Extract most relevant content chunks using semantic similarity (from Challenge 1B).
        Enhanced with better ranking and context awareness.
        
        Args:
            document_chunks: List of text chunks from document
            query: Query text for semantic matching
            max_chunks: Maximum number of chunks to return
            query_threshold: Override threshold for similarity filtering
            
        Returns:
            List of ranked chunks with similarity scores and enhanced metadata
        """
        if not document_chunks or not query:
            return []
        
        try:
            # Extract text content from chunks
            chunk_texts = []
            chunk_metadata = []
            
            for chunk in document_chunks:
                if isinstance(chunk, dict):
                    text = chunk.get('text_chunk', '') or chunk.get('text', '')
                    # Include section title for better context
                    section_title = chunk.get('section_title', '')
                    if section_title and section_title not in text[:100]:
                        text = f"{section_title}: {text}"
                    
                    chunk_texts.append(text)
                    chunk_metadata.append({
                        'original_chunk': chunk,
                        'chunk_type': chunk.get('chunk_type', 'content'),
                        'extraction_method': chunk.get('extraction_method', 'unknown'),
                        'content_quality_score': chunk.get('content_quality_score', 0.5),
                        'semantic_markers': chunk.get('semantic_markers', [])
                    })
                else:
                    text = str(chunk)
                    chunk_texts.append(text)
                    chunk_metadata.append({
                        'original_chunk': {'text': text},
                        'chunk_type': 'unknown',
                        'extraction_method': 'legacy',
                        'content_quality_score': 0.5,
                        'semantic_markers': []
                    })
            
            # Generate embeddings for query and chunks
            query_embedding = self.create_embedding(query)
            if not query_embedding:
                return []
            
            chunk_embeddings = self.create_embeddings_batch(chunk_texts)
            if not chunk_embeddings:
                return []
            
            # Calculate similarities
            similarities = self._calculate_similarities(query_embedding, chunk_embeddings)
            
            # Enhanced ranking with multiple factors
            ranked_results = []
            for i, (similarity, metadata) in enumerate(zip(similarities, chunk_metadata)):
                # Use query threshold if provided, otherwise use a flexible threshold
                if query_threshold is not None:
                    effective_threshold = max(query_threshold * 0.8, 0.1)  # Ensure we don't filter too aggressively
                else:
                    effective_threshold = min(self.similarity_threshold * 0.4, 0.25)
                
                if similarity >= effective_threshold:  # More flexible threshold for better results
                    
                    # Calculate enhanced relevance score
                    relevance_score = self._calculate_enhanced_relevance(
                        similarity, metadata, query, chunk_texts[i]
                    )
                    
                    result_chunk = metadata['original_chunk'].copy()
                    result_chunk.update({
                        'similarity_score': float(similarity),
                        'relevance_score': float(relevance_score),
                        'rank': 0,  # Will be set after sorting
                        'match_explanation': self._generate_match_explanation(query, chunk_texts[i], similarity),
                        'key_phrases': self._extract_key_phrases(chunk_texts[i]),
                        'content_preview': self._generate_query_focused_preview(chunk_texts[i], query)
                    })
                    
                    ranked_results.append(result_chunk)
            
            # Sort by enhanced relevance score
            ranked_results.sort(key=lambda x: x['relevance_score'], reverse=True)
            
            # Set ranks and return top results
            for i, result in enumerate(ranked_results[:max_chunks]):
                result['rank'] = i + 1
            
            return ranked_results[:max_chunks]
            
        except Exception as e:
            logger.error(f"Failed to extract semantic content: {e}")
            return []
    
    def analyze_document_structure(self, document_chunks: List[Dict]) -> Dict[str, Any]:
        """
        Analyze document structure using semantic clustering (from Challenge 1B).
        
        Args:
            document_chunks: List of text chunks from document
            
        Returns:
            Dictionary with structural analysis results
        """
        if not document_chunks:
            return {"sections": [], "summary": "No content available"}
        
        try:
            # Extract embeddings for all chunks
            chunk_texts = []
            for chunk in document_chunks:
                if isinstance(chunk, dict):
                    text = chunk.get('text_chunk', '') or chunk.get('text', '')
                else:
                    text = str(chunk)
                chunk_texts.append(text)
            
            embeddings = self.create_embeddings_batch(chunk_texts)
            if not embeddings:
                return {"sections": [], "summary": "Failed to generate embeddings"}
            
            # Perform clustering analysis
            structure_analysis = self._cluster_content(embeddings, chunk_texts, document_chunks)
            
            # Generate summary
            summary = self._generate_document_summary(structure_analysis, chunk_texts)
            
            return {
                "sections": structure_analysis,
                "summary": summary,
                "total_chunks": len(document_chunks),
                "embedding_dimension": len(embeddings[0]) if embeddings else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze document structure: {e}")
            return {"sections": [], "summary": "Analysis failed"}
    
    def find_similar_content(self, text: str, document_chunks: List[Dict], 
                           threshold: float = None, max_results: int = 5) -> List[Dict]:
        """
        Find content similar to the given text (from Challenge 1B approach).
        
        Args:
            text: Reference text to find similarities for
            document_chunks: Document chunks to search in
            threshold: Similarity threshold (optional)
            max_results: Maximum number of results
            
        Returns:
            List of similar chunks with scores
        """
        if threshold is None:
            threshold = self.similarity_threshold
        
        return self.extract_semantic_content(document_chunks, text, max_results)
    
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for embedding (from Challenge 1B)."""
        if not text:
            return ""
        
        # Clean up the text
        text = text.strip()
        
        # Remove excessive whitespace
        text = ' '.join(text.split())
        
        # Truncate if too long (model limit)
        max_length = 512  # Typical transformer limit
        if len(text.split()) > max_length:
            text = ' '.join(text.split()[:max_length])
        
        return text
    
    def _get_text_hash(self, text: str) -> str:
        """Generate hash for text caching."""
        return hashlib.md5(text.encode('utf-8')).hexdigest()
    
    def _cache_embedding(self, text_hash: str, embedding: List[float]):
        """Cache embedding with size management."""
        if len(self.embedding_cache) >= self.cache_max_size:
            # Remove oldest entries (simple FIFO)
            old_keys = list(self.embedding_cache.keys())[:100]
            for key in old_keys:
                del self.embedding_cache[key]
        
        self.embedding_cache[text_hash] = embedding
    
    def _calculate_similarities(self, query_embedding: List[float], 
                              chunk_embeddings: List[List[float]]) -> List[float]:
        """Calculate cosine similarities between query and chunks."""
        if not SKLEARN_AVAILABLE:
            logger.warning("scikit-learn not available, using simple dot product")
            # Fallback to manual cosine similarity
            similarities = []
            query_norm = np.linalg.norm(query_embedding)
            
            for chunk_embedding in chunk_embeddings:
                chunk_norm = np.linalg.norm(chunk_embedding)
                if query_norm == 0 or chunk_norm == 0:
                    similarities.append(0.0)
                else:
                    dot_product = np.dot(query_embedding, chunk_embedding)
                    similarity = dot_product / (query_norm * chunk_norm)
                    similarities.append(float(similarity))
            
            return similarities
        
        try:
            # Use sklearn for efficient computation
            query_array = np.array(query_embedding).reshape(1, -1)
            chunk_array = np.array(chunk_embeddings)
            
            similarities = cosine_similarity(query_array, chunk_array)[0]
            return similarities.tolist()
            
        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return [0.0] * len(chunk_embeddings)
    
    def _cluster_content(self, embeddings: List[List[float]], 
                        chunk_texts: List[str], 
                        original_chunks: List[Dict]) -> List[Dict]:
        """Cluster content into semantic sections (from Challenge 1B)."""
        if not SKLEARN_AVAILABLE:
            logger.warning("scikit-learn not available, returning sequential sections")
            return self._create_sequential_sections(chunk_texts, original_chunks)
        
        try:
            # Determine optimal number of clusters
            n_chunks = len(embeddings)
            n_clusters = min(max(2, n_chunks // 5), 8)  # Between 2-8 clusters
            
            if n_chunks < 2:
                return self._create_sequential_sections(chunk_texts, original_chunks)
            
            # Perform clustering
            embeddings_array = np.array(embeddings)
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(embeddings_array)
            
            # Group chunks by cluster
            clusters = {}
            for i, label in enumerate(cluster_labels):
                if label not in clusters:
                    clusters[label] = []
                clusters[label].append({
                    'text': chunk_texts[i],
                    'original_chunk': original_chunks[i],
                    'index': i
                })
            
            # Create structured sections
            sections = []
            for cluster_id, cluster_chunks in clusters.items():
                section_title = self._generate_section_title(cluster_chunks)
                sections.append({
                    'title': section_title,
                    'chunks': cluster_chunks,
                    'chunk_count': len(cluster_chunks),
                    'cluster_id': int(cluster_id)
                })
            
            # Sort sections by the average position of their chunks
            sections.sort(key=lambda s: np.mean([c['index'] for c in s['chunks']]))
            
            return sections
            
        except Exception as e:
            logger.error(f"Clustering failed: {e}")
            return self._create_sequential_sections(chunk_texts, original_chunks)
    
    def _create_sequential_sections(self, chunk_texts: List[str], 
                                  original_chunks: List[Dict]) -> List[Dict]:
        """Create sequential sections as fallback."""
        sections = []
        chunks_per_section = max(1, len(chunk_texts) // 3)
        
        for i in range(0, len(chunk_texts), chunks_per_section):
            section_chunks = []
            for j in range(i, min(i + chunks_per_section, len(chunk_texts))):
                section_chunks.append({
                    'text': chunk_texts[j],
                    'original_chunk': original_chunks[j],
                    'index': j
                })
            
            sections.append({
                'title': f"Section {len(sections) + 1}",
                'chunks': section_chunks,
                'chunk_count': len(section_chunks),
                'cluster_id': len(sections)
            })
        
        return sections
    
    def _generate_section_title(self, cluster_chunks: List[Dict]) -> str:
        """Generate title for a content section."""
        # Use the first few words of the longest chunk as title
        longest_chunk = max(cluster_chunks, key=lambda x: len(x['text']))
        text = longest_chunk['text']
        
        # Extract first meaningful phrase
        words = text.split()[:8]
        title = ' '.join(words)
        
        # Clean up title
        if len(title) > 60:
            title = title[:60] + "..."
        
        return title
    
    def _generate_document_summary(self, sections: List[Dict], chunk_texts: List[str]) -> str:
        """Generate document summary from structural analysis."""
        if not sections:
            return "Document structure could not be analyzed."
        
        section_count = len(sections)
        total_chunks = len(chunk_texts)
        
        # Calculate average section size
        avg_section_size = total_chunks / section_count if section_count > 0 else 0
        
        summary = f"Document contains {section_count} main sections with {total_chunks} total content chunks. "
        summary += f"Average section size: {avg_section_size:.1f} chunks. "
        
        # Add section overview
        if sections:
            summary += "Main sections include: "
            section_titles = [s['title'] for s in sections[:3]]
            summary += ", ".join(section_titles)
            if len(sections) > 3:
                summary += f" and {len(sections) - 3} other sections."
        
        return summary
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        return {
            "model_name": self.model_name,
            "model_loaded": self.model is not None,
            "device": self.device,
            "cache_size": len(self.embedding_cache),
            "embedding_dimension": 384,  # all-MiniLM-L6-v2 dimension
            "dependencies": {
                "sentence_transformers": SENTENCE_TRANSFORMERS_AVAILABLE,
                "sklearn": SKLEARN_AVAILABLE
            }
        }
    
    # Enhanced methods for better semantic analysis
    
    def _calculate_enhanced_relevance(self, similarity: float, metadata: Dict, 
                                    query: str, chunk_text: str) -> float:
        """Calculate enhanced relevance score combining multiple factors."""
        base_score = similarity
        
        # Quality boost
        quality_score = metadata.get('content_quality_score', 0.5)
        quality_boost = (quality_score - 0.5) * 0.2
        
        # Chunk type boost
        chunk_type = metadata.get('chunk_type', 'content')
        type_boost = 0.0
        if chunk_type in ['H1', 'H2']:
            type_boost = 0.1  # Headings are important
        elif chunk_type in ['introduction', 'summary']:
            type_boost = 0.05
        
        # Semantic markers boost
        markers = metadata.get('semantic_markers', [])
        marker_boost = len(markers) * 0.02  # Small boost for semantic richness
        
        # Keyword matching boost (simple implementation)
        query_words = set(query.lower().split())
        chunk_words = set(chunk_text.lower().split())
        keyword_overlap = len(query_words.intersection(chunk_words)) / max(1, len(query_words))
        keyword_boost = keyword_overlap * 0.15
        
        # Extraction method boost
        extraction_method = metadata.get('extraction_method', 'unknown')
        method_boost = 0.0
        if extraction_method == 'embedded_toc':
            method_boost = 0.1  # ToC-based extraction is high quality
        elif extraction_method == 'enhanced_pipeline':
            method_boost = 0.05
        
        enhanced_score = base_score + quality_boost + type_boost + marker_boost + keyword_boost + method_boost
        return min(enhanced_score, 1.0)  # Cap at 1.0
    
    def _generate_match_explanation(self, query: str, chunk_text: str, similarity: float) -> str:
        """Generate explanation for why this chunk matches the query."""
        if similarity > 0.8:
            return "High semantic similarity - content closely matches your query"
        elif similarity > 0.6:
            return "Good semantic match - content is relevant to your query"
        elif similarity > 0.4:
            return "Moderate match - content contains related concepts"
        else:
            return "Basic match - content has some relevance"
    
    def _extract_key_phrases(self, text: str) -> List[str]:
        """Extract key phrases from text for highlighting."""
        if not text:
            return []
        
        # Simple key phrase extraction (could be enhanced with NLP)
        phrases = []
        
        # Extract noun phrases (simplified)
        words = text.split()
        for i in range(len(words) - 1):
            phrase = f"{words[i]} {words[i + 1]}"
            if len(phrase) > 8 and phrase.lower() not in ['the the', 'and and', 'of of']:
                phrases.append(phrase)
        
        # Extract capitalized phrases
        import re
        capitalized = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        phrases.extend(capitalized[:5])
        
        return phrases[:10]  # Return top 10 phrases
    
    def _generate_query_focused_preview(self, text: str, query: str, max_length: int = 300) -> str:
        """Generate a preview that focuses on content most relevant to the query."""
        if not text:
            return ""
        
        import re
        
        # Clean text
        text = re.sub(r'\s+', ' ', text).strip()
        
        # If text is short enough, return as is
        if len(text) <= max_length:
            return text
            
        # Extract query terms
        query_terms = [term.lower().strip() for term in re.split(r'[^\w]+', query) if len(term) > 2]
        
        if not query_terms:
            return self._generate_content_preview(text, max_length)
        
        # Split text into sentences
        sentences = re.split(r'[.!?]+', text)
        sentence_scores = []
        
        # Score sentences based on query term presence and position
        for i, sentence in enumerate(sentences):
            if not sentence.strip():
                continue
                
            sentence_lower = sentence.lower()
            score = 0
            
            # Count query terms in sentence
            for term in query_terms:
                score += sentence_lower.count(term) * 2  # Weight for exact matches
                # Partial matches
                for word in sentence_lower.split():
                    if term in word or word in term:
                        score += 0.5
            
            # Boost score for sentences near the beginning (but not too much)
            position_bonus = max(0, (len(sentences) - i) / len(sentences)) * 0.3
            score += position_bonus
            
            sentence_scores.append((sentence.strip(), score, i))
        
        if not sentence_scores:
            return self._generate_content_preview(text, max_length)
        
        # Sort by score and select best sentences
        sentence_scores.sort(key=lambda x: x[1], reverse=True)
        
        selected_sentences = []
        total_length = 0
        
        # Add sentences until we reach max length
        for sentence, score, original_idx in sentence_scores:
            if not sentence:
                continue
                
            sentence_with_space = sentence + '. '
            if total_length + len(sentence_with_space) <= max_length:
                selected_sentences.append((sentence, original_idx))
                total_length += len(sentence_with_space)
            elif total_length == 0:  # Always include at least one sentence
                # Truncate the sentence to fit
                available = max_length - 3  # Space for "..."
                truncated = sentence[:available] + "..."
                selected_sentences.append((truncated, original_idx))
                break
        
        if not selected_sentences:
            return self._generate_content_preview(text, max_length)
        
        # Sort selected sentences by original order
        selected_sentences.sort(key=lambda x: x[1])
        
        # Join sentences
        preview = '. '.join([sent for sent, _ in selected_sentences])
        if not preview.endswith('.'):
            preview += '.'
            
        return preview

    def _generate_content_preview(self, text: str, max_length: int = 200) -> str:
        """Generate a preview of the content."""
        if not text:
            return ""
        
        # Clean text
        import re
        text = re.sub(r'\s+', ' ', text).strip()
        
        if len(text) <= max_length:
            return text
        
        # Try to break at sentence boundary
        preview = text[:max_length]
        last_sentence = max(preview.rfind('.'), preview.rfind('!'), preview.rfind('?'))
        
        if last_sentence > max_length * 0.7:  # If we can break at a good sentence point
            return preview[:last_sentence + 1]
        else:
            # Break at word boundary
            last_space = preview.rfind(' ')
            if last_space > 0:
                return preview[:last_space] + "..."
            else:
                return preview + "..."
    
    def find_related_content(self, chunk: Dict, document_chunks: List[Dict], 
                           threshold: float = 0.7, max_results: int = 3) -> List[Dict]:
        """
        Find content related to the given chunk within the same document.
        Useful for the "Connect the Dots" feature.
        """
        if not chunk or not document_chunks:
            return []
        
        try:
            # Get text from the reference chunk
            reference_text = ""
            if isinstance(chunk, dict):
                reference_text = chunk.get('text_chunk', '') or chunk.get('text', '')
                section_title = chunk.get('section_title', '')
                if section_title and section_title not in reference_text[:50]:
                    reference_text = f"{section_title}: {reference_text}"
            else:
                reference_text = str(chunk)
            
            if not reference_text:
                return []
            
            # Find similar content using embeddings
            related_chunks = self.extract_semantic_content(
                document_chunks, reference_text, max_results + 1  # +1 to account for self-match
            )
            
            # Filter out the original chunk and apply threshold
            filtered_chunks = []
            for related_chunk in related_chunks:
                # Skip if it's the same chunk
                if (related_chunk.get('page_number') == chunk.get('page_number') and
                    related_chunk.get('text_chunk', '') == chunk.get('text_chunk', '')):
                    continue
                
                if related_chunk.get('similarity_score', 0) >= threshold:
                    # Add relationship explanation
                    related_chunk['relationship_type'] = self._determine_relationship_type(
                        chunk, related_chunk
                    )
                    filtered_chunks.append(related_chunk)
            
            return filtered_chunks[:max_results]
            
        except Exception as e:
            logger.error(f"Failed to find related content: {e}")
            return []
    
    def _determine_relationship_type(self, source_chunk: Dict, related_chunk: Dict) -> str:
        """Determine the type of relationship between two chunks."""
        source_page = source_chunk.get('page_number', 0)
        related_page = related_chunk.get('page_number', 0)
        
        source_type = source_chunk.get('chunk_type', 'content')
        related_type = related_chunk.get('chunk_type', 'content')
        
        # Page-based relationships
        if abs(source_page - related_page) <= 1:
            return "nearby_content"
        elif related_page > source_page:
            return "continues_topic"
        elif related_page < source_page:
            return "background_info"
        
        # Type-based relationships
        if source_type.startswith('H') and related_type == 'content':
            return "section_content"
        elif source_type == 'content' and related_type.startswith('H'):
            return "related_heading"
        elif source_type == related_type:
            return "similar_section"
        
        return "thematically_related"
    
    def generate_document_insights(self, document_chunks: List[Dict]) -> Dict[str, Any]:
        """
        Generate insights about the document structure and content.
        Enhanced version for better user experience.
        """
        if not document_chunks:
            return {"insights": [], "summary": "No content available"}
        
        try:
            insights = []
            
            # Analyze document structure
            structure_insight = self._analyze_document_structure_enhanced(document_chunks)
            insights.append(structure_insight)
            
            # Analyze content themes
            themes_insight = self._analyze_content_themes(document_chunks)
            insights.append(themes_insight)
            
            # Analyze document quality
            quality_insight = self._analyze_document_quality(document_chunks)
            insights.append(quality_insight)
            
            # Generate executive summary
            summary = self._generate_executive_summary(document_chunks)
            
            return {
                "insights": insights,
                "summary": summary,
                "total_chunks": len(document_chunks),
                "processing_quality": "enhanced"
            }
            
        except Exception as e:
            logger.error(f"Failed to generate document insights: {e}")
            return {"insights": [], "summary": "Analysis failed"}
    
    def _analyze_document_structure_enhanced(self, chunks: List[Dict]) -> Dict:
        """Analyze document structure with enhanced insights."""
        structure = {
            "type": "structure_analysis",
            "title": "Document Structure",
            "insights": []
        }
        
        # Count different types of content
        heading_counts = {}
        extraction_methods = {}
        
        for chunk in chunks:
            chunk_type = chunk.get('chunk_type', 'content')
            if chunk_type.startswith('H'):
                heading_counts[chunk_type] = heading_counts.get(chunk_type, 0) + 1
            
            method = chunk.get('extraction_method', 'unknown')
            extraction_methods[method] = extraction_methods.get(method, 0) + 1
        
        # Generate insights
        total_headings = sum(heading_counts.values())
        if total_headings > 0:
            structure["insights"].append(f"Document has {total_headings} headings with good hierarchical structure")
        else:
            structure["insights"].append("Document appears to have minimal heading structure")
        
        # Quality insights based on extraction method
        if 'embedded_toc' in extraction_methods:
            structure["insights"].append("Document has embedded table of contents - high structural quality")
        elif 'enhanced_pipeline' in extraction_methods:
            structure["insights"].append("Document processed with advanced structure detection")
        
        return structure
    
    def _analyze_content_themes(self, chunks: List[Dict]) -> Dict:
        """Analyze main themes in the document."""
        themes = {
            "type": "theme_analysis", 
            "title": "Content Themes",
            "insights": []
        }
        
        # Collect all semantic markers
        all_markers = []
        for chunk in chunks:
            markers = chunk.get('semantic_markers', [])
            all_markers.extend(markers)
        
        # Count marker frequencies
        from collections import Counter
        marker_counts = Counter(all_markers)
        
        if marker_counts:
            top_themes = marker_counts.most_common(3)
            theme_descriptions = {
                'introductory': 'Introduction and overview content',
                'conclusive': 'Conclusions and summary content', 
                'methodological': 'Process and methodology descriptions',
                'results': 'Results and findings',
                'technical': 'Technical and detailed information',
                'visual_reference': 'References to charts, tables, and figures'
            }
            
            for theme, count in top_themes:
                description = theme_descriptions.get(theme, f'{theme.replace("_", " ").title()} content')
                themes["insights"].append(f"{description} appears {count} time(s)")
        else:
            themes["insights"].append("Content themes could not be automatically determined")
        
        return themes
    
    def _analyze_document_quality(self, chunks: List[Dict]) -> Dict:
        """Analyze overall document quality."""
        quality = {
            "type": "quality_analysis",
            "title": "Content Quality",
            "insights": []
        }
        
        # Calculate average quality score
        quality_scores = [chunk.get('content_quality_score', 0.5) for chunk in chunks]
        avg_quality = sum(quality_scores) / len(quality_scores)
        
        if avg_quality > 1.5:
            quality["insights"].append("High quality content with good structure and readability")
        elif avg_quality > 1.0:
            quality["insights"].append("Good quality content with decent structure")
        elif avg_quality > 0.7:
            quality["insights"].append("Moderate quality content - some sections may need attention")
        else:
            quality["insights"].append("Content quality could be improved")
        
        # Analyze chunk size distribution
        chunk_sizes = [len(chunk.get('text_chunk', '')) for chunk in chunks]
        avg_size = sum(chunk_sizes) / len(chunk_sizes)
        
        if avg_size > 500:
            quality["insights"].append("Content is well-detailed with substantial sections")
        elif avg_size > 200:
            quality["insights"].append("Content has good detail level")
        else:
            quality["insights"].append("Content sections are concise")
        
        return quality
    
    def _generate_executive_summary(self, chunks: List[Dict]) -> str:
        """Generate an executive summary of the document."""
        if not chunks:
            return "No content available for summary."
        
        # Find key summary content
        summary_chunks = []
        
        for chunk in chunks:
            # Prioritize summary-like content
            markers = chunk.get('semantic_markers', [])
            chunk_type = chunk.get('chunk_type', '')
            
            if ('introductory' in markers or 'conclusive' in markers or 
                chunk_type in ['H1'] or
                'summary' in chunk.get('section_title', '').lower()):
                summary_chunks.append(chunk)
        
        # If no specific summary content, use first and last chunks
        if not summary_chunks:
            summary_chunks = chunks[:2] + chunks[-1:]
        
        # Generate summary text
        summary_parts = []
        for chunk in summary_chunks[:3]:  # Limit to 3 chunks
            text = chunk.get('text_chunk', '')
            preview = self._generate_content_preview(text, 150)
            if preview:
                summary_parts.append(preview)
        
        if summary_parts:
            return " ... ".join(summary_parts)
        else:
            return f"Document contains {len(chunks)} sections with varied content."
