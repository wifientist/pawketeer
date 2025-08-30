// src/App.jsx
import React, { useState, useEffect } from "react";
import "./App.css"; // keep for now; we’ll chip away component-by-component
import config from "./config/config";
import apiService from "./services/api";
import FileUpload from "./components/FileUpload";
import UploadsList from "./components/UploadsList";
import AnalysisView from "./components/AnalysisView";

function App() {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [serverStatus, setServerStatus] = useState("checking");

  useEffect(() => {
    checkServerHealth();
    fetchUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkServerHealth() {
    try {
      await apiService.healthCheck();
      setServerStatus("healthy");
    } catch {
      setServerStatus("error");
    }
  }

  async function fetchUploads() {
    try {
      const data = await apiService.getUploads();
      setUploads(data.uploads || []);
      if (selectedUpload) {
        const updated = (data.uploads || []).find((u) => u.id === selectedUpload.id);
        if (updated) setSelectedUpload(updated);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const statusText =
    serverStatus === "healthy"
      ? "🟢 Online"
      : serverStatus === "error"
      ? "🔴 Offline"
      : "🟡 Checking…";

  const statusClass =
    serverStatus === "healthy"
      ? "bg-[--success] text-white"
      : serverStatus === "error"
      ? "bg-[--error] text-white"
      : "bg-[--warning] text-[--dark]";

  return (
    <div className="max-w-[--container-max] mx-auto p-5 text-center">
      <header className="relative bg-[--header-bg] text-white p-5 rounded-[--radius] mb-8">
        <h1 className="m-0 mb-2 text-4xl font-semibold">{config.appName}</h1>
        <p className="opacity-90">Upload and analyze WiFi packet captures</p>

        <div
          className={[
            "absolute top-4 right-4 px-3 py-2 rounded-full text-sm font-bold",
            statusClass,
          ].join(" ")}
        >
          Server: {statusText}
        </div>
      </header>

      <main className="flex flex-col gap-8">
        <div className="bg-[#f5f5f5] p-5 rounded-[--radius]">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-5 text-left">
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
              <div className="placeholder text-center italic text-[#666] py-16">
                Select an upload to view &amp; run analysis
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );

  function handleUploadSuccess(uploadData) {
    setUploads((prev) => [...prev, uploadData]);
  }
}

export default App;
