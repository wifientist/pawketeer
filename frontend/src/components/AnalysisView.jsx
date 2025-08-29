// src/components/AnalysisView.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import api from '../services/api';
import config from '../config/config';

export default function AnalysisView({ upload }) {
  const [combo, setCombo] = useState(null);         // { pcap, analyses: [...] }
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
    (combo?.analyses || []).find(a => a.id === selectedAnalysisId) || latest;

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
      const data = await api.getPcapCombo(id); // returns { pcap, analyses: [latest...oldest] }
      setCombo(data);
      // auto-select latest on load
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
      // preserve selection if still present, else fallback to latest
      if (data?.analyses?.length) {
        if (!data.analyses.some(a => a.id === selectedAnalysisId)) {
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

    // Start by upload id; fallback to pcap id if needed
    try {
      await api.startAnalysisByUpload(upload.id);
    } catch {
      await api.startAnalysisByPcap(pcapId);
    }

    // Begin polling combo until terminal status
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getPcapCombo(pcapId);
        setCombo(data);
        const latestStatus = data?.analyses?.[0]?.status;
        if (latestStatus && ['ok', 'error'].includes(latestStatus)) {
          stopPoll();
        }
      } catch (e) {
        setError(e.message);
        stopPoll();
      }
    }, 1200);
  }

  const statusBadge = (s) => (
    <span className={`status ${s || 'none'}`}>{s || 'no-analysis'}</span>
  );

  return (
    <div className="analysis-view">
      <h3>Analysis</h3>

      {/* PCAP File info */}
      <section className="file-info-section">
        <h4>File</h4>
        <div className="file-details">
          <div><strong>Original (upload):</strong> {upload?.filename}</div>
          <div><strong>PCAP ID:</strong> {pcapId ?? '—'}</div>
          <div><strong>Stored filename:</strong> {combo?.pcap?.filename ?? '—'}</div>
          <div><strong>Size:</strong> {config.formatFileSize(combo?.pcap?.size_bytes || upload?.file_size || 0)}</div>
          <div><strong>Uploaded:</strong> {combo?.pcap?.uploaded_at ? new Date(combo.pcap.uploaded_at).toLocaleString() : '—'}</div>
          <div><strong>Latest status:</strong> {statusBadge(latest?.status)}</div>
        </div>
      </section>

      {/* Controls */}
      <section className="controls">
        <button
          className="btn primary"
          onClick={startAnalysis}
          disabled={
            !canAnalyze ||
            polling ||
            (latest && ['pending', 'running'].includes(latest.status))
          }
          title={!canAnalyze ? 'PCAP not linked' : 'Start analysis'}
        >
          {polling || (latest && ['pending', 'running'].includes(latest.status))
            ? 'Analyzing…'
            : 'Start Analysis'}
        </button>
        <button className="btn" onClick={refreshStatusOnce} disabled={polling}>
          Refresh Status
        </button>
      </section>

      {error && <div className="message error" style={{ marginTop: 8 }}>{error}</div>}

      {/* Analyses list */}
      <section className="analyses-list" style={{ marginTop: 16 }}>
        <h4>Runs</h4>
        {!combo?.analyses?.length ? (
          <div className="placeholder">No analysis runs yet.</div>
        ) : (
          <div className="runs-table">
            {(combo.analyses || []).map((a) => (
              <div
                key={a.id}
                className={`run-row ${selected?.id === a.id ? 'selected' : ''}`}
                onClick={() => setSelectedAnalysisId(a.id)}
              >
                <div className="cell id">#{a.id}</div>
                <div className="cell status">{statusBadge(a.status)}</div>
                <div className="cell started">{a.started_at ? new Date(a.started_at).toLocaleString() : '—'}</div>
                <div className="cell completed">{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</div>
                <div className="cell dur">{a.duration_ms != null ? `${a.duration_ms} ms` : '—'}</div>
                <div className="cell meta">
                  pkts: {a.total_packets ?? '—'} • dev: {a.unique_devices ?? '—'} • aps: {a.unique_aps ?? '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Selected run details */}
      {selected && selected.status === 'ok' && (
        <section className="results" style={{ marginTop: 16 }}>
          <h4>Summary (Run #{selected.id})</h4>
          <div className="grid metrics">
            <div className="metric"><label>Total Packets</label><span>{selected.total_packets}</span></div>
            <div className="metric"><label>Unique Devices</label><span>{selected.unique_devices}</span></div>
            <div className="metric"><label>APs</label><span>{selected.unique_aps}</span></div>
            <div className="metric"><label>Clients</label><span>{selected.unique_clients}</span></div>
            <div className="metric"><label>SSIDs</label><span>{selected.ssid_count}</span></div>
            <div className="metric"><label>Duration</label><span>{selected.duration_ms} ms</span></div>
          </div>
          <div className="meta">
            <div><strong>Started:</strong> {selected.started_at ? new Date(selected.started_at).toLocaleString() : '—'}</div>
            <div><strong>Completed:</strong> {selected.completed_at ? new Date(selected.completed_at).toLocaleString() : '—'}</div>
          </div>
        </section>
      )}

      {/* More detailed view if available */}
      {selected?.details && (
        <section className="details" style={{ marginTop: 16 }}>
          <h4>Specialized Findings</h4>

          {/* Deauth/Disassoc */}
          {selected.details.DeauthDisassoc && (
            <div className="card">
              <h5>Deauth/Disassoc</h5>
              <div>Deauth: {selected.details.DeauthDisassoc.total_deauth}</div>
              <div>Disassoc: {selected.details.DeauthDisassoc.total_disassoc}</div>
            </div>
          )}

          {/* Evil Twin */}
          {selected.details.EvilTwinHeuristic?.suspected_evil_twins?.length > 0 && (
            <div className="card warning">
              <h5>Suspected Evil Twins</h5>
              <ul>
                {selected.details.EvilTwinHeuristic.suspected_evil_twins.map((e,i)=>(
                  <li key={i}>{e.ssid} — {e.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Probe Privacy */}
          {selected.details.ProbePrivacy && (
            <div className="card">
              <h5>Probe-Request Privacy</h5>
              <div>Clients with large PNL: {selected.details.ProbePrivacy.clients_with_large_pnl.length}</div>
            </div>
          )}

          {/* Weak Security */}
          {selected.details.WeakSecurity?.weak_aps?.length > 0 && (
            <div className="card danger">
              <h5>Weak APs</h5>
              <ul>
                {selected.details.WeakSecurity.weak_aps.slice(0,5).map((ap,i)=>(
                  <li key={i}>{ap.ssid || '(hidden)'} — {ap.bssid}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}


      {selected && selected.status === 'error' && (
        <section className="results" style={{ marginTop: 16 }}>
          <h4>Analysis Failed (Run #{selected.id})</h4>
          <div className="message error">{selected.error || 'Unknown error.'}</div>
        </section>
      )}
    </div>
  );
}
