/**
 * Local reminder scheduler (E25/DEC-105). Mounted once at the app root; renders nothing. It is the
 * impure orchestrator around the pure `planReminders`: while the app is open it ticks every 30s and
 * fires any reminder that has come due, through the notifications boundary (system notification, or an
 * in-app toast when permission is missing). It reuses the exact plan/travel pipeline the Now home uses
 * (`buildPlanTimeline` over the active day's locked sets), so reminder times match what the UI shows.
 *
 * Cost discipline: the data hooks only mount when reminders are ENABLED (default off), so a user who
 * never opts in pays nothing. Fired ids are remembered for the session so changing routes never
 * re-fires; the pure scheduler's grace window stops stale reminders from firing on a late open.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLineup } from "../data/useLineup";
import { useOnboarding, usePlan } from "../data/localStore";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { buildPlanTimeline } from "../domain/plan";
import { DEFAULT_REMINDER_SETTINGS, planReminders, type PlannedSet } from "../domain/reminders";
import { fireReminder } from "../lib/notifications";
import { daysForWeekends, pickActiveDay } from "../lib/festival";
import { useNotificationsEnabled, useTravelPref } from "./settings";
import { useLocale, useT } from "../i18n";

const FIRED_KEY = "fp.firedReminders";

function loadFired(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveFired(fired: Set<string>): void {
  try {
    sessionStorage.setItem(FIRED_KEY, JSON.stringify([...fired]));
  } catch {
    /* sessionStorage unavailable (private mode) — fired set stays in memory for this mount */
  }
}

export function ReminderScheduler(): JSX.Element | null {
  const { enabled } = useNotificationsEnabled();
  // Gate the data hooks behind the opt-in: a user who never enables reminders triggers no fetches/timers.
  return enabled ? <ActiveReminderScheduler /> : null;
}

function ActiveReminderScheduler(): null {
  const t = useT();
  const locale = useLocale();
  const { lineup } = useLineup();
  const { onboarding } = useOnboarding();
  const travel = useTravelMatrix(lineup);
  const { travelPref } = useTravelPref();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const days = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds, locale) : []), [lineup, weekendIds, locale]);
  const activeDay = useMemo(() => pickActiveDay(days, now), [days, now]);
  const plan = usePlan(lineup?.festival.id, activeDay?.key);

  // Effective start + walk per set, from the same timeline the plan/now screens render. `nowMs` only
  // drives status labels (unused here), so we pass 0 to keep this stable across the 30s tick.
  const sets = useMemo<PlannedSet[]>(() => {
    const slots = plan.plan?.slots ?? [];
    if (slots.length === 0) return [];
    const timeline = buildPlanTimeline(slots, plan.plan?.blocks ?? [], travel, 0, travelPref);
    const out: PlannedSet[] = [];
    for (const item of timeline.items) {
      if (item.kind !== "set") continue;
      out.push({
        setId: item.slot.setId,
        artistLabel: item.slot.label,
        stageName: item.slot.stageName,
        startMs: item.startMs,
        walkMinutes: item.travelIn?.walkMinutes ?? 0,
      });
    }
    return out;
  }, [plan.plan?.slots, plan.plan?.blocks, travel, travelPref]);

  const reminders = useMemo(() => planReminders(sets, DEFAULT_REMINDER_SETTINGS, now), [sets, now]);

  const firedRef = useRef<Set<string>>(loadFired());
  useEffect(() => {
    let changed = false;
    for (const reminder of reminders) {
      if (reminder.fireAtMs <= now && !firedRef.current.has(reminder.id)) {
        firedRef.current.add(reminder.id);
        changed = true;
        void fireReminder(reminder, t);
      }
    }
    if (changed) saveFired(firedRef.current);
  }, [reminders, now, t]);

  return null;
}
