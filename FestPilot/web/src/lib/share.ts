/**
 * Share a locked plan via the Web Share API, falling back to the clipboard (DEC-029 celebration
 * "Share"). Pure text — no deep link yet (groups land in Phase 4). Resolves to how it was shared so
 * the UI can confirm ("Copied!" vs the native sheet).
 */
import type { PlanSlot } from "../domain/types";
import { timeInZone } from "./format";

export type ShareResult = "shared" | "copied" | "unavailable";

/** "23:00  Charlotte de Witte — MAINSTAGE" lines under a day heading. */
export function formatPlanText(dayName: string, slots: PlanSlot[], timeZone: string): string {
  const lines = slots.map((slot) => {
    const time = timeInZone(new Date(slot.startMs).toISOString(), timeZone);
    const stage = slot.stageName ? ` — ${slot.stageName}` : "";
    return `${time}  ${slot.label}${stage}`;
  });
  return [`My FestPilot plan · ${dayName}`, ...lines].join("\n");
}

export async function sharePlan(dayName: string, slots: PlanSlot[], timeZone: string): Promise<ShareResult> {
  const text = formatPlanText(dayName, slots, timeZone);
  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  if (nav && typeof nav.share === "function") {
    try {
      await nav.share({ title: "My FestPilot plan", text });
      return "shared";
    } catch {
      /* user dismissed or share failed — fall through to clipboard */
    }
  }
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
    try {
      await nav.clipboard.writeText(text);
      return "copied";
    } catch {
      /* clipboard blocked */
    }
  }
  return "unavailable";
}
