/**
 * Auth token + cached identity (DEC-024, anonymous-local per DEC-038).
 *
 * The app mints a stable `anon.<ulid>` bearer token once and carries it on every authenticated
 * request. The server turns it into an `app_user` (anonymous-first). When Firebase lands, this
 * token is replaced by a real ID token and `getUserFromRequest` on the server verifies it — no
 * change here beyond what mints the token. The last `me` profile is cached so the UI knows the
 * user's name/colour even offline. Framework-free so both the API client and the React hook share it.
 */
import { ulid } from "../lib/ulid";
import type { UserDto } from "./types";

const AUTH_KEY = "fp.auth.v1";
export const AUTH_EVENT = "fp:auth";

export interface AuthState {
  token: string;
  user: UserDto | null;
}

export function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function saveAuth(state: AuthState): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — in-memory callers still update */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

/** The persisted bearer token, minting an anonymous one on first use. */
export function getAuthToken(): string {
  const existing = loadAuth();
  if (existing?.token) return existing.token;
  const token = `anon.${ulid()}`;
  saveAuth({ token, user: existing?.user ?? null });
  return token;
}

/** Authorization header for authenticated requests. */
export function authHeader(): Record<string, string> {
  return { authorization: `Bearer ${getAuthToken()}` };
}

export function cachedUser(): UserDto | null {
  return loadAuth()?.user ?? null;
}

export function cacheUser(user: UserDto | null): void {
  saveAuth({ token: getAuthToken(), user });
}
