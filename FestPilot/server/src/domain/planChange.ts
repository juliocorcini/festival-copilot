// Squad plan-change domain (Gate G4 — E07 / DEC-095). PURE + framework-free. Live re-share records a
// coalesced "group plan change" history so the squad can see WHO changed their plan and the net
// effect, in plain language (the sentence is rendered CLIENT-SIDE via i18n from these structured
// numbers — the server never localizes). This layer owns two rules that need a single tested home:
//   1. the content diff of a member's shared picks (added/removed), so a re-share is a no-op when
//      nothing changed (idempotency — no revision bump, no history spam); and
//   2. whether a fresh change should COALESCE into the member's last same-day change instead of
//      opening a new history line (anti-spam during rapid edits at the festival).
// It NEVER touches buildSquadPlan — the aggregation is unchanged; this only records what members did.

export type PlanChangeKind = "share" | "unshare";

/** Inside this window, a member's consecutive same-day changes merge into one history line. */
export const PLAN_CHANGE_COALESCE_MS = 90_000;

export interface ShareDiff {
  added: number;
  removed: number;
  /** True when `next` differs from `prev` — drives the revision bump + whether to record history. */
  changed: boolean;
}

/**
 * Pure set-diff of a member's shared performance ids (order-independent, duplicate-tolerant). `added`
 * counts ids present in `next` but not `prev`; `removed` the reverse. `changed` is the idempotency
 * gate: a re-share with the same content yields `{ added: 0, removed: 0, changed: false }`.
 */
export function diffShareIds(prev: readonly string[], next: readonly string[]): ShareDiff {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  let added = 0;
  for (const id of nextSet) if (!prevSet.has(id)) added += 1;
  let removed = 0;
  for (const id of prevSet) if (!nextSet.has(id)) removed += 1;
  return { added, removed, changed: added > 0 || removed > 0 };
}

/**
 * Whether a change at `nowMs` should coalesce into a previous one at `prevMs` (same actor + day).
 * True only for a non-negative gap within the window — a clock skew (negative gap) opens a new line.
 */
export function shouldCoalesce(prevMs: number, nowMs: number, windowMs: number = PLAN_CHANGE_COALESCE_MS): boolean {
  const gap = nowMs - prevMs;
  return Number.isFinite(prevMs) && Number.isFinite(nowMs) && gap >= 0 && gap <= windowMs;
}
