// API response DTOs (camelCase). The web client mirrors these types.
// Source of truth lives here in the server.

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

// Map (DEC-030/034/040). `transform` is the engine-exported affine doc, passed through
// to the client verbatim (it mirrors web/src/map/transform.ts MapTransform).
export interface AffineDoc {
  a: number; b: number; c: number; d: number; e: number; f: number;
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

// Social domain (Pillar 3). The user identity behind the auth seam (DEC-024).
export interface UserDto {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  isAnonymous: boolean;
  provider: string;
}

// Groups (Pillar 3a — UC-16/17, DEC-013/038). A squad is festival-scoped; cap 50.
export interface GroupDto {
  id: string;
  name: string;
  emoji: string | null;
  festivalId: string;
  createdByUserId: string;
  memberCount: number;
  /** The caller's role in this group ("owner" | "member") — null when not a member. */
  role: string | null;
  /** The active invite token (link/QR). Present for members; the link never expires (DEC-038). */
  inviteToken: string | null;
}

export interface GroupMemberDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  isYou: boolean;
}

// What an invitee sees before joining (the join card #23.6) — resolved from the link token.
export interface InvitePreviewDto {
  token: string;
  groupId: string;
  name: string;
  emoji: string | null;
  festivalId: string;
  memberCount: number;
  ownerName: string | null;
  alreadyMember: boolean;
}
