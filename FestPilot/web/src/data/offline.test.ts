import { afterEach, describe, expect, it, vi } from "vitest";
import { getOfflineStatus, primeOffline } from "./offline";
import { API_BASE } from "./api";

const FID = "fest1";

function mockCaches(present: string[]): void {
  (globalThis as unknown as { caches: { match: (url: string) => Promise<Response | undefined> } }).caches = {
    match: (url: string) => Promise.resolve(present.some((p) => url.startsWith(p)) ? (new Response("x")) : undefined),
  };
}

afterEach(() => {
  delete (globalThis as unknown as { caches?: unknown }).caches;
  vi.restoreAllMocks();
});

describe("getOfflineStatus", () => {
  it("reports unsupported when the Cache API is absent", async () => {
    const status = await getOfflineStatus(FID);
    expect(status.supported).toBe(false);
    expect(status.lineup).toBe(false);
  });

  it("needs both the festivals list and the lineup response to call lineup cached", async () => {
    // Only the lineup endpoint is cached; the festivals list (a shorter, different URL) is not.
    mockCaches([`${API_BASE}/api/festivals/${FID}/lineup`]);
    const status = await getOfflineStatus(FID);
    expect(status.lineup).toBe(false);
  });

  it("is fully ready when lineup, map and art are cached", async () => {
    mockCaches([`${API_BASE}/api/festivals`, `${API_BASE}/api/festivals/${FID}/map`, "/maps/tomorrowland-deschorre.webp"]);
    const status = await getOfflineStatus(FID);
    expect(status.lineup).toBe(true);
    expect(status.map).toBe(true);
    expect(status.art).toBe(true);
  });

  it("returns all-false (supported) for a null festival id", async () => {
    mockCaches([`${API_BASE}/api/festivals`]);
    const status = await getOfflineStatus(null);
    expect(status).toEqual({ supported: true, lineup: false, map: false, art: false });
  });
});

describe("primeOffline", () => {
  it("fetches the lineup, map and art urls then reports status", async () => {
    const seen: string[] = [];
    mockCaches([`${API_BASE}/api/festivals`, `${API_BASE}/api/festivals/${FID}/map`, "/maps/tomorrowland-deschorre.webp"]);
    vi.stubGlobal("fetch", (url: string) => {
      seen.push(url);
      return Promise.resolve(new Response("x"));
    });
    const status = await primeOffline(FID);
    expect(seen).toContain(`${API_BASE}/api/festivals/${FID}/lineup`);
    expect(seen).toContain(`${API_BASE}/api/festivals/${FID}/map`);
    expect(seen).toContain("/maps/tomorrowland-deschorre.webp");
    expect(status.map).toBe(true);
  });
});
