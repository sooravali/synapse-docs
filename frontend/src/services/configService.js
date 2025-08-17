/**
 * Configuration service for runtime configuration
 * Fetches configuration from the backend API when environment variables are not available
 */
import axios from 'axios';

class ConfigService {
  constructor() {
    this.config = null;
    this.loading = false;
  }

  async getConfig() {
    if (this.config) {
      return this.config;
    }

    if (this.loading) {
      // Wait for existing request to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.config;
    }

    this.loading = true;
    try {
      // Try to get config from backend
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
        (import.meta.env.PROD ? '' : 'http://localhost:8080');
      
      console.log('🔧 Fetching config from backend API:', `${API_BASE_URL}/api/v1/config/`);
      
      const response = await axios.get(`${API_BASE_URL}/api/v1/config/`, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Config response received:', response.data);
      this.config = response.data;
      return this.config;
    } catch (error) {
      console.warn('❌ Failed to fetch config from backend:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.warn('🔧 Backend API is not accessible - using environment variables as fallback');
      } else if (error.response?.status === 404) {
        console.warn('🔧 Config endpoint not found - check backend API routing');
      } else if (error.response?.status >= 500) {
        console.warn('🔧 Backend server error - check backend logs');
      }
      
      // Fallback to environment variables
      this.config = {
        adobe_client_id: import.meta.env.VITE_ADOBE_CLIENT_ID || ''
      };
      
      console.log('📦 Using fallback config:', this.config);
      return this.config;
    } finally {
      this.loading = false;
    }
  }

  async getAdobeClientId() {
    // First try environment variable (for development)
    if (import.meta.env.VITE_ADOBE_CLIENT_ID) {
      return import.meta.env.VITE_ADOBE_CLIENT_ID;
    }

    // Then try backend API (for Docker deployment)
    const config = await this.getConfig();
    return config.adobe_client_id;
  }
}

export const configService = new ConfigService();
