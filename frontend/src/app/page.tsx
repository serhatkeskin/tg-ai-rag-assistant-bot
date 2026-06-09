"use client";

import { useState, useRef } from "react";
import { runQuery, type QueryResult, type Source } from "@/lib/api";

type Step = "idle" | "retrieve" | "generate" | "done";

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
  return (
    <span className={`score-badge ${scoreClass(score)}`}>
      {pct}% match
    </span>
  );
}

function PipelineSteps({ step }: { step: Step }) {
  const steps = [
    { id: "retrieve", label: "Searching pgvector" },
    { id: "generate", label: "Generating with Gemini" },
  ];

  return (
    <div className="pipeline">
      {steps.map((s, i) => {
        const isDone =
          (s.id === "retrieve" && (step === "generate" || step === "done")) ||
          (s.id === "generate" && step === "done");
        const isActive =
          (s.id === "retrieve" && step === "retrieve") ||
          (s.id === "generate" && step === "generate");

        return (
          <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`p-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
              <span className="p-icon">
                {isDone ? "✓" : isActive ? "●" : String(i + 1)}
              </span>
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

export default function QueryPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loading = step === "retrieve" || step === "generate";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setError(null);
    setResult(null);
    setStep("retrieve");

    const timer = setTimeout(() => setStep("generate"), 2000);

    try {
      const res = await runQuery(query.trim());
      clearTimeout(timer);
      setStep("done");
      setResult(res);
    } catch (err) {
      clearTimeout(timer);
      setStep("idle");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  function useExample(ex: string) {
    setQuery(ex);
    setResult(null);
    setError(null);
    setStep("idle");
    textareaRef.current?.focus();
  }

  return (
    <>
      <div className="hero">
        <h1>Ask anything about<br /><em>your documents</em></h1>
        <div className="hero-sub">
          <span>LlamaIndex</span>
          <span className="hero-sep">·</span>
          <span>LangGraph</span>
          <span className="hero-sep">·</span>
          <span>Gemini</span>
          <span className="hero-sep">·</span>
          <span>pgvector</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="query-card">
          <textarea
            ref={textareaRef}
            className="query-textarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
            }}
            placeholder="Ask a question about your documents…"
            rows={3}
          />
          <div className="query-footer">
            <span className="query-hint">⌘ + Enter to submit</span>
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

      {!loading && step === "idle" && !result && (
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

      {loading && <PipelineSteps step={step} />}

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

      {result && step === "done" && (
        <div className="result-section">
          <div className="section-label">Answer</div>
          <div className="answer-box">
            <p className="answer-text">{result.answer}</p>
          </div>

          {result.sources && result.sources.length > 0 && (
            <>
              <div className="sources-header">
                <div className="section-label" style={{ margin: 0 }}>Sources</div>
                <span className="sources-count">{result.sources.length} chunk{result.sources.length !== 1 ? "s" : ""} retrieved</span>
              </div>
              {result.sources.map((src, i) => (
                <SourceCard key={i} source={src} index={i} />
              ))}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
