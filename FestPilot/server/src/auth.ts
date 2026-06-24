// Authentication seam (DEC-024).
//
// V1 ships an ANONYMOUS-LOCAL identity (Firebase deferred — DEC-038/DEC-042): the client mints a
// stable `anon.<ulid>` bearer token once and carries it on every request. This module is the SINGLE
// place a request is turned into an identity, so the future Firebase ID-token path (verify the JWT
// via Google's JWKS) slots in here WITHOUT touching any route or repo code — `getUserFromRequest`
// stays the contract and always returns the same `AuthIdentity` shape. Anonymous→permanent linking
// will preserve `firebaseUid`, so favorites/plan carry over (DEC-024).

export type AuthProvider = "anonymous" | "google" | "email_link";

export interface AuthIdentity {
  /** Stable id; survives anon→permanent linking. Anonymous ids are namespaced `anon:<ulid>`. */
  firebaseUid: string;
  provider: AuthProvider;
  isAnonymous: boolean;
}

const ANON_PREFIX = "anon.";
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i; // Crockford base32, matches db/ids.ts

/** Derive the caller identity from a raw `Authorization` header. Returns null when absent/invalid. */
export function parseAuthIdentity(authHeader: string | null | undefined): AuthIdentity | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  const token = match[1]!.trim();
  if (!token) return null;

  // V1 anonymous-local token: "anon.<ulid>".
  if (token.startsWith(ANON_PREFIX)) {
    const id = token.slice(ANON_PREFIX.length);
    if (!ULID_RE.test(id)) return null;
    return { firebaseUid: `anon:${id}`, provider: "anonymous", isAnonymous: true };
  }

  // Unknown scheme today. Firebase JWT verification will be added here (same return shape).
  return null;
}

/** Convenience wrapper over a Fetch `Request` (Hono exposes it as `c.req.raw`). */
export function getUserFromRequest(req: Request): AuthIdentity | null {
  return parseAuthIdentity(req.headers.get("authorization"));
}
