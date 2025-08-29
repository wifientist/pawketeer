// AnalyzeCard.jsx
import { useState } from "react";

export default function AnalyzeCard({ pcapId, filename }) {
  const [status, setStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    setStatus("queued");
    setSummary(null);
    try {
      await fetch(`/pcaps/${pcapId}/analyze`, { method: "POST" });
      // simple poll for demo; you can switch to websockets later
      const poll = setInterval(async () => {
        const r = await fetch(`/pcaps/${pcapId}/analysis/latest`);
        if (r.ok) {
          const data = await r.json();
          setStatus(data.status);
          if (data.status === "ok" || data.status === "error") {
            setSummary(data);
            setLoading(false);
            clearInterval(poll);
          }
        }
      }, 1200);
    } catch (e) {
      setStatus("error");
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <header className="card-header">
        <p className="card-header-title">{filename}</p>
      </header>
      <div className="card-content">
        <div className="content">
          <button className={`button is-link ${loading ? "is-loading" : ""}`} onClick={start}>
            Run Initial Analysis
          </button>
          {status && <p style={{ marginTop: 10 }}>Status: <strong>{status}</strong></p>}
          {summary && summary.status === "ok" && (
            <table className="table is-fullwidth is-striped" style={{ marginTop: 10 }}>
              <tbody>
                <tr><th>Total packets</th><td>{summary.total_packets}</td></tr>
                <tr><th>Unique devices</th><td>{summary.unique_devices}</td></tr>
                <tr><th>APs</th><td>{summary.unique_aps}</td></tr>
                <tr><th>Clients</th><td>{summary.unique_clients}</td></tr>
                <tr><th>SSIDs</th><td>{summary.ssid_count}</td></tr>
                <tr><th>Duration (ms)</th><td>{summary.duration_ms}</td></tr>
              </tbody>
            </table>
          )}
          {summary && summary.status === "error" && (
            <article className="message is-danger" style={{ marginTop: 10 }}>
              <div className="message-body">
                <strong>Error:</strong> {summary.error}
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
