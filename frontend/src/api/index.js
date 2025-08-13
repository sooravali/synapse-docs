/**
 * API client for communicating with the Synapse-Docs backend
 * Provides centralized HTTP request handling using axios
 */
import axios from 'axios';

// In production (Docker), API calls should be relative to the same domain
// In development, use localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? '' : 'http://localhost:8080');

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minute timeout for general operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// API functions for document operations
export const documentAPI = {
  // Upload a PDF document
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/v1/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minute timeout for single file upload
    });
    return response.data;
  },

  // Upload multiple PDF documents
  uploadMultiple: async (files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await api.post('/api/v1/documents/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 600000, // 10 minute timeout for multiple file upload
    });
    return response.data;
  },

  // Get all documents
  list: async () => {
    const response = await api.get('/api/v1/documents/');
    return response.data;
  },

  // Get single document by ID
  get: async (documentId) => {
    const response = await api.get(`/api/v1/documents/${documentId}`);
    return response.data;
  },

  // Delete a document
  delete: async (documentId) => {
    const response = await api.delete(`/api/v1/documents/${documentId}`);
    return response.data;
  },

  // Clear all documents and vector index
  clearAll: async () => {
    const response = await api.delete('/api/v1/documents/clear-all');
    return response.data;
  },

  // Search across documents using semantic search
  search: async (queryText, topK = 5, similarityThreshold = 0.3) => {
    const response = await api.post('/api/v1/search/semantic', {
      query_text: queryText,
      top_k: topK,
      similarity_threshold: similarityThreshold,
    });
    return response.data;
  },

  // Get PDF file URL for viewing
  getViewUrl: (documentId) => {
    return `${API_BASE_URL}/api/v1/documents/view/${documentId}`;
  }
};

// API functions for insights and podcast features
export const insightsAPI = {
  // Generate insights using LLM
  generate: async (text, context = "") => {
    const response = await api.post('/api/v1/insights/generate', {
      text: text,
      context: context,
    });
    return response.data;
  }
};

export const podcastAPI = {
  // Generate podcast script and audio
  generate: async (mainText, recommendations) => {
    const response = await api.post('/api/v1/insights/podcast', {
      content: mainText,
      related_content: Array.isArray(recommendations) ? recommendations.join('\n') : (recommendations || ""),
    });
    return response.data;
  },

  // Get audio file URL
  getAudioUrl: (filename) => {
    return `${API_BASE_URL}/api/v1/insights/audio/${filename}`;
  }
};

// API functions for search operations
export const searchAPI = {
  // Perform semantic search with optimization support
  semantic: async (searchQuery, options = {}) => {
    // Ensure proper structure for backend API
    const payload = {
      query_text: typeof searchQuery === 'string' ? searchQuery : searchQuery.query_text,
      top_k: searchQuery.top_k || 10,
      similarity_threshold: searchQuery.similarity_threshold || 0.3,
      document_ids: searchQuery.document_ids || null,
      include_metadata: searchQuery.include_metadata !== false
    };
    
    // Support for abort signals and other options
    const requestConfig = {
      ...options
    };
    
    const response = await api.post('/api/v1/search/semantic', payload, requestConfig);
    return response.data;
  },

  // Perform text search
  text: async (searchQuery) => {
    const response = await api.post('/api/v1/search/text', searchQuery);
    return response.data;
  },

  // Find similar chunks
  similar: async (searchQuery) => {
    const response = await api.post('/api/v1/search/similar', searchQuery);
    return response.data;
  },

  // Get search suggestions
  suggestions: async () => {
    const response = await api.get('/api/v1/search/suggestions');
    return response.data;
  },

  // Get search analytics
  analytics: async () => {
    const response = await api.get('/api/v1/search/analytics');
    return response.data;
  }
};

export default api;
