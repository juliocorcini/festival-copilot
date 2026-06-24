/**
 * Typed API client for the FestPilot Worker. Base URL comes from `VITE_API_URL`
 * (baked at build time); falls back to the deployed Worker so the app always has
 * a live source. Every read is a single GET — the service worker layers offline
 * caching on top (network-first for /api, see public/sw.js).
 */
import type {
  BoardNoteDto,
  CreateMeetingPointInput,
  FestivalDto,
  FestivalMapDto,
  GroupDto,
  GroupMemberDto,
  GroupPresenceDto,
  InvitePreviewDto,
  LineupDto,
  MeetingPointDto,
  SettableMeetingStatus,
  ShareMode,
  SquadPlanDataDto,
  StageDto,
  UserDto,
} from "./types";
import { authHeader, getAuthToken } from "./authToken";

const DEFAULT_API = "https://festpilot.trippilot.workers.dev";

export const API_BASE: string = (
  (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_API
).replace(/\/+$/, "");

/** WebSocket origin for the GroupRoom realtime channel (https -> wss). */
export const WS_BASE: string = API_BASE.replace(/^http/, "ws");

/** URL for a group's realtime socket. The token rides as a query param because browsers can't
 *  set headers on a WebSocket handshake; the server accepts `?t=` for the upgrade only. */
export function groupSocketUrl(groupId: string): string {
  return `${WS_BASE}/api/groups/${groupId}/socket?t=${encodeURIComponent(getAuthToken())}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { accept: "application/json" } });
  } catch (cause) {
    throw new ApiError(`Network error reaching ${path}`, 0, url);
  }
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status, url);
  }
  return (await res.json()) as T;
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/** Authenticated JSON request — attaches the bearer token (minting it on first use). */
async function authedJson<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      signal: opts.signal,
      headers: {
        accept: "application/json",
        ...(opts.body != null ? { "content-type": "application/json" } : {}),
        ...authHeader(),
      },
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(`Network error reaching ${path}`, 0, url);
  }
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status, url);
  }
  return (await res.json()) as T;
}

export interface ProfileInput {
  displayName?: string;
  avatarColor?: string;
  locale?: string;
}

export interface CreateGroupInput {
  name: string;
  emoji: string | null;
  festivalId: string;
}

/** One locked pick the user shares with a squad (mirrors the personal plan slot). */
export interface ShareSlotInput {
  performanceId: string;
  startOverrideUtc?: string | null;
  endOverrideUtc?: string | null;
}

export interface ShareMyPlanInput {
  day: string;
  slots: ShareSlotInput[];
  shareFavorites: boolean;
  favoriteActKeys: string[];
}

export interface LineupQuery {
  weekend?: string;
  day?: string;
}

function queryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return "";
  const usp = new URLSearchParams(entries as [string, string][]);
  return `?${usp.toString()}`;
}

export const api = {
  health(signal?: AbortSignal): Promise<{ ok: boolean; service: string }> {
    return getJson("/api/health", signal);
  },

  async listFestivals(signal?: AbortSignal): Promise<FestivalDto[]> {
    const data = await getJson<{ festivals: FestivalDto[] }>("/api/festivals", signal);
    return data.festivals;
  },

  getLineup(festivalId: string, query: LineupQuery = {}, signal?: AbortSignal): Promise<LineupDto> {
    const qs = queryString({ weekend: query.weekend, day: query.day });
    return getJson<LineupDto>(`/api/festivals/${festivalId}/lineup${qs}`, signal);
  },

  async listStages(festivalId: string, signal?: AbortSignal): Promise<StageDto[]> {
    const data = await getJson<{ stages: StageDto[] }>(`/api/festivals/${festivalId}/stages`, signal);
    return data.stages;
  },

  getMap(festivalId: string, signal?: AbortSignal): Promise<FestivalMapDto> {
    return getJson<FestivalMapDto>(`/api/festivals/${festivalId}/map`, signal);
  },

  // Identity (anonymous-first; DEC-024). GET ensures + returns the caller's user.
  getMe(signal?: AbortSignal): Promise<UserDto> {
    return authedJson<{ user: UserDto }>("/api/me", { signal }).then((d) => d.user);
  },

  updateMe(profile: ProfileInput, signal?: AbortSignal): Promise<UserDto> {
    return authedJson<{ user: UserDto }>("/api/me", { method: "PUT", body: profile, signal }).then(
      (d) => d.user
    );
  },

  // Groups (Pillar 3a — UC-16/17). All authenticated through the same bearer token.
  listMyGroups(signal?: AbortSignal): Promise<GroupDto[]> {
    return authedJson<{ groups: GroupDto[] }>("/api/groups/mine", { signal }).then((d) => d.groups);
  },

  createGroup(input: CreateGroupInput, signal?: AbortSignal): Promise<GroupDto> {
    return authedJson<{ group: GroupDto }>("/api/groups", { method: "POST", body: input, signal }).then(
      (d) => d.group
    );
  },

  getGroup(
    id: string,
    signal?: AbortSignal
  ): Promise<{ group: GroupDto; members: GroupMemberDto[] }> {
    return authedJson<{ group: GroupDto; members: GroupMemberDto[] }>(`/api/groups/${id}`, { signal });
  },

  getInvite(token: string, signal?: AbortSignal): Promise<InvitePreviewDto> {
    return authedJson<{ invite: InvitePreviewDto }>(`/api/groups/invite/${token}`, { signal }).then(
      (d) => d.invite
    );
  },

  joinGroup(token: string, signal?: AbortSignal): Promise<GroupDto> {
    return authedJson<{ group: GroupDto }>("/api/groups/join", {
      method: "POST",
      body: { token },
      signal,
    }).then((d) => d.group);
  },

  leaveGroup(id: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/leave`, { method: "POST", signal }).then(
      () => undefined
    );
  },

  // Shared timetable (Gate 4.3). Raw data in; the client aggregates the squad plan.
  getSquadPlan(id: string, day: string, signal?: AbortSignal): Promise<SquadPlanDataDto> {
    return authedJson<{ plan: SquadPlanDataDto }>(
      `/api/groups/${id}/plan${queryString({ day })}`,
      { signal }
    ).then((d) => d.plan);
  },

  shareMyPlan(id: string, input: ShareMyPlanInput, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/plan`, {
      method: "PUT",
      body: input,
      signal,
    }).then(() => undefined);
  },

  unshareMyPlan(id: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/plan`, { method: "DELETE", signal }).then(
      () => undefined
    );
  },

  setSquadOverride(id: string, day: string, performanceId: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/plan/override`, {
      method: "POST",
      body: { day, performanceId },
      signal,
    }).then(() => undefined);
  },

  clearSquadOverride(id: string, day: string, performanceId: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/plan/override`, {
      method: "DELETE",
      body: { day, performanceId },
      signal,
    }).then(() => undefined);
  },

  // Group board (Gate 4.4 — UC-39). Lightweight pinned notes; not chat.
  getBoard(id: string, signal?: AbortSignal): Promise<BoardNoteDto[]> {
    return authedJson<{ notes: BoardNoteDto[] }>(`/api/groups/${id}/board`, { signal }).then((d) => d.notes);
  },

  postNote(id: string, body: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ note: BoardNoteDto }>(`/api/groups/${id}/board`, {
      method: "POST",
      body: { body },
      signal,
    }).then(() => undefined);
  },

  editNote(id: string, noteId: string, body: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/board/${noteId}`, {
      method: "PUT",
      body: { body },
      signal,
    }).then(() => undefined);
  },

  pinNote(id: string, noteId: string, pinned: boolean, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/board/${noteId}`, {
      method: "PUT",
      body: { pinned },
      signal,
    }).then(() => undefined);
  },

  deleteNote(id: string, noteId: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/board/${noteId}`, {
      method: "DELETE",
      signal,
    }).then(() => undefined);
  },

  // Live presence (Phase 5 — UC-21/22/24). Raw fix in; coarse-only roster out (DEC-046).
  getGroupPresence(id: string, signal?: AbortSignal): Promise<GroupPresenceDto> {
    return authedJson<{ presence: GroupPresenceDto }>(`/api/groups/${id}/presence`, { signal }).then(
      (d) => d.presence
    );
  },

  /** Report one raw fix; the server coarsens it into every squad you share with. */
  reportFix(
    fix: { lat: number; lng: number; accuracyMeters?: number | null; source?: "gps" | "manual" | "push_reply" },
    signal?: AbortSignal
  ): Promise<{ ok: boolean; groups: number }> {
    return authedJson<{ ok: boolean; groups: number }>("/api/presence", {
      method: "POST",
      body: fix,
      signal,
    });
  },

  setShareMode(id: string, mode: ShareMode, durationMinutes?: number, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${id}/share`, {
      method: "PUT",
      body: { mode, ...(durationMinutes != null ? { durationMinutes } : {}) },
      signal,
    }).then(() => undefined);
  },

  /** Master switch (#25.6): pause sharing across all squads, or resume to coarse ("stage"). */
  pauseSharing(paused: boolean, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>("/api/presence/pause", {
      method: "POST",
      body: { paused },
      signal,
    }).then(() => undefined);
  },

  // "Where is everyone?" ping round-trip (Gate 5.3 — UC-25/26).
  /** Ask a squad-mate to locate ("locate", when stale) or to turn sharing on ("nudge"). */
  sendPing(groupId: string, toUserId: string, kind: "locate" | "nudge", signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${groupId}/ping`, {
      method: "POST",
      body: { toUserId, kind },
      signal,
    }).then(() => undefined);
  },

  /** Answer a ping by declaring a stage (push-reply; works with GPS off). */
  answerPing(groupId: string, pingId: string, stageId: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${groupId}/ping/${pingId}/answer`, {
      method: "POST",
      body: { stageId },
      signal,
    }).then(() => undefined);
  },

  /** Dismiss a ping without sharing. */
  dismissPing(groupId: string, pingId: string, signal?: AbortSignal): Promise<void> {
    return authedJson<{ ok: boolean }>(`/api/groups/${groupId}/ping/${pingId}/dismiss`, {
      method: "POST",
      signal,
    }).then(() => undefined);
  },

  // Meeting points (Gate 6.1 — UC-27, DEC-014/046/047). "Come to me": an exact opt-in spot.
  /** The squad's active meeting points (not archived, not yet expired), newest first. */
  async listMeetingPoints(groupId: string, signal?: AbortSignal): Promise<MeetingPointDto[]> {
    const data = await authedJson<{ meetingPoints: MeetingPointDto[] }>(`/api/groups/${groupId}/meeting-points`, {
      method: "GET",
      signal,
    });
    return data.meetingPoints;
  },

  /** Drop a meeting point (B4.2). The exact lat/lng is the caller's explicit share (DEC-046). */
  async createMeetingPoint(
    groupId: string,
    input: CreateMeetingPointInput,
    signal?: AbortSignal
  ): Promise<MeetingPointDto> {
    const data = await authedJson<{ meetingPoint: MeetingPointDto }>(`/api/groups/${groupId}/meeting-points`, {
      method: "POST",
      body: input,
      signal,
    });
    return data.meetingPoint;
  },

  /** One meeting point with the full convergence roster + live ETAs + lifecycle (#26.3). */
  async getMeetingPoint(groupId: string, mpId: string, signal?: AbortSignal): Promise<MeetingPointDto> {
    const data = await authedJson<{ meetingPoint: MeetingPointDto }>(`/api/groups/${groupId}/meeting-points/${mpId}`, {
      method: "GET",
      signal,
    });
    return data.meetingPoint;
  },

  /** Set my own status on a point: going / arrived / not_going (the going/here/can't loop). */
  async setMeetingStatus(
    groupId: string,
    mpId: string,
    status: SettableMeetingStatus,
    signal?: AbortSignal
  ): Promise<MeetingPointDto> {
    const data = await authedJson<{ meetingPoint: MeetingPointDto }>(
      `/api/groups/${groupId}/meeting-points/${mpId}/status`,
      { method: "POST", body: { status }, signal }
    );
    return data.meetingPoint;
  },

  /** End a point — creator-only. "close" wraps it up (#26.4); "cancel" calls it off. */
  async endMeetingPoint(
    groupId: string,
    mpId: string,
    mode: "close" | "cancel",
    signal?: AbortSignal
  ): Promise<MeetingPointDto> {
    const data = await authedJson<{ meetingPoint: MeetingPointDto }>(
      `/api/groups/${groupId}/meeting-points/${mpId}/end`,
      { method: "POST", body: { mode }, signal }
    );
    return data.meetingPoint;
  },
};
