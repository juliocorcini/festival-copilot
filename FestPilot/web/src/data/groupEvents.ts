/**
 * Group-event data layer (Phase 8 — fixed-time squad commitments, roadmap D2). `useGroupEvents`
 * reads the squad's upcoming + live events, kept fresh by the exact same contract as the rest of
 * Pillar 3: the GroupRoom socket ("changed" → refetch), a focus refetch, and a slow tick so the
 * countdown to each event stays honest while the screen is open. This is a layer ALONGSIDE the
 * squad plan — it never touches the set aggregation or any personal lock.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useGroupLive, type LoadStatus } from "./groups";
import type { GroupEventDto } from "./types";

export interface GroupEventsState {
  events: GroupEventDto[];
  status: LoadStatus;
  reload: () => void;
}

/** Events move slowly; a 30s tick keeps the countdown honest without spamming the network. */
const EVENTS_TICK_MS = 30_000;

export function useGroupEvents(groupId: string | undefined): GroupEventsState {
  const [events, setEvents] = useState<GroupEventDto[]>([]);
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
      .listGroupEvents(groupId, controller.signal)
      .then((data) => {
        if (!alive) return;
        setEvents(data);
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

  // Slow tick keeps the per-event countdown current.
  useEffect(() => {
    if (!groupId) return;
    const id = setInterval(reload, EVENTS_TICK_MS);
    return () => clearInterval(id);
  }, [groupId, reload]);

  useGroupLive(groupId, reload);

  return { events, status, reload };
}
