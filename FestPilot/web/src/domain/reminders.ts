/**
 * Pure scheduler for local set reminders (E25/DEC-105). Given the day's planned sets — each with its
 * effective start and the walk into its stage (from `buildPlanTimeline`) — it decides *what* fires and
 * *when*, with no DOM/timers/Notification API. Two reminders per upcoming set:
 *   • set-start  — fire at `start − setLeadMinutes`  → "starts in N min".
 *   • leave-by   — fire at `start − (walk + buffer)` → "leave now — N min walk" (only for a real walk).
 *
 * Honesty guards baked in:
 *   • a reminder whose fire time already passed by more than a short GRACE is dropped, so opening the
 *     app mid-afternoon never spams reminders for sets that are already on.
 *   • ids are stable (`setId:kind`) so re-builds dedupe and the caller can track "already fired".
 * The impure side (permission, firing, the 30s tick) lives in the scheduler/boundary; this is testable.
 */

const MIN = 60_000;
/** Reminders whose fire time passed by more than this are stale — never resurrect them on a late open. */
export const REMINDER_STALE_GRACE_MS = 90_000;

export type ReminderKind = "set-start" | "leave-by";

/** One planned set, distilled from a `PlanSetItem` so this module stays independent of plan internals. */
export interface PlannedSet {
  setId: string;
  artistLabel: string;
  stageName: string;
  /** Effective start (after travel resolution). */
  startMs: number;
  /** Whole-minute walk into this set's stage from the previous set; 0 when none/same stage. */
  walkMinutes: number;
}

export interface ReminderSettings {
  /** Minutes before a set starts to fire the "starts soon" reminder. */
  setLeadMinutes: number;
  /** Extra buffer minutes added on top of the walk for the "leave now" alert. */
  leaveBufferMinutes: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  setLeadMinutes: 10,
  leaveBufferMinutes: 2,
};

export interface ScheduledReminder {
  /** Stable `${setId}:${kind}` — dedupes re-builds and anchors "already fired" tracking. */
  id: string;
  kind: ReminderKind;
  setId: string;
  fireAtMs: number;
  artistLabel: string;
  stageName: string;
  /** set-start → the lead minutes ("starts in N"); leave-by → the walk minutes ("N min walk"). */
  minutes: number;
}

/**
 * Build the sorted list of reminders that are still worth firing (fire time in the future, or just
 * passed within GRACE). Caller fires those whose `fireAtMs <= now` and tracks fired ids to avoid repeats.
 */
export function planReminders(
  sets: PlannedSet[],
  settings: ReminderSettings,
  nowMs: number
): ScheduledReminder[] {
  const floor = nowMs - REMINDER_STALE_GRACE_MS;
  const out: ScheduledReminder[] = [];

  for (const set of sets) {
    if (!Number.isFinite(set.startMs)) continue;

    const startFire = set.startMs - settings.setLeadMinutes * MIN;
    if (startFire >= floor) {
      out.push({
        id: `${set.setId}:set-start`,
        kind: "set-start",
        setId: set.setId,
        fireAtMs: startFire,
        artistLabel: set.artistLabel,
        stageName: set.stageName,
        minutes: settings.setLeadMinutes,
      });
    }

    // Leave-by only makes sense when there's a real walk into the stage.
    if (set.walkMinutes >= 1) {
      const leaveFire = set.startMs - (set.walkMinutes + settings.leaveBufferMinutes) * MIN;
      if (leaveFire >= floor) {
        out.push({
          id: `${set.setId}:leave-by`,
          kind: "leave-by",
          setId: set.setId,
          fireAtMs: leaveFire,
          artistLabel: set.artistLabel,
          stageName: set.stageName,
          minutes: set.walkMinutes,
        });
      }
    }
  }

  // Earliest first; leave-by before set-start when they tie (you leave before it starts).
  return out.sort((a, b) => a.fireAtMs - b.fireAtMs || (a.kind === "leave-by" ? -1 : 1));
}

/** Quiet-hours window check (optional, off by default). Handles a window that wraps past midnight. */
export function withinQuietHours(hour: number, quiet: { startHour: number; endHour: number } | null): boolean {
  if (!quiet || quiet.startHour === quiet.endHour) return false;
  const { startHour, endHour } = quiet;
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}
