/**
 * Meeting-point data layer (Phase 6 — UC-27, DEC-014/046/047). `useMeetingPoints` reads the squad's
 * active "come to me" points, kept fresh by the same contract as the rest of Pillar 3: the GroupRoom
 * socket ("changed" → refetch), a focus refetch, and a slow tick so the expiry countdown + going/here
 * tallies stay honest while the screen is open.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useGroupLive, type LoadStatus } from "./groups";
import type { MeetingPointDto } from "./types";

export interface MeetingPointsState {
  points: MeetingPointDto[];
  status: LoadStatus;
  reload: () => void;
}

/** Points move slower than presence; a 30s tick keeps the expiry countdown honest without spamming. */
const POINTS_TICK_MS = 30_000;

export function useMeetingPoints(groupId: string | undefined): MeetingPointsState {
  const [points, setPoints] = useState<MeetingPointDto[]>([]);
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
      .listMeetingPoints(groupId, controller.signal)
      .then((data) => {
        if (!alive) return;
        setPoints(data);
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

  // Slow tick keeps the expiry countdown + tallies current.
  useEffect(() => {
    if (!groupId) return;
    const id = setInterval(reload, POINTS_TICK_MS);
    return () => clearInterval(id);
  }, [groupId, reload]);

  useGroupLive(groupId, reload);

  return { points, status, reload };
}
