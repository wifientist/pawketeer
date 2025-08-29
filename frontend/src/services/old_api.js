import config from '../config/config';

class ApiService {
  constructor() {
    this.baseURL = config.apiUrl;
    this.timeout = config.apiTimeout;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: this.timeout,
      ...options,
    };

    // Remove Content-Type header for FormData
    if (options.body instanceof FormData) {
      delete defaultOptions.headers['Content-Type'];
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...defaultOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (config.enableDebug) {
        console.error('API request failed:', error);
      }
      throw error;
    }
  }

  // Upload file
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/api/upload', {
      method: 'POST',
      body: formData,
    });
  }

  // Get uploads list
  async getUploads() {
    return this.request('/api/uploads');
  }

  // Get specific upload
  async getUpload(uploadId) {
    return this.request(`/api/uploads/${uploadId}`);
  }

  // Get analysis results
  async getAnalysis(uploadId) {
    return this.request(`/api/analysis/${uploadId}`);
  }

  // Get server config
  async getConfig() {
    return this.request('/config');
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export default new ApiService();
