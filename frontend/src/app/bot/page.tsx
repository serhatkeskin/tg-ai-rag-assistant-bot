"use client";

import { useState, useEffect, useRef } from "react";
import { getToken, getAdminKey } from "@/lib/auth";
import { getBotStatus, activateBot, stopBot, type BotStatus } from "@/lib/api";

export default function BotControllerPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [customSec, setCustomSec] = useState<string>("30");

  useEffect(() => {
    document.title = "Telegram Bot | Sage";
  }, []);

  // Check authentication on mount and on storage events
  useEffect(() => {
    function check() {
      const auth = Boolean(getToken() || getAdminKey());
      setIsAuth(auth);
      if (auth) {
        fetchStatus();
      } else {
        setLoading(false);
      }
    }
    check();
    window.addEventListener("storage", check);
    window.addEventListener("admin-key-changed", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("admin-key-changed", check);
    };
  }, []);

  // Local second-by-second countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Poll server to confirm expiration
          fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Periodic polling every 5s while active to sync status
  useEffect(() => {
    if (!isAuth) return;
    const interval = setInterval(() => {
      fetchStatus(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuth]);

  async function fetchStatus(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await getBotStatus();
      setStatus(data);
      if (data.is_running && data.remaining_seconds > 0) {
        setCountdown(data.remaining_seconds);
      } else {
        setCountdown(0);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "unauthorized") {
        setIsAuth(false);
      } else if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load bot status");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleActivate(seconds: number) {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await activateBot(seconds);
      setStatus(res);
      setCountdown(res.remaining_seconds);
      const minutes = Math.round(seconds / 60);
      setSuccess(
        seconds >= 60
          ? `Bot polling activated for ~${minutes} minute${minutes > 1 ? "s" : ""}.`
          : `Bot polling activated for ${seconds} seconds (test mode).`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate bot");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await stopBot();
      setStatus(res);
      setCountdown(0);
      setSuccess("Bot polling stopped. Container can now enter sleep mode.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to stop bot");
    } finally {
      setActionLoading(false);
    }
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [
      h > 0 ? `${h}h` : null,
      m > 0 || h > 0 ? `${m}m` : null,
      `${s}s`,
    ].filter(Boolean);
    return parts.join(" ");
  }

  // Not Authenticated screen
  if (!isAuth) {
    return (
      <div style={{ maxWidth: 640, margin: "40px auto 0", textAlign: "center" }}>
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)",
            padding: "48px 32px",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: "var(--text)" }}>
            Authentication Required
          </h2>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            You need a valid <strong>Demo Token</strong> or <strong>Admin Key</strong> to view
            and manage the on-demand Telegram Bot controller.
          </p>
          <button
            onClick={() => window.dispatchEvent(new Event("open-token-modal"))}
            style={{
              background: "var(--accent)",
              color: "#fff",
              padding: "11px 26px",
              borderRadius: "var(--r)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔑 Enter Token / Admin Key
          </button>
        </div>
      </div>
    );
  }

  const isRunning = Boolean(status?.is_running && countdown > 0);
  const botUsername = status?.bot_username || "aven_ai_assistant_bot";
  const botLink = `https://t.me/${botUsername}`;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <h1>Telegram Bot Controller</h1>
        <p>
          On-demand polling window designed for Railway Scale-to-Zero ($0 cost during idle).
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div
          style={{
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--red)",
            borderRadius: "var(--r)",
            padding: "12px 16px",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "rgba(52,211,153,0.12)",
            border: "1px solid rgba(52,211,153,0.3)",
            color: "var(--green)",
            borderRadius: "var(--r)",
            padding: "12px 16px",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ✓ {success}
        </div>
      )}

      {/* Main Status & Hero Card */}
      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: 32,
          marginBottom: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 20,
            marginBottom: 28,
          }}
        >
          {/* Bot Title & Username */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                background: "linear-gradient(135deg, rgba(129,140,248,0.2) 0%, rgba(99,102,241,0.3) 100%)",
                border: "1px solid rgba(129,140,248,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
              }}
            >
              🤖
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                  Aven AI Assistant
                </h2>
                <a
                  href={botLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--mono)",
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                    padding: "2px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(129,140,248,0.25)",
                  }}
                >
                  @{botUsername} ↗
                </a>
              </div>
              <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 3 }}>
                Connected to RAG Pipeline · LlamaIndex & pgvector
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {loading ? (
              <span style={{ color: "var(--text3)", fontSize: 13 }}>Loading status...</span>
            ) : isRunning ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: 99,
                  background: "rgba(52,211,153,0.12)",
                  border: "1px solid rgba(52,211,153,0.35)",
                  color: "var(--green)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--green)",
                    boxShadow: "0 0 10px var(--green)",
                  }}
                />
                Active (Polling Telegram)
              </div>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: 99,
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  color: "var(--text3)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span>🌙</span>
                Sleeping / Inactive
              </div>
            )}
          </div>
        </div>

        {/* Live Countdown & Info */}
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--mono)",
                color: "var(--text3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Active Window Countdown
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "var(--mono)",
                color: isRunning ? "var(--green)" : "var(--text3)",
                letterSpacing: "-0.02em",
              }}
            >
              {isRunning ? formatTime(countdown) : "00:00:00"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
              {isRunning
                ? "Bot is actively listening to messages. Polling will stop automatically when expired."
                : "Polling is off. Service is idle and eligible for Railway zero-cost sleep."}
            </div>
          </div>

          <div>
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--accent-dim)",
                border: "1px solid rgba(129,140,248,0.3)",
                color: "var(--accent)",
                padding: "9px 18px",
                borderRadius: "var(--r)",
                fontSize: 13,
                fontWeight: 600,
                transition: "var(--t)",
              }}
            >
              Open @{botUsername} ↗
            </a>
          </div>
        </div>
      </div>

      {/* Control Actions Card */}
      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: 32,
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
          Polling Controls
        </h3>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>
          Start an active polling session. You can activate for the standard 1-hour window or use
          small test thresholds to quickly test sleep transitions.
        </p>

        {/* Primary Buttons */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <button
            disabled={actionLoading}
            onClick={() => handleActivate(3600)}
            style={{
              background: "var(--accent)",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "var(--r)",
              fontSize: 14,
              fontWeight: 600,
              cursor: actionLoading ? "not-allowed" : "pointer",
              opacity: actionLoading ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ⚡ {isRunning ? "Extend (1 Hour)" : "Activate Bot (1 Hour)"}
          </button>

          {isRunning && (
            <button
              disabled={actionLoading}
              onClick={handleStop}
              style={{
                background: "rgba(248,113,113,0.15)",
                border: "1px solid rgba(248,113,113,0.35)",
                color: "var(--red)",
                padding: "12px 20px",
                borderRadius: "var(--r)",
                fontSize: 14,
                fontWeight: 600,
                cursor: actionLoading ? "not-allowed" : "pointer",
              }}
            >
              ⏹ Stop Bot Now
            </button>
          )}
        </div>

        {/* Quick Test Thresholds */}
        <div
          style={{
            padding: "16px 18px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text2)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>⏱️</span>
            <span>Quick Threshold Testing (Low Durations):</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              disabled={actionLoading}
              onClick={() => handleActivate(30)}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border2)",
                color: "var(--text)",
                padding: "7px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "var(--mono)",
                cursor: "pointer",
              }}
            >
              Test: 30 Seconds
            </button>

            <button
              disabled={actionLoading}
              onClick={() => handleActivate(120)}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border2)",
                color: "var(--text)",
                padding: "7px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "var(--mono)",
                cursor: "pointer",
              }}
            >
              Test: 2 Minutes
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <input
                type="number"
                min="5"
                max="86400"
                value={customSec}
                onChange={(e) => setCustomSec(e.target.value)}
                placeholder="sec"
                style={{
                  width: 70,
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: "var(--text)",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--text3)" }}>sec</span>
              <button
                disabled={actionLoading || !customSec}
                onClick={() => handleActivate(parseInt(customSec) || 30)}
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Run
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Educational & Architecture Card */}
      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: 28,
          marginBottom: 24,
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>
          💡 How Railway Scale-to-Zero Works with Telegram Polling
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>
              1. Auto-Wake on Container Boot
            </div>
            <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
              Whenever the container wakes up from an incoming request, the bot is initialized with a
              1-hour active polling window.
            </p>
          </div>

          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)", marginBottom: 6 }}>
              2. Clean Scale-to-Zero
            </div>
            <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
              When the active window ends, long-polling gracefully stops. Railway detects zero network
              traffic and suspends the container ($0/month during sleep).
            </p>
          </div>
        </div>
      </div>

      {/* Bot Commands Quick Reference */}
      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: 28,
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>
          Telegram Bot Commands Reference
        </h4>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
            overflow: "hidden",
          }}
        >
          {[
            { cmd: "/auth <token>", desc: "Authenticate your chat with a demo token" },
            { cmd: "/ask <query>", desc: "Query the RAG pipeline using your indexed documents" },
            { cmd: "/docs", desc: "List all indexed documents accessible to your token" },
            { cmd: "/clear", desc: "Clear your Telegram conversation memory" },
            { cmd: "/status", desc: "View remaining token queries and expiration" },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                padding: "10px 16px",
                borderBottom: idx < 4 ? "1px solid var(--border)" : "none",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--accent)", width: 170, fontWeight: 600 }}>
                {item.cmd}
              </span>
              <span style={{ color: "var(--text2)" }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
