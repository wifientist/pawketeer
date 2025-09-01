import React, { useState } from "react";
import UploadsList from "./UploadsList";
import FileUpload from "./FileUpload";

export default function UploadsModal({ 
  open, 
  onClose, 
  uploads, 
  onSelect, 
  selectedId, 
  onRefresh,
  onUploadSuccess 
}) {
  const [activeTab, setActiveTab] = useState("uploads");

  if (!open) return null;

  const handleUploadSuccess = (...args) => {
    onUploadSuccess(...args);
    setActiveTab("uploads"); // Switch to uploads tab after successful upload
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Manage Uploads
            </h2>
            
            {/* Tab buttons */}
            <div className="flex border border-gray-200 rounded-md">
              <button
                onClick={() => setActiveTab("uploads")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  activeTab === "uploads"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                } rounded-l-md border-r border-gray-200`}
              >
                View Uploads ({uploads.length})
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  activeTab === "upload"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                } rounded-r-md`}
              >
                Upload New
              </button>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === "uploads" ? (
            <UploadsList
              uploads={uploads}
              onSelect={(upload) => {
                onSelect(upload);
                onClose(); // Close modal after selection
              }}
              selectedId={selectedId}
              onRefresh={onRefresh}
            />
          ) : (
            <div className="max-w-2xl mx-auto">
              <FileUpload onUploadSuccess={handleUploadSuccess} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}