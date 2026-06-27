/**
 * Branded, share-ready plan poster rendered on a <canvas> (DEC-029 + DEC-080 "poster v2").
 *
 * Dependency-free: we draw the Amber-Glass poster ourselves so it works as a Web Share file
 * (Instagram Stories / WhatsApp), a downloadable PNG, and a live preview — pixel-identical
 * everywhere. The layout math (`buildPosterLayout`) is pure and unit-tested: it fits EVERY set with
 * adaptive row density down to a legibility floor, and paginates beyond it (so we never hide the
 * majority behind a "+N more"). Photos are drawn from the artist CDN with `crossOrigin` and a
 * colored-initials fallback when CORS/loading fails — a failed photo never taints the export.
 */
import type { PlanSlot } from "../domain/types";
import { readableInkOn } from "./contrast";
import { initials } from "./festival";
import { stageColorHex, timeInZone } from "./format";
import { artistPhotoSrc } from "./photo";

export type PosterFormat = "story" | "square";
/** Square can show a one-page "summary" or the full (paginated) plan; story is always full. */
export type PosterMode = "full" | "summary";

export interface PosterInput {
  festivalName: string;
  dayName: string;
  slots: PlanSlot[];
  timeZone: string;
  format: PosterFormat;
  mode?: PosterMode;
  appUrl?: string;
  /** actKey → photo URL (from `imageByActKey`); optional. Missing/blocked photos fall back to initials. */
  photos?: ReadonlyMap<string, string | null>;
}

export interface PosterRow {
  time: string;
  label: string;
  stageName: string;
  /** Concrete stage hex (canvas can't resolve CSS vars). */
  color: string;
  actKey: string;
  /** Pre-computed 2-letter fallback for the medallion. */
  initials: string;
  /** Readable ink (near-black/white) for initials over `color`. */
  ink: string;
  /** This set's interval overlaps a neighbour (a real clash). */
  clash: boolean;
}

export interface PosterLayout {
  /** One inner array per page — every kept set, split to fit the legibility floor. */
  pages: PosterRow[][];
  /** Total sets in the plan (before any summary cap). */
  total: number;
  /** Sets actually shown across all pages (== total unless summary caps it). */
  shown: number;
  /** Real number of overlapping set pairs in the full plan. */
  clashes: number;
  /** Row height used when drawing (comfortable when few, floor when paginating). */
  rowH: number;
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
  minRowH: number;
  maxRowH: number;
  footTop: number;
  nameSize: number;
  timeSize: number;
  stageSize: number;
  avatar: number;
}

function metricsFor(format: PosterFormat, size: Size): Metrics {
  if (format === "story") {
    return {
      pad: 92,
      headTop: 168,
      rowsTop: 700,
      footTop: size.h - 250,
      minRowH: 96,
      maxRowH: 132,
      nameSize: 42,
      timeSize: 30,
      stageSize: 25,
      avatar: 84,
    };
  }
  return {
    pad: 80,
    headTop: 104,
    rowsTop: 470,
    footTop: size.h - 168,
    minRowH: 66,
    maxRowH: 92,
    nameSize: 30,
    timeSize: 22,
    stageSize: 18,
    avatar: 56,
  };
}

/** Effective end of a set: a tight-walk cut shortens it (DEC-074); else its real end. */
function effectiveEnd(slot: PlanSlot): number {
  return slot.cutMs ?? slot.endMs;
}

/** Effective start: a late arrival pushes it (DEC-074); else its real start. */
function effectiveStart(slot: PlanSlot): number {
  return slot.lateStartMs ?? slot.startMs;
}

/** Pure: count the overlapping pairs in a plan (a clean, resolver-built plan returns 0). */
export function countClashes(slots: PlanSlot[]): number {
  const ordered = [...slots].sort((a, b) => effectiveStart(a) - effectiveStart(b));
  let clashes = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    if (effectiveStart(ordered[i]!) < effectiveEnd(ordered[i - 1]!)) clashes += 1;
  }
  return clashes;
}

function toRow(slot: PlanSlot, timeZone: string, clash: boolean): PosterRow {
  const stageName = slot.stageName ?? "";
  const color = stageColorHex(stageName);
  return {
    time: timeInZone(new Date(effectiveStart(slot)).toISOString(), timeZone),
    label: slot.label,
    stageName,
    color,
    actKey: slot.actKey,
    initials: initials(slot.label),
    ink: readableInkOn(color),
    clash,
  };
}

function chunk<T>(items: T[], perPage: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/**
 * Pure: lay the plan out into pages that always show EVERY set (no "+N" hiding), with an adaptive
 * row height. One page when they fit (comfortably spaced); otherwise split at the legibility floor.
 * Square "summary" mode caps to a single page of highlights (the user's explicit choice).
 */
export function buildPosterLayout(input: PosterInput): PosterLayout {
  const size = POSTER_SIZES[input.format];
  const m = metricsFor(input.format, size);
  const ordered = [...input.slots].sort((a, b) => effectiveStart(a) - effectiveStart(b));

  const clashRow = ordered.map((slot, i) => {
    const prev = i > 0 ? ordered[i - 1]! : null;
    const next = i < ordered.length - 1 ? ordered[i + 1]! : null;
    const hitsPrev = prev ? effectiveStart(slot) < effectiveEnd(prev) : false;
    const hitsNext = next ? effectiveStart(next) < effectiveEnd(slot) : false;
    return hitsPrev || hitsNext;
  });
  const rows = ordered.map((slot, i) => toRow(slot, input.timeZone, clashRow[i]!));

  const avail = m.footTop - m.rowsTop;
  const perPage = Math.max(1, Math.floor(avail / m.minRowH));

  const summary = input.mode === "summary" && input.format === "square";
  const pages = summary ? [rows.slice(0, perPage)] : chunk(rows, perPage);

  const firstCount = pages[0]!.length;
  const rowH = pages.length === 1 ? clamp(avail / Math.max(1, firstCount), m.minRowH, m.maxRowH) : m.minRowH;
  const shown = pages.reduce((n, p) => n + p.length, 0);

  return { pages, total: ordered.length, shown, clashes: countClashes(ordered), rowH };
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

/** Width of letter-spaced text (matches what `tracked` paints), so we can right-align it correctly. */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
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

/** Natural pixel size of a drawable source, or null when it isn't introspectable. */
function sourceSize(image: CanvasImageSource): { w: number; h: number } | null {
  const any = image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const w = any.naturalWidth ?? any.width;
  const h = any.naturalHeight ?? any.height;
  return typeof w === "number" && typeof h === "number" && w > 0 && h > 0 ? { w, h } : null;
}

/** Draw `image` cover-cropped into the `d`×`d` square at (x, y) — fills it without distortion. */
function drawImageCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, d: number): void {
  const size = sourceSize(image);
  if (!size) {
    ctx.drawImage(image, x, y, d, d);
    return;
  }
  const scale = Math.max(d / size.w, d / size.h);
  const sw = d / scale;
  const sh = d / scale;
  const sx = (size.w - sw) / 2;
  const sy = (size.h - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, d, d);
}

/** A circular DJ medallion: the loaded photo (cover-cropped) or a colored initials disc fallback. */
function drawMedallion(
  ctx: CanvasRenderingContext2D,
  row: PosterRow,
  cx: number,
  cy: number,
  d: number,
  image: CanvasImageSource | undefined
): void {
  const r = d / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (image) {
    drawImageCover(ctx, image, cx - r, cy - r, d);
  } else {
    ctx.fillStyle = row.color;
    ctx.fillRect(cx - r, cy - r, d, d);
    setFont(ctx, 800, d * 0.4, "Oswald");
    ctx.fillStyle = row.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(row.initials, cx, cy + d * 0.02);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // Glass ring — amber when the set clashes, soft white otherwise.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = row.clash ? 4 : 2.5;
  ctx.strokeStyle = row.clash ? "rgba(245,166,35,0.9)" : "rgba(245,240,230,0.28)";
  ctx.stroke();
}

export interface DrawOptions {
  /** Which page to render (0-based); defaults to the first. */
  pageIndex?: number;
  /** Pre-loaded photos by actKey (see `loadPosterPhotos`); missing keys fall back to initials. */
  images?: ReadonlyMap<string, CanvasImageSource>;
}

/** Draw one poster page into a sized canvas. Fonts/images should be loaded first (see `planPosterBlob`). */
export function drawPlanPoster(canvas: HTMLCanvasElement, input: PosterInput, opts: DrawOptions = {}): void {
  const size = POSTER_SIZES[input.format];
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const m = metricsFor(input.format, size);
  const story = input.format === "story";

  const layout = buildPosterLayout(input);
  const pageCount = layout.pages.length;
  const pageIndex = clamp(opts.pageIndex ?? 0, 0, pageCount - 1);
  const pageRows = layout.pages[pageIndex] ?? [];

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
  ctx.textAlign = "left";

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

  // Section label + an honest "sets · clash-free / N clashes" count (computed, not hardcoded).
  y += story ? 70 : 52;
  setFont(ctx, 700, story ? 22 : 17, "Albert Sans");
  ctx.fillStyle = "#9C9080";
  tracked(ctx, "MY PLAN", m.pad, y, 3);
  const setsWord = layout.total === 1 ? "SET" : "SETS";
  const clashWord =
    layout.clashes === 0 ? "CLASH-FREE" : `${layout.clashes} ${layout.clashes === 1 ? "CLASH" : "CLASHES"}`;
  const countText = `${layout.total} ${setsWord} · ${clashWord}`;
  const spacing = 3;
  setFont(ctx, 700, story ? 22 : 17, "Albert Sans");
  ctx.fillStyle = layout.clashes === 0 ? "#F5A623" : "#FF8A5B";
  tracked(ctx, countText, size.w - m.pad - trackedWidth(ctx, countText, spacing), y, spacing);

  // Rows — every set on this page, with a photo medallion (or initials fallback).
  const rowH = layout.rowH;
  const avatarX = m.pad + m.avatar / 2;
  const nameX = m.pad + m.avatar + (story ? 28 : 20);
  for (let i = 0; i < pageRows.length; i += 1) {
    const row = pageRows[i]!;
    const top = m.rowsTop + i * rowH;
    const cy = top + (story ? 48 : 34);

    drawMedallion(ctx, row, avatarX, cy, m.avatar, opts.images?.get(row.actKey));

    setFont(ctx, 800, m.timeSize, "Albert Sans");
    ctx.fillStyle = "#F5A623";
    ctx.fillText(row.time, nameX, top + (story ? 30 : 22));

    setFont(ctx, 700, m.nameSize, "Oswald");
    ctx.fillStyle = "#F5F0E6";
    ctx.fillText(fitText(ctx, row.label.toUpperCase(), size.w - nameX - m.pad), nameX, top + (story ? 74 : 52));

    const sy = top + (story ? 108 : 74);
    ctx.beginPath();
    ctx.fillStyle = row.color;
    ctx.arc(nameX + (story ? 9 : 7), sy - (story ? 8 : 6), story ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();
    setFont(ctx, 600, m.stageSize, "Albert Sans");
    ctx.fillStyle = "#9C9080";
    ctx.fillText(fitText(ctx, row.stageName, size.w - nameX - m.pad - 40), nameX + (story ? 28 : 22), sy);

    // Hairline separator between rows (skip after the last).
    if (i < pageRows.length - 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.pad, top + rowH - (story ? 14 : 10));
      ctx.lineTo(size.w - m.pad, top + rowH - (story ? 14 : 10));
      ctx.stroke();
    }
  }

  // Footer CTA pill + URL.
  const url = (input.appUrl ?? "festpilot.app").replace(/^https?:\/\//, "").replace(/\/$/, "");
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

  // Page indicator when the plan spans multiple images.
  if (pageCount > 1) {
    setFont(ctx, 700, story ? 20 : 16, "Albert Sans");
    ctx.fillStyle = "rgba(156,144,128,0.9)";
    ctx.fillText(`${pageIndex + 1} / ${pageCount}`, size.w / 2, m.footTop + (story ? 6 : 4));
  }
  ctx.textAlign = "left";
}

/** Unique actKeys present in the plan, in first-seen order (for photo preloading). */
function uniqueActKeys(slots: PlanSlot[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const s of slots) {
    if (s.actKey && !seen.has(s.actKey)) {
      seen.add(s.actKey);
      keys.push(s.actKey);
    }
  }
  return keys;
}

/**
 * Preload the plan's DJ photos for the canvas. Uses `crossOrigin="anonymous"` so a successful load
 * is exportable; a CORS/error/timeout simply omits the key (the draw then falls back to initials) and
 * never taints the export. Resolves to the successfully loaded images only.
 */
export async function loadPosterPhotos(
  input: PosterInput,
  width = 220,
  timeoutMs = 4000
): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  if (typeof Image === "undefined" || !input.photos) return out;
  const keys = uniqueActKeys(input.slots);
  await Promise.all(
    keys.map(
      (key) =>
        new Promise<void>((resolve) => {
          const url = input.photos?.get(key);
          if (!url) return resolve();
          const img = new Image();
          img.crossOrigin = "anonymous";
          let done = false;
          const finish = (ok: boolean): void => {
            if (done) return;
            done = true;
            if (ok) out.set(key, img);
            resolve();
          };
          const timer = setTimeout(() => finish(false), timeoutMs);
          img.onload = (): void => {
            clearTimeout(timer);
            finish(true);
          };
          img.onerror = (): void => {
            clearTimeout(timer);
            finish(false);
          };
          img.src = artistPhotoSrc(url, width);
        })
    )
  );
  return out;
}

async function fontsReady(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts API unavailable — system fallback fonts still render */
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("poster render failed"))), "image/png");
  });
}

/** How many images the current input renders to (1 unless the plan paginates). */
export function planPosterPageCount(input: PosterInput): number {
  return buildPosterLayout(input).pages.length;
}

/** Render one poster page off-screen and return a PNG Blob, after fonts + photos are ready. */
export async function planPosterBlob(input: PosterInput, pageIndex = 0): Promise<Blob> {
  await fontsReady();
  const images = await loadPosterPhotos(input);
  const canvas = document.createElement("canvas");
  drawPlanPoster(canvas, input, { pageIndex, images });
  return await canvasToBlob(canvas);
}

/** Render every page of the plan and return one PNG Blob each (loads fonts + photos once). */
export async function planPosterBlobs(input: PosterInput): Promise<Blob[]> {
  await fontsReady();
  const images = await loadPosterPhotos(input);
  const pageCount = buildPosterLayout(input).pages.length;
  const blobs: Blob[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    const canvas = document.createElement("canvas");
    drawPlanPoster(canvas, input, { pageIndex: i, images });
    blobs.push(await canvasToBlob(canvas));
  }
  return blobs;
}
