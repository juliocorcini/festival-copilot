/**
 * Shared "check for updates" state machine for the manual update affordances (R10.2).
 *
 * Wraps the service-worker update flow (`registerSW`) in one tiny React hook so every place that
 * lets the user pull the latest build — Settings → About and Settings → Offline — behaves identically:
 * tap to re-check, then either learn they're current / unsupported, or activate a waiting worker
 * (which reloads). `force` is the last-resort hard refresh for long-open sessions.
 */
import { useState } from "react";
import { applyUpdate, checkForUpdate, forceUpdate, type UpdateStatus } from "./registerSW";

export type UpdateCheckState = "idle" | "checking" | UpdateStatus;

export function useUpdateCheck(): {
  state: UpdateCheckState;
  check: () => void;
  apply: () => void;
  force: () => void;
} {
  const [state, setState] = useState<UpdateCheckState>("idle");
  return {
    state,
    check: () => {
      setState("checking");
      void checkForUpdate().then(setState);
    },
    apply: () => void applyUpdate(),
    force: () => void forceUpdate(),
  };
}
