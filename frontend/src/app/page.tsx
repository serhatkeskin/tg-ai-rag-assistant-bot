"use client";

import { useState, useEffect } from "react";
import { getToken, clearToken } from "@/lib/auth";
import { fetchMe, queryRAG } from "@/lib/api";
import TokenButton from "@/components/TokenButton";

export default function HomePage() {
  const [label, setLabel] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    fetchMe(t)
      .then((info) => setLabel(info.label))
      .catch(() => { clearToken(); });
  }, []);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    const t = getToken();
    if (!t || !question.trim()) return;
    setLoading(true);
    setAnswer("");
    setError("");
    try {
      const res = await queryRAG(t, question.trim());
      setAnswer(res.answer ?? "No answer returned.");
    } catch {
      setError("Query failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!label) {
    return (
      <div>
        <h1>Aven AI Assistant</h1>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Authenticate with your demo token to get started.
        </p>
        <TokenButton onAuth={setLabel} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Ask anything</h1>
        <span className="muted">
          Logged in as <strong>{label}</strong>{" "}
          <button className="btn btn-sm btn-danger" onClick={() => { clearToken(); setLabel(null); }}>
            Sign out
          </button>
        </span>
      </div>
      <form onSubmit={handleQuery} className="token-form" style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          className="token-input"
          placeholder="Ask a question about your documents..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {answer && (
        <div className="card">
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}
