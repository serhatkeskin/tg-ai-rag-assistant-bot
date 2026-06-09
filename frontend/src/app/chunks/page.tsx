"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { fetchChunks } from "@/lib/api";

interface ChunkInfo {
  total: number;
  by_document: { document_id: number; title: string; count: number }[];
}

export default function ChunksPage() {
  const [data, setData] = useState<ChunkInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = getToken();
    if (!t) { setError("Not authenticated."); return; }
    fetchChunks(t)
      .then(setData)
      .catch(() => setError("Failed to load chunk info."));
  }, []);

  return (
    <div>
      <h1>Chunks</h1>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Total indexed chunks: <strong>{data.total}</strong>
          </p>
          <table>
            <thead>
              <tr><th>Document</th><th>Chunks</th></tr>
            </thead>
            <tbody>
              {data.by_document.map((row) => (
                <tr key={row.document_id}>
                  <td>{row.title}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
