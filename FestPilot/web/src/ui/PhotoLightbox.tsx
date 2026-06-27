/**
 * Full-screen photo lightbox (E19/DEC-102). Tapping a meeting-point photo opens it here, where the
 * whole image is visible (contained, not cover-cropped) and can be pinch-zoomed + panned to read a
 * detail ("it's the blue tent"). The viewport meta locks native pinch (`maximum-scale=1`), so zoom is
 * driven by the SAME `usePanZoom` the map uses — one transformed "world" layer, clamped panning, and
 * the honest resolution-based zoom ceiling (`maxScaleForBase`, DEC-075). Close via the ✕, Esc, or a
 * double-tap to reset. Reused for any photo, not just meeting points.
 */
import { useEffect, useState } from "react";
import { usePanZoom } from "../map/usePanZoom";
import { NO_INSETS, maxScaleForBase } from "../map/panClamp";
import { useT } from "../i18n";
import { containedSize } from "./lightbox";

/** Zoom ceiling before the source's resolution is known — a meeting snapshot tolerates a little zoom. */
const FALLBACK_MAX_SCALE = 4;

export function PhotoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }): JSX.Element {
  const t = useT();
  // The overlay is fixed inset:0, so the viewport equals the screen — freeze it once (portrait-only app).
  const [vp] = useState(() => ({ w: window.innerWidth || 360, h: window.innerHeight || 640 }));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const display = natural ? containedSize(natural.w, natural.h, vp.w, vp.h) : { w: vp.w, h: vp.h };
  const maxScale = natural ? maxScaleForBase(natural.w, display.w) : FALLBACK_MAX_SCALE;
  const { ref, view, recenter, handlers } = usePanZoom(vp.w, vp.h, NO_INSETS, maxScale);

  // Esc closes; lock the body scroll behind the overlay while it's open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="viewport lightbox-viewport" ref={ref} {...handlers}>
        <div
          className="world"
          style={{ width: vp.w, height: vp.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <img
            className="lightbox-img"
            src={src}
            alt={alt}
            draggable={false}
            style={{ width: vp.w, height: vp.h }}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
            onDoubleClick={recenter}
          />
        </div>
      </div>
      <button className="lightbox-close" onClick={onClose} aria-label={t("common.close")}>
        <span className="ms" aria-hidden="true">close</span>
      </button>
    </div>
  );
}
