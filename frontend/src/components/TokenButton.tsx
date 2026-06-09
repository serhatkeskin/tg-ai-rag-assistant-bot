"use client";

import { useState } from "react";
import { setToken } from "@/lib/auth";
import { fetchMe } from "@/lib/api";

interface Props {
  onAuth: (label: string) => void;
}

export default function TokenButton({ onAuth }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const t = value.trim();
    if (!t) return;
    try {
      const info = await fetchMe(t);
      setToken(t);
      onAuth(info.label);
    } catch {
      setError("Invalid or expired token.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="token-form">
      <input
        type="text"
        placeholder="Paste your demo token"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="token-input"
      />
      <button type="submit" className="btn">Authenticate</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
