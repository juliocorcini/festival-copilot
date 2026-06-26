/**
 * Where to resume after first-run onboarding. A deep link captured by `RequireOnboarding` (notably a
 * squad invite `/j/:token`) is carried as `?next=` and resolved here. Kept pure so the open-redirect
 * guard and the auto-join flag are unit-tested without a router.
 */

/** Only allow same-origin app paths (blocks open-redirect via `//host` or absolute URLs). */
export function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * A squad invite landed the user here: they already opted in by opening the link, so flag the join
 * screen to auto-join (`auto=1`) instead of asking for a second tap. No-op for other paths.
 */
export function withAutoJoin(path: string): string {
  if (!/^\/(j|squad\/join)\//.test(path)) return path;
  return path.includes("?") ? `${path}&auto=1` : `${path}?auto=1`;
}

/** Resolve the post-onboarding destination: a safe deep link (auto-joining invites) or home. */
export function resolveOnboardingNext(rawNext: string | null): string {
  const safe = safeNext(rawNext);
  return safe ? withAutoJoin(safe) : "/";
}
