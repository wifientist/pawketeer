import React from 'react';

function UploadsList({ uploads, onSelect, selectedId }) {
  if (uploads.length === 0) {
    return (
      <div className="uploads-list">
        <h3>Uploads</h3>
        <p>No uploads yet. Upload a packet capture file to get started.</p>
      </div>
    );
  }

  return (
    <div className="uploads-list">
      <h3>Uploads ({uploads.length})</h3>
      
      <div className="uploads-items">
        {uploads.map((upload) => (
          <div 
            key={upload.id}
            className={`upload-item ${selectedId === upload.id ? 'selected' : ''}`}
            onClick={() => onSelect(upload)}
          >
            <div className="upload-name">{upload.filename}</div>
            <div className="upload-details">
              <span>ID: {upload.id}</span>
              <span>Size: {(upload.size / 1024).toFixed(1)} KB</span>
              <span className={`status ${upload.status}`}>{upload.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UploadsList;
