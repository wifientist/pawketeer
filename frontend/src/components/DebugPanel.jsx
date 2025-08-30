import React, { useState, useEffect } from "react";
import config from "../config/config";
import apiService from "../services/api";

function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState({
    apiUrl: config.apiUrl,
    healthCheck: "not tested",
    rawFetch: "not tested",
    configEndpoint: "not tested",
  });

  useEffect(() => {
    runDebugChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runDebugChecks = async () => {
    const results = { ...debugInfo };

    try {
      const response = await fetch(`${config.apiUrl}/`);
      const data = await response.json();
      results.rawFetch = `✅ Success: ${data.message}`;
    } catch (error) {
      results.rawFetch = `❌ Error: ${error.message}`;
    }

    try {
      const health = await apiService.healthCheck();
      results.healthCheck = `✅ Success: ${health.status}`;
    } catch (error) {
      results.healthCheck = `❌ Error: ${error.message}`;
    }

    try {
      const configData = await apiService.getConfig();
      results.configEndpoint = `✅ Success: ${configData.app_name}`;
    } catch (error) {
      results.configEndpoint = `❌ Error: ${error.message}`;
    }

    setDebugInfo(results);
  };

  if (!config.enableDebug) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-[400px] rounded-lg border border-gray-300 bg-gray-50 p-4 text-xs shadow">
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Debug Information</h4>
      <div>
        <strong>API URL:</strong> {debugInfo.apiUrl}
      </div>
      <div>
        <strong>Raw Fetch:</strong> {debugInfo.rawFetch}
      </div>
      <div>
        <strong>Health Check:</strong> {debugInfo.healthCheck}
      </div>
      <div>
        <strong>Config Endpoint:</strong> {debugInfo.configEndpoint}
      </div>
      <button
        onClick={runDebugChecks}
        className="mt-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-800 hover:bg-gray-100"
      >
        Re-test
      </button>
    </div>
  );
}

export default DebugPanel;
