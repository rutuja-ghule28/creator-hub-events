/**
 * Session guard and session-only storage.
 * Enforces session-only auth: tokens are stored strictly in sessionStorage (cleared on tab/browser close)
 * and legacy tokens/user data are cleared from localStorage/cookies on app load.
 */

export function initSessionGuard(): void {
  if (typeof window === "undefined") return;

  try {
    // Clear persistent auth tokens, demo accounts, or cached user states from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (key.startsWith("sb-") ||
          key.includes("supabase") ||
          key.includes("auth") ||
          key.includes("token") ||
          key.includes("user") ||
          key.includes("lovable") ||
          key.includes("remember"))
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }

    // Clear legacy auth cookies
    if (typeof document !== "undefined" && document.cookie) {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name] = cookie.trim().split("=");
        if (
          name &&
          (name.startsWith("sb-") ||
            name.includes("auth") ||
            name.includes("token") ||
            name.includes("supabase") ||
            name.includes("session"))
        ) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      }
    }
  } catch (err) {
    console.warn("Session cleaner notice:", err);
  }
}

// Auto-run once on module import in the browser
if (typeof window !== "undefined") {
  initSessionGuard();
}

/**
 * Supabase-compatible session storage adapter that delegates strictly to sessionStorage.
 */
export const sessionOnlyStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch (err) {
      void err;
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(key);
    } catch (err) {
      void err;
    }
  },
};
