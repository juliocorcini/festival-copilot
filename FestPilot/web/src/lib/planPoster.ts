/**
 * Branded, share-ready plan poster rendered on a <canvas> (DEC-029, "share my plan as image").
 *
 * Dependency-free: we draw the Amber-Glass poster ourselves so it works as a Web Share file
 * (Instagram Stories / WhatsApp), a downloadable PNG, and a live preview — pixel-identical
 * everywhere. The row math (`buildPosterRows`) is pure and unit-tested; the drawing is canvas.
 */
import type { PlanSlot } from "../domain/types";
import { stageColorHex, timeInZone } from "./format";

export type PosterFormat = "story" | "square";

export interface PosterInput {
  festivalName: string;
  dayName: string;
  slots: PlanSlot[];
  timeZone: string;
  format: PosterFormat;
  appUrl?: string;
}

export interface PosterRow {
  time: string;
  label: string;
  stageName: string;
  color: string;
}

interface Size {
  w: number;
  h: number;
}

/** Output pixel size per format — 9:16 for stories, 1:1 for feed/WhatsApp. */
export const POSTER_SIZES: Record<PosterFormat, Size> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

interface Metrics {
  pad: number;
  headTop: number;
  rowsTop: number;
  rowH: number;
  capacity: number;
  footTop: number;
  nameSize: number;
  timeSize: number;
  stageSize: number;
}

function metricsFor(format: PosterFormat, size: Size): Metrics {
  if (format === "story") {
    const rowsTop = 700;
    const footTop = size.h - 250;
    const rowH = 120;
    return { pad: 92, headTop: 168, rowsTop, rowH, capacity: Math.floor((footTop - rowsTop) / rowH), footTop, nameSize: 42, timeSize: 30, stageSize: 25 };
  }
  const rowsTop = 470;
  const footTop = size.h - 168;
  const rowH = 82;
  return { pad: 80, headTop: 104, rowsTop, rowH, capacity: Math.floor((footTop - rowsTop) / rowH), footTop, nameSize: 30, timeSize: 22, stageSize: 18 };
}

/** Pure: the rows to print, capped to `max` with an overflow count for the "+N more" line. */
export function buildPosterRows(
  slots: PlanSlot[],
  timeZone: string,
  max: number
): { rows: PosterRow[]; overflow: number } {
  const ordered = [...slots].sort((a, b) => a.startMs - b.startMs);
  const fits = ordered.length <= max;
  const shown = fits ? ordered : ordered.slice(0, Math.max(1, max - 1));
  const rows = shown.map((slot) => ({
    time: timeInZone(new Date(slot.startMs).toISOString(), timeZone),
    label: slot.label,
    stageName: slot.stageName ?? "",
    color: stageColorHex(slot.stageName ?? ""),
  }));
  return { rows, overflow: ordered.length - shown.length };
}

function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string): void {
  ctx.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed.trim()}…`;
}

/** Shrink the headline font until it fits the width (down to a floor), only then truncate. */
function fitHeadline(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  family: string,
  maxSize: number,
  minSize: number
): string {
  let s = maxSize;
  while (s > minSize) {
    setFont(ctx, 700, s, family);
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  }
  setFont(ctx, 700, s, family);
  return fitText(ctx, text, maxWidth);
}

function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

function radialGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(15,13,9,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** Draw the full poster into a sized canvas. Fonts should be loaded first (see `planPosterBlob`). */
export function drawPlanPoster(canvas: HTMLCanvasElement, input: PosterInput): void {
  const size = POSTER_SIZES[input.format];
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const m = metricsFor(input.format, size);
  const story = input.format === "story";

  // Background + warm glows.
  ctx.fillStyle = "#0F0D09";
  ctx.fillRect(0, 0, size.w, size.h);
  radialGlow(ctx, size.w * 0.5, size.h * (story ? 0.04 : 0.02), size.w * 0.95, "rgba(245,166,35,0.26)");
  radialGlow(ctx, size.w * 0.92, size.h * 0.62, size.w * 0.7, "rgba(124,58,237,0.12)");

  // Amber frame.
  ctx.strokeStyle = "rgba(245,166,35,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(22, 22, size.w - 44, size.h - 44, 38);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";

  // Wordmark + tagline.
  let y = m.headTop;
  setFont(ctx, 800, story ? 34 : 28, "Albert Sans");
  ctx.fillStyle = "#F5A623";
  tracked(ctx, "FESTPILOT", m.pad, y, story ? 6 : 4);
  y += story ? 40 : 32;
  setFont(ctx, 600, story ? 23 : 18, "Albert Sans");
  ctx.fillStyle = "#9C9080";
  ctx.fillText("Your festival, sorted.", m.pad, y);

  // Festival + day headline.
  y += story ? 120 : 92;
  const headGrad = ctx.createLinearGradient(m.pad, 0, size.w - m.pad, 0);
  headGrad.addColorStop(0, "#FFFFFF");
  headGrad.addColorStop(1, "#F5F0E6");
  ctx.fillStyle = headGrad;
  const fest = fitHeadline(ctx, input.festivalName.toUpperCase(), size.w - m.pad * 2, "Oswald", story ? 78 : 58, story ? 50 : 38);
  ctx.fillText(fest, m.pad, y);
  y += story ? 64 : 50;
  setFont(ctx, 700, story ? 44 : 34, "Oswald");
  const dayGrad = ctx.createLinearGradient(m.pad, 0, m.pad + 500, 0);
  dayGrad.addColorStop(0, "#F5A623");
  dayGrad.addColorStop(1, "#FFD060");
  ctx.fillStyle = dayGrad;
  ctx.fillText(input.dayName.toUpperCase(), m.pad, y);

  // Section label + count.
  const { rows, overflow } = buildPosterRows(input.slots, input.timeZone, m.capacity);
  y += story ? 70 : 52;
  setFont(ctx, 700, story ? 22 : 17, "Albert Sans");
  ctx.fillStyle = "#9C9080";
  tracked(ctx, "MY PLAN", m.pad, y, 3);
  const countText = `${input.slots.length} SET${input.slots.length === 1 ? "" : "S"} · 0 CLASHES`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#F5A623";
  tracked(ctx, countText, size.w - m.pad - ctx.measureText(countText).width - countText.length * 3, y, 3);
  ctx.textAlign = "left";

  // Rows.
  let ry = m.rowsTop;
  const nameX = m.pad + (story ? 168 : 120);
  for (const row of rows) {
    const top = ry;
    setFont(ctx, 800, m.timeSize, "Albert Sans");
    ctx.fillStyle = "#F5A623";
    ctx.fillText(row.time, m.pad, top + (story ? 42 : 30));

    setFont(ctx, 700, m.nameSize, "Oswald");
    ctx.fillStyle = "#F5F0E6";
    ctx.fillText(fitText(ctx, row.label.toUpperCase(), size.w - nameX - m.pad), nameX, top + (story ? 44 : 32));

    // Stage dot + name.
    const sy = top + (story ? 86 : 60);
    ctx.beginPath();
    ctx.fillStyle = row.color;
    ctx.arc(nameX + (story ? 9 : 7), sy - (story ? 8 : 6), story ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();
    setFont(ctx, 600, m.stageSize, "Albert Sans");
    ctx.fillStyle = "#9C9080";
    ctx.fillText(fitText(ctx, row.stageName, size.w - nameX - m.pad - 40), nameX + (story ? 28 : 22), sy);

    // Hairline separator.
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m.pad, top + m.rowH - (story ? 18 : 12));
    ctx.lineTo(size.w - m.pad, top + m.rowH - (story ? 18 : 12));
    ctx.stroke();

    ry += m.rowH;
  }
  if (overflow > 0) {
    setFont(ctx, 700, m.stageSize + 2, "Albert Sans");
    ctx.fillStyle = "#9C9080";
    ctx.fillText(`+${overflow} more set${overflow === 1 ? "" : "s"}`, m.pad, ry + (story ? 36 : 26));
  }

  // Footer CTA pill + URL.
  const url = (input.appUrl ?? "festpilot.app").replace(/^https?:\/\//, "");
  const pillH = story ? 76 : 58;
  const pillY = m.footTop + (story ? 40 : 28);
  setFont(ctx, 800, story ? 27 : 21, "Albert Sans");
  const cta = "Make yours — free";
  const pillW = ctx.measureText(cta).width + (story ? 100 : 76);
  const pillX = (size.w - pillW) / 2;
  const pillGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
  pillGrad.addColorStop(0, "#F5A623");
  pillGrad.addColorStop(1, "#FFD060");
  ctx.fillStyle = pillGrad;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = "#0F0D09";
  ctx.textAlign = "center";
  ctx.fillText(cta, size.w / 2, pillY + pillH / 2 + (story ? 9 : 7));
  setFont(ctx, 600, story ? 22 : 17, "Albert Sans");
  ctx.fillStyle = "#9C9080";
  ctx.fillText(url, size.w / 2, pillY + pillH + (story ? 48 : 36));
  ctx.textAlign = "left";
}

/** Render the poster off-screen and return a PNG Blob, after fonts are ready. */
export async function planPosterBlob(input: PosterInput): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts API unavailable — system fallback fonts still render */
    }
  }
  const canvas = document.createElement("canvas");
  drawPlanPoster(canvas, input);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("poster render failed"))), "image/png");
  });
}
