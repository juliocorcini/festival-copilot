/**
 * API DTOs — mirror of `server/src/api/dto.ts` (the server is the source of truth).
 * Kept as a hand-synced copy so the web has no build-time dependency on the server.
 */

export interface FestivalDto {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  revision: number;
}

export interface WeekendDto {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export interface StageDto {
  id: string;
  sourceStageId: string;
  name: string;
  sortOrder: number;
}

export interface ArtistDto {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface PerformanceDto {
  id: string;
  sourcePerformanceId: string;
  name: string;
  day: string | null;
  dateLocal: string | null;
  weekendId: string | null;
  stageId: string | null;
  startAtUtc: string | null;
  endAtUtc: string | null;
  isPlaceholder: boolean;
  artists: ArtistDto[];
}

export interface LineupDto {
  festival: FestivalDto;
  weekends: WeekendDto[];
  stages: StageDto[];
  performances: PerformanceDto[];
}

export interface AffineDoc {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface MapStageGeo {
  name: string;
  lng: number;
  lat: number;
  matched: boolean;
}

export interface MapTransformDoc {
  festival: string;
  venue: string;
  canvas: { width: number; height: number };
  bbox: { west: number; east: number; south: number; north: number };
  affine: AffineDoc;
  stages: MapStageGeo[];
  source: string;
}

export interface FestivalMapDto {
  festivalId: string;
  assetSlug: string;
  baseNightUrl: string;
  baseDayUrl: string;
  revision: number;
  transform: MapTransformDoc;
}
