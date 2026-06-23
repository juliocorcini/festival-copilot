/**
 * Overpass (OpenStreetMap, ODbL) client — base geometry for any venue bbox.
 * Generalized from the map-svg spike; fetches via curl across mirrors with retry.
 */
import type { BBoxLngLat } from "./types.js";
import { curlPostForm } from "./http.js";

export function buildQuery(b: BBoxLngLat): string {
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

export function fetchOverpass(query: string): unknown {
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const buf = curlPostForm(url, "data=" + encodeURIComponent(query));
        const text = buf.toString("utf8");
        const json = JSON.parse(text) as { elements?: unknown[] };
        if (json && Array.isArray(json.elements)) return json;
        throw new Error(`no elements (${text.slice(0, 120)})`);
      } catch (e) {
        lastErr = e;
        console.warn(`  ! overpass ${url} attempt ${attempt}/2: ${String(e).slice(0, 120)}`);
      }
    }
  }
  throw lastErr;
}
