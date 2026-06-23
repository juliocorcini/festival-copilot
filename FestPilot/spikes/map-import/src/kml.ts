// Minimal KML parser: Placemarks -> ImportedFeature[] (GeoJSON, [lng, lat]).
// KMZ is just a zipped KML (read doc.kml); this seed is plain .kml so no unzip needed.

import { XMLParser } from "fast-xml-parser";
import type { Geometry, ImportedFeature } from "./types.js";

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false });

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** KML coordinate strings are "lng,lat[,alt] lng,lat[,alt] ..." (NOT lat,lng). */
function parseCoords(raw: string): Array<[number, number]> {
  return raw
    .trim()
    .split(/\s+/)
    .map((tok) => tok.split(",").map(Number))
    .filter((a) => a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]))
    .map((a) => [a[0] as number, a[1] as number] as [number, number]);
}

function geometryOf(pm: any): Geometry | null {
  const host = pm.MultiGeometry ?? pm;
  if (host.Point?.coordinates) {
    const [c] = parseCoords(String(host.Point.coordinates));
    return c ? { type: "Point", coordinates: c } : null;
  }
  if (host.Polygon?.outerBoundaryIs?.LinearRing?.coordinates) {
    const ring = parseCoords(String(host.Polygon.outerBoundaryIs.LinearRing.coordinates));
    return ring.length ? { type: "Polygon", coordinates: [ring] } : null;
  }
  if (host.LineString?.coordinates) {
    const pts = parseCoords(String(host.LineString.coordinates));
    return pts.length ? { type: "LineString", coordinates: pts } : null;
  }
  return null;
}

export function parseKml(kml: string): ImportedFeature[] {
  const parsed = parser.parse(kml);
  const doc = parsed?.kml?.Document ?? parsed?.kml ?? {};
  const out: ImportedFeature[] = [];
  let idx = 0;

  const handle = (pm: any, layer: string | null) => {
    const geometry = geometryOf(pm);
    if (!geometry) return;
    out.push({
      id: String(++idx),
      name: pm.name != null ? String(pm.name).trim() : "",
      description: pm.description != null ? String(pm.description) : null,
      layer,
      geometry,
    });
  };

  for (const pm of asArray<any>(doc.Placemark)) handle(pm, doc.name != null ? String(doc.name).trim() : null);
  for (const folder of asArray<any>(doc.Folder)) {
    const layer = folder.name != null ? String(folder.name).trim() : null;
    for (const pm of asArray<any>(folder.Placemark)) handle(pm, layer);
  }
  return out;
}
