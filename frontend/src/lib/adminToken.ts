/**
 * Admin token storage, shared by /admin and /monitor.
 *
 * Stored in localStorage rather than sessionStorage because sessionStorage is
 * scoped to a single tab: opening the dashboard in a second tab produced an
 * empty page, since the admin request 401'd there while the first tab worked.
 * This is a self-hosted operator dashboard on the user's own machine, so
 * persisting across tabs is the behaviour people expect from it.
 */
const KEY = "adminToken";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  // Fall back to sessionStorage so a tab authenticated before this change
  // keeps working, and promote the value to localStorage on the way through.
  const fromLocal = localStorage.getItem(KEY);
  if (fromLocal) return fromLocal;
  const legacy = sessionStorage.getItem(KEY);
  if (legacy) {
    localStorage.setItem(KEY, legacy);
    return legacy;
  }
  return "";
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, token);
  sessionStorage.removeItem(KEY);
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

/** Notifies when another tab signs in or out, so open tabs stay in sync. */
export function onAdminTokenChange(cb: (token: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === KEY) cb(e.newValue ?? "");
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
