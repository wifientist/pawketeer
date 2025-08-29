import React, { useState, useEffect } from 'react';
import config from '../config/config';
import apiService from '../services/api';

function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState({
    apiUrl: config.apiUrl,
    healthCheck: 'not tested',
    rawFetch: 'not tested',
    configEndpoint: 'not tested'
  });

  useEffect(() => {
    runDebugChecks();
  }, []);

  const runDebugChecks = async () => {
    const results = { ...debugInfo };

    // Test 1: Raw fetch to root endpoint
    try {
      const response = await fetch(`${config.apiUrl}/`);
      const data = await response.json();
      results.rawFetch = `✅ Success: ${data.message}`;
    } catch (error) {
      results.rawFetch = `❌ Error: ${error.message}`;
    }

    // Test 2: Health check via API service
    try {
      const health = await apiService.healthCheck();
      results.healthCheck = `✅ Success: ${health.status}`;
    } catch (error) {
      results.healthCheck = `❌ Error: ${error.message}`;
    }

    // Test 3: Config endpoint
    try {
      const configData = await apiService.getConfig();
      results.configEndpoint = `✅ Success: ${configData.app_name}`;
    } catch (error) {
      results.configEndpoint = `❌ Error: ${error.message}`;
    }

    setDebugInfo(results);
  };

  if (!config.enableDebug) {
    return null;
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      background: '#f8f9fa', 
      padding: '15px', 
      border: '1px solid #ccc',
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '400px',
      zIndex: 1000
    }}>
      <h4>Debug Information</h4>
      <div><strong>API URL:</strong> {debugInfo.apiUrl}</div>
      <div><strong>Raw Fetch:</strong> {debugInfo.rawFetch}</div>
      <div><strong>Health Check:</strong> {debugInfo.healthCheck}</div>
      <div><strong>Config Endpoint:</strong> {debugInfo.configEndpoint}</div>
      <button onClick={runDebugChecks} style={{ marginTop: '10px' }}>
        Re-test
      </button>
    </div>
  );
}

export default DebugPanel;
