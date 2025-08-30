import React, { useEffect, useState, useRef, useMemo } from "react";
import api from "../services/api";
import config from "../config/config";

export default function AnalysisView({ upload }) {
  const [combo, setCombo] = useState(null); // { pcap, analyses: [...] }
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const pcapId = upload?.pcap_id;
  const canAnalyze = Boolean(pcapId);

  const latest = useMemo(
    () => (combo?.analyses && combo.analyses.length ? combo.analyses[0] : null),
    [combo]
  );
  const selected =
    (combo?.analyses || []).find((a) => a.id === selectedAnalysisId) || latest;

  useEffect(() => {
    stopPoll();
    setError(null);
    setCombo(null);
    setSelectedAnalysisId(null);
    if (pcapId) fetchCombo(pcapId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcapId, upload?.id]);

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }

  async function fetchCombo(id) {
    try {
      const data = await api.getPcapCombo(id); // { pcap, analyses: [latest...oldest] }
      setCombo(data);
      if (data?.analyses?.length) setSelectedAnalysisId(data.analyses[0].id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function refreshStatusOnce() {
    if (!pcapId) return;
    try {
      const data = await api.getPcapCombo(pcapId);
      setCombo(data);
      if (data?.analyses?.length) {
        if (!data.analyses.some((a) => a.id === selectedAnalysisId)) {
          setSelectedAnalysisId(data.analyses[0].id);
        }
      } else {
        setSelectedAnalysisId(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function startAnalysis() {
    if (!canAnalyze) return;
    setError(null);

    try {
      await api.startAnalysisByUpload(upload.id);
    } catch {
      await api.startAnalysisByPcap(pcapId);
    }

    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getPcapCombo(pcapId);
        setCombo(data);
        const latestStatus = data?.analyses?.[0]?.status;
        if (latestStatus && ["ok", "error"].includes(latestStatus)) {
          stopPoll();
        }
      } catch (e) {
        setError(e.message);
        stopPoll();
      }
    }, 1200);
  }

  const StatusBadge = ({ s }) => {
    const status = s || "no-analysis";
    const cls =
      status === "ok"
        ? "bg-green-100 text-green-800 border-green-200"
        : status === "error"
        ? "bg-red-100 text-red-800 border-red-200"
        : status === "running" || status === "pending"
        ? "bg-yellow-100 text-yellow-900 border-yellow-200"
        : "bg-gray-100 text-gray-800 border-gray-200";
    return (
      <span
        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase border ${cls}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="analysis-view">
      <h3 className="m-0 mb-3 border-b-2 border-[--blue-500] pb-2 text-xl font-semibold text-gray-800">
        Analysis
      </h3>

      {/* PCAP File info */}
      <section className="rounded-md bg-gray-50 p-4">
        <h4 className="m-0 mb-3 text-sm font-semibold text-gray-700">File</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <strong>Original (upload):</strong> {upload?.filename}
          </div>
          <div>
            <strong>PCAP ID:</strong> {pcapId ?? "—"}
          </div>
          <div>
            <strong>Stored filename:</strong> {combo?.pcap?.filename ?? "—"}
          </div>
          <div>
            <strong>Size:</strong>{" "}
            {config.formatFileSize(
              combo?.pcap?.size_bytes || upload?.file_size || 0
            )}
          </div>
          <div>
            <strong>Uploaded:</strong>{" "}
            {combo?.pcap?.uploaded_at
              ? new Date(combo.pcap.uploaded_at).toLocaleString()
              : "—"}
          </div>
          <div className="flex items-center gap-2">
            <strong>Latest status:</strong> <StatusBadge s={latest?.status} />
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={startAnalysis}
          disabled={
            !canAnalyze ||
            polling ||
            (latest && ["pending", "running"].includes(latest.status))
          }
          title={!canAnalyze ? "PCAP not linked" : "Start analysis"}
          className={[
            "rounded-md px-4 py-2 font-medium text-white transition",
            !canAnalyze ||
            polling ||
            (latest && ["pending", "running"].includes(latest.status))
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-[--blue-500] hover:bg-[--blue-600]",
          ].join(" ")}
        >
          {polling ||
          (latest && ["pending", "running"].includes(latest.status))
            ? "Analyzing…"
            : "Start Analysis"}
        </button>

        <button
          onClick={refreshStatusOnce}
          disabled={polling}
          className={[
            "rounded-md border px-4 py-2 font-medium transition",
            polling
              ? "cursor-not-allowed border-gray-200 text-gray-400"
              : "border-gray-300 text-gray-800 hover:bg-gray-100",
          ].join(" ")}
        >
          Refresh Status
        </button>
      </section>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-100 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Analyses list */}
      <section className="mt-4">
        <h4 className="m-0 mb-2 text-sm font-semibold text-gray-700">Runs</h4>
        {!combo?.analyses?.length ? (
          <div className="italic text-gray-600">No analysis runs yet.</div>
        ) : (
          <div className="rounded-md border border-gray-200">
            {(combo.analyses || []).map((a) => {
              const isSel = selected?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAnalysisId(a.id)}
                  className={[
                    "grid w-full grid-cols-[80px_110px_1fr_1fr_100px_1.2fr] items-center gap-3 border-b px-3 py-2 text-left text-sm transition",
                    "last:border-b-0",
                    isSel ? "bg-blue-50" : "hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="font-mono text-gray-700">#{a.id}</div>
                  <div>
                    <StatusBadge s={a.status} />
                  </div>
                  <div className="truncate">
                    {a.started_at
                      ? new Date(a.started_at).toLocaleString()
                      : "—"}
                  </div>
                  <div className="truncate">
                    {a.completed_at
                      ? new Date(a.completed_at).toLocaleString()
                      : "—"}
                  </div>
                  <div>{a.duration_ms != null ? `${a.duration_ms} ms` : "—"}</div>
                  <div className="text-gray-700">
                    pkts: {a.total_packets ?? "—"} • dev:{" "}
                    {a.unique_devices ?? "—"} • aps: {a.unique_aps ?? "—"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected run details */}
      {selected && selected.status === "ok" && (
        <section className="mt-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-gray-700">
            Summary (Run #{selected.id})
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-center transition hover:-translate-y-0.5 hover:shadow">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Total Packets
              </label>
              <span className="text-2xl font-bold text-gray-800">
                {selected.total_packets}
              </span>
            </div>
            <div className="rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-center transition hover:-translate-y-0.5 hover:shadow">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Unique Devices
              </label>
              <span className="text-2xl font-bold text-gray-800">
                {selected.unique_devices}
              </span>
            </div>
            <div className="rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-center transition hover:-translate-y-0.5 hover:shadow">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
                APs
              </label>
              <span className="text-2xl font-bold text-gray-800">
                {selected.unique_aps}
              </span>
            </div>
            <div className="rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-center transition hover:-translate-y-0.5 hover:shadow">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Clients
              </label>
              <span className="text-2xl font-bold text-gray-800">
                {selected.unique_clients}
              </span>
            </div>
            <div className="rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-center transition hover:-translate-y-0.5 hover:shadow">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
                SSIDs
              </label>
              <span className="text-2xl font-bold text-gray-800">
                {selected.ssid_count}
              </span>
            </div>
            <div className="rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-center transition hover:-translate-y-0.5 hover:shadow">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Duration
              </label>
              <span className="text-2xl font-bold text-gray-800">
                {selected.duration_ms} ms
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <strong>Started:</strong>{" "}
              {selected.started_at
                ? new Date(selected.started_at).toLocaleString()
                : "—"}
            </div>
            <div>
              <strong>Completed:</strong>{" "}
              {selected.completed_at
                ? new Date(selected.completed_at).toLocaleString()
                : "—"}
            </div>
          </div>
        </section>
      )}

      {/* More detailed view if available */}
      {selected?.details && (
        <section className="mt-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-gray-700">
            Specialized Findings
          </h4>

          {selected.details.DeauthDisassoc && (
            <div className="mb-3 rounded-md border border-gray-200 bg-white p-4">
              <h5 className="mb-2 text-sm font-semibold text-gray-800">
                Deauth/Disassoc
              </h5>
              <div className="text-sm">
                Deauth: {selected.details.DeauthDisassoc.total_deauth}
              </div>
              <div className="text-sm">
                Disassoc: {selected.details.DeauthDisassoc.total_disassoc}
              </div>
            </div>
          )}

          {selected.details.EvilTwinHeuristic?.suspected_evil_twins?.length >
            0 && (
            <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 p-4">
              <h5 className="mb-2 text-sm font-semibold text-yellow-900">
                Suspected Evil Twins
              </h5>
              <ul className="list-disc pl-5 text-sm">
                {selected.details.EvilTwinHeuristic.suspected_evil_twins.map(
                  (e, i) => (
                    <li key={i}>
                      {e.ssid} — {e.reason}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {selected.details.ProbePrivacy && (
            <div className="mb-3 rounded-md border border-gray-200 bg-white p-4">
              <h5 className="mb-2 text-sm font-semibold text-gray-800">
                Probe-Request Privacy
              </h5>
              <div className="text-sm">
                Clients with large PNL:{" "}
                {selected.details.ProbePrivacy.clients_with_large_pnl.length}
              </div>
            </div>
          )}

          {selected.details.WeakSecurity?.weak_aps?.length > 0 && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-4">
              <h5 className="mb-2 text-sm font-semibold text-red-900">
                Weak APs
              </h5>
              <ul className="list-disc pl-5 text-sm">
                {selected.details.WeakSecurity.weak_aps.slice(0, 5).map((ap, i) => (
                  <li key={i}>
                    {ap.ssid || "(hidden)"} — {ap.bssid}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {selected && selected.status === "error" && (
        <section className="mt-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-red-900">
            Analysis Failed (Run #{selected.id})
          </h4>
          <div className="rounded-md border border-red-200 bg-red-100 p-3 text-sm text-red-700">
            {selected.error || "Unknown error."}
          </div>
        </section>
      )}
    </div>
  );
}
