const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE}${path}`;
  return fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}) } });
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function adminHeaders(adminKey: string): Record<string, string> {
  return { "X-Admin-Key": adminKey };
}

export async function fetchMe(token: string) {
  const res = await request("/me/", { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchDocuments(token: string) {
  const res = await request("/documents/", { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function deleteDocument(token: string, id: number) {
  const res = await request(`/documents/${id}/`, { method: "DELETE", headers: authHeaders(token) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function uploadDocument(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/documents/upload/`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchChunks(token: string) {
  const res = await request("/chunks/", { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function queryRAG(token: string, question: string) {
  const res = await request("/query/", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function adminListTokens(adminKey: string) {
  const res = await request("/admin/tokens/", { headers: adminHeaders(adminKey) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function adminCreateToken(adminKey: string, label: string, days: number) {
  const res = await request("/admin/tokens/", {
    method: "POST",
    headers: adminHeaders(adminKey),
    body: JSON.stringify({ label, days }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function adminRevokeToken(adminKey: string, id: number) {
  const res = await request(`/admin/tokens/${id}/`, { method: "DELETE", headers: adminHeaders(adminKey) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
