/**
 * Meeting-point data layer (Phase 6 — UC-27, DEC-014/046/047). `useMeetingPoints` reads the squad's
 * active "come to me" points, kept fresh by the same contract as the rest of Pillar 3: the GroupRoom
 * socket ("changed" → refetch), a focus refetch, and a slow tick so the expiry countdown + going/here
 * tallies stay honest while the screen is open.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
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

export interface MeetingPointState {
  point: MeetingPointDto | null;
  status: LoadStatus;
  reload: () => void;
}

/**
 * One meeting point with its full convergence roster (#26.3), kept fresh by the same contract as the
 * list: the GroupRoom socket, a focus refetch, and a slow tick so ETAs + the expiry countdown stay
 * honest while the detail is open. A 404 (ended/purged) resolves to `point: null`, status "ready".
 */
export function useMeetingPoint(groupId: string | undefined, mpId: string | undefined): MeetingPointState {
  const [point, setPoint] = useState<MeetingPointDto | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const hasData = useRef(false);

  useEffect(() => {
    if (!groupId || !mpId) return;
    const controller = new AbortController();
    let alive = true;
    if (!hasData.current) setStatus("loading");
    api
      .getMeetingPoint(groupId, mpId, controller.signal)
      .then((data) => {
        if (!alive) return;
        setPoint(data);
        hasData.current = true;
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!alive || controller.signal.aborted) return;
        // A 404 means the point ended or was purged — show the empty state, not an error.
        if (err instanceof ApiError && err.status === 404) {
          setPoint(null);
          hasData.current = true;
          setStatus("ready");
          return;
        }
        if (!hasData.current) setStatus("error");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [groupId, mpId, nonce]);

  useEffect(() => {
    if (!groupId || !mpId) return;
    const onFocus = (): void => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const id = setInterval(reload, POINTS_TICK_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(id);
    };
  }, [groupId, mpId, reload]);

  useGroupLive(groupId, reload);

  return { point, status, reload };
}

/** Safety convergence is urgent — refresh ETAs a little faster than regular points. */
const SAFETY_TICK_MS = 15_000;

export interface SafetyState {
  points: MeetingPointDto[];
  status: LoadStatus;
  reload: () => void;
}

/**
 * The squad's active safety broadcasts (Gate 6.3 #26.5/#26.6), kept fresh by the same contract as the
 * rest of Pillar 3 (socket → refetch, focus refetch, fast tick). Drives both the "I'm lost" entry's
 * active state and the squad-home safety banner. Empty array = nobody's broadcasting right now.
 */
export function useSafety(groupId: string | undefined): SafetyState {
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
      .listSafetyPoints(groupId, controller.signal)
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

  useEffect(() => {
    if (!groupId) return;
    const onFocus = (): void => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const id = setInterval(reload, SAFETY_TICK_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(id);
    };
  }, [groupId, reload]);

  useGroupLive(groupId, reload);

  return { points, status, reload };
}
