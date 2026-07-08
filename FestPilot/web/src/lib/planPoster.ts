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
      pad: 72,
      headTop: 110,
      rowsTop: 580,
      footTop: size.h - 200,
      minRowH: 88,
      maxRowH: 120,
      nameSize: 36,
      timeSize: 34,
      stageSize: 20,
      avatar: 72,
    };
  }
  return {
    pad: 72,
    headTop: 80,
    rowsTop: 380,
    footTop: size.h - 148,
    minRowH: 62,
    maxRowH: 88,
    nameSize: 28,
    timeSize: 26,
    stageSize: 16,
    avatar: 52,
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
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
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

  // Background: warm dark with subtle radial gradient.
  const bgGrad = ctx.createRadialGradient(size.w / 2, 0, 0, size.w / 2, 0, size.w);
  bgGrad.addColorStop(0, "#1E1B17");
  bgGrad.addColorStop(1, "#0F0D09");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size.w, size.h);

  // Atmospheric amber glow (top center).
  radialGlow(ctx, size.w * 0.5, size.h * 0.05, size.w * 0.9, "rgba(245,166,35,0.15)");
  // Purple stage-light glow (bottom right).
  radialGlow(ctx, size.w * 0.9, size.h * 0.9, size.w * 0.5, "rgba(124,58,237,0.12)");

  // Hex pattern overlay (subtle geometric texture).
  ctx.globalAlpha = 0.04;
  const hexSize = 60;
  ctx.strokeStyle = "#F5A623";
  ctx.lineWidth = 0.5;
  for (let hy = 0; hy < size.h; hy += hexSize * 0.87) {
    for (let hx = 0; hx < size.w; hx += hexSize) {
      const offset = Math.floor(hy / (hexSize * 0.87)) % 2 === 0 ? 0 : hexSize / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = hx + offset + Math.cos(angle) * hexSize * 0.3;
        const py = hy + Math.sin(angle) * hexSize * 0.3;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Amber glass frame.
  ctx.strokeStyle = "rgba(245,166,35,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(24, 24, size.w - 48, size.h - 48, 38);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";

  // Header (centered): FESTPILOT + tagline.
  let y = m.headTop;
  ctx.textAlign = "center";
  setFont(ctx, 600, story ? 28 : 22, "Oswald");
  ctx.fillStyle = "#F5A623";
  tracked(ctx, "FESTPILOT", (size.w - trackedWidth(ctx, "FESTPILOT", story ? 10 : 8)) / 2, y, story ? 10 : 8);
  y += story ? 36 : 28;
  setFont(ctx, 500, story ? 18 : 14, "Hanken Grotesk");
  ctx.fillStyle = "#9C9080";
  ctx.fillText("Your festival, sorted.", size.w / 2, y);

  // Festival name (centered, large).
  y += story ? 100 : 72;
  ctx.textAlign = "center";
  const headGrad = ctx.createLinearGradient(0, y - 80, 0, y + 10);
  headGrad.addColorStop(0, "#FFFFFF");
  headGrad.addColorStop(1, "#F5F0E6");
  ctx.fillStyle = headGrad;
  const festLines = input.festivalName.toUpperCase().split(/\s+/);
  const festMaxSize = story ? 82 : 60;
  const festMinSize = story ? 48 : 36;
  setFont(ctx, 700, festMaxSize, "Oswald");
  const fullFest = festLines.join(" ");
  const availW = size.w - m.pad * 2;
  if (ctx.measureText(fullFest).width <= availW) {
    ctx.fillText(fullFest, size.w / 2, y);
  } else {
    let sz = festMaxSize;
    while (sz > festMinSize) {
      setFont(ctx, 700, sz, "Oswald");
      if (ctx.measureText(fullFest).width <= availW) break;
      sz -= 2;
    }
    if (ctx.measureText(fullFest).width <= availW) {
      ctx.fillText(fullFest, size.w / 2, y);
    } else {
      const mid = Math.ceil(festLines.length / 2);
      const line1 = festLines.slice(0, mid).join(" ");
      const line2 = festLines.slice(mid).join(" ");
      setFont(ctx, 700, festMaxSize * 0.85, "Oswald");
      ctx.fillText(line1, size.w / 2, y - festMaxSize * 0.45);
      ctx.fillText(line2, size.w / 2, y + festMaxSize * 0.45);
      y += festMaxSize * 0.3;
    }
  }

  // Day name (gradient gold, centered).
  y += story ? 56 : 42;
  setFont(ctx, 600, story ? 38 : 30, "Oswald");
  const dayGrad = ctx.createLinearGradient(size.w * 0.3, 0, size.w * 0.7, 0);
  dayGrad.addColorStop(0, "#F5A623");
  dayGrad.addColorStop(1, "#FFD060");
  ctx.fillStyle = dayGrad;
  ctx.fillText(input.dayName.toUpperCase(), size.w / 2, y);

  // Section divider + "MY PLAN" label with badge.
  y += story ? 56 : 40;
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(245,166,35,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.pad, y + 8);
  ctx.lineTo(size.w - m.pad, y + 8);
  ctx.stroke();

  setFont(ctx, 700, story ? 32 : 24, "Oswald");
  ctx.fillStyle = "#F5F0E6";
  ctx.fillText("MY PLAN", m.pad, y);

  const setsWord = layout.total === 1 ? "SET" : "SETS";
  const clashWord = layout.clashes === 0 ? "CLASH-FREE" : `${layout.clashes} ${layout.clashes === 1 ? "CLASH" : "CLASHES"}`;
  const countText = `${layout.total} ${setsWord} · ${clashWord}`;
  setFont(ctx, 700, story ? 18 : 14, "Hanken Grotesk");
  ctx.fillStyle = "#F5A623";
  const badgeW = ctx.measureText(countText).width + 32;
  const badgeX = size.w - m.pad - badgeW;
  const badgeY = y - (story ? 18 : 14);
  const badgeH = story ? 30 : 24;
  ctx.strokeStyle = "rgba(245,166,35,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(22,18,11,0.5)";
  ctx.fill();
  ctx.fillStyle = "#F5A623";
  ctx.textAlign = "center";
  ctx.fillText(countText, badgeX + badgeW / 2, badgeY + badgeH / 2 + (story ? 6 : 5));
  ctx.textAlign = "left";

  // Set rows — glass cards with time | photo (colored ring) | name + stage.
  const rowH = layout.rowH;
  const cardPad = story ? 14 : 10;
  const timeColW = story ? 110 : 88;
  const cardLeft = m.pad;
  const cardRight = size.w - m.pad;
  const cardW = cardRight - cardLeft;
  const cardR = story ? 24 : 18;

  for (let i = 0; i < pageRows.length; i += 1) {
    const row = pageRows[i]!;
    const top = m.rowsTop + i * (rowH + (story ? 6 : 4));
    const cardH = rowH - (story ? 4 : 2);
    const cy = top + cardH / 2;

    // Glass card background.
    ctx.fillStyle = "rgba(22,18,11,0.8)";
    ctx.beginPath();
    ctx.roundRect(cardLeft, top, cardW, cardH, cardR);
    ctx.fill();
    // Card border.
    ctx.strokeStyle = "rgba(245,166,35,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cardLeft, top, cardW, cardH, cardR);
    ctx.stroke();
    // Inner glow (top-left edge lighting).
    ctx.strokeStyle = "rgba(255,208,96,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cardLeft + 1, top + 1, cardW - 2, cardH - 2, cardR - 1);
    ctx.stroke();

    // Time column.
    setFont(ctx, 600, m.timeSize, "Oswald");
    ctx.fillStyle = "#F5A623";
    ctx.textAlign = "left";
    ctx.fillText(row.time, cardLeft + cardPad + 6, cy + (story ? 10 : 8));

    // Photo medallion with stage-colored ring.
    const photoX = cardLeft + timeColW + m.avatar / 2 + 4;
    const photoR = m.avatar / 2;

    // Colored glow behind photo.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(photoX, cy, photoR + 6, 0, Math.PI * 2);
    ctx.fillStyle = row.color;
    ctx.fill();
    ctx.restore();

    drawMedallion(ctx, row, photoX, cy, m.avatar, opts.images?.get(row.actKey));

    // Override the ring with stage-colored ring (thicker).
    ctx.beginPath();
    ctx.arc(photoX, cy, photoR, 0, Math.PI * 2);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = row.color;
    ctx.stroke();

    // Artist name + stage.
    const textX = photoX + photoR + (story ? 20 : 14);
    const maxTextW = cardRight - textX - cardPad;

    setFont(ctx, 700, m.nameSize, "Oswald");
    ctx.fillStyle = "#F5F0E6";
    ctx.textAlign = "left";
    ctx.fillText(fitText(ctx, row.label.toUpperCase(), maxTextW), textX, cy - (story ? 4 : 2));

    setFont(ctx, 700, m.stageSize, "Hanken Grotesk");
    ctx.fillStyle = "#9C9080";
    ctx.fillText(fitText(ctx, `@ ${row.stageName.toUpperCase()}`, maxTextW), textX, cy + (story ? 26 : 18));
  }

  // Footer: CTA pill + URL (compact, right after last card).
  const lastCardBottom = m.rowsTop + pageRows.length * (rowH + (story ? 6 : 4)) + (story ? 24 : 16);
  const footY = Math.max(lastCardBottom, m.footTop);

  const url = (input.appUrl ?? "festpilot.pages.dev").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const pillH = story ? 72 : 54;
  const pillY = footY;
  setFont(ctx, 600, story ? 26 : 20, "Oswald");
  const cta = "Build your plan for free";
  const pillW = Math.min(ctx.measureText(cta).width + (story ? 96 : 72), cardW);
  const pillX = (size.w - pillW) / 2;
  const pillGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
  pillGrad.addColorStop(0, "#F5A623");
  pillGrad.addColorStop(1, "#FFD060");

  // Pill outer glow.
  ctx.save();
  ctx.shadowColor = "rgba(245,166,35,0.3)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = pillGrad;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.restore();

  // Pill border (outline only, fill is gradient already).
  ctx.fillStyle = "#0F0D09";
  setFont(ctx, 600, story ? 26 : 20, "Oswald");
  ctx.textAlign = "center";
  ctx.fillText(cta, size.w / 2, pillY + pillH / 2 + (story ? 9 : 7));

  // URL.
  setFont(ctx, 500, story ? 20 : 16, "Hanken Grotesk");
  ctx.fillStyle = "#9C9080";
  ctx.fillText(url, size.w / 2, pillY + pillH + (story ? 36 : 28));

  // Page indicator.
  if (pageCount > 1) {
    setFont(ctx, 600, story ? 18 : 14, "Hanken Grotesk");
    ctx.fillStyle = "rgba(156,144,128,0.9)";
    ctx.fillText(`${pageIndex + 1} / ${pageCount}`, size.w / 2, footY - (story ? 14 : 10));
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
 * Load a single photo as a blob URL image (bypasses CORS issues with crossOrigin attribute).
 * Falls back to the traditional crossOrigin approach if fetch fails.
 */
async function loadPhotoViaFetch(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal, mode: "cors" });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = (): void => resolve(img);
      img.onerror = (): void => { URL.revokeObjectURL(blobUrl); resolve(null); };
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

/** Traditional load via crossOrigin attribute (works when CDN has proper CORS headers). */
function loadPhotoCrossOrigin(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      resolve(ok ? img : null);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = (): void => { clearTimeout(timer); finish(true); };
    img.onerror = (): void => { clearTimeout(timer); finish(false); };
    img.src = url;
  });
}

/**
 * Last-resort: load without crossOrigin (always works), then paint into an off-screen canvas
 * to extract a non-tainted copy as a blob URL image. This avoids tainting the main canvas.
 */
async function loadPhotoUntainted(url: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      if (!ok) { resolve(null); return; }
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const cx = c.getContext("2d");
        if (!cx) { resolve(null); return; }
        cx.drawImage(img, 0, 0);
        c.toBlob((blob) => {
          if (!blob) { resolve(null); return; }
          const bUrl = URL.createObjectURL(blob);
          const clean = new Image();
          clean.onload = (): void => resolve(clean);
          clean.onerror = (): void => { URL.revokeObjectURL(bUrl); resolve(null); };
          clean.src = bUrl;
        });
      } catch {
        resolve(null);
      }
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = (): void => { clearTimeout(timer); finish(true); };
    img.onerror = (): void => { clearTimeout(timer); finish(false); };
    img.src = url;
  });
}

/**
 * Preload the plan's DJ photos for the canvas. Tries fetch+blob first (better CORS handling),
 * then falls back to crossOrigin attribute. A failed photo never taints the export — it simply
 * falls back to the colored-initials medallion.
 */
export async function loadPosterPhotos(
  input: PosterInput,
  width = 220,
  timeoutMs = 5000
): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  if (typeof Image === "undefined" || !input.photos) return out;
  const keys = uniqueActKeys(input.slots);
  await Promise.all(
    keys.map(async (key) => {
      const rawUrl = input.photos?.get(key);
      if (!rawUrl) return;
      const url = artistPhotoSrc(rawUrl, width);
      const img =
        await loadPhotoViaFetch(url, timeoutMs) ??
        await loadPhotoCrossOrigin(url, timeoutMs) ??
        await loadPhotoUntainted(url, timeoutMs);
      if (img) out.set(key, img);
    })
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
