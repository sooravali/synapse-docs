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
      
      const response = await axios.get(`${API_BASE_URL}/api/v1/config/`);
      this.config = response.data;
      return this.config;
    } catch (error) {
      console.warn('Failed to fetch config from backend:', error);
      // Fallback to environment variables
      this.config = {
        adobe_client_id: import.meta.env.VITE_ADOBE_CLIENT_ID || ''
      };
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
