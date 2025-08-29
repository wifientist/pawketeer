// src/components/UploadsList.jsx
import React from 'react';
import config from '../config/config';

function UploadsList({ uploads, onSelect, selectedId, onRefresh }) {
  return (
    <div className="uploads-list">
      <div className="list-header">
        <h3>Uploads ({uploads.length})</h3>
        {onRefresh && (
          <button className="btn small" onClick={onRefresh} title="Refresh">↻</button>
        )}
      </div>

      {uploads.length === 0 ? (
        <p>No uploads yet. Upload a packet capture to get started.</p>
      ) : (
        <div className="uploads-items">
          {uploads.map((u) => (
            <div
              key={u.id}
              className={`upload-item ${selectedId === u.id ? 'selected' : ''}`}
              onClick={() => onSelect(u)}
            >
              <div className="upload-name">{u.filename}</div>
              <div className="upload-details">
                <span>ID: {u.id}</span>
                <span>PCAP: {u.pcap_id ?? '—'}</span>
                <span>Size: {config.formatFileSize(u.file_size || 0)}</span>
                <span className={`status ${u.status}`}>{u.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadsList;
