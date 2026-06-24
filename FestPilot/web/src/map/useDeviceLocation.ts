/**
 * Display-only device location for the map (R2.3 / DEC-051). This is NOT the sharing engine — it
 * never POSTs a fix anywhere; the coordinate stays on the device purely to draw the user's own
 * "you are here" dot and to decide whether they're inside the venue (out-of-venue state).
 *
 * It is deliberately passive: it reads the position ONLY when geolocation permission is already
 * granted, and never triggers the OS prompt on its own — the prompt belongs to the explicit
 * "share my location" flow on the squad screens, not to merely opening the map tab.
 */
import { useEffect, useState } from "react";

export type DeviceLocationStatus = "off" | "locating" | "ready";

export interface DeviceLocation {
  /** The device's own coordinate, or null when unknown/permission not granted. */
  coords: { lng: number; lat: number } | null;
  status: DeviceLocationStatus;
}

// Coarse + cached: cheap on battery; we only need rough placement and an inside/outside decision.
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 };

export function useDeviceLocation(): DeviceLocation {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>("off");

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let watchId: number | null = null;

    const accept = (pos: GeolocationPosition): void => {
      if (cancelled) return;
      setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
      setStatus("ready");
    };

    const start = (): void => {
      if (cancelled || watchId != null) return;
      setStatus("locating");
      navigator.geolocation.getCurrentPosition(accept, () => !cancelled && setStatus("off"), GEO_OPTIONS);
      watchId = navigator.geolocation.watchPosition(accept, () => {}, GEO_OPTIONS);
    };

    // Only act on an already-granted permission; never prompt just for opening the map.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((st) => {
          if (cancelled) return;
          if (st.state === "granted") start();
          st.onchange = (): void => {
            if (st.state === "granted") start();
          };
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [supported]);

  return { coords, status };
}
