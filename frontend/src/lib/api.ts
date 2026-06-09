import { getToken, getAdminKey } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function adminHeaders(): Record<string, string> {
  return { "X-Admin-Key": getAdminKey() };
}

export interface TokenInfo {
  id: number;
  token: string;
  label: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export async function listTokens(): Promise<TokenInfo[]> {
  const res = await fetch(`${API_BASE}/admin/tokens/`, { headers: adminHeaders() });
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error("Failed to fetch tokens");
  return res.json();
}

export async function createToken(label: string, days: number): Promise<TokenInfo> {
  const res = await fetch(`${API_BASE}/admin/tokens/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ label, days }),
  });
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to create token");
  }
  return res.json();
}

export async function deactivateToken(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/tokens/${id}/`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error("Failed to deactivate token");
}

export interface Document {
  id: number;
  title: string;
  content: string;
  created_at: string;
  indexed_at: string | null;
  chunk_count: number;
  deletable: boolean;
}

export interface Chunk {
  id: string;
  text: string;
  metadata: Record<string, string> | null;
}

export interface ChunksResponse {
  count: number;
  chunks: Chunk[];
}

export interface Source {
  text: string;
  score: number | null;
  metadata: Record<string, string>;
}

export interface QueryResult {
  query: string;
  answer: string;
  sources: Source[];
}

export async function getDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/documents/`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function createDocument(title: string, content: string): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, content }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to create document");
  }
  return res.json();
}

export async function uploadDocument(file: File, title?: string): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  const res = await fetch(`${API_BASE}/documents/upload/`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Upload failed");
  }
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Delete failed");
  }
}

export async function getChunks(): Promise<ChunksResponse> {
  const res = await fetch(`${API_BASE}/chunks/`, { headers: authHeaders() });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("Failed to fetch chunks");
  return res.json();
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runQuery(
  query: string,
  chatHistory: ChatMessage[] = [],
): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, chat_history: chatHistory }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Query failed");
  }
  return res.json();
}
