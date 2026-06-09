"use client";

import { useState, useEffect, useRef } from "react";
import { getDocuments, createDocument, uploadDocument, deleteDocument, type Document } from "@/lib/api";

type Tab = "text" | "file";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("text");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [fileTitle, setFileTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => { document.title = "Documents | RAG Explorer"; }, []);

  useEffect(() => {
    getDocuments()
      .then(setDocs)
      .catch((err) => {
        if (err?.message === "unauthorized") setError("unauthorized");
      })
      .finally(() => setDocsLoading(false));
  }, []);

  function reset() { setError(null); setSuccess(null); }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    reset();
    try {
      const doc = await createDocument(title, content);
      setDocs((prev) => [doc, ...prev]);
      setTitle("");
      setContent("");
      setSuccess(`"${doc.title}" indexed successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setSubmitting(true);
    reset();
    try {
      const doc = await uploadDocument(selectedFile, fileTitle || undefined);
      setDocs((prev) => [doc, ...prev]);
      setFileTitle("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setSuccess(`"${doc.title}" indexed successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(doc: Document) {
    if (deletingId) return;
    setDeletingId(doc.id);
    reset();
    try {
      await deleteDocument(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      setSuccess(`"${doc.title}" deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Documents</h1>
        <p>Add text or upload a file — embedded via Gemini and stored in pgvector immediately.</p>
      </div>

      <div className="upload-card">
        <div className="tab-bar">
          <button className={`tab-btn ${tab === "text" ? "active" : ""}`} onClick={() => setTab("text")}>
            Paste Text
          </button>
          <button className={`tab-btn ${tab === "file" ? "active" : ""}`} onClick={() => setTab("file")}>
            Upload File
          </button>
        </div>

        {tab === "text" && (
          <form onSubmit={handleTextSubmit} className="form-group">
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
            />
            <textarea
              className="field field-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste document content here…"
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !title.trim() || !content.trim()}
            >
              {submitting ? "Indexing…" : "Add & Index"}
            </button>
          </form>
        )}

        {tab === "file" && (
          <form onSubmit={handleFileSubmit} className="form-group">
            <input
              className="field"
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              placeholder="Title (optional — defaults to filename)"
            />
            <input
              ref={fileRef}
              className="field"
              type="file"
              accept=".txt,.pdf,.md"
              style={{ padding: "8px 14px" }}
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <span className="file-hint">Supported: .txt · .pdf · .md</span>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !selectedFile}
            >
              {submitting ? "Uploading & Indexing…" : "Upload & Index"}
            </button>
          </form>
        )}

        {error && (
          error === "unauthorized" ? (
            <div className="token-prompt-box" style={{ marginTop: 12 }}>
              <span>🔑 Token missing or invalid — enter a demo token to access the RAG pipeline.</span>
              <button
                className="token-prompt-btn"
                onClick={() => window.dispatchEvent(new CustomEvent("open-token-modal"))}
              >
                Enter Token
              </button>
            </div>
          ) : (
            <div className="error-box" style={{ marginTop: 12 }}>⚠ {error}</div>
          )
        )}
        {success && <div className="success-box" style={{ marginTop: 12 }}>✓ {success}</div>}
      </div>

      <div className="docs-header">
        <h2>Indexed Documents ({docsLoading ? "…" : docs.length})</h2>
        <a href="/chunks" className="link-subtle">View all chunks →</a>
      </div>

      {docsLoading && <div className="empty">Loading documents…</div>}

      {!docsLoading && docs.length === 0 && (
        <div className="empty">No documents yet. Add one above to get started.</div>
      )}

      {!docsLoading && docs.length > 0 && (
        <div className="doc-list">
          {docs.map((doc) => (
            <div key={doc.id} className="doc-card">
              <div className="doc-info">
                <div className="doc-title">{doc.title}</div>
                <div className="doc-meta">
                  <span>{new Date(doc.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                  {doc.chunk_count > 0 && (
                    <span className="chunk-badge">{doc.chunk_count} chunk{doc.chunk_count !== 1 ? "s" : ""}</span>
                  )}
                </div>
                <div className="doc-preview">
                  {doc.content.slice(0, 120)}{doc.content.length > 120 ? "…" : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`status-badge ${doc.indexed_at ? "status-indexed" : "status-pending"}`}>
                  {doc.indexed_at ? "indexed" : "pending"}
                </span>
                {doc.deletable && (
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    title="Delete your document"
                  >
                    {deletingId === doc.id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
