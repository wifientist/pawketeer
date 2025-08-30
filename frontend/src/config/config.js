// Vite uses import.meta.env (not process.env)
const env = import.meta.env;

// helpers
const parseIntSafe = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
const parseBool = (v) => v === true || v === "true" || v === 1 || v === "1";
const splitList = (v, def) =>
  typeof v === "string" && v.trim()
    ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : def;

const config = {
  // API Configuration
  apiUrl: env.VITE_API_URL || "/api",
  apiTimeout: parseIntSafe(env.VITE_API_TIMEOUT, 30000),

  // App Configuration
  appName: env.VITE_APP_NAME || "WiFi Packet Analyzer",
  appVersion: env.VITE_APP_VERSION || "0.1.0",

  // Feature Flags
  enableDebug: parseBool(env.VITE_ENABLE_DEBUG),

  // File Upload Settings
  maxFileSize: parseIntSafe(env.VITE_MAX_FILE_SIZE, 104_857_600), // 100MB
  allowedExtensions: splitList(env.VITE_ALLOWED_EXTENSIONS, [
    ".pcap",
    ".pcapng",
    ".cap",
  ]),

  // UI Settings
  refreshInterval: 5000, // 5s

  // Helpers
  formatFileSize: (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(k)),
      units.length - 1
    );
    const val = (bytes / Math.pow(k, i)).toFixed(2);
    return `${val} ${units[i]}`;
  },

  isValidFileExtension: (filename) => {
    if (!filename) return false;
    const ext = "." + filename.split(".").pop().toLowerCase();
    return config.allowedExtensions.includes(ext);
  },
};

export default config;
