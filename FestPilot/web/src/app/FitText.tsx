import { useLayoutEffect, useRef } from "react";
import { fitFontScale, shouldWrap } from "../lib/fitText";

interface Props {
  text: string;
  className?: string;
  /** Smallest font scale before the text is allowed to wrap instead of shrinking further. */
  minScale?: number;
}

/**
 * Renders `text` scaled down (relative to the inherited font size) so it fits its container on one
 * line; if it still will not fit at `minScale` it wraps to a second line rather than being cut with
 * an ellipsis (DEC-087). Recomputes on container resize / rotation. Used for the festival name on
 * the home eyebrow, which can be arbitrarily long for any festival.
 */
export function FitText({ text, className, minScale = 0.72 }: Props): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;

    const fit = (): void => {
      // Measure the natural one-line width at base size, then scale to fit the container.
      el.style.fontSize = "1em";
      el.style.whiteSpace = "nowrap";
      const naturalWidth = el.scrollWidth;
      const availableWidth = box.clientWidth;
      const scale = fitFontScale(naturalWidth, availableWidth, minScale);
      el.style.fontSize = `${scale}em`;
      el.style.whiteSpace = shouldWrap(naturalWidth, availableWidth, scale) ? "normal" : "nowrap";
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text, minScale]);

  return (
    <span ref={ref} className={className} style={{ display: "inline-block", maxWidth: "100%" }}>
      {text}
    </span>
  );
}
