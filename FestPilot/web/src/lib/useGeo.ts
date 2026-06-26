/**
 * Device geolocation + compass hooks, shared by the meeting-point navigation screen and the squad-home
 * meeting card (Gate 6.3 / Squad redesign). Each piece degrades on its own so callers stay useful:
 *  - `useMyFix` watches the live GPS fix (null until the first fix / when denied);
 *  - `useHeading` reads the device compass heading (best-effort across iOS/Android), exposing whether
 *    an explicit permission request is still needed (iOS 13+) so the UI can offer an "enable" button.
 *
 * Raw coordinates never leave the device here — these hooks only feed on-device distance/bearing math
 * (see domain/travel). They are intentionally framework-light: mount them only where a live fix is
 * actually shown, so GPS/compass sensors aren't woken needlessly.
 */
import { useEffect, useRef, useState } from "react";

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
}

/** Live device heading (degrees clockwise from north), best-effort across iOS/Android with graceful gaps. */
export function useHeading(): { heading: number | null; needsPermission: boolean; request: () => void } {
  const [heading, setHeading] = useState<number | null>(null);
  const [granted, setGranted] = useState(false);
  const needsPermission =
    typeof window !== "undefined" &&
    typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown })?.requestPermission ===
      "function";

  useEffect(() => {
    if (needsPermission && !granted) return;
    const onOrient = (e: DeviceOrientationEvent): void => {
      const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof webkit === "number" && !Number.isNaN(webkit)) setHeading(webkit);
      else if (e.absolute && e.alpha != null) setHeading((360 - e.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", onOrient as EventListener);
    window.addEventListener("deviceorientation", onOrient as EventListener);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener);
      window.removeEventListener("deviceorientation", onOrient as EventListener);
    };
  }, [needsPermission, granted]);

  const request = (): void => {
    const req = (window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      ?.requestPermission;
    if (typeof req === "function") req().then((r) => r === "granted" && setGranted(true)).catch(() => {});
    else setGranted(true);
  };

  return { heading, needsPermission, request };
}

/** Live GPS fix while mounted (watchPosition); null until the first fix / when denied. */
export function useMyFix(): { fix: Fix | null; denied: boolean } {
  const [fix, setFix] = useState<Fix | null>(null);
  const [denied, setDenied] = useState(false);
  const watch = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDenied(true);
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (pos) =>
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        }),
      () => setDenied(true),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    };
  }, []);

  return { fix, denied };
}
