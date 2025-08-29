const config = {
  // API Configuration
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  apiTimeout: parseInt(process.env.REACT_APP_API_TIMEOUT) || 30000,
  
  // App Configuration  
  appName: process.env.REACT_APP_NAME || 'WiFi Packet Analyzer',
  appVersion: process.env.REACT_APP_VERSION || '0.1.0',
  
  // Feature Flags
  enableDebug: process.env.REACT_APP_ENABLE_DEBUG === 'true',
  
  // File Upload Settings
  maxFileSize: parseInt(process.env.REACT_APP_MAX_FILE_SIZE) || 104857600, // 100MB
  allowedExtensions: process.env.REACT_APP_ALLOWED_EXTENSIONS?.split(',') || ['.pcap', '.pcapng', '.cap'],
  
  // UI Settings
  refreshInterval: 5000, // 5 seconds
  
  // Helper functions
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  isValidFileExtension: (filename) => {
    if (!filename) return false;
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return config.allowedExtensions.includes(ext);
  }
};

export default config;
