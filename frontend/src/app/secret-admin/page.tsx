"use client";

import { useState, useEffect } from "react";
import { getAdminKey, setAdminKey, clearAdminKey } from "@/lib/auth";
import { adminListTokens, adminCreateToken, adminRevokeToken } from "@/lib/api";

interface Token {
  id: number;
  label: string;
  token: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

export default function SecretAdminPage() {
  const [key, setKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDays, setNewDays] = useState("30");

  useEffect(() => {
    const k = getAdminKey();
    if (k) { setSavedKey(k); loadTokens(k); }
  }, []);

  async function loadTokens(k: string) {
    setError("");
    try {
      const data = await adminListTokens(k);
      setTokens(data);
    } catch {
      setError("Failed to load tokens. Check your admin key.");
    }
  }

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k) return;
    setAdminKey(k);
    setSavedKey(k);
    loadTokens(k);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!savedKey || !newLabel.trim()) return;
    setError(""); setMsg("");
    try {
      const tok = await adminCreateToken(savedKey, newLabel.trim(), parseInt(newDays));
      setMsg(`Created token for "${tok.label}": ${tok.token}`);
      setNewLabel("");
      loadTokens(savedKey);
    } catch {
      setError("Failed to create token.");
    }
  }

  async function handleRevoke(id: number) {
    if (!savedKey) return;
    try {
      await adminRevokeToken(savedKey, id);
      setMsg(`Token ${id} revoked.`);
      loadTokens(savedKey);
    } catch {
      setError("Revoke failed.");
    }
  }

  if (!savedKey) {
    return (
      <div>
        <h1>Admin</h1>
        <form onSubmit={handleSaveKey} className="token-form">
          <input
            type="text"
            className="token-input"
            placeholder="Enter admin key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button type="submit" className="btn">Save</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Admin</h1>
        <button className="btn btn-sm btn-danger" onClick={() => { clearAdminKey(); setSavedKey(null); setTokens([]); }}>
          Clear key
        </button>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2>Create token</h2>
        <form onSubmit={handleCreate} className="form-row">
          <input
            type="text"
            className="form-input"
            placeholder="Label (e.g. user-alice)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <input
            type="number"
            className="form-input"
            style={{ width: "80px" }}
            min={1}
            value={newDays}
            onChange={(e) => setNewDays(e.target.value)}
          />
          <span className="muted" style={{ alignSelf: "center" }}>days</span>
          <button type="submit" className="btn">Create</button>
        </form>
      </div>

      {error && <p className="error" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {msg && <p className="success mono" style={{ marginBottom: "0.75rem" }}>{msg}</p>}

      <table>
        <thead>
          <tr><th>Label</th><th>Token</th><th>Expires</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {tokens.map((tok) => (
            <tr key={tok.id}>
              <td>{tok.label}</td>
              <td className="mono">{tok.token.slice(0, 8)}…</td>
              <td className="muted">{new Date(tok.expires_at).toLocaleDateString()}</td>
              <td>
                <span className={`badge ${tok.is_active ? "badge-active" : "badge-revoked"}`}>
                  {tok.is_active ? "active" : "revoked"}
                </span>
              </td>
              <td>
                {tok.is_active && (
                  <button className="btn btn-sm btn-danger" onClick={() => handleRevoke(tok.id)}>
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
