/**
 * Default demo input: De Schorre stages from the map-import KML seed (DEC-021).
 * Shared by the CLI (`run.ts`) and the admin editor server so both prefill the
 * same venue. In production the admin map-editor produces this MapInput from pins.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MapInput } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));

interface SeedFeature {
  name: string;
  category: string;
  status: string;
  matchedStageName: string | null;
  geometry: { type: string; coordinates: [number, number] } | null;
}

/** Read the KML-seed stages (lng/lat) as a ready-to-generate MapInput. */
export function deSchorreInput(): MapInput {
  const seed = join(HERE, "..", "..", "map-import", "out", "imported-features.json");
  const stages = existsSync(seed)
    ? (JSON.parse(readFileSync(seed, "utf8")) as SeedFeature[])
        .filter((f) => f.category === "stage" && f.geometry?.type === "Point")
        .map((f) => ({
          name: f.matchedStageName ?? f.name,
          lng: f.geometry!.coordinates[0],
          lat: f.geometry!.coordinates[1],
          matched: f.status === "matched",
        }))
    : [];
  return {
    festivalId: "tomorrowland-deschorre",
    title: "De Schorre",
    subtitle: "Tomorrowland · Boom",
    stages,
    padMeters: 230,
    relief: "auto",
    reliefWidth: 3072,
  };
}
