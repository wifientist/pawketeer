import config from '../config/config';

class ApiService {
  constructor() {
    this.baseURL = config.apiUrl;
    this.timeout = config.apiTimeout;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    console.log(`API Request: ${options.method || 'GET'} ${url}`); // Debug log
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
      
      console.log(`API Response: ${response.status} ${response.statusText}`); // Debug log
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`API Data:`, data); // Debug log
      return data;
    } catch (error) {
      console.error(`API Error for ${url}:`, error); // Debug log
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Is it running?');
      }
      
      throw error;
    }
  }

  // Health check with simpler endpoint
  async healthCheck() {
    return this.request('/health');
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
}

export default new ApiService();
