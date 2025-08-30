import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

export default function useUploads() {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);

  const fetchUploads = useCallback(async () => {
    const data = await api.getUploads();
    setUploads(data.uploads || []);
    // keep selection fresh, if selected
    setSelectedUpload(prev => {
      if (!prev) return prev;
      const updated = (data.uploads || []).find(u => u.id === prev.id);
      return updated || prev;
    });
  }, []);

  useEffect(() => { fetchUploads().catch(console.error); }, [fetchUploads]);

  const onUploadSuccess = useCallback((uploadData) => {
    setUploads(prev => [...prev, uploadData]);
  }, []);

  return {
    uploads,
    selectedUpload,
    setSelectedUpload,
    fetchUploads,
    onUploadSuccess,
  };
}
