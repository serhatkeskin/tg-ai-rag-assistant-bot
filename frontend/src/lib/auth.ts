const TOKEN_KEY = "rag_demo_token";
const ADMIN_KEY = "rag_admin_key";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY) ?? "";
}

export function setAdminKey(key: string): void {
  localStorage.setItem(ADMIN_KEY, key);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("admin-key-changed"));
}

export function clearAdminKey(): void {
  localStorage.removeItem(ADMIN_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("admin-key-changed"));
}
