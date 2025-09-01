import React from "react";
import config from "../config/config";

export default function UploadBanner({ upload, onOpenModal }) {
  if (!upload) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="text-center">
          <p className="text-gray-600 mb-3">No upload selected</p>
          <button
            onClick={onOpenModal}
            className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Select or Upload PCAP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {upload.filename}
            </h2>
            <span
              className={`uppercase font-bold px-2 py-1 rounded text-xs ${
                upload.status === "uploaded"
                  ? "bg-green-100 text-green-800"
                  : upload.status === "processing"
                  ? "bg-yellow-100 text-yellow-800"
                  : upload.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {upload.status}
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Upload ID:</span> {upload.id}
            </div>
            <div>
              <span className="font-medium">PCAP ID:</span> {upload.pcap_id ?? "—"}
            </div>
            <div>
              <span className="font-medium">Size:</span> {config.formatFileSize(upload.file_size || 0)}
            </div>
            <div>
              <span className="font-medium">Uploaded:</span> {
                upload.created_at 
                  ? new Date(upload.created_at).toLocaleDateString()
                  : "—"
              }
            </div>
          </div>
        </div>
        
        <button
          onClick={onOpenModal}
          className="ml-4 inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Change Upload
        </button>
      </div>
    </div>
  );
}