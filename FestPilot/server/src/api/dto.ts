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

/** A pending "where are you?" / "turn on sharing" request addressed to the caller (#25.4). */
export interface PingDto {
  id: string;
  fromUserId: string;
  fromName: string | null;
  kind: "locate" | "nudge";
  createdAtUtc: string;
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
  /** Pending pings addressed to the caller in this squad (one-tap answer with a stage). */
  inbox: PingDto[];
}

// Meeting points (Pillar 3b, Phase 6 — UC-27, DEC-014/046/047). An exact opt-in spot the squad walks
// to ("come to me"). UNLIKE presence, the meeting point IS an explicit, intentional share of an exact
// coordinate by its creator — the one place an exact coordinate leaves a device in V1 (DEC-046). The
// label is a coarse landmark for copy; the photo is deferred (DEC-047, R2 not enabled in V1).

/** A member's response on a meeting point. DB enum: going / arrived / left / not_going. */
// "no_response" is SYNTHESIZED for squad members without a row (the detail roster shows them dimmed,
// wireframe #26.3 "Theo · no response"); it is never written to the DB (only the first four are).
export type MeetingMemberStatus = "going" | "arrived" | "left" | "not_going" | "no_response";

export interface MeetingPointMemberDto {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  isYou: boolean;
  status: MeetingMemberStatus;
  updatedAtUtc: string;
  /** Walking ETA to the spot (min), DERIVED server-side from the member's fix — never a coordinate.
   *  Null unless the member is sharing presence and still heading over (Gate 6.2, DEC-048). */
  etaMinutes: number | null;
  /** Straight-line distance to the spot (m), rounded; pairs with etaMinutes for the convergence view. */
  distanceMeters: number | null;
}

/** The live state a meeting point presents to the squad (derived, never stored — see domain/meeting). */
export type MeetingLifecycle =
  | "active"
  | "on_the_way"
  | "everyone_here"
  | "expiring_soon"
  | "expired"
  | "cancelled";

export interface MeetingPointDto {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdByName: string | null;
  /** The caller created this point. */
  isMine: boolean;
  title: string;
  note: string | null;
  /** Exact spot — the creator's explicit, intentional share (DEC-046). */
  lat: number;
  lng: number;
  /** Coarse landmark for copy ("at FREEDOM" / "between FREEDOM & CORE" / "in the venue"). */
  landmarkLabel: string;
  /** When to meet (ISO, UTC); null = "now". */
  meetAtUtc: string | null;
  /** Auto-archives at this instant (10/20/30/60 min from creation, DEC-014). */
  expiresAtUtc: string;
  createdAtUtc: string;
  members: MeetingPointMemberDto[];
  /** Members heading over (status = going) — the "on the way" tally. */
  goingCount: number;
  /** Members who arrived (status = arrived). */
  hereCount: number;
  /** The caller's own status on this point, or null when they haven't responded. */
  myStatus: MeetingMemberStatus | null;
  /** Derived live state (active → on_the_way → everyone_here → expiring_soon → expired/cancelled). */
  lifecycle: MeetingLifecycle;
  /** True when every committed member arrived (the #26.4 reunion). Convenience over `lifecycle`. */
  everyoneHere: boolean;
  /** Smart prompt (#26): the creator's live fix is far from the spot. Only ever true for the creator. */
  creatorDrifted: boolean;
  /** A safety / "I'm lost" broadcast (Gate 6.3, #26.5/#26.6, DEC-022): the creator shares their exact
   *  spot so the squad can converge to help. Surfaces in its own lane, never auto-fades, ends on "I'm okay". */
  isSafety: boolean;
}
