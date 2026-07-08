/**
 * Publishes coarse presence from the moment the app opens (F04 / DEC-112).
 * Conditions: the user has opted in (fp.share.v1) AND belongs to at least one group.
 * This runs at App root level so presence doesn't depend on opening the "Where is everyone" screen.
 *
 * DEC-116: also requests a Wake Lock when location sharing is active, so the device doesn't
 * suspend JS execution while the user has the app open/in focus. Released on visibility hidden.
 */
import { useEffect, useRef } from "react";
import { useLocationSharing } from "../data/presence";
import { getSharingOptIn } from "../data/shareOptIn";
import { useMyGroups } from "../data/groups";

export function PassivePresencePublisher(): null {
  const { groups } = useMyGroups();
  const sharing = useLocationSharing();
  const hasGroup = (groups?.length ?? 0) > 0;
  const optedIn = getSharingOptIn();

  useEffect(() => {
    if (!optedIn || !hasGroup) return;
    if (sharing.active || sharing.permission === "denied" || !sharing.supported) return;
    if (sharing.permission === "granted") {
      void sharing.enable();
    }
  }, [optedIn, hasGroup, sharing.active, sharing.permission, sharing.supported, sharing.enable]);

  useWakeLock(sharing.active);

  return null;
}

/**
 * Wake Lock API (DEC-116): keeps the device awake (screen on, JS running) while location sharing
 * is active. Auto-releases on visibility hidden, re-acquires on visibility visible.
 * Gracefully no-ops on browsers that don't support it (Safari <16.4, older Firefox).
 */
function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let released = false;

    const acquire = async (): Promise<void> => {
      if (released || document.visibilityState === "hidden") return;
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
        lockRef.current.addEventListener("release", () => {
          lockRef.current = null;
        });
      } catch {
        // Fails silently (low battery, permission denied, etc.)
      }
    };

    const onVisibility = (): void => {
      if (document.visibilityState === "visible" && !lockRef.current) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (lockRef.current) {
        void lockRef.current.release();
        lockRef.current = null;
      }
    };
  }, [active]);
}
