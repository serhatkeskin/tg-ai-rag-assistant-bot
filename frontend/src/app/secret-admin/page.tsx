"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminKey, setAdminKey, clearAdminKey } from "@/lib/auth";
import { listTokens, createToken, deactivateToken, TokenInfo } from "@/lib/api";

export default function AdminPage() {
  const [adminKey, setAdminKeyState] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDays, setNewDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [deactivating, setDeactivating] = useState<number | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listTokens();
      setTokens(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "error";
      setError(msg === "forbidden" ? "Wrong admin key." : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = getAdminKey();
    if (saved) { setAdminKeyState(saved); setKeyInput(saved); }
  }, []);

  useEffect(() => { if (adminKey) fetchTokens(); }, [adminKey, fetchTokens]);

  function saveKey() {
    const k = keyInput.trim();
    setAdminKey(k);
    setAdminKeyState(k);
  }

  function logout() {
    clearAdminKey();
    setAdminKeyState(""); setKeyInput(""); setTokens([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true); setError("");
    try {
      const tok = await createToken(newLabel.trim(), parseInt(newDays));
      setTokens((prev) => [tok, ...prev]);
      setNewLabel(""); setNewDays("30");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "error");
    } finally { setCreating(false); }
  }

  async function handleDeactivate(id: number) {
    setDeactivating(id); setError("");
    try {
      await deactivateToken(id);
      setTokens((prev) => prev.map((t) => t.id === id ? { ...t, is_active: false } : t));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "error");
    } finally { setDeactivating(null); }
  }

  function copyToken(tok: TokenInfo) {
    navigator.clipboard.writeText(tok.token);
    setCopied(tok.id);
    setTimeout(() => setCopied(null), 2000);
  }

  function formatExpiry(iso: string) {
    const d = new Date(iso);
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    if (days < 0) return { text: `${label}`, tag: "expired" };
    if (days <= 7) return { text: `${label}`, tag: `${days}d left` };
    return { text: `${label}`, tag: `${days}d` };
  }

  const active = tokens.filter(t => t.is_active);
  const revoked = tokens.filter(t => !t.is_active);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Token Admin</h1>
          {adminKey && (
            <p className="admin-subtitle">
              {active.length} active · {revoked.length} revoked
            </p>
          )}
        </div>
        {adminKey && (
          <button className="btn-ghost" onClick={logout}>Sign out</button>
        )}
      </div>

      {!adminKey ? (
        <div className="admin-lock-screen">
          <div className="lock-icon">⬡</div>
          <p className="lock-hint">Enter admin key to continue</p>
          <div className="admin-key-row">
            <input
              type="password"
              placeholder="Admin key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey()}
              className="input-field"
              autoFocus
            />
            <button className="btn-primary" onClick={saveKey}>Unlock</button>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </div>
      ) : (
        <>
          {error && <p className="error-msg">{error}</p>}

          <div className="admin-key-row admin-key-inline">
            <input
              type="password"
              placeholder="Admin key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey()}
              className="input-field input-sm"
            />
            <button className="btn-ghost btn-sm" onClick={saveKey}>Update key</button>
          </div>

          <form className="create-form" onSubmit={handleCreate}>
            <div className="create-form-header">
              <span className="section-label">New token</span>
            </div>
            <div className="form-row">
              <input
                type="text"
                placeholder="Label — e.g. client-name, recruiter"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="input-field"
                required
              />
              <div className="days-wrapper">
                <input
                  type="number"
                  value={newDays}
                  onChange={(e) => setNewDays(e.target.value)}
                  className="input-field input-days"
                  min="1" max="3650" required
                />
                <span className="days-label">days</span>
              </div>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? "…" : "Create"}
              </button>
            </div>
          </form>

          <div className="token-list">
            <div className="token-list-header">
              <span className="section-label">
                Tokens <span className="count-badge">{tokens.length}</span>
              </span>
              <button className="btn-ghost btn-sm" onClick={fetchTokens} disabled={loading}>
                {loading ? "…" : "Refresh"}
              </button>
            </div>

            {tokens.length === 0 && !loading && (
              <p className="empty-msg">No tokens yet. Create one above.</p>
            )}

            {[...active, ...revoked].map((tok) => {
              const exp = formatExpiry(tok.expires_at);
              const isExpiredSoon = tok.is_active && exp.tag.endsWith("d left");
              return (
                <div key={tok.id} className={`token-card ${tok.is_active ? "" : "revoked"}`}>
                  <div className="token-card-top">
                    <div className="token-card-left">
                      <span className="token-label">{tok.label}</span>
                      <span className={`status-pill ${tok.is_active ? (isExpiredSoon ? "warning" : "active") : "inactive"}`}>
                        {tok.is_active ? (isExpiredSoon ? exp.tag : "active") : "revoked"}
                      </span>
                    </div>
                    <div className="token-card-right">
                      <span className="token-expiry-date">{exp.text}</span>
                      {!isExpiredSoon && tok.is_active && (
                        <span className="token-expiry-days">{exp.tag}</span>
                      )}
                    </div>
                  </div>

                  <div className="token-uuid-row">
                    <code className="token-uuid-text">{tok.token}</code>
                    <button
                      className={`btn-copy ${copied === tok.id ? "copied" : ""}`}
                      onClick={() => copyToken(tok)}
                    >
                      {copied === tok.id ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {tok.is_active && (
                    <div className="token-card-actions">
                      <button
                        className="btn-deactivate"
                        onClick={() => handleDeactivate(tok.id)}
                        disabled={deactivating === tok.id}
                      >
                        {deactivating === tok.id ? "Deactivating…" : "Deactivate"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
