/**
 * Group board hook (Gate 4.4 — UC-39, DEC-013). Lightweight pinned notes; not chat. Same freshness
 * contract as the rest of Pillar 3a: a best-effort GroupRoom socket plus a refetch on focus, with
 * HTTP always authoritative. The DO fans out a "board" change; we simply re-fetch the list.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useGroupLive, type LoadStatus } from "./groups";
import type { BoardNoteDto } from "./types";

export interface BoardState {
  notes: BoardNoteDto[];
  status: LoadStatus;
  reload: () => void;
}

export function useBoard(groupId: string | undefined): BoardState {
  const [notes, setNotes] = useState<BoardNoteDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    api
      .getBoard(groupId, controller.signal)
      .then((list) => {
        if (!alive) return;
        setNotes(list);
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
  return { notes, status, reload };
}
