/**
 * Shared artist image (DEC-061 / R5.4). Renders the CDN photo right-sized via `?width=`, falling
 * back to a branded initials chip when there's no photo or the image fails to load. One component
 * for every surface (swipe, grid, timetable, lineup, my plan, now/next, stage sheet).
 *
 * Race-proof (DEC-067 / IMG-1): the `<img>` is keyed by its resolved URL so React swaps the DOM node
 * on every `src` change instead of reusing one element that keeps the previous artist's bitmap. Both
 * `failed` and `loaded` reset when the source changes, so a card never shows one artist's photo under
 * another's name — until the new image decodes (`onLoad`) we render the initials placeholder.
 *
 * Resilient (IMG-6): a transient load error retries once (soft cache-buster + small backoff) before
 * falling back to initials, and a dev-only session counter separates "artist has no photo" (expected)
 * from "network/limit" failures so the "no photos on day 3" report can be confirmed, not guessed.
 */
import { useEffect, useRef, useState } from "react";
import { initialsOf } from "../data/identity";
import { artistPhotoSrc } from "../lib/photo";

const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 600;

// Per-session diagnostic (no user PII — artist names are public lineup data). Lets us tell apart the
// expected ~24% of artists with no source photo from genuine network/limit failures worth chasing.
let sessionPhotoFailures = 0;
function reportPhotoFailure(name: string): void {
  sessionPhotoFailures += 1;
  if (import.meta.env.DEV) {
    console.warn(`[photo] gave up after ${MAX_RETRIES} retry — failure #${sessionPhotoFailures} this session: ${name}`);
  }
}

export function ArtistPhoto({
  src,
  name,
  width,
  className,
}: {
  src: string | null;
  name: string;
  /** CDN resize width — pass a per-surface value from `PHOTO_WIDTH`. */
  width: number;
  className?: string;
}): JSX.Element {
  const resolved = src ? artistPhotoSrc(src, width) : null;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<number | null>(null);
  const cls = `artphoto${className ? ` ${className}` : ""}`;

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setAttempt(0);
    return () => {
      if (retryTimer.current !== null) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [resolved]);

  if (!resolved || failed) {
    return (
      <span className={`${cls} artphoto-ph`} aria-hidden="true">
        {initialsOf(name)}
      </span>
    );
  }

  // On the first failure, re-request once with a soft cache-buster after a short backoff; only after
  // that retry also fails do we surface the initials fallback. The retry keeps the placeholder up.
  const effectiveSrc = attempt === 0 ? resolved : `${resolved}&_r=${attempt}`;
  const handleError = (): void => {
    if (attempt < MAX_RETRIES) {
      retryTimer.current = window.setTimeout(() => setAttempt((a) => a + 1), RETRY_BACKOFF_MS);
    } else {
      setFailed(true);
      reportPhotoFailure(name);
    }
  };

  return (
    <>
      {!loaded && (
        <span className={`${cls} artphoto-ph`} aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}
      <img
        key={effectiveSrc}
        className={cls}
        src={effectiveSrc}
        alt=""
        decoding="async"
        draggable={false}
        style={loaded ? undefined : { display: "none" }}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </>
  );
}
