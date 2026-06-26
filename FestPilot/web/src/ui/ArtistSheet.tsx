/**
 * Artist Detail Sheet (ART-5, DEC-069): tap any artist to see a big photo, the name, the social
 * links the source ships, and EVERY place/time they play (stage colour dot + day/date + start–end,
 * with a weekend tag when the artist spans both weekends). A bottom sheet mirroring the existing
 * pattern (`scrim`/`sheet` + `sheet-head`/`sheet-x`); closes on backdrop, Esc and the close button.
 *
 * Pure presentation over a prebuilt `ArtistDetail` (see domain/artistDetail) — no time/lineup math
 * here. Brand glyphs are small inline SVGs (Material Symbols carries no brand logos).
 */
import { useEffect, useRef } from "react";
import type { ArtistSocials } from "../data/types";
import type { ArtistDetail } from "../domain/artistDetail";
import { PHOTO_WIDTH } from "../lib/photo";
import { ArtistPhoto } from "./ArtistPhoto";

const SOCIAL_ORDER = [
  "instagram",
  "spotify",
  "soundcloud",
  "facebook",
  "tiktok",
  "youtube",
  "website",
  "twitter",
] as const satisfies readonly (keyof ArtistSocials)[];

const SOCIAL_LABELS: Record<keyof ArtistSocials, string> = {
  instagram: "Instagram",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  website: "Website",
  twitter: "X (Twitter)",
};

/** Compact, hand-authored brand glyphs (24×24). Stroke-based so they inherit the accent colour. */
function SocialGlyph({ kind }: { kind: keyof ArtistSocials }): JSX.Element {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "spotify":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M7.5 9.2c3-0.9 6.6-0.5 9 1" />
          <path d="M7.8 12c2.6-0.7 5.7-0.4 7.8 0.9" />
          <path d="M8.2 14.7c2.1-0.6 4.6-0.3 6.3 0.8" />
        </svg>
      );
    case "soundcloud":
      return (
        <svg {...common}>
          <path d="M4 14v3" />
          <path d="M6.5 12v5" />
          <path d="M9 10.5v6.5" />
          <path d="M11.5 13v4" />
          <path d="M14 11v6h3.5a3 3 0 0 0 0-6 4.2 4.2 0 0 0-3.5-2" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M13.5 8.2h1.7M13.5 8.2c0-1 .6-1.7 1.7-1.7M13.5 8.2V17M13.5 11h2.2" fill="none" />
          <path d="M13.6 6.5c-1.1 0-1.8.8-1.8 2v8.5" />
          <path d="M10.2 11h3.6" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14.5 4c.4 2 1.8 3.3 3.8 3.5" />
          <path d="M14.5 4v10.2a3.6 3.6 0 1 1-3.6-3.6c.4 0 .8 .06 1.1 .17" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <rect x="3" y="6.5" width="18" height="11" rx="3.2" />
          <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "website":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.2 12h17.6" />
          <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
        </svg>
      );
    case "twitter":
      return (
        <svg {...common}>
          <path d="M5 4.5l14 15" />
          <path d="M19 4.5l-14 15" />
        </svg>
      );
  }
}

export function ArtistSheet({
  detail,
  onClose,
}: {
  detail: ArtistDetail;
  onClose: () => void;
}): JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);

  // A11y: focus the close button on open, close on Esc, and return focus to the trigger on unmount.
  useEffect(() => {
    const previouslyFocused = (typeof document !== "undefined" ? document.activeElement : null) as
      | HTMLElement
      | null;
    // preventScroll: the sheet animates up from translateY(100%); focusing without it makes the
    // browser scroll the background (the timetable) to reveal the off-screen button — a visible jump.
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const links = SOCIAL_ORDER.filter((key) => detail.socials[key]).map((key) => ({
    key,
    href: detail.socials[key] as string,
    label: SOCIAL_LABELS[key],
  }));

  // Show a weekend tag only when this artist actually plays across more than one weekend (the case
  // where it disambiguates); a single-weekend artist needs no "W1" noise.
  const showWeekend = new Set(detail.slots.map((s) => s.weekendName).filter(Boolean)).size > 1;

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div
        className="sheet on artist-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={detail.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-head artist-sheet-head">
          <button ref={closeRef} className="ms sheet-x" aria-label="Close" onClick={onClose}>
            close
          </button>
        </div>

        <div className="sheet-body artist-sheet-body">
          <div className="artist-sheet-hero">
            <ArtistPhoto
              src={detail.imageUrl}
              name={detail.name}
              width={PHOTO_WIDTH.grid}
              className="artist-sheet-photo"
            />
          </div>

          <h2 className="poster artist-sheet-name">{detail.name}</h2>

          {links.length > 0 && (
            <div className="artist-sheet-socials">
              {links.map((link) => (
                <a
                  key={link.key}
                  className="artist-sheet-social"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  title={link.label}
                >
                  <SocialGlyph kind={link.key} />
                </a>
              ))}
            </div>
          )}

          {detail.slots.length > 0 ? (
            <ul className="artist-sheet-slots">
              {detail.slots.map((slot, index) => (
                <li className="artist-sheet-slot" key={`${slot.stageName}-${slot.start}-${index}`}>
                  <span
                    className="artist-sheet-dot"
                    style={{ background: slot.stageColorKey }}
                    aria-hidden="true"
                  />
                  <div className="artist-sheet-slot-text">
                    <div className="artist-sheet-stage">
                      {slot.stageName}
                      {showWeekend && slot.weekendName && (
                        <span className="artist-sheet-wk">{slot.weekendName}</span>
                      )}
                    </div>
                    <div className="artist-sheet-when">
                      {slot.dayLabel} {slot.dateLabel} · {slot.start}–{slot.end}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="artist-sheet-empty">Set times to be announced.</p>
          )}
        </div>
      </div>
    </>
  );
}
