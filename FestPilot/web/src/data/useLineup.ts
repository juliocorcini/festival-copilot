/**
 * Loads the active festival + its lineup in one hook. The festival list rarely
 * changes, so we take the first festival (V1 is single-festival — DEC-038) and
 * fetch its lineup. Returns a small state machine the screens render against.
 */
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type LineupQuery } from "./api";
import type { LineupDto } from "./types";

export type LineupStatus = "loading" | "ready" | "error";

export interface LineupState {
  status: LineupStatus;
  lineup: LineupDto | null;
  error: string | null;
  reload: () => void;
}

export function useLineup(query: LineupQuery = {}): LineupState {
  const [status, setStatus] = useState<LineupStatus>("loading");
  const [lineup, setLineup] = useState<LineupDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const weekend = query.weekend;
  const day = query.day;

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const festivals = await api.listFestivals(controller.signal);
        const festival = festivals[0];
        if (!festival) throw new ApiError("No festival published yet", 404, "/api/festivals");
        const data = await api.getLineup(festival.id, { weekend, day }, controller.signal);
        if (!alive) return;
        setLineup(data);
        setStatus("ready");
      } catch (err) {
        if (!alive || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [weekend, day, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { status, lineup, error, reload };
}
