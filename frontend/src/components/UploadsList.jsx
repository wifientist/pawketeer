import React from "react";
import config from "../config/config";

function UploadsList({ uploads, onSelect, selectedId, onRefresh }) {
  return (
    <div className="bg-white border border-gray-200 rounded-[--radius] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="m-0 text-lg font-semibold text-gray-800">
          Uploads ({uploads.length})
        </h3>
        {onRefresh && (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-[--blue-500] px-3 py-1 text-sm font-medium text-[--blue-500] hover:bg-[--blue-500] hover:text-white transition"
            onClick={onRefresh}
            title="Refresh"
          >
            ↻ Refresh
          </button>
        )}
      </div>

      {uploads.length === 0 ? (
        <p className="text-sm text-gray-600">
          No uploads yet. Upload a packet capture to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {uploads.map((u) => {
            const isSelected = selectedId === u.id;
            return (
              <button
                type="button"
                key={u.id}
                onClick={() => onSelect(u)}
                className={[
                  "w-full text-left rounded-md border px-4 py-3 transition",
                  "border-gray-200 hover:bg-gray-50",
                  isSelected
                    ? "bg-blue-50 border-blue-300 shadow-[0_2px_4px_rgba(33,150,243,.2)]"
                    : "",
                ].join(" ")}
              >
                <div className="font-semibold text-gray-800">{u.filename}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span>ID: {u.id}</span>
                  <span>PCAP: {u.pcap_id ?? "—"}</span>
                  <span>Size: {config.formatFileSize(u.file_size || 0)}</span>
                  <span
                    className={[
                      "uppercase font-bold px-2 py-0.5 rounded text-xs",
                      u.status === "uploaded"
                        ? "bg-[--success] text-white"
                        : u.status === "processing"
                        ? "bg-[--warning] text-[--dark]"
                        : u.status === "failed"
                        ? "bg-[--error] text-white"
                        : "bg-gray-200 text-gray-800",
                    ].join(" ")}
                  >
                    {u.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UploadsList;
