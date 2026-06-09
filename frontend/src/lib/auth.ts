const TOKEN_KEY = "demo_token";
const ADMIN_KEY = "admin_key";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAdminKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_KEY);
}

export function setAdminKey(key: string): void {
  localStorage.setItem(ADMIN_KEY, key);
}

export function clearAdminKey(): void {
  localStorage.removeItem(ADMIN_KEY);
}
