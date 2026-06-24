/**
 * Admin API client (R11 / DEC-057). The whole back-office is gated by an `x-admin-token` secret,
 * stored locally and sent on every request. A 401 surfaces as AdminAuthError so the gate can
 * re-prompt for the token. Mirrors the server DTOs in `server/src/api/adminRepo.ts`.
 */
import { API_BASE } from "../data/api";

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
  if (!res.ok) throw new AdminError(`Request failed (${res.status})`, res.status);
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
