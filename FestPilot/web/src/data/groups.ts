/**
 * Group data hooks (Pillar 3a — UC-16/17).
 *
 * The server is the source of truth. `useGroup` keeps the member list fresh two ways:
 *   1. a best-effort WebSocket to the group's GroupRoom Durable Object (instant fan-out), and
 *   2. a refetch when the tab regains focus (the reliable fallback if the socket is down).
 * The socket is purely an enhancement — the UI is fully correct on the HTTP path alone.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, groupSocketUrl } from "./api";
import type { GroupDto, GroupMemberDto } from "./types";

export type LoadStatus = "loading" | "ready" | "error";

export interface MyGroupsState {
  groups: GroupDto[];
  status: LoadStatus;
  reload: () => void;
}

export function useMyGroups(): MyGroupsState {
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    api
      .listMyGroups(controller.signal)
      .then((list) => {
        if (!alive) return;
        setGroups(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive || controller.signal.aborted) return;
        setStatus("error");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { groups, status, reload };
}

export interface GroupState {
  group: GroupDto | null;
  members: GroupMemberDto[];
  status: LoadStatus;
  reload: () => void;
}

export function useGroup(groupId: string | undefined): GroupState {
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    api
      .getGroup(groupId, controller.signal)
      .then((data) => {
        if (!alive) return;
        setGroup(data.group);
        setMembers(data.members);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive || controller.signal.aborted) return;
        setStatus("error");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [groupId, nonce]);

  // Refetch when the tab regains focus (reliable refresh after backgrounding).
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

  useGroupLive(groupId, reload);

  return { group, members, status, reload };
}

/** Best-effort realtime: connect to the GroupRoom socket and reload on any "changed" event. */
export function useGroupLive(groupId: string | undefined, onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!groupId || typeof WebSocket === "undefined") return;
    let ws: WebSocket | null = null;
    let closedByUs = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = (): void => {
      try {
        ws = new WebSocket(groupSocketUrl(groupId));
      } catch {
        return; // socket unavailable; focus-refetch still covers updates
      }
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string" && ev.data.includes("changed")) onChangeRef.current();
      };
      ws.onclose = () => {
        if (closedByUs) return;
        retry = setTimeout(connect, 4000); // single lazy reconnect loop
      };
    };
    connect();

    return () => {
      closedByUs = true;
      if (retry) clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
    };
  }, [groupId]);
}
