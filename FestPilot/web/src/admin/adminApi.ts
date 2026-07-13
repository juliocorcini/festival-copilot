/**
 * Admin API client (R11 / DEC-057). The whole back-office is gated by an `x-admin-token` secret,
 * stored locally and sent on every request. A 401 surfaces as AdminAuthError so the gate can
 * re-prompt for the token. Mirrors the server DTOs in `server/src/api/adminRepo.ts`.
 */
import { API_BASE } from "../data/api";
import type { FestivalMapDto, MapTransformDoc } from "../data/types";

const TOKEN_KEY = "fp.admin.token.v1";

export function getAdminToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token.trim());
  } catch {
    /* storage disabled — token simply won't persist */
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class AdminAuthError extends Error {
  constructor() {
    super("admin unauthorized");
    this.name = "AdminAuthError";
  }
}

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AdminError";
  }
}

interface AdminRequestOpts {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function adminRequest<T>(path: string, opts: AdminRequestOpts = {}): Promise<T> {
  const token = getAdminToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/admin${path}`, {
      method: opts.method ?? "GET",
      signal: opts.signal,
      headers: {
        accept: "application/json",
        "x-admin-token": token,
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new AdminError("Network error reaching the admin API", 0);
  }
  if (res.status === 401) throw new AdminAuthError();
  if (!res.ok) {
    // Surface the server's `{ error }` message when present (e.g. an honest "couldn't import" reason).
    const serverMessage = await res
      .clone()
      .json()
      .then((b) => (b && typeof (b as { error?: unknown }).error === "string" ? (b as { error: string }).error : null))
      .catch(() => null);
    throw new AdminError(serverMessage ?? `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export const adminGet = <T>(path: string, signal?: AbortSignal): Promise<T> => adminRequest<T>(path, { signal });
export const adminSend = <T>(path: string, method: string, body?: unknown): Promise<T> =>
  adminRequest<T>(path, { method, body });

/** Validate the stored token against the guarded /ping probe. */
export async function pingAdmin(signal?: AbortSignal): Promise<boolean> {
  try {
    await adminGet<{ ok: boolean }>("/ping", signal);
    return true;
  } catch (err) {
    if (err instanceof AdminAuthError) return false;
    throw err;
  }
}

// --- DTOs (mirror the server) -------------------------------------------------

export interface AdminFestivalRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  revision: number;
  withTimetable: boolean;
  stageCount: number;
  performanceCount: number;
  scheduledCount: number;
  hasMap: boolean;
}

export interface AdminOverview {
  totals: { festivals: number; stages: number; performances: number; scheduled: number };
  festivals: AdminFestivalRow[];
}

export const fetchAdminOverview = (signal?: AbortSignal): Promise<AdminOverview> =>
  adminGet<AdminOverview>("/overview", signal);

// R11.1b — Lineup & timetable dashboard.
export interface LineupSourceInfo {
  event: string;
  uuid: string;
  sourcePageUrl: string;
  lastSeenUtc: string;
}
export interface LineupStageRow {
  id: string;
  name: string;
  total: number;
  scheduled: number;
  countsByDay: Record<string, number>;
  firstStartUtc: string | null;
  lastStartUtc: string | null;
}
export interface LineupDashboard {
  festival: { id: string; name: string; slug: string; timezone: string; withTimetable: boolean };
  source: LineupSourceInfo | null;
  days: string[];
  stages: LineupStageRow[];
  needsEndTime: number;
  totals: { sets: number; scheduled: number; stages: number };
}

export const fetchLineupDashboard = (festivalId: string, signal?: AbortSignal): Promise<LineupDashboard> =>
  adminGet<LineupDashboard>(`/festivals/${festivalId}/lineup`, signal);

export interface IngestResult {
  status?: string;
  changes?: number;
  [k: string]: unknown;
}
export const reimportLineup = (): Promise<{ results: IngestResult[] }> =>
  adminSend<{ results: IngestResult[] }>("/ingest", "POST");

// R11.1c — Festival onboarding + management (DEC-063).
export interface CreateFestivalInput {
  name: string;
  slug?: string;
  timezone: string;
  pageUrl: string;
  /** Optional saved source ref — only used if the page can't be resolved live. */
  event?: string;
  uuid?: string;
}
export interface CreateFestivalResult extends IngestResult {
  festivalId: string;
  slug: string;
  name: string;
  revision?: number;
  changesCount?: number;
}
export interface FestivalMetaPatch {
  name?: string;
  timezone?: string;
}
export const createFestival = (input: CreateFestivalInput): Promise<CreateFestivalResult> =>
  adminSend<CreateFestivalResult>("/festivals", "POST", input);
export const updateFestival = (id: string, patch: FestivalMetaPatch): Promise<{ ok: boolean }> =>
  adminSend<{ ok: boolean }>(`/festivals/${id}`, "PATCH", patch);
export const reimportFestival = (id: string): Promise<IngestResult> =>
  adminSend<IngestResult>(`/festivals/${id}/ingest`, "POST");

// R11.1c — Festival map editor (DEC-064): georeference a base raster + place stage coordinates.
export type { FestivalMapDto, MapTransformDoc };
export interface FestivalMapInput {
  assetSlug: string;
  baseNightKey: string;
  baseDayKey: string;
  transform: MapTransformDoc;
  revision?: number;
}
export const fetchFestivalMap = (id: string, signal?: AbortSignal): Promise<{ map: FestivalMapDto | null }> =>
  adminGet<{ map: FestivalMapDto | null }>(`/festivals/${id}/map`, signal);
export const saveFestivalMap = (id: string, input: FestivalMapInput): Promise<{ ok: boolean; revision: number }> =>
  adminSend<{ ok: boolean; revision: number }>(`/festivals/${id}/map`, "POST", input);

/** Upload a base raster (night/day) to R2; returns the absolute media URL to store as the base key. */
export async function uploadMapAsset(id: string, slot: "night" | "day", file: Blob): Promise<{ url: string }> {
  const token = getAdminToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/admin/festivals/${id}/map-asset?slot=${slot}`, {
      method: "POST",
      headers: { "x-admin-token": token, "content-type": file.type || "application/octet-stream" },
      body: file,
    });
  } catch {
    throw new AdminError("Network error uploading the image", 0);
  }
  if (res.status === 401) throw new AdminAuthError();
  if (!res.ok) {
    const msg = await res
      .clone()
      .json()
      .then((b) => (b && typeof (b as { error?: unknown }).error === "string" ? (b as { error: string }).error : null))
      .catch(() => null);
    throw new AdminError(msg ?? `Upload failed (${res.status})`, res.status);
  }
  return (await res.json()) as { url: string };
}

// R11.3 — Festival suggestions inbox.
export type SuggestionStatus = "new" | "planned" | "live" | "declined";
export interface FestivalSuggestion {
  id: string;
  name: string;
  count: number;
  status: string;
  suggestedBy: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}
export const fetchSuggestions = (signal?: AbortSignal): Promise<{ suggestions: FestivalSuggestion[] }> =>
  adminGet<{ suggestions: FestivalSuggestion[] }>("/festival-suggestions", signal);
export const setSuggestionStatus = (id: string, status: SuggestionStatus): Promise<{ ok: boolean }> =>
  adminSend<{ ok: boolean }>(`/festival-suggestions/${id}`, "PATCH", { status });

// R11.2 — Data-source registry.
export type DataSourceOrigin = "official_page" | "manual" | "ai_assisted";
export interface OperationalSource {
  event: string;
  uuid: string;
  pageUrl: string;
  lastSeenUtc: string;
}
export interface DataSourceDto {
  festivalId: string;
  origin: DataSourceOrigin;
  pageUrl: string | null;
  event: string | null;
  uuid: string | null;
  captureMethod: string | null;
  notes: string | null;
  aiReaderEnabled: boolean;
  updatedAtUtc: string | null;
  operational: OperationalSource | null;
}
export interface DataSourceInput {
  origin: DataSourceOrigin;
  pageUrl: string | null;
  event: string | null;
  uuid: string | null;
  captureMethod: string | null;
  notes: string | null;
  aiReaderEnabled: boolean;
}
export const fetchDataSource = (festivalId: string, signal?: AbortSignal): Promise<DataSourceDto> =>
  adminGet<DataSourceDto>(`/festivals/${festivalId}/data-source`, signal);
export const saveDataSource = (festivalId: string, input: DataSourceInput): Promise<DataSourceDto> =>
  adminSend<DataSourceDto>(`/festivals/${festivalId}/data-source`, "PUT", input);

// R11.4 — Usage metrics + free-tier runway.
export type RunwayStatus = "ok" | "watch" | "critical";
export type LimitKind = "cumulative" | "daily";
export interface UsersSummary {
  total: number;
  named: number;
  withEmail: number;
  anonymous: number;
  activeLast7d: number;
  newLast7d: number;
  testUsers: number;
  byCountry: { country: string; count: number }[];
  recent: { displayName: string | null; country: string | null; hasEmail: boolean; lastSeenUtc: string | null }[];
}
export interface StorageUsage {
  objectCount: number;
  totalBytes: number;
  bytesLast7d: number;
  objectsLast7d: number;
}
export interface ActivitySummary {
  kind: string;
  today: number;
  avgPerDay: number;
  series: { day: string; count: number }[];
}
export interface ServiceRunway {
  id: string;
  label: string;
  used: number;
  ceiling: number;
  unit: "bytes" | "count";
  kind: LimitKind;
  firstParty: boolean;
  note: string;
  usedPct: number;
  perDayRate: number;
  daysLeft: number | null;
  status: RunwayStatus;
}
export interface LockedService {
  id: string;
  label: string;
  ceiling: number;
  unit: "bytes" | "count";
  note: string;
}
export interface MetricsDto {
  users: UsersSummary;
  storage: StorageUsage;
  activity: ActivitySummary;
  runways: ServiceRunway[];
  locked: LockedService[];
  generatedAtUtc: string;
}
export const fetchMetrics = (signal?: AbortSignal): Promise<MetricsDto> =>
  adminGet<MetricsDto>("/metrics", signal);

export interface AdminUserRow {
  id: string;
  displayName: string | null;
  avatarColor: string | null;
  email: string | null;
  country: string | null;
  provider: string;
  isAnonymous: boolean;
  createdAtUtc: string;
  lastSeenUtc: string | null;
}

export const fetchAllUsers = (signal?: AbortSignal): Promise<{ users: AdminUserRow[] }> =>
  adminGet<{ users: AdminUserRow[] }>("/users", signal);

// R11.5 — Live test console.
export interface TestGroupRow {
  id: string;
  name: string;
  festivalId: string;
  festivalName: string;
  memberCount: number;
  testCount: number;
  hasMap: boolean;
}
export interface InjectableStage {
  stageId: string;
  name: string;
}
export interface TestMemberRow {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  coarseLabel: string | null;
  stageName: string | null;
  updatedAtUtc: string | null;
}
export const fetchTestGroups = (signal?: AbortSignal): Promise<{ groups: TestGroupRow[] }> =>
  adminGet<{ groups: TestGroupRow[] }>("/test/groups", signal);
export const fetchInjectableStages = (festivalId: string, signal?: AbortSignal): Promise<{ stages: InjectableStage[] }> =>
  adminGet<{ stages: InjectableStage[] }>(`/test/festivals/${festivalId}/stages`, signal);
export const fetchTestMembers = (groupId: string, signal?: AbortSignal): Promise<{ members: TestMemberRow[] }> =>
  adminGet<{ members: TestMemberRow[] }>(`/test/groups/${groupId}/members`, signal);
export const spawnTestMember = (
  groupId: string,
  body: { name?: string; color?: string; stageId?: string }
): Promise<{ member: { userId: string; displayName: string; avatarColor: string }; injected: boolean }> =>
  adminSend(`/test/groups/${groupId}/members`, "POST", body);
export const injectTestFix = (userId: string, body: { groupId: string; stageId: string }): Promise<{ ok: boolean }> =>
  adminSend(`/test/members/${userId}/inject`, "POST", body);
export const purgeTestData = (): Promise<{ users: number }> => adminSend("/test/purge", "POST");
