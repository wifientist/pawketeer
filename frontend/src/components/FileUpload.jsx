import React, { useState, useEffect } from "react";
import config from "../config/config";
import apiService from "../services/api";

function FileUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [serverConfig, setServerConfig] = useState(null);

  useEffect(() => {
    fetchServerConfig();
  }, []);

  const fetchServerConfig = async () => {
    try {
      const cfg = await apiService.getConfig();
      setServerConfig(cfg);
    } catch (error) {
      console.error("Failed to fetch server config:", error);
    }
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!config.isValidFileExtension(selectedFile.name)) {
      setMessage(
        `Error: Invalid file type. Allowed: ${config.allowedExtensions.join(", ")}`
      );
      setFile(null);
      return;
    }

    const maxSize = serverConfig?.max_file_size || config.maxFileSize;
    if (selectedFile.size > maxSize) {
      setMessage(
        `Error: File too large. Max size: ${config.formatFileSize(maxSize)}`
      );
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setMessage("");
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const result = await apiService.uploadFile(file);
      setMessage(`Success: ${result.message}`);
      setFile(null);
      onUploadSuccess(result);
      const input = document.querySelector('input[type="file"]');
      if (input) input.value = "";
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const maxSizeDisplay = serverConfig?.max_file_size
    ? config.formatFileSize(serverConfig.max_file_size)
    : config.formatFileSize(config.maxFileSize);

  const allowedExtensions =
    serverConfig?.allowed_extensions || config.allowedExtensions;

  return (
    <div className="file-upload">
      <h2 className="text-xl font-semibold text-gray-800">Upload Packet Capture</h2>

      <div className="mt-3 rounded-md bg-gray-100 p-4 text-sm text-gray-700">
        <p>Supported formats: {allowedExtensions.join(", ")}</p>
        <p>Maximum file size: {maxSizeDisplay}</p>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center gap-3 md:flex-row">
        <input
          type="file"
          accept={allowedExtensions.join(",")}
          onChange={handleFileSelect}
          disabled={uploading}
          className="block w-full max-w-xs text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[--blue-500] file:px-3 file:py-2 file:text-white hover:file:bg-[--blue-600]"
        />

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={[
            "rounded-md px-4 py-2 font-medium text-white transition",
            uploading || !file
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-[--blue-500] hover:bg-[--blue-600]",
          ].join(" ")}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {file && (
        <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          Selected: {file.name} ({config.formatFileSize(file.size)})
        </div>
      )}

      {message && (
        <div
          className={[
            "mt-3 rounded-md border p-3 text-sm font-semibold",
            message.startsWith("Error")
              ? "border-red-200 bg-red-100 text-red-700"
              : "border-green-200 bg-green-100 text-green-700",
          ].join(" ")}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
