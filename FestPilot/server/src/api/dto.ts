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

// Shared timetable (Pillar 3a, Gate 4.3 — DEC-013/019). The server returns the RAW shared data;
// the client aggregates it against the lineup it already has (plurality → favorited → owner),
// keeping the squad-plan logic pure, testable and consistent with the personal resolver.

/** One member's contribution: their locked picks (+ favorites when shared as fallback). */
export interface SquadMemberShareDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  isYou: boolean;
  /** The member has shared a locked plan for the requested day. */
  shared: boolean;
  /** "Use my favorites as fallback" was enabled (#23.8). */
  shareFavorites: boolean;
  /** Locked picks for the day (performance ids = local setIds). */
  performanceIds: string[];
  /** Shared favorites (act keys); empty unless shareFavorites is on. */
  favoriteActKeys: string[];
}

/** The raw squad-plan data for one day; the client builds the timetable from it. */
export interface SquadPlanDataDto {
  groupId: string;
  day: string | null;
  memberCount: number;
  sharedCount: number;
  members: SquadMemberShareDto[];
  /** Owner-pinned performance ids for the day (method=owner override). */
  overrides: string[];
}

// Group board (Pillar 3a, Gate 4.4 — UC-39, DEC-013). A lightweight list of pinned notes /
// announcements; explicitly NOT real-time chat. Authors edit/remove their own; the owner can
// remove any (moderation) and pin/unpin. Fanned out via the GroupRoom DO ("board" topic).
export interface BoardNoteDto {
  id: string;
  authorUserId: string;
  authorName: string | null;
  authorColor: string | null;
  /** The caller wrote this note (can edit + remove). */
  isMine: boolean;
  body: string;
  /** Pinned notes float to the top of the board. */
  pinned: boolean;
  createdAtUtc: string;
  /** Set when the note was edited (drives the "· edited" hint). */
  updatedAtUtc: string | null;
}

// Live presence (Pillar 3b, Phase 5 — DEC-007/008/015/046). The server keeps raw lat/lng
// SERVER-ONLY and exposes ONLY this coarse view: a stage + an honest label/confidence + freshness.
// No DTO here ever carries a coordinate. The "precise" sharing mode is honoured as a 60-min,
// server-hard-expiring intent (live + countdown); the exact moving dot lands in Phase 6 (DEC-046).

/** How a member appears to a squad: stage labels (coarse) / precise (60-min) / ghost (invisible). */
export type ShareMode = "stage" | "precise" | "ghost";

/** A member's coarse presence — the maximal info a client may ever receive (never coordinates). */
export interface CoarsePresenceDto {
  coarseLabel: "at" | "near" | "between" | "none";
  stageName: string | null;
  /** The second stage for "between A and B"; null otherwise. */
  betweenStageName: string | null;
  /** Auto-detected from the lineup at the resolved stage; null when unknown. */
  currentArtistName: string | null;
  confidence: "high" | "medium" | "low";
  source: "gps" | "manual" | "push_reply";
  updatedAtUtc: string;
  /** Past its freshness window (GPS ~15m, manual/push ~45m) → shown as "last seen". */
  stale: boolean;
  /** Seconds since the fix (drives "now / 4m / 18m ago"). */
  ageSeconds: number;
}

export interface PresenceMemberDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  isYou: boolean;
  shareMode: ShareMode;
  /** Precise sharing is currently active (live_until and not yet expired). */
  live: boolean;
  /** Seconds remaining on an active precise share; null otherwise. */
  liveSecondsLeft: number | null;
  /** Coarse presence; null when the member isn't sharing a (fresh) fix to this squad / is ghost. */
  presence: CoarsePresenceDto | null;
}

/** The squad's "where is everyone" roster for one group (coarse + freshness only). */
export interface GroupPresenceDto {
  groupId: string;
  memberCount: number;
  /** Members with a fresh coarse fix right now. */
  liveCount: number;
  members: PresenceMemberDto[];
  /** The caller's own sharing for this squad (mirrors their entry; drives the precise control). */
  me: { shareMode: ShareMode; live: boolean; liveSecondsLeft: number | null };
}
