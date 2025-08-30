import config from "../config/config";

// join baseURL + endpoint safely (avoid double slashes)
const join = (base, path) =>
  base.replace(/\/+$/, "") + (path.startsWith("/") ? "" : "/") + path;

class ApiService {
  constructor() {
    this.baseURL = config.apiUrl;
    this.timeout = config.apiTimeout;
  }

  async request(endpoint, options = {}) {
    const url = join(this.baseURL, endpoint);

    // Build headers (don’t set Content-Type for FormData)
    const headers = { "Content-Type": "application/json", ...options.headers };
    const isFormData = options.body instanceof FormData;
    if (isFormData) delete headers["Content-Type"];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let res;
    try {
      res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Try JSON, fall back to text if needed
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data = await res.text();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      // Prefer structured error if present
      const detail =
        (data && data.detail) ||
        (typeof data === "string" && data) ||
        `HTTP ${res.status} ${res.statusText}`;
      throw new Error(detail);
    }

    return data;
  }

  // ---- endpoints ----
  getConfig() {
    return this.request("/config");
  }
  healthCheck() {
    return this.request("/health");
  }

  uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    return this.request("/upload", { method: "POST", body: formData });
  }

  getUploads() {
    return this.request("/uploads");
  }
  getUpload(id) {
    return this.request(`/uploads/${id}`);
  }

  // PCAP
  getPcapsList() {
    return this.request("/pcaps/list");
  }
  getPcapCombo(pcapId, { latestOnly = false } = {}) {
    const q = latestOnly ? "?latest_only=true" : "";
    return this.request(`/pcaps/${pcapId}/combo${q}`);
  }
  startAnalysisByUpload(uploadId) {
    return this.request(`/uploads/${uploadId}/analyze`, { method: "POST" });
  }
  startAnalysisByPcap(pcapId) {
    return this.request(`/pcaps/${pcapId}/analyze`, { method: "POST" });
  }
  getLatestPcapAnalysis(pcapId) {
    return this.request(`/pcaps/${pcapId}/analysis/latest`);
  }
}

export default new ApiService();
