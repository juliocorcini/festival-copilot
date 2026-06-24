/**
 * Share-my-plan sheet (DEC-029). Previews the branded poster live, lets the user pick a format
 * (Story 9:16 / Square 1:1), and offers three lanes: share the image to anywhere (Web Share files →
 * Stories / WhatsApp), save the PNG, or copy the plan text + link. Pure presentation over
 * `planPoster` + `lib/share`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlanSlot } from "../../domain/types";
import { drawPlanPoster, planPosterBlob, type PosterFormat, type PosterInput } from "../../lib/planPoster";
import { copyPlanText, downloadBlob, formatPlanText, sharePlanImage } from "../../lib/share";

interface Props {
  festivalName: string;
  dayName: string;
  slots: PlanSlot[];
  timeZone: string;
  onClose: () => void;
}

function appOrigin(): string {
  if (typeof window === "undefined" || !window.location?.origin) return "festpilot.app";
  return window.location.origin;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan";
}

export function SharePlanSheet({ festivalName, dayName, slots, timeZone, onClose }: Props): JSX.Element {
  const [format, setFormat] = useState<PosterFormat>("story");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const appUrl = appOrigin();
  const input = useMemo<PosterInput>(
    () => ({ festivalName, dayName, slots, timeZone, format, appUrl }),
    [festivalName, dayName, slots, timeZone, format, appUrl]
  );
  const filename = `festpilot-${slug(festivalName)}-${slug(dayName)}.png`;

  useEffect(() => {
    let cancelled = false;
    const draw = (): void => {
      if (!cancelled && canvasRef.current) drawPlanPoster(canvasRef.current, input);
    };
    draw();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(draw).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [input]);

  const shareImage = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const blob = await planPosterBlob(input);
      const text = formatPlanText(dayName, slots, timeZone, appUrl);
      const res = await sharePlanImage(blob, filename, text);
      if (res === "unsupported") {
        downloadBlob(blob, filename);
        setMsg("Saved to your device — now share it anywhere");
      } else if (res === "shared") {
        setMsg("Shared!");
      }
    } catch {
      setMsg("Couldn't build the image. Try saving instead.");
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const blob = await planPosterBlob(input);
      downloadBlob(blob, filename);
      setMsg("Saved to your device");
    } catch {
      setMsg("Couldn't save the image.");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (): Promise<void> => {
    const ok = await copyPlanText(dayName, slots, timeZone, appUrl);
    setMsg(ok ? "Plan + link copied" : "Couldn't copy");
  };

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="sheet on share-sheet">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="poster sheet-title">Share your plan</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>

        <div className="share-preview">
          <canvas ref={canvasRef} className={`share-canvas ${format}`} aria-label="Plan poster preview" />
        </div>

        <div className="seg share-format">
          <button className={format === "story" ? "on" : ""} onClick={() => setFormat("story")}>
            <span className="ms" style={{ fontSize: 15 }}>crop_portrait</span> Story
          </button>
          <button className={format === "square" ? "on" : ""} onClick={() => setFormat("square")}>
            <span className="ms" style={{ fontSize: 15 }}>crop_square</span> Square
          </button>
        </div>

        <div className="share-actions">
          <button className="btn btn-primary" disabled={busy} onClick={() => void shareImage()}>
            <span className="ms">ios_share</span>
            Share image
          </button>
          <div className="share-actions-row">
            <button className="btn btn-ghost" disabled={busy} onClick={() => void saveImage()}>
              <span className="ms">download</span>
              Save
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void copyText()}>
              <span className="ms">link</span>
              Copy link
            </button>
          </div>
        </div>

        <p className="share-note">{msg ?? "Drop it in your Instagram story or send it on WhatsApp."}</p>
      </div>
    </>
  );
}
