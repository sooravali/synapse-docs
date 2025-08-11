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
                logger.info(f"Generating embeddings for {len(uncached_texts)} texts")
                batch_embeddings = self.model.encode(uncached_texts, convert_to_tensor=False, batch_size=32)
                
                # Fill in the uncached embeddings and cache them
                for idx, embedding in zip(uncached_indices, batch_embeddings):
                    embedding_list = embedding.tolist()
                    embeddings[idx] = embedding_list
                    
                    text_hash = self._get_text_hash(texts[idx])
                    self._cache_embedding(text_hash, embedding_list)
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Failed to create batch embeddings: {e}")
            return []
    
    def extract_semantic_content(self, document_chunks: List[Dict], query: str, max_chunks: int = 10) -> List[Dict]:
        """
        Extract most relevant content chunks using semantic similarity (from Challenge 1B).
        
        Args:
            document_chunks: List of text chunks from document
            query: Query text for semantic matching
            max_chunks: Maximum number of chunks to return
            
        Returns:
            List of ranked chunks with similarity scores
        """
        if not document_chunks or not query:
            return []
        
        try:
            # Extract text content from chunks
            chunk_texts = []
            for chunk in document_chunks:
                if isinstance(chunk, dict):
                    text = chunk.get('text_chunk', '') or chunk.get('text', '')
                else:
                    text = str(chunk)
                chunk_texts.append(text)
            
            # Generate embeddings for query and chunks
            query_embedding = self.create_embedding(query)
            if not query_embedding:
                return []
            
            chunk_embeddings = self.create_embeddings_batch(chunk_texts)
            if not chunk_embeddings:
                return []
            
            # Calculate similarities
            similarities = self._calculate_similarities(query_embedding, chunk_embeddings)
            
            # Rank and filter chunks
            ranked_results = []
            for i, (chunk, similarity) in enumerate(zip(document_chunks, similarities)):
                if similarity >= self.similarity_threshold * 0.7:  # Slightly lower threshold for retrieval
                    result_chunk = chunk.copy() if isinstance(chunk, dict) else {'text': str(chunk)}
                    result_chunk['similarity_score'] = float(similarity)
                    result_chunk['rank'] = len(ranked_results) + 1
                    ranked_results.append(result_chunk)
            
            # Sort by similarity and return top results
            ranked_results.sort(key=lambda x: x['similarity_score'], reverse=True)
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
from typing import List
import logging

logger = logging.getLogger(__name__)
