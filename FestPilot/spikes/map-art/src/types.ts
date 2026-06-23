/**
 * Input contract for the FestPilot map generator (DEC-033).
 *
 * This is what the (future) admin map-editor produces and hands to `generateMap`:
 * a venue location + the stage pins (placed on a base map by the admin). Everything
 * else — geometry, relief, art, the GPS->SVG transform — is derived automatically,
 * for ANY festival anywhere.
 */
export interface StageInput {
  name: string;
  lng: number;
  lat: number;
  /** Admin-verified placement (solid marker) vs. needs-review (dashed). */
  matched?: boolean;
}

export interface BBoxLngLat {
  west: number;
  east: number;
  south: number;
  north: number;
}

export type ReliefMode = "auto" | "flanders" | "global" | "none";

export interface MapInput {
  /** Stable id (used for filenames / D1 key). */
  festivalId: string;
  /** Big title on the map (e.g. the venue). */
  title: string;
  /** Small overline (e.g. festival · city). */
  subtitle?: string;
  /** The stage pins placed by the admin. Doubles as the GCPs for the transform. */
  stages: StageInput[];
  /** Explicit venue extent; if omitted it's derived from the stages + `padMeters`. */
  bbox?: BBoxLngLat;
  /** Padding around the stage cluster when deriving the bbox (default 220 m). */
  padMeters?: number;
  /** SVG canvas (the art is vector, so this is just the design coordinate space). */
  canvas?: { width: number; height: number };
  /** Raster supersample for the PNG previews (default 2; the shipped asset is the SVG). */
  scale?: number;
  /** Terrain relief source (default "auto": Flanders LiDAR where available, else global DEM). */
  relief?: ReliefMode;
  /** Hillshade raster width in px (default 2048). Raise for crisper terrain on deep zoom. */
  reliefWidth?: number;
}
