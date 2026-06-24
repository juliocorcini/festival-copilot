/**
 * Builds a real stage-to-stage walking matrix (DEC-011) by joining the lineup's stages to the
 * georeferenced coordinates published in the map doc, matched by normalized name. Until the map
 * loads — or for stages without published coords — `buildTravelMatrix` returns the flat fallback,
 * so callers always get a usable matrix and nothing regresses from the Phase-2 stub.
 */
import { useEffect, useMemo, useState } from "react";
import { buildTravelMatrix, type LatLng } from "../domain/travel";
import type { TravelMatrix } from "../domain/types";
import { api } from "./api";
import type { LineupDto } from "./types";

function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

export function useTravelMatrix(lineup: LineupDto | null): TravelMatrix {
  const [coords, setCoords] = useState<Map<string, LatLng>>(() => new Map());
  const festivalId = lineup?.festival.id;
  const stages = lineup?.stages;

  useEffect(() => {
    if (!festivalId || !stages) return;
    const controller = new AbortController();
    let alive = true;
    (async () => {
      try {
        const map = await api.getMap(festivalId, controller.signal);
        if (!alive) return;
        const byName = new Map<string, LatLng>();
        for (const stage of map.transform.stages) {
          if (stage.matched) byName.set(normalizeName(stage.name), { lat: stage.lat, lng: stage.lng });
        }
        const byId = new Map<string, LatLng>();
        for (const stage of stages) {
          const coord = byName.get(normalizeName(stage.name));
          if (coord) byId.set(stage.id, coord);
        }
        setCoords(byId);
      } catch {
        /* no map yet / offline → keep empty so the flat fallback applies */
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [festivalId, stages]);

  return useMemo(() => buildTravelMatrix(coords, { fallbackMinutes: 8 }), [coords]);
}
