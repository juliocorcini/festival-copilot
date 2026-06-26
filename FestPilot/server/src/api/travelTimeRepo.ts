// R11.1c stage-to-stage travel-time matrix (DEC-065). Operator-curated walking minutes between a
// festival's stages, layered over the live coord-derived estimate (DEC-011): the client prefers a
// stored pair when present, else falls back to the geometric guess. Replace semantics like the POI
// editor; entries are deduped per directed pair so the (from,to) unique index never clashes.

import { ulid, type IdFactory } from "../db/ids";

export interface TravelTimeDto {
  fromStageId: string;
  toStageId: string;
  minutesTypical: number;
  minutesCrowded: number | null;
}

export type TravelTimeInput = TravelTimeDto;

interface TravelRow {
  from_stage_id: string;
  to_stage_id: string;
  minutes_typical: number;
  minutes_crowded: number | null;
}

export async function listTravelTimes(db: D1Database, festivalId: string): Promise<TravelTimeDto[]> {
  const res = await db
    .prepare(
      `SELECT from_stage_id, to_stage_id, minutes_typical, minutes_crowded
         FROM stage_travel_time WHERE festival_id = ?`
    )
    .bind(festivalId)
    .all<TravelRow>();
  return (res.results ?? []).map((r) => ({
    fromStageId: r.from_stage_id,
    toStageId: r.to_stage_id,
    minutesTypical: r.minutes_typical,
    minutesCrowded: r.minutes_crowded,
  }));
}

const MAX_MINUTES = 240;

/** Coerce a raw `{ times: [...] }` body into validated, deduped (directed-pair) inputs. */
export function readTravelTimeInputs(body: unknown): TravelTimeInput[] {
  const arr = Array.isArray((body as { times?: unknown } | null)?.times) ? (body as { times: unknown[] }).times : [];
  const byPair = new Map<string, TravelTimeInput>();
  for (const raw of arr) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const fromStageId = typeof o.fromStageId === "string" ? o.fromStageId : "";
    const toStageId = typeof o.toStageId === "string" ? o.toStageId : "";
    if (!fromStageId || !toStageId || fromStageId === toStageId) continue;
    const typical = Math.round(Number(o.minutesTypical));
    if (!Number.isFinite(typical) || typical < 0 || typical > MAX_MINUTES) continue;
    const crowdedRaw = o.minutesCrowded;
    const crowdedNum = crowdedRaw === null || crowdedRaw === undefined || crowdedRaw === "" ? NaN : Number(crowdedRaw);
    const minutesCrowded =
      Number.isFinite(crowdedNum) && crowdedNum >= 0 && crowdedNum <= MAX_MINUTES ? Math.round(crowdedNum) : null;
    byPair.set(`${fromStageId}|${toStageId}`, { fromStageId, toStageId, minutesTypical: typical, minutesCrowded });
  }
  return [...byPair.values()];
}

/** Replace the whole travel-time matrix for a festival (delete-all + insert). Returns the count stored. */
export async function replaceTravelTimes(
  db: D1Database,
  festivalId: string,
  times: TravelTimeInput[],
  idFactory: IdFactory = ulid
): Promise<number> {
  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM stage_travel_time WHERE festival_id = ?`).bind(festivalId),
  ];
  for (const t of times) {
    statements.push(
      db
        .prepare(
          `INSERT INTO stage_travel_time (id, festival_id, from_stage_id, to_stage_id, minutes_typical, minutes_crowded, source)
           VALUES (?, ?, ?, ?, ?, ?, 'manual')`
        )
        .bind(idFactory(), festivalId, t.fromStageId, t.toStageId, t.minutesTypical, t.minutesCrowded)
    );
  }
  await db.batch(statements);
  return times.length;
}
