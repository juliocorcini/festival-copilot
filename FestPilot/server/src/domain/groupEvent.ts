// Group-event domain (Phase 8, roadmap D2). PURE + framework-free. A group event is a fixed-time
// squad commitment ("photo at 16:00"). Two things need a single tested home: (1) the window is
// validated/clamped so a bad payload can't store ends <= starts or an absurd 3-day "event"; and
// (2) the live lifecycle (upcoming → soon → live → past) is DERIVED from the timestamps + now, so
// it stays honest as the clock moves without any extra writes. This layer never touches the squad
// plan — group events are a parallel stream (the lock aggregation only ever reads sets).

/** The state a group event presents to the squad (computed from the window + now, never stored). */
export type GroupEventLifecycle =
  | "upcoming" // further out than the "soon" window
  | "soon" // starts within EVENT_SOON_MS — the gentle "coming up" nudge
  | "live" // started, not yet ended — happening right now
  | "past"; // ended

/** Inside this window before the start → "soon" (drives the amber "coming up" badge). */
export const EVENT_SOON_MS = 30 * 60_000;
/** Floor a window so a mistyped/zero duration still reads as a real block. */
export const MIN_EVENT_DURATION_MS = 5 * 60_000;
/** Cap a window so a fat-fingered end can't create a multi-day "event". */
export const MAX_EVENT_DURATION_MS = 12 * 60 * 60_000;

/**
 * Validate + clamp an event window (pure, so the rule is unit-tested in one place). Guarantees
 * `endsMs` is strictly after `startsMs` by at least MIN_EVENT_DURATION_MS and no more than
 * MAX_EVENT_DURATION_MS. A missing/invalid end falls back to start + the minimum duration.
 */
export function normalizeEventWindow(startsMs: number, endsMs: number): { startsMs: number; endsMs: number } {
  const start = startsMs;
  let end = endsMs;
  if (!Number.isFinite(end) || end <= start + MIN_EVENT_DURATION_MS) end = start + MIN_EVENT_DURATION_MS;
  if (end - start > MAX_EVENT_DURATION_MS) end = start + MAX_EVENT_DURATION_MS;
  return { startsMs: start, endsMs: end };
}

/**
 * Derive the live lifecycle (pure, exhaustively tested). Order matters: a finished event is
 * terminal ("past"); otherwise an in-progress window is "live"; a start inside the soon window is
 * "soon"; everything else is "upcoming".
 */
export function eventLifecycle(startsMs: number, endsMs: number, nowMs: number): GroupEventLifecycle {
  if (nowMs >= endsMs) return "past";
  if (nowMs >= startsMs) return "live";
  if (startsMs - nowMs <= EVENT_SOON_MS) return "soon";
  return "upcoming";
}

/** Whether a derived lifecycle still counts the event as worth surfacing (agenda + home card). */
export function isLiveEvent(lifecycle: GroupEventLifecycle): boolean {
  return lifecycle !== "past";
}
