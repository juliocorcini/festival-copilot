/**
 * Share a locked plan (DEC-029 "share my plan as image / link"). Three lanes:
 *   1. `sharePlanImage` — the branded poster as a Web Share file (Instagram Stories, WhatsApp…).
 *   2. `downloadBlob`   — save the poster PNG when the device can't share files.
 *   3. `sharePlan`      — formatted text + app link via Web Share, falling back to the clipboard.
 * Each resolves to how it was shared so the UI can confirm.
 */
import type { PlanSlot } from "../domain/types";
import { timeInZone } from "./format";

export type ShareResult = "shared" | "copied" | "unavailable";
export type ImageShareResult = "shared" | "cancelled" | "unsupported";

/** "23:00  Charlotte de Witte — MAINSTAGE" lines under a day heading, with the app link last. */
export function formatPlanText(dayName: string, slots: PlanSlot[], timeZone: string, appUrl?: string): string {
  const lines = [...slots]
    .sort((a, b) => a.startMs - b.startMs)
    .map((slot) => {
      const time = timeInZone(new Date(slot.startMs).toISOString(), timeZone);
      const stage = slot.stageName ? ` — ${slot.stageName}` : "";
      return `${time}  ${slot.label}${stage}`;
    });
  const footer = appUrl ? ["", `Build your own → ${appUrl}`] : [];
  return [`My FestPilot plan · ${dayName}`, ...lines, ...footer].join("\n");
}

export async function sharePlan(
  dayName: string,
  slots: PlanSlot[],
  timeZone: string,
  appUrl?: string
): Promise<ShareResult> {
  const text = formatPlanText(dayName, slots, timeZone, appUrl);
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

/** Copy just the formatted plan text (+ link). Returns whether the clipboard accepted it. */
export async function copyPlanText(
  dayName: string,
  slots: PlanSlot[],
  timeZone: string,
  appUrl?: string
): Promise<boolean> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (!nav?.clipboard?.writeText) return false;
  try {
    await nav.clipboard.writeText(formatPlanText(dayName, slots, timeZone, appUrl));
    return true;
  } catch {
    return false;
  }
}

/** Share the poster PNG as a file (native sheet → Stories / WhatsApp / etc.). */
export async function sharePlanImage(blob: Blob, filename: string, text: string): Promise<ImageShareResult> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (!nav || typeof nav.share !== "function") return "unsupported";
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (typeof nav.canShare === "function" && !nav.canShare({ files: [file] })) return "unsupported";
  try {
    await nav.share({ files: [file], title: "My FestPilot plan", text });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** Share several poster pages as files in one native sheet (falls back to "unsupported"). */
export async function sharePlanImages(
  blobs: Blob[],
  filenames: string[],
  text: string
): Promise<ImageShareResult> {
  if (blobs.length <= 1) {
    return blobs[0] ? sharePlanImage(blobs[0], filenames[0] ?? "festpilot-plan.png", text) : "unsupported";
  }
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (!nav || typeof nav.share !== "function") return "unsupported";
  const files = blobs.map((blob, i) => new File([blob], filenames[i] ?? `festpilot-plan-${i + 1}.png`, { type: blob.type || "image/png" }));
  if (typeof nav.canShare === "function" && !nav.canShare({ files })) return "unsupported";
  try {
    await nav.share({ files, title: "My FestPilot plan", text });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** Trigger a browser download of a blob (poster PNG fallback / explicit save). */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
