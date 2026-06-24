/**
 * Offline cache/sync contract (G3.3, DEC-022). The service worker already caches the shell, the map
 * art and /api reads opportunistically (network-first). This module lets the user *guarantee* a
 * festival is usable with no signal: `primeOffline` fetches the lineup + map (through the SW, so its
 * handlers populate the caches), and `getOfflineStatus` reports what is actually cached. The personal
 * plan/favorites live in localStorage (DEC-041) and are always offline, so they're not tracked here.
 */
import { API_BASE } from "./api";

const MAP_ART = "/maps/tomorrowland-deschorre.webp";
const MAP_ART_DAY = "/maps/tomorrowland-deschorre-day.webp";

export interface OfflineStatus {
  /** The Cache Storage API is available (PWA context, https/localhost). */
  supported: boolean;
  /** The festivals list + the lineup response are cached. */
  lineup: boolean;
  /** The map document (affine + stage coords) is cached. */
  map: boolean;
  /** The illustrated base map raster is cached. */
  art: boolean;
}

const EMPTY: OfflineStatus = { supported: false, lineup: false, map: false, art: false };

function cacheSupported(): boolean {
  return typeof caches !== "undefined";
}

async function isCached(url: string): Promise<boolean> {
  if (!cacheSupported()) return false;
  try {
    const hit = await caches.match(url, { ignoreSearch: true, ignoreVary: true });
    return Boolean(hit);
  } catch {
    return false;
  }
}

const festivalsUrl = (): string => `${API_BASE}/api/festivals`;
const lineupUrl = (id: string): string => `${API_BASE}/api/festivals/${id}/lineup`;
const mapUrl = (id: string): string => `${API_BASE}/api/festivals/${id}/map`;

/** Report what the current festival has cached for offline use. */
export async function getOfflineStatus(festivalId: string | null | undefined): Promise<OfflineStatus> {
  if (!cacheSupported() || !festivalId) return { ...EMPTY, supported: cacheSupported() };
  const [festivals, lineup, map, art] = await Promise.all([
    isCached(festivalsUrl()),
    isCached(lineupUrl(festivalId)),
    isCached(mapUrl(festivalId)),
    isCached(MAP_ART),
  ]);
  return { supported: true, lineup: festivals && lineup, map, art };
}

/** Proactively fetch the festival's lineup + map + art so the SW caches them; returns fresh status. */
export async function primeOffline(festivalId: string): Promise<OfflineStatus> {
  await Promise.allSettled([
    fetch(festivalsUrl()),
    fetch(lineupUrl(festivalId)),
    fetch(mapUrl(festivalId)),
    fetch(MAP_ART),
    fetch(MAP_ART_DAY),
  ]);
  return getOfflineStatus(festivalId);
}
