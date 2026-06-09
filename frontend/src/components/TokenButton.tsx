"use client";

import { useState, useEffect } from "react";
import { getToken, setToken, clearToken, setAdminKey } from "@/lib/auth";

export default function TokenButton() {
  const [token, setTokenState] = useState("");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setTokenState(getToken());
    const handler = () => setOpen(true);
    window.addEventListener("open-token-modal", handler);
    return () => window.removeEventListener("open-token-modal", handler);
  }, []);

  function handleSave() {
    const v = input.trim();
    if (!v) { setError("Token cannot be empty."); return; }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(v)) {
      // Demo access token (UUID) — grants the RAG pipeline.
      setToken(v);
      setTokenState(v);
    } else {
      // Non-UUID value is treated as an admin key. It unlocks the Admin nav link;
      // the admin page verifies it against the backend on first use.
      setAdminKey(v);
    }
    setOpen(false);
    setInput("");
    setError("");
    window.location.reload();
  }

  function handleClear() {
    clearToken();
    setTokenState("");
    window.location.reload();
  }

  return (
    <>
      {token ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontFamily: "var(--mono)", color: "var(--accent)",
            background: "rgba(129,140,248,.12)", padding: "3px 10px",
            borderRadius: 6, border: "1px solid rgba(129,140,248,.25)",
          }}>
            {token.slice(0, 8)}…
          </span>
          <button onClick={handleClear} title="Token'ı kaldır" style={{
            background: "none", border: "none", color: "var(--text3)",
            cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px",
          }}>×</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{
          background: "none", border: "1px solid var(--border)",
          color: "var(--text2)", borderRadius: 8, padding: "5px 14px",
          fontSize: 12, cursor: "pointer", fontFamily: "var(--mono)",
        }}>
          🔑 Enter Token
        </button>
      )}

      {open && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "32px 28px", width: 420, maxWidth: "90vw",
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "var(--text1)" }}>Demo Access Token</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text3)" }}>
              Enter your demo token to access the RAG pipeline — or an admin key to manage tokens.
            </p>
            <input
              autoFocus
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{
                width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 14px", color: "var(--text1)",
                fontFamily: "var(--mono)", fontSize: 13, boxSizing: "border-box",
              }}
            />
            {error && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{
                flex: 1, background: "var(--accent)", border: "none", borderRadius: 8,
                padding: "10px 0", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>Save</button>
              <button onClick={() => { setOpen(false); setInput(""); setError(""); }} style={{
                flex: 1, background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 0", color: "var(--text2)", fontSize: 14, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
