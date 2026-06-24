/**
 * Presence data layer (Phase 5 — UC-21/22/24, DEC-006/007/015/046).
 *
 *  - `useGroupPresence` reads the coarse "where is everyone" roster, kept fresh by the same
 *    contract as the rest of Pillar 3: the GroupRoom socket ("changed" → refetch), a focus
 *    refetch, and a slow tick so freshness/countdowns stay live while the screen is open.
 *  - `useLocationSharing` is the device-side engine: it requests geolocation consent, then
 *    samples battery-consciously (coarse accuracy, cached fixes, significant-move + a slow
 *    keepalive timer) and POSTs each raw fix to the server, which coarsens it. Raw coordinates
 *    never leave the device except to the server, and the server never echoes them back.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useGroupLive, type LoadStatus } from "./groups";
import type { GroupPresenceDto } from "./types";

export interface GroupPresenceState {
  presence: GroupPresenceDto | null;
  status: LoadStatus;
  reload: () => void;
}

/** Slow refresh so countdowns + "Nm ago" freshness stay honest without hammering the API. */
const ROSTER_TICK_MS = 15_000;

export function useGroupPresence(groupId: string | undefined): GroupPresenceState {
  const [presence, setPresence] = useState<GroupPresenceDto | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const hasData = useRef(false);

  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    let alive = true;
    if (!hasData.current) setStatus("loading");
    api
      .getGroupPresence(groupId, controller.signal)
      .then((data) => {
        if (!alive) return;
        setPresence(data);
        hasData.current = true;
        setStatus("ready");
      })
      .catch(() => {
        if (!alive || controller.signal.aborted) return;
        if (!hasData.current) setStatus("error");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [groupId, nonce]);

  // Focus refetch (reliable refresh after backgrounding).
  useEffect(() => {
    if (!groupId) return;
    const onFocus = (): void => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [groupId, reload]);

  // Slow tick keeps the live countdown + freshness current.
  useEffect(() => {
    if (!groupId) return;
    const id = setInterval(reload, ROSTER_TICK_MS);
    return () => clearInterval(id);
  }, [groupId, reload]);

  useGroupLive(groupId, reload);

  return { presence, status, reload };
}

export type GeoPermission = "unknown" | "prompt" | "granted" | "denied";

export interface LocationSharingState {
  supported: boolean;
  permission: GeoPermission;
  /** We are actively watching + posting fixes. */
  active: boolean;
  lastFixAtMs: number | null;
  error: string | null;
  /** Request consent (triggers the OS prompt) and start sharing. Resolves true on success. */
  enable: () => Promise<boolean>;
  /** Stop watching + posting (does not change server share mode). */
  disable: () => void;
}

// Battery-aware sampling knobs: coarse accuracy + cached fixes mean fewer GPS wakes; we only POST
// on a meaningful move or after a slow keepalive so a GPS fix doesn't lapse its 15-min window.
const MIN_POST_INTERVAL_MS = 25_000;
const KEEPALIVE_MS = 75_000;
const SIGNIFICANT_MOVE_M = 25;
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 };

function metersApart(a: GeolocationCoordinates, b: GeolocationCoordinates): number {
  const RAD = Math.PI / 180;
  const k = Math.cos(((a.latitude + b.latitude) / 2) * RAD);
  const dx = (b.longitude - a.longitude) * k;
  const dy = b.latitude - a.latitude;
  return Math.hypot(dx, dy) * 111320;
}

/**
 * Device sharing engine. `onPosted` fires after each successful fix so a roster can refresh.
 * Returns control + status for the consent screen and the precise-sharing control.
 */
export function useLocationSharing(onPosted?: () => void): LocationSharingState {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const [permission, setPermission] = useState<GeoPermission>("unknown");
  const [active, setActive] = useState(false);
  const [lastFixAtMs, setLastFixAtMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchId = useRef<number | null>(null);
  const keepAlive = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoords = useRef<GeolocationCoordinates | null>(null);
  const lastPostMs = useRef(0);
  const onPostedRef = useRef(onPosted);
  onPostedRef.current = onPosted;

  // Read the current permission without prompting (where the Permissions API exists).
  useEffect(() => {
    if (!supported || !navigator.permissions?.query) return;
    let alive = true;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((st) => {
        if (!alive) return;
        setPermission(st.state as GeoPermission);
        st.onchange = () => setPermission(st.state as GeoPermission);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [supported]);

  const postFix = useCallback((coords: GeolocationCoordinates) => {
    lastPostMs.current = Date.now();
    api
      .reportFix({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracyMeters: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
        source: "gps",
      })
      .then(() => {
        setLastFixAtMs(Date.now());
        onPostedRef.current?.();
      })
      .catch(() => {});
  }, []);

  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const prev = lastCoords.current;
      lastCoords.current = pos.coords;
      const moved = !prev || metersApart(prev, pos.coords) >= SIGNIFICANT_MOVE_M;
      const due = Date.now() - lastPostMs.current >= MIN_POST_INTERVAL_MS;
      if (moved || due) postFix(pos.coords);
    },
    [postFix]
  );

  const disable = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (keepAlive.current) clearInterval(keepAlive.current);
    watchId.current = null;
    keepAlive.current = null;
    setActive(false);
  }, []);

  const enable = useCallback((): Promise<boolean> => {
    if (!supported) {
      setError("Location isn't available on this device.");
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermission("granted");
          setError(null);
          lastCoords.current = pos.coords;
          postFix(pos.coords);
          // Watch for significant moves...
          watchId.current = navigator.geolocation.watchPosition(onPosition, () => {}, GEO_OPTIONS);
          // ...and a slow keepalive so a stationary fix doesn't lapse its freshness window.
          keepAlive.current = setInterval(() => {
            if (lastCoords.current) postFix(lastCoords.current);
          }, KEEPALIVE_MS);
          setActive(true);
          resolve(true);
        },
        (err) => {
          setPermission(err.code === err.PERMISSION_DENIED ? "denied" : permission);
          setError(err.code === err.PERMISSION_DENIED ? "Location permission was declined." : "Couldn't read your location.");
          resolve(false);
        },
        GEO_OPTIONS
      );
    });
  }, [supported, onPosition, postFix, permission]);

  useEffect(() => () => disable(), [disable]);

  return { supported, permission, active, lastFixAtMs, error, enable, disable };
}
