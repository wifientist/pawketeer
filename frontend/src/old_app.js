import React, { useState, useEffect } from 'react';
import './App.css';
import config from './config/config';
import apiService from './services/api';
import FileUpload from './components/FileUpload';
import UploadsList from './components/UploadsList';

function App() {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');

  // Check server health and fetch uploads on component mount
  useEffect(() => {
    checkServerHealth();
    fetchUploads();
  }, []);

  const checkServerHealth = async () => {
    try {
      await apiService.healthCheck();
      setServerStatus('healthy');
    } catch (error) {
      setServerStatus('error');
      console.error('Server health check failed:', error);
    }
  };

  const fetchUploads = async () => {
    try {
      const data = await apiService.getUploads();
      setUploads(data.uploads || []);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  };

  const handleUploadSuccess = (uploadData) => {
    setUploads([...uploads, uploadData]);
  };

  const handleUploadSelect = (upload) => {
    setSelectedUpload(upload);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>{config.appName}</h1>
        <p>Upload and analyze WiFi packet captures</p>
        <div className={`server-status ${serverStatus}`}>
          Server: {serverStatus === 'healthy' ? '🟢 Online' : 
                   serverStatus === 'error' ? '🔴 Offline' : 
                   '🟡 Checking...'}
        </div>
        {config.enableDebug && (
          <div className="debug-info">
            Debug Mode | API: {config.apiUrl} | Version: {config.appVersion}
          </div>
        )}
      </header>
      
      <main className="App-main">
        <div className="upload-section">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>
        
        <div className="content-section">
          <div className="uploads-panel">
            <UploadsList 
              uploads={uploads} 
              onSelect={handleUploadSelect}
              selectedId={selectedUpload?.id}
              onRefresh={fetchUploads}
            />
          </div>
          
          <div className="analysis-panel">
            {selectedUpload ? (
              <AnalysisView uploadId={selectedUpload.id} />
            ) : (
              <div className="placeholder">
                Select an upload to view analysis
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Enhanced Analysis View component
function AnalysisView({ uploadId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, [uploadId]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAnalysis(uploadId);
      setAnalysis(data);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading analysis...</div>;
  }

  if (!analysis) {
    return <div className="error">Failed to load analysis</div>;
  }

  return (
    <div className="analysis-view">
      <h3>Analysis Results</h3>
      
      <div className="file-info-section">
        <h4>File Information</h4>
        <div className="file-details">
          <div className="detail">
            <label>Filename:</label>
            <span>{analysis.filename}</span>
          </div>
          <div className="detail">
            <label>Size:</label>
            <span>{config.formatFileSize(analysis.file_info?.size || 0)}</span>
          </div>
          <div className="detail">
            <label>Type:</label>
            <span>{analysis.file_info?.extension || 'Unknown'}</span>
          </div>
        </div>
      </div>
      
      <div className="analysis-summary">
        <div className="metric">
          <label>Total Packets:</label>
          <span>{analysis.summary.total_packets}</span>
        </div>
        <div className="metric">
          <label>Devices Found:</label>
          <span>{analysis.summary.devices_found}</span>
        </div>
        <div className="metric">
          <label>Security Score:</label>
          <span>{analysis.summary.security_score}/100</span>
        </div>
        <div className="metric">
          <label>Analysis Time:</label>
          <span>{analysis.summary.analysis_time}</span>
        </div>
      </div>
      
      <div className="status-message">
        <p>{analysis.message}</p>
      </div>
    </div>
  );
}

export default App;
