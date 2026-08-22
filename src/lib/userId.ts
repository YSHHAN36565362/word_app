export function sanitizeUserId(raw: string): string {
  return raw.replace(/[^0-9A-Za-z_-]/g, "").slice(0, 40);
}

const STORAGE_KEY = "word_app_user_id";

export function loadStoredUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    const fromQuery = sanitizeUserId(url.searchParams.get("uid") || "");
    if (fromQuery) {
      window.localStorage.setItem(STORAGE_KEY, fromQuery);
      return fromQuery;
    }
    return sanitizeUserId(window.localStorage.getItem(STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

export function storeUserId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("uid", id);
    else url.searchParams.delete("uid");
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* ignore */
  }
}
