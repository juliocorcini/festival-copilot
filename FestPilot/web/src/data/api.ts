/**
 * Typed API client for the FestPilot Worker. Base URL comes from `VITE_API_URL`
 * (baked at build time); falls back to the deployed Worker so the app always has
 * a live source. Every read is a single GET — the service worker layers offline
 * caching on top (network-first for /api, see public/sw.js).
 */
import type {
  FestivalDto,
  FestivalMapDto,
  GroupDto,
  GroupMemberDto,
  InvitePreviewDto,
  LineupDto,
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
};
