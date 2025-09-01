// src/App.jsx
import React, { useState } from "react";
import "./App.css";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminDashboard from "./components/admin/AdminDashboard";
import useUploads from "./hooks/useUploads";
import AppHeader from "./components/AppHeader";
import AnalysisView from "./components/AnalysisView";
import UploadsModal from "./components/UploadsModal";
import UploadBanner from "./components/UploadBanner";
import BackgroundLogo from "./components/BackgroundLogo";

function MainApp() {
  const {
    uploads, selectedUpload, setSelectedUpload, fetchUploads, onUploadSuccess,
  } = useUploads();

  const [showUploadsModal, setShowUploadsModal] = useState(false);
  const [currentView, setCurrentView] = useState('main'); // 'main' or 'admin'

  const handleAdminClick = () => {
    setCurrentView(currentView === 'admin' ? 'main' : 'admin');
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  if (currentView === 'admin') {
    return (
      <ProtectedRoute adminOnly>
        <div className="max-w-[--container-max] mx-auto p-5">
          <BackgroundLogo />
          <AppHeader 
            showAdminButton={true}
            onAdminClick={handleBackToMain}
          />
          <AdminDashboard />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-[--container-max] mx-auto p-5">
        <BackgroundLogo />
        
        <AppHeader 
          showAdminButton={true}
          onAdminClick={handleAdminClick}
        />
        
        {/* Upload Banner */}
        <UploadBanner 
          upload={selectedUpload}
          onOpenModal={() => setShowUploadsModal(true)}
        />

        {/* Full-width Analysis View */}
        <main className="w-full">
          {selectedUpload ? (
            <AnalysisView upload={selectedUpload} />
          ) : (
            <div className="placeholder text-center italic text-[#666] py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-lg mb-4">No upload selected</p>
              <p className="text-sm">Click "Select or Upload PCAP" above to get started</p>
            </div>
          )}
        </main>

        {/* Uploads Modal */}
        <UploadsModal
          open={showUploadsModal}
          onClose={() => setShowUploadsModal(false)}
          uploads={uploads}
          onSelect={setSelectedUpload}
          selectedId={selectedUpload?.id}
          onRefresh={fetchUploads}
          onUploadSuccess={onUploadSuccess}
        />

        {/* Optional FAB for mobile */}
        <button
          className="fixed bottom-6 right-6 rounded-full shadow-lg px-5 py-3 bg-[--primary] text-white hover:opacity-90 md:hidden"
          onClick={() => setShowUploadsModal(true)}
          title="Manage Uploads"
          aria-label="Manage Uploads"
        >
          📁
        </button>
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
