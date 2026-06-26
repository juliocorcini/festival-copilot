/**
 * Builds a real stage-to-stage walking matrix (DEC-011) by joining the lineup's stages to the
 * georeferenced coordinates published in the map doc, matched by normalized name. On top of that,
 * operator-curated pairs (DEC-065) override the geometric estimate for the paths the admin measured.
 * Until anything loads — or for stages with neither an override nor coords — `buildTravelMatrix`
 * returns the flat fallback, so callers always get a usable matrix and nothing regresses.
 */
import { useEffect, useMemo, useState } from "react";
import { buildTravelMatrix, travelPairKey, type LatLng } from "../domain/travel";
import type { TravelMatrix } from "../domain/types";
import { api } from "./api";
import type { LineupDto } from "./types";

function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

export function useTravelMatrix(lineup: LineupDto | null): TravelMatrix {
  const [coords, setCoords] = useState<Map<string, LatLng>>(() => new Map());
  const [overrides, setOverrides] = useState<Map<string, number>>(() => new Map());
  const festivalId = lineup?.festival.id;
  const stages = lineup?.stages;

  useEffect(() => {
    if (!festivalId || !stages) return;
    const controller = new AbortController();
    let alive = true;
    (async () => {
      // Both reads are independent (guidelines §2.5): fetch coords + operator overrides together.
      const [mapResult, timesResult] = await Promise.allSettled([
        api.getMap(festivalId, controller.signal),
        api.listTravelTimes(festivalId, controller.signal),
      ]);
      if (!alive) return;

      if (mapResult.status === "fulfilled") {
        const byName = new Map<string, LatLng>();
        for (const stage of mapResult.value.transform.stages) {
          if (stage.matched) byName.set(normalizeName(stage.name), { lat: stage.lat, lng: stage.lng });
        }
        const byId = new Map<string, LatLng>();
        for (const stage of stages) {
          const coord = byName.get(normalizeName(stage.name));
          if (coord) byId.set(stage.id, coord);
        }
        setCoords(byId);
      }

      if (timesResult.status === "fulfilled") {
        const byPair = new Map<string, number>();
        for (const t of timesResult.value) {
          byPair.set(travelPairKey(t.fromStageId, t.toStageId), t.minutesTypical);
        }
        setOverrides(byPair);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [festivalId, stages]);

  return useMemo(() => buildTravelMatrix(coords, { fallbackMinutes: 8, overrides }), [coords, overrides]);
}
