// src/components/UploadModal.jsx
import React from "react";
import Modal from "./Modal";
import FileUpload from "./FileUpload";

export default function UploadModal({ open, onClose, onUploadSuccess }) {
  return (
    <Modal open={open} onClose={onClose} title="Upload Packet Capture">
      <FileUpload
        onUploadSuccess={(u) => {
          onUploadSuccess?.(u);
          onClose?.();
        }}
      />
    </Modal>
  );
}
