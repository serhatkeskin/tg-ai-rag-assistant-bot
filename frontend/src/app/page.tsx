"use client";

import { useState, useRef, useEffect } from "react";
import { runQuery, type Source, type ChatMessage } from "@/lib/api";

type Step = "idle" | "retrieve" | "generate";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

const GENERAL_KEYWORD = "!general";

const EXAMPLES = [
  "What are the pricing tiers and what does each include?",
  "How do I set up the local development environment?",
  "What authentication methods does the API support?",
  "What is the remote work and PTO policy?",
  "What should I do when a P0 incident is reported?",
];

function scoreClass(score: number | null): string {
  if (score === null) return "score-low";
  if (score >= 0.75) return "score-high";
  if (score >= 0.55) return "score-mid";
  return "score-low";
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  return <span className={`score-badge ${scoreClass(score)}`}>{pct}% match</span>;
}

function PipelineSteps({ step }: { step: Step }) {
  const steps = [
    { id: "retrieve", label: "Searching pgvector" },
    { id: "generate", label: "Generating with Gemini" },
  ];
  return (
    <div className="pipeline">
      {steps.map((s, i) => {
        const isActive = s.id === step;
        const isDone =
          (s.id === "retrieve" && step === "generate");
        return (
          <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`p-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
              <span className="p-icon">{isDone ? "✓" : isActive ? "●" : String(i + 1)}</span>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="p-arrow">→</span>}
          </span>
        );
      })}
    </div>
  );
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const docTitle = source.metadata?.title || "Document";
  const text = source.text;
  const preview = text.length > 280 ? text.slice(0, 280) + "…" : text;
  return (
    <div className="source-card">
      <div className="source-meta">
        <div className="source-title">
          <span style={{ color: "var(--text3)" }}>#{index + 1}</span>
          <span>📄 {docTitle}</span>
        </div>
        <ScoreBar score={source.score} />
      </div>
      <p className="source-text" style={{ whiteSpace: "pre-wrap" }}>
        {expanded ? text : preview}
      </p>
      {text.length > 280 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 8, background: "none", border: "none",
            color: "var(--accent)", fontSize: 11, cursor: "pointer",
            fontFamily: "var(--mono)", padding: 0,
          }}
        >
          {expanded ? "▲ show less" : "▼ show more"}
        </button>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="chat-user-msg">
      <span className="chat-role-label">You</span>
      <p className="chat-user-text">{content}</p>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  return (
    <div className="chat-assistant-msg">
      <span className="chat-role-label assistant-label">Assistant</span>
      <div className="answer-box" style={{ marginTop: 8 }}>
        <p className="answer-text">{message.content}</p>
      </div>
      {message.sources && message.sources.length > 0 && (
        <>
          <div className="sources-header" style={{ marginTop: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>Sources</div>
            <span className="sources-count">
              {message.sources.length} chunk{message.sources.length !== 1 ? "s" : ""} retrieved
            </span>
          </div>
          {message.sources.map((src, i) => (
            <SourceCard key={i} source={src} index={i} />
          ))}
        </>
      )}
    </div>
  );
}

export default function QueryPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loading = step !== "idle";
  const isGeneral = query.toLowerCase().includes(GENERAL_KEYWORD);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setError(null);

    const userMessage = query.trim();
    const chatHistory: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setStep("retrieve");

    const timer = setTimeout(() => setStep("generate"), 2000);

    try {
      const res = await runQuery(userMessage, chatHistory);
      clearTimeout(timer);
      setStep("idle");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, sources: res.sources },
      ]);
    } catch (err) {
      clearTimeout(timer);
      setStep("idle");
      setMessages((prev) => prev.slice(0, -1));
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  function clearConversation() {
    setMessages([]);
    setStep("idle");
    setError(null);
    setQuery("");
  }

  function useExample(ex: string) {
    setQuery(ex);
    setError(null);
    textareaRef.current?.focus();
  }

  return (
    <>
      {messages.length === 0 && (
        <div className="hero">
          <h1>Ask anything about<br /><em>your documents</em></h1>
          <div className="hero-sub">
            <span>LlamaIndex</span>
            <span className="hero-sep">·</span>
            <span>Gemini</span>
            <span className="hero-sep">·</span>
            <span>pgvector</span>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="chat-header">
          <span className="section-label" style={{ margin: 0 }}>Conversation</span>
          <button className="btn-clear-chat" onClick={clearConversation}>
            New conversation
          </button>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <UserBubble key={i} content={msg.content} />
          ) : (
            <AssistantBubble key={i} message={msg} />
          )
        )}
        {loading && <PipelineSteps step={step} />}
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: messages.length > 0 ? 8 : 0 }}>
        <div className={`query-card${isGeneral ? " query-card-general" : ""}`}>
          <textarea
            ref={textareaRef}
            className="query-textarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                handleSubmit(e as unknown as React.FormEvent);
            }}
            placeholder={
              messages.length === 0
                ? "Ask a question about your documents… (or use !general for general knowledge)"
                : "Follow-up question… (or use !general for general knowledge)"
            }
            rows={3}
          />
          <div className="query-footer">
            {isGeneral ? (
              <span className="query-hint" style={{ color: "var(--accent)" }}>
                ⚡ General knowledge mode
              </span>
            ) : (
              <span className="query-hint">⌘ + Enter to submit</span>
            )}
            <button type="submit" className="btn-ask" disabled={!query.trim() || loading}>
              {loading ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                  Processing…
                </>
              ) : (
                <>Ask →</>
              )}
            </button>
          </div>
        </div>
      </form>

      {!loading && messages.length === 0 && !error && (
        <>
          <div className="examples-label">Try these examples</div>
          <div className="examples-list">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="example-chip" onClick={() => useExample(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        error === "unauthorized" ? (
          <div className="token-prompt-box">
            <span>🔑 Token missing or invalid — enter a demo token to access the RAG pipeline.</span>
            <button
              className="token-prompt-btn"
              onClick={() => window.dispatchEvent(new CustomEvent("open-token-modal"))}
            >
              Enter Token
            </button>
          </div>
        ) : (
          <div className="error-box">⚠ {error}</div>
        )
      )}

      <div ref={bottomRef} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .chat-messages { display: flex; flex-direction: column; gap: 8px; }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .btn-clear-chat {
          background: none;
          border: 1px solid var(--border);
          color: var(--text3);
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-family: var(--mono);
          transition: border-color 0.15s, color 0.15s;
        }
        .btn-clear-chat:hover { border-color: var(--accent); color: var(--accent); }

        .chat-role-label {
          font-size: 10px;
          font-family: var(--mono);
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: block;
          margin-bottom: 4px;
        }
        .assistant-label { color: var(--text3); }

        .chat-user-msg {
          padding: 12px 16px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 8px;
          border-left: 3px solid var(--accent);
        }
        .chat-user-text { margin: 0; color: var(--text1); font-size: 14px; line-height: 1.5; }

        .chat-assistant-msg {
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        .chat-assistant-msg .answer-box { margin-top: 0; }

        .query-card-general {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 1px var(--accent) !important;
        }
      `}</style>
    </>
  );
}
