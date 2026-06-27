import type { Palette } from "../app/settings";

/**
 * The single source of truth for a venue base-map URL (DEC-090). Static slug assets are served for
 * the live festival in V1 (DEC-040; single-festival), so every map surface — MapView, the meeting-point
 * picker, the convergence map and the coarse presence mini-map — resolves its base through here. That
 * keeps the path from drifting between screens, and pairs with a warm color fallback on the container
 * so a missing or slow base degrades to brand color, never black (N3).
 */
export function mapBaseUrl(festivalId: string, palette: Palette): string {
  return `/maps/${festivalId}${palette === "day" ? "-day" : ""}.webp`;
}
