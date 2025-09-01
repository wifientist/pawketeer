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
  startAnalysisByPcap(pcapId) {
    return this.request(`/pcaps/${pcapId}/analyze`, { method: "POST" });
  }
  getLatestPcapAnalysis(pcapId) {
    return this.request(`/pcaps/${pcapId}/analysis/latest`);
  }

  // Auth endpoints
  requestAccess(email) {
    return this.request("/auth/request-access", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  requestOTP(email) {
    return this.request("/auth/request-otp", {
      method: "POST", 
      body: JSON.stringify({ email })
    });
  }

  verifyOTP(email, otp_code) {
    return this.request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp_code })
    });
  }

  getMe() {
    const token = localStorage.getItem('auth_token');
    return this.request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  logout() {
    const token = localStorage.getItem('auth_token');
    return this.request("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Admin endpoints
  getAdminStats() {
    const token = localStorage.getItem('auth_token');
    return this.request("/admin/stats", {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getPendingUsers(skip = 0, limit = 50) {
    const token = localStorage.getItem('auth_token');
    return this.request(`/admin/pending-users?skip=${skip}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getAllUsers(statusFilter = null, skip = 0, limit = 50) {
    const token = localStorage.getItem('auth_token');
    const params = new URLSearchParams({ skip, limit });
    if (statusFilter) params.append('status_filter', statusFilter);
    
    return this.request(`/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  approveUser(userId, notes = '') {
    const token = localStorage.getItem('auth_token');
    return this.request(`/admin/approve-user/${userId}`, {
      method: "POST",
      body: JSON.stringify({ notes }),
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  rejectUser(userId, notes = '') {
    const token = localStorage.getItem('auth_token');
    return this.request(`/admin/reject-user/${userId}`, {
      method: "POST", 
      body: JSON.stringify({ notes }),
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  makeUserAdmin(userId) {
    const token = localStorage.getItem('auth_token');
    return this.request(`/admin/make-admin/${userId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  revokeAdminPrivileges(userId) {
    const token = localStorage.getItem('auth_token');
    return this.request(`/admin/revoke-admin/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

export default new ApiService();
