// R11.1c POI registry (DEC-065). Points of interest a festival-goer needs on the map — toilets,
// water, food, medical, exits, etc. Coordinates are real-world (lng/lat); the client drops them on
// the illustration through the same affine the stages use. The editor saves the whole set at once
// (replace semantics), mirroring the map editor's save-the-doc simplicity.

import { ulid, type IdFactory } from "../db/ids";

export const POI_TYPES = [
  "toilet",
  "water",
  "food",
  "medical",
  "exit",
  "atm",
  "charging",
  "locker",
  "entrance",
  "landmark",
] as const;
export type PoiType = (typeof POI_TYPES)[number];

export function isPoiType(v: unknown): v is PoiType {
  return typeof v === "string" && (POI_TYPES as readonly string[]).includes(v);
}

export interface PoiDto {
  id: string;
  type: PoiType;
  name: string | null;
  lng: number;
  lat: number;
  verified: boolean;
}

export interface PoiInput {
  type: PoiType;
  name: string | null;
  lng: number;
  lat: number;
  verified: boolean;
}

interface PoiRow {
  id: string;
  type: string;
  name: string | null;
  lat: number;
  lng: number;
  verified: number;
}

export async function listPois(db: D1Database, festivalId: string): Promise<PoiDto[]> {
  const res = await db
    .prepare(`SELECT id, type, name, lat, lng, verified FROM poi WHERE festival_id = ? ORDER BY type, name`)
    .bind(festivalId)
    .all<PoiRow>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    type: isPoiType(r.type) ? r.type : "landmark",
    name: r.name,
    lng: r.lng,
    lat: r.lat,
    verified: r.verified === 1,
  }));
}

/** Coerce a raw `{ pois: [...] }` body into validated inputs; silently drops malformed entries. */
export function readPoiInputs(body: unknown): PoiInput[] {
  const arr = Array.isArray((body as { pois?: unknown } | null)?.pois) ? (body as { pois: unknown[] }).pois : [];
  const out: PoiInput[] = [];
  for (const raw of arr) {
    const o = (raw ?? {}) as Record<string, unknown>;
    if (!isPoiType(o.type)) continue;
    const lng = Number(o.lng);
    const lat = Number(o.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const name = typeof o.name === "string" && o.name.trim() !== "" ? o.name.trim().slice(0, 80) : null;
    out.push({ type: o.type, name, lng, lat, verified: o.verified === true });
  }
  return out;
}

/** Replace the whole POI set for a festival (delete-all + insert). Returns the number stored. */
export async function replacePois(
  db: D1Database,
  festivalId: string,
  pois: PoiInput[],
  idFactory: IdFactory = ulid
): Promise<number> {
  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM poi WHERE festival_id = ?`).bind(festivalId),
  ];
  for (const p of pois) {
    statements.push(
      db
        .prepare(
          `INSERT INTO poi (id, festival_id, type, name, lat, lng, source, verified)
           VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)`
        )
        .bind(idFactory(), festivalId, p.type, p.name, p.lat, p.lng, p.verified ? 1 : 0)
    );
  }
  await db.batch(statements);
  return pois.length;
}
