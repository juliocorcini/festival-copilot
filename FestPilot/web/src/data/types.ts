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
  /** Source data-state (DEC-052): the clock-by-clock timetable is published (vs lineup-only). */
  withTimetable: boolean;
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

/** Social links a source artist may carry (ART-3), in display order. Mirrors server ArtistSocials. */
export interface ArtistSocials {
  instagram?: string;
  spotify?: string;
  soundcloud?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  website?: string;
  twitter?: string;
}

export interface ArtistDto {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Present social links only; omitted entirely when the artist has none. */
  socials?: ArtistSocials;
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
  /** DEC-052 data-state: at least one real (non-placeholder) act is announced. */
  hasLineup: boolean;
  /** DEC-052 data-state: the timetable is published AND scheduled sets exist. */
  hasTimetable: boolean;
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
  iconUrl?: string | null;
  iconLng?: number | null;
  iconLat?: number | null;
  iconScale?: number | null;
  isSpoiler?: boolean;
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

// Points of interest (DEC-065) — mirror of server/src/api/poiRepo.ts. Real-world coords the client
// drops on the illustration through the same affine the stages use.
export const POI_TYPES = [
  "toilet",
  "water",
  "food",
  "medical",
  "exit",
  "atm",
  "charging",
  "locker",
  "entrance",
  "landmark",
] as const;
export type PoiType = (typeof POI_TYPES)[number];

export interface PoiDto {
  id: string;
  type: PoiType;
  name: string | null;
  lng: number;
  lat: number;
  verified: boolean;
}

// Operator-curated stage-to-stage walking minutes (DEC-065). The router prefers a stored pair over
// the live coord estimate (DEC-011). Mirror of server/src/api/travelTimeRepo.ts.
export interface TravelTimeDto {
  fromStageId: string;
  toStageId: string;
  minutesTypical: number;
  minutesCrowded: number | null;
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
  /** R2-hosted avatar photo (DEC-059); null → fall back to the colour initial. */
  avatarUrl: string | null;
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
  /** Monotonic revision of this member's shared plan (G4) — bumped only when the content changes. */
  revision: number;
}

export interface SquadPlanDataDto {
  groupId: string;
  day: string | null;
  memberCount: number;
  sharedCount: number;
  members: SquadMemberShareDto[];
  overrides: string[];
}

/**
 * One coalesced line of the squad's plan-change history (G4, E07 — DEC-095). Structured, locale-free
 * numbers; the sentence is built client-side via i18n. `day` is null for a full unshare; `pickCount`
 * is the member's resulting shared-set count for the day after the change.
 */
export interface SquadPlanChangeDto {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorColor: string | null;
  isMine: boolean;
  day: string | null;
  kind: "share" | "unshare";
  addedCount: number;
  removedCount: number;
  pickCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
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
  /** Synthetic member injected by the admin live test console (R11.5) — badged in the UI. */
  isTest: boolean;
  shareMode: ShareMode;
  live: boolean;
  liveSecondsLeft: number | null;
  presence: CoarsePresenceDto | null;
}

export interface PingDto {
  id: string;
  fromUserId: string;
  fromName: string | null;
  kind: "locate" | "nudge" | "share_plan";
  createdAtUtc: string;
}

/** The exact pin a precise+live member exposes to their squad (DEC-099) — a separate channel from
 *  the coarse roster, populated only while sharing precise with a fresh fix; auto-empties on TTL. */
export interface PrecisePresenceDto {
  userId: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  expiresAtUtc: string;
  updatedAtUtc: string;
  ageSeconds: number;
}

export interface GroupPresenceDto {
  groupId: string;
  memberCount: number;
  liveCount: number;
  members: PresenceMemberDto[];
  /** Exact pins for precise+live members (DEC-099); empty by default (privacy). */
  precise: PrecisePresenceDto[];
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
  /** R2-hosted photo of the spot (DEC-047/059); null → render the no-photo state. */
  photoUrl: string | null;
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
  /** A safety / "I'm lost" broadcast (#26.5/#26.6): the squad converges to help; ends on "I'm okay". */
  isSafety: boolean;
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
  /** Mark this as a safety / "I'm lost" broadcast (Gate 6.3) — long-lived, surfaced in the safety lane. */
  isSafety?: boolean;
}

// Group events (Phase 8, roadmap D2/Q5/Q6). A fixed-time squad commitment ("photo at 16:00"). Mirrors
// the server GroupEventDto. It is a layer ALONGSIDE the squad plan — never fed into the set
// aggregation (buildSquadPlan) nor any personal lock. Any member creates it; the creator OR the
// squad owner deletes it. The lifecycle is derived from the window; the client re-derives the live
// countdown as the clock ticks (see routes/squad/eventsUi).
export type GroupEventLifecycle = "upcoming" | "soon" | "live" | "past";

export interface GroupEventDto {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdByName: string | null;
  isMine: boolean;
  /** The caller may delete this event (created it OR owns the squad). */
  canDelete: boolean;
  title: string;
  note: string | null;
  stageId: string | null;
  stageName: string | null;
  startsAtUtc: string;
  endsAtUtc: string;
  createdAtUtc: string;
  lifecycle: GroupEventLifecycle;
  seenCount: number;
  memberCount: number;
  mySeen: boolean;
}

/** The create-sheet payload. `endsAtUtc` omitted/null → the server floors a minimum window. */
export interface CreateGroupEventInput {
  title: string;
  startsAtUtc: string;
  endsAtUtc?: string | null;
  stageId?: string | null;
  note?: string | null;
}
