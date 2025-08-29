// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import config from './config/config';
import apiService from './services/api';
import FileUpload from './components/FileUpload';
import UploadsList from './components/UploadsList';
import AnalysisView from './components/AnalysisView';  // <-- new

function App() {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => { checkServerHealth(); fetchUploads(); }, []);

  async function checkServerHealth() {
    try { await apiService.healthCheck(); setServerStatus('healthy'); }
    catch { setServerStatus('error'); }
  }

  async function fetchUploads() {
    try {
      const data = await apiService.getUploads();
      setUploads(data.uploads || []);
      // keep selection fresh
      if (selectedUpload) {
        const updated = (data.uploads || []).find(u => u.id === selectedUpload.id);
        if (updated) setSelectedUpload(updated);
      }
    } catch (e) { console.error(e); }
  }

  function handleUploadSuccess(uploadData) {
    setUploads(prev => [...prev, uploadData]);
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>{config.appName}</h1>
        <p>Upload and analyze WiFi packet captures</p>
        <div className={`server-status ${serverStatus}`}>
          Server: {serverStatus === 'healthy' ? '🟢 Online' : serverStatus === 'error' ? '🔴 Offline' : '🟡 Checking…'}
        </div>
      </header>

      <main className="App-main">
        <div className="upload-section">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>

        <div className="content-section">
          <div className="uploads-panel">
            <UploadsList
              uploads={uploads}
              onSelect={setSelectedUpload}
              selectedId={selectedUpload?.id}
              onRefresh={fetchUploads}
            />
          </div>

          <div className="analysis-panel">
            {selectedUpload ? (
              <AnalysisView upload={selectedUpload} />
            ) : (
              <div className="placeholder">Select an upload to view & run analysis</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
