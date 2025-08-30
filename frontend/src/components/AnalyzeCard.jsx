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
    <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow">
      <div className="border-b border-gray-200 px-4 py-3">
        <p className="m-0 text-base font-semibold text-gray-800">{filename}</p>
      </div>

      <div className="px-4 py-4">
        <button
          onClick={start}
          disabled={loading}
          className={[
            "inline-flex items-center rounded-md px-4 py-2 font-medium text-white transition",
            loading ? "bg-gray-300 cursor-not-allowed" : "bg-[--blue-500] hover:bg-[--blue-600]",
          ].join(" ")}
        >
          {loading ? "Analyzing..." : "Run Initial Analysis"}
        </button>

        {status && (
          <p className="mt-3">
            Status: <strong>{status}</strong>
          </p>
        )}

        {summary && summary.status === "ok" && (
          <table className="mt-3 w-full table-auto overflow-hidden rounded-md border border-gray-200 text-sm">
            <tbody>
              <tr className="odd:bg-white even:bg-gray-50">
                <th className="w-1/2 border-b border-gray-200 px-3 py-2 text-left">Total packets</th>
                <td className="border-b border-gray-200 px-3 py-2">{summary.total_packets}</td>
              </tr>
              <tr className="odd:bg-white even:bg-gray-50">
                <th className="border-b border-gray-200 px-3 py-2 text-left">Unique devices</th>
                <td className="border-b border-gray-200 px-3 py-2">{summary.unique_devices}</td>
              </tr>
              <tr className="odd:bg-white even:bg-gray-50">
                <th className="border-b border-gray-200 px-3 py-2 text-left">APs</th>
                <td className="border-b border-gray-200 px-3 py-2">{summary.unique_aps}</td>
              </tr>
              <tr className="odd:bg-white even:bg-gray-50">
                <th className="border-b border-gray-200 px-3 py-2 text-left">Clients</th>
                <td className="border-b border-gray-200 px-3 py-2">{summary.unique_clients}</td>
              </tr>
              <tr className="odd:bg-white even:bg-gray-50">
                <th className="border-b border-gray-200 px-3 py-2 text-left">SSIDs</th>
                <td className="border-b border-gray-200 px-3 py-2">{summary.ssid_count}</td>
              </tr>
              <tr className="odd:bg-white even:bg-gray-50">
                <th className="border-b border-gray-200 px-3 py-2 text-left">Duration (ms)</th>
                <td className="border-b border-gray-200 px-3 py-2">{summary.duration_ms}</td>
              </tr>
            </tbody>
          </table>
        )}

        {summary && summary.status === "error" && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-100 p-3 text-sm text-red-700">
            <strong>Error:</strong> {summary.error}
          </div>
        )}
      </div>
    </div>
  );
}
