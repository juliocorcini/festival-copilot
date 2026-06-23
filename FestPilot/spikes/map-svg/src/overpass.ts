/**
 * Overpass API client for the OSM base-geometry pull (DEC-031, layer A).
 * OSM data is © OpenStreetMap contributors, licensed ODbL — attribution required.
 */

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Build the Overpass QL query for everything we want to draw inside the bbox. */
export function buildQuery(b: BBox): string {
  const a = `(${b.south},${b.west},${b.north},${b.east})`;
  return `[out:json][timeout:90];
(
  way["natural"="water"]${a};
  relation["natural"="water"]${a};
  way["waterway"]${a};
  way["natural"="wood"]${a};
  way["landuse"="forest"]${a};
  way["natural"="scrub"]${a};
  way["natural"="grassland"]${a};
  way["landuse"="grass"]${a};
  way["landuse"="meadow"]${a};
  way["leisure"="park"]${a};
  relation["leisure"="park"]${a};
  way["leisure"="nature_reserve"]${a};
  relation["leisure"="nature_reserve"]${a};
  way["landuse"="recreation_ground"]${a};
  way["amenity"="parking"]${a};
  way["landuse"="parking"]${a};
  way["highway"~"^(footway|path|track|pedestrian|cycleway|steps)$"]${a};
  way["highway"~"^(service|residential|unclassified|tertiary|secondary|primary|living_street)$"]${a};
  way["building"]${a};
);
out body;
>;
out skel qt;`;
}

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const RETRYABLE = new Set([429, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST the query to Overpass, trying mirrors and retrying transient overload (504/429). */
export async function fetchOverpass(query: string): Promise<unknown> {
  let lastError: unknown;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(query),
        });
        if (RETRYABLE.has(res.status)) {
          console.warn(`  ! ${url} -> ${res.status}, retry ${attempt}/3`);
          await sleep(4000 * attempt);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (error) {
        lastError = error;
        console.warn(`  ! ${url} attempt ${attempt}/3 failed: ${String(error)}`);
        await sleep(2000);
      }
    }
  }
  throw lastError;
}
