/**
 * Loads a festival's points of interest (DEC-065) for the map layer. Keyed by the festival ULID
 * (the same id the lineup + travel matrix use), so a freshly onboarded festival shows its POIs as
 * soon as the operator publishes them. A missing/offline read yields an empty list — the map simply
 * draws no amenity layer, never an error.
 */
import { useEffect, useState } from "react";
import { api } from "./api";
import type { PoiDto } from "./types";

export function usePois(festivalId: string | undefined): PoiDto[] {
  const [pois, setPois] = useState<PoiDto[]>([]);

  useEffect(() => {
    if (!festivalId) {
      setPois([]);
      return;
    }
    const controller = new AbortController();
    let alive = true;
    api
      .listPois(festivalId, controller.signal)
      .then((list) => alive && setPois(list))
      .catch(() => alive && setPois([]));
    return () => {
      alive = false;
      controller.abort();
    };
  }, [festivalId]);

  return pois;
}
