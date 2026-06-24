/**
 * Avatar (DEC-059). Renders the R2-hosted photo when present, else the initials-on-colour dot that
 * has always been the V1 fallback. One component so every member surface (header, squad roster,
 * profile) shows photos consistently and degrades to initials identically.
 */
import { initialsOf } from "../data/identity";
import { readableInkOn } from "../lib/contrast";

const FALLBACK_COLOR = "#6B7280";

interface Props {
  url?: string | null;
  color?: string | null;
  name?: string | null;
  size?: number;
  /** Draw the 2px bg ring used in overlapping stacks. */
  ring?: boolean;
  className?: string;
}

export function Avatar({ url, color, name, size = 36, ring = false, className }: Props): JSX.Element {
  const dot = color ?? FALLBACK_COLOR;
  const ringShadow = ring ? "0 0 0 2px var(--bg)" : undefined;
  const cls = `ava${className ? ` ${className}` : ""}`;

  if (url) {
    return (
      <img
        className={cls}
        src={url}
        alt={name ?? "Avatar"}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size, objectFit: "cover", boxShadow: ringShadow }}
      />
    );
  }
  return (
    <span
      className={cls}
      aria-label={name ?? "Avatar"}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(135deg, ${dot}, ${dot}cc)`,
        color: readableInkOn(dot),
        boxShadow: ringShadow,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
