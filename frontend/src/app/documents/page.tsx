"use client";

import { useState, useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";
import { fetchDocuments, deleteDocument, uploadDocument } from "@/lib/api";

interface Doc {
  id: number;
  title: string;
  chunk_count: number;
  deletable: boolean;
  created_at: string;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const t = getToken();
    if (!t) { setError("Not authenticated."); return; }
    try {
      const data = await fetchDocuments(t);
      setDocs(data);
    } catch {
      setError("Failed to load documents.");
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    const t = getToken();
    if (!t) return;
    try {
      await deleteDocument(t, id);
      setMsg("Document deleted.");
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("Delete failed.");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = getToken();
    if (!t) { setError("Not authenticated."); return; }
    setMsg("Uploading...");
    try {
      const data = await uploadDocument(t, file);
      setMsg(`Uploaded "${data.title}" — ${data.chunk_count} chunks.`);
      load();
    } catch {
      setError("Upload failed.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Documents</h1>
        <label className="btn" style={{ cursor: "pointer" }}>
          Upload PDF / TXT
          <input type="file" accept=".pdf,.txt" ref={fileRef} onChange={handleUpload} style={{ display: "none" }} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}
      {docs.length === 0 ? (
        <p className="muted">No documents yet. Upload a PDF or TXT file.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Title</th><th>Chunks</th><th>Uploaded</th><th></th></tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.title}</td>
                <td>{doc.chunk_count}</td>
                <td className="muted">{new Date(doc.created_at).toLocaleDateString()}</td>
                <td>
                  {doc.deletable && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(doc.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
