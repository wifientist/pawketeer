// src/services/api.js
import config from '../config/config';

class ApiService {
  constructor() {
    this.baseURL = config.apiUrl;
    this.timeout = config.apiTimeout;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    };
    if (options.body instanceof FormData) delete defaultOptions.headers['Content-Type'];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const res = await fetch(url, { ...defaultOptions, signal: controller.signal }).catch((e)=>{throw e});
    clearTimeout(timeoutId);

    let data = null;
    try { data = await res.json(); } catch { /* empty 204 or plaintext */ }

    if (!res.ok) {
      const detail = data?.detail || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(detail);
    }
    return data;
  }

  getConfig() { return this.request('/config'); }

  // ---- existing helpers ----
  healthCheck() { return this.request('/health'); }
  uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/upload', { method: 'POST', body: formData });
  }
  getUploads() { return this.request('/uploads'); }
  getUpload(id) { return this.request(`/uploads/${id}`); }

  // ---- PCAP related ----
  getPcapsList() {
    return this.request('/pcaps/list');
  }
  getPcapCombo(pcapId, { latestOnly = false } = {}) {
    const q = latestOnly ? '?latest_only=true' : '';
    return this.request(`/pcaps/${pcapId}/combo${q}`);
  }
  startAnalysisByUpload(uploadId) {
    return this.request(`/uploads/${uploadId}/analyze`, { method: 'POST' });
  }
  startAnalysisByPcap(pcapId) {
    return this.request(`/pcaps/${pcapId}/analyze`, { method: 'POST' });
  }

  // Poll latest analysis for a PCAP
  getLatestPcapAnalysis(pcapId) {
    return this.request(`/pcaps/${pcapId}/analysis/latest`);
  }
}

export default new ApiService();
