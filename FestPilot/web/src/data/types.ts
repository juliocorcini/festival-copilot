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

// Identity behind the auth seam (DEC-024). Anonymous-first; profile set at first group join.
export interface UserDto {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  isAnonymous: boolean;
  provider: string;
}

// Groups (Pillar 3a — UC-16/17). Mirrors server/src/api/dto.ts.
export interface GroupDto {
  id: string;
  name: string;
  emoji: string | null;
  festivalId: string;
  createdByUserId: string;
  memberCount: number;
  role: string | null;
  inviteToken: string | null;
}

export interface GroupMemberDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  isYou: boolean;
}

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

// Shared timetable (Gate 4.3). The server returns raw shared data; the client aggregates it.
export interface SquadMemberShareDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  isYou: boolean;
  shared: boolean;
  shareFavorites: boolean;
  performanceIds: string[];
  favoriteActKeys: string[];
}

export interface SquadPlanDataDto {
  groupId: string;
  day: string | null;
  memberCount: number;
  sharedCount: number;
  members: SquadMemberShareDto[];
  overrides: string[];
}

// Group board (Gate 4.4 — UC-39, DEC-013). Lightweight pinned notes; not chat.
export interface BoardNoteDto {
  id: string;
  authorUserId: string;
  authorName: string | null;
  authorColor: string | null;
  isMine: boolean;
  body: string;
  pinned: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

// Live presence (Phase 5 — DEC-007/008/015/046). Coarse + honest; the server NEVER sends a
// coordinate. "precise" is a 60-min, server-hard-expiring intent (live + countdown).
export type ShareMode = "stage" | "precise" | "ghost";

export interface CoarsePresenceDto {
  coarseLabel: "at" | "near" | "between" | "none";
  stageName: string | null;
  betweenStageName: string | null;
  currentArtistName: string | null;
  confidence: "high" | "medium" | "low";
  source: "gps" | "manual" | "push_reply";
  updatedAtUtc: string;
  stale: boolean;
  ageSeconds: number;
}

export interface PresenceMemberDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  isYou: boolean;
  shareMode: ShareMode;
  live: boolean;
  liveSecondsLeft: number | null;
  presence: CoarsePresenceDto | null;
}

export interface PingDto {
  id: string;
  fromUserId: string;
  fromName: string | null;
  kind: "locate" | "nudge";
  createdAtUtc: string;
}

export interface GroupPresenceDto {
  groupId: string;
  memberCount: number;
  liveCount: number;
  members: PresenceMemberDto[];
  me: { shareMode: ShareMode; live: boolean; liveSecondsLeft: number | null };
  inbox: PingDto[];
}

// Meeting points (Phase 6 — UC-27, DEC-014/046/047). An exact opt-in spot the squad walks to.
// Unlike presence, the meeting point IS an explicit, intentional share of an exact coordinate by
// its creator — the one place an exact coordinate is exposed in V1. Photo deferred (DEC-047).
// "no_response" is synthesized for squad members who haven't responded (the detail roster, #26.3).
export type MeetingMemberStatus = "going" | "arrived" | "left" | "not_going" | "no_response";

/** Statuses a member can set on themselves (the going/here/can't loop). */
export type SettableMeetingStatus = "going" | "arrived" | "not_going";

/** Derived live state a meeting point presents to the squad (#26.3/#26.4). */
export type MeetingLifecycle =
  | "active"
  | "on_the_way"
  | "everyone_here"
  | "expiring_soon"
  | "expired"
  | "cancelled";

export interface MeetingPointMemberDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  isYou: boolean;
  status: MeetingMemberStatus;
  updatedAtUtc: string;
  /** Walking ETA to the spot (min), derived server-side — never a coordinate. Null unless heading over. */
  etaMinutes: number | null;
  /** Straight-line distance to the spot (m); pairs with etaMinutes for the convergence view. */
  distanceMeters: number | null;
}

export interface MeetingPointDto {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdByName: string | null;
  isMine: boolean;
  title: string;
  note: string | null;
  /** Exact spot — the creator's explicit share (DEC-046). */
  lat: number;
  lng: number;
  /** Coarse landmark for copy ("at FREEDOM" / "between FREEDOM & CORE" / "in the venue"). */
  landmarkLabel: string;
  meetAtUtc: string | null;
  expiresAtUtc: string;
  createdAtUtc: string;
  members: MeetingPointMemberDto[];
  /** Members heading over (status = going) — the "on the way" tally. */
  goingCount: number;
  /** Members who arrived (status = arrived). */
  hereCount: number;
  myStatus: MeetingMemberStatus | null;
  /** Derived live state (active → on_the_way → everyone_here → expiring_soon → expired/cancelled). */
  lifecycle: MeetingLifecycle;
  everyoneHere: boolean;
  /** Smart prompt: the creator's live fix is far from the spot (only ever true for the creator). */
  creatorDrifted: boolean;
}

/** The B4.2 create payload — the exact spot is chosen on B4.1. */
export interface CreateMeetingPointInput {
  lat: number;
  lng: number;
  accuracyMeters?: number | null;
  title: string;
  note?: string | null;
  /** ISO instant to meet at; omit/null = "now". The point auto-closes ~30 min after this (DEC-014). */
  meetAtUtc?: string | null;
}
