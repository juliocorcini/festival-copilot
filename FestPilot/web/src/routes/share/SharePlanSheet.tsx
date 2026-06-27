/**
 * Share-my-plan sheet (DEC-029 + DEC-080 poster v2). Previews the branded poster live, lets the user
 * pick a format (Story 9:16 / Square 1:1) and — for Square — a density (Summary / Full plan), pages
 * through multi-image plans, and offers three lanes: share the image(s) to anywhere (Web Share files →
 * Stories / WhatsApp), save the PNG(s), or copy the plan text + link. Pure presentation over
 * `planPoster` + `lib/share`; the canonical public URL comes from app meta (never a deploy-hash host).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_URL } from "../../data/changelog";
import type { PlanSlot } from "../../domain/types";
import { useT } from "../../i18n";
import {
  drawPlanPoster,
  loadPosterPhotos,
  planPosterBlob,
  planPosterBlobs,
  planPosterPageCount,
  type PosterFormat,
  type PosterInput,
  type PosterMode,
} from "../../lib/planPoster";
import { copyPlanText, downloadBlob, formatPlanText, sharePlanImage, sharePlanImages } from "../../lib/share";
import { Sheet } from "../../ui/Sheet";

interface Props {
  festivalName: string;
  dayName: string;
  slots: PlanSlot[];
  timeZone: string;
  /** actKey → photo URL (from `imageByActKey`), drawn on the poster with an initials fallback. */
  photos?: ReadonlyMap<string, string | null>;
  onClose: () => void;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan";
}

/** "festpilot-tomorrowland-saturday.png" or, for multi-page plans, "…-saturday-2.png". */
function pageFilename(base: string, page: number, total: number): string {
  return total > 1 ? `${base}-${page + 1}.png` : `${base}.png`;
}

export function SharePlanSheet({ festivalName, dayName, slots, timeZone, photos, onClose }: Props): JSX.Element {
  const t = useT();
  const [format, setFormat] = useState<PosterFormat>("story");
  const [mode, setMode] = useState<PosterMode>("full");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const input = useMemo<PosterInput>(
    () => ({ festivalName, dayName, slots, timeZone, format, mode, appUrl: APP_URL, photos }),
    [festivalName, dayName, slots, timeZone, format, mode, photos]
  );
  const pageCount = useMemo(() => planPosterPageCount(input), [input]);
  const baseName = `festpilot-${slug(festivalName)}-${slug(dayName)}`;

  // Keep the page in range when the format/mode change the page count.
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  // Live preview: draw immediately (initials), then redraw once fonts + photos resolve.
  useEffect(() => {
    let cancelled = false;
    const redraw = (images?: ReadonlyMap<string, CanvasImageSource>): void => {
      if (!cancelled && canvasRef.current) drawPlanPoster(canvasRef.current, input, { pageIndex: page, images });
    };
    redraw();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => redraw()).catch(() => {});
    }
    loadPosterPhotos(input)
      .then((images) => redraw(images))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [input, page]);

  const shareImage = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const text = formatPlanText(dayName, slots, timeZone, APP_URL);
      let res;
      if (pageCount > 1) {
        const blobs = await planPosterBlobs(input);
        const names = blobs.map((_, i) => pageFilename(baseName, i, blobs.length));
        res = await sharePlanImages(blobs, names, text);
        if (res === "unsupported") {
          blobs.forEach((b, i) => downloadBlob(b, names[i]!));
          setMsg(t("share.savedPages", { count: blobs.length }));
        }
      } else {
        const blob = await planPosterBlob(input, page);
        res = await sharePlanImage(blob, pageFilename(baseName, 0, 1), text);
        if (res === "unsupported") {
          downloadBlob(blob, pageFilename(baseName, 0, 1));
          setMsg(t("share.savedShareAnywhere"));
        }
      }
      if (res === "shared") setMsg(t("share.shared"));
    } catch {
      setMsg(t("share.buildError"));
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      if (pageCount > 1) {
        const blobs = await planPosterBlobs(input);
        blobs.forEach((b, i) => downloadBlob(b, pageFilename(baseName, i, blobs.length)));
        setMsg(t("share.savedPages", { count: blobs.length }));
      } else {
        const blob = await planPosterBlob(input, page);
        downloadBlob(blob, pageFilename(baseName, 0, 1));
        setMsg(t("share.savedDevice"));
      }
    } catch {
      setMsg(t("share.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (): Promise<void> => {
    const ok = await copyPlanText(dayName, slots, timeZone, APP_URL);
    setMsg(ok ? t("share.copied") : t("share.copyError"));
  };

  return (
    <Sheet onClose={onClose} label={t("share.title")} className="share-sheet">
      <div className="sheet-head">
        <div className="poster sheet-title">{t("share.title")}</div>
        <button className="ms sheet-x" onClick={onClose}>close</button>
      </div>

      <div className="share-preview">
        <canvas ref={canvasRef} className={`share-canvas ${format}`} aria-label={t("share.previewAria")} />
        {pageCount > 1 && (
          <div className="share-pager">
            <button
              className="ms share-pager-btn"
              aria-label={t("share.prevPage")}
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              chevron_left
            </button>
            <span className="share-pager-label">{t("share.pageOf", { current: page + 1, total: pageCount })}</span>
            <button
              className="ms share-pager-btn"
              aria-label={t("share.nextPage")}
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              chevron_right
            </button>
          </div>
        )}
      </div>

      <div className="seg share-format">
        <button className={format === "story" ? "on" : ""} onClick={() => setFormat("story")}>
          <span className="ms" style={{ fontSize: 15 }}>crop_portrait</span> {t("share.story")}
        </button>
        <button className={format === "square" ? "on" : ""} onClick={() => setFormat("square")}>
          <span className="ms" style={{ fontSize: 15 }}>crop_square</span> {t("share.square")}
        </button>
      </div>

      {format === "square" && (
        <div className="seg share-mode">
          <button className={mode === "summary" ? "on" : ""} onClick={() => setMode("summary")}>
            {t("share.summary")}
          </button>
          <button className={mode === "full" ? "on" : ""} onClick={() => setMode("full")}>
            {t("share.full")}
          </button>
        </div>
      )}

      <div className="share-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => void shareImage()}>
          <span className="ms">ios_share</span>
          {t("share.shareImage")}
        </button>
        <div className="share-actions-row">
          <button className="btn btn-ghost" disabled={busy} onClick={() => void saveImage()}>
            <span className="ms">download</span>
            {t("share.save")}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => void copyText()}>
            <span className="ms">link</span>
            {t("share.copyLink")}
          </button>
        </div>
      </div>

      <p className="share-note">{msg ?? t("share.hint")}</p>
    </Sheet>
  );
}
