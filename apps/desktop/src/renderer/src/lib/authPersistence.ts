const USER_KEY = 'xander_user_cache';

export interface CachedUser {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
}

export function saveCachedUser(user: CachedUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function loadCachedUser(): CachedUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedUser;
  } catch {
    return null;
  }
}

export function clearCachedUser(): void {
  localStorage.removeItem(USER_KEY);
}

/** JWT exp (ms) from access_token payload — client-side only, not verified. */
export function getTokenExpiryMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return json.exp ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewMs = 60_000): boolean {
  const exp = getTokenExpiryMs(token);
  if (!exp) return false;
  return Date.now() >= exp - skewMs;
}
