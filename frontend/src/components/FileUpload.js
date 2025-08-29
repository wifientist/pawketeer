import React, { useState, useEffect } from 'react';
import config from '../config/config';
import apiService from '../services/api';

function FileUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [serverConfig, setServerConfig] = useState(null);

  // Fetch server config on mount
  useEffect(() => {
    fetchServerConfig();
  }, []);

  const fetchServerConfig = async () => {
    try {
      const config = await apiService.getConfig();
      setServerConfig(config);
    } catch (error) {
      console.error('Failed to fetch server config:', error);
    }
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    
    if (!selectedFile) return;

    // Validate file extension
    if (!config.isValidFileExtension(selectedFile.name)) {
      setMessage(`Error: Invalid file type. Allowed: ${config.allowedExtensions.join(', ')}`);
      setFile(null);
      return;
    }

    // Validate file size
    const maxSize = serverConfig?.max_file_size || config.maxFileSize;
    if (selectedFile.size > maxSize) {
      setMessage(`Error: File too large. Max size: ${config.formatFileSize(maxSize)}`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setMessage('');
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const result = await apiService.uploadFile(file);
      setMessage(`Success: ${result.message}`);
      setFile(null);
      onUploadSuccess(result);
      // Clear the file input
      document.querySelector('input[type="file"]').value = '';
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const maxSizeDisplay = serverConfig?.max_file_size 
    ? config.formatFileSize(serverConfig.max_file_size)
    : config.formatFileSize(config.maxFileSize);

  const allowedExtensions = serverConfig?.allowed_extensions || config.allowedExtensions;

  return (
    <div className="file-upload">
      <h2>Upload Packet Capture</h2>
      
      <div className="upload-info">
        <p>Supported formats: {allowedExtensions.join(', ')}</p>
        <p>Maximum file size: {maxSizeDisplay}</p>
      </div>
      
      <div className="upload-controls">
        <input
          type="file"
          accept={allowedExtensions.join(',')}
          onChange={handleFileSelect}
          disabled={uploading}
        />
        
        <button 
          onClick={handleUpload} 
          disabled={!file || uploading}
          className="upload-btn"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      
      {file && (
        <div className="file-info">
          Selected: {file.name} ({config.formatFileSize(file.size)})
        </div>
      )}
      
      {message && (
        <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
