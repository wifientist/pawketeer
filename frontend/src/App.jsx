// src/App.jsx
import React, { useState } from "react";
import "./App.css";
import useServerHealth from "./hooks/useServerHealth";
import useUploads from "./hooks/useUploads";
import AppHeader from "./components/AppHeader";
import UploadsList from "./components/UploadsList";
import AnalysisView from "./components/AnalysisView";
import UploadModal from "./components/UploadModal";
import BackgroundLogo from "./components/BackgroundLogo";


export default function App() {
  const { statusText, statusClass } = useServerHealth();
  const {
    uploads, selectedUpload, setSelectedUpload, fetchUploads, onUploadSuccess,
  } = useUploads();

  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="max-w-[--container-max] mx-auto p-5">
      <BackgroundLogo />
      <AppHeader statusText={statusText} statusClass={statusClass} />
      {/* Top actions */}
      <div className="flex justify-center mb-4">
        <button
          className="btn primary"
          onClick={() => setShowUpload(true)}
          title="Upload a new PCAP"
        >
          ⬆️ Upload PCAP
        </button>
      </div>

      <main className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-5">
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
      </main>

      {/* Modal */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploadSuccess={onUploadSuccess}
      />

      {/* Optional FAB */}
      <button
        className="fixed bottom-6 right-6 rounded-full shadow-lg px-5 py-3 bg-[--primary] text-white hover:opacity-90 md:hidden"
        onClick={() => setShowUpload(true)}
        title="Upload"
        aria-label="Upload"
      >
        ⬆️
      </button>
    </div>
  );
}
