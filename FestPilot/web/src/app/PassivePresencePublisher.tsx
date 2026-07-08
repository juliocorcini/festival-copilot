/**
 * Publishes coarse presence from the moment the app opens (F04 / DEC-112).
 * Conditions: the user has opted in (fp.share.v1) AND belongs to at least one group.
 * This runs at App root level so presence doesn't depend on opening the "Where is everyone" screen.
 */
import { useEffect } from "react";
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

  return null;
}
