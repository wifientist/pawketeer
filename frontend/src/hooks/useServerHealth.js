import { useEffect, useState } from "react";
import api from "../services/api";

export default function useServerHealth() {
  const [status, setStatus] = useState("checking"); // checking | healthy | error

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await api.healthCheck();
        if (mounted) setStatus("healthy");
      } catch {
        if (mounted) setStatus("error");
      }
    })();
    return () => { mounted = false; };
  }, []);

  const statusText =
    status === "healthy" ? "🟢 Online" :
    status === "error" ? "🔴 Offline" : "🟡 Checking…";

  const statusClass =
    status === "healthy" ? "bg-[--success] text-gray" :
    status === "error" ? "bg-[--error] text-gray" : "bg-[--warning] text-[--dark]";

  return { status, statusText, statusClass };
}
