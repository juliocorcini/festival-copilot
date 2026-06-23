// Spike runner: proves the full pipeline offline against real fixtures.
//   resolve event+uuid (from __NEXT_DATA__)  ->  build CDN URLs
//   load config / stages / weekend files     ->  normalize
//   validate + sample queries + clash demo
//
// Run: npm start   (tsx src/run.ts)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cdnUrls, extractSourceRef } from "./resolver.js";
import { buildNormalizedLineup, overlaps } from "./normalize.js";
import type { Performance, SourceConfig, SourceStages, SourceWeekendFile } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, "..", "fixtures");
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(FIX, file), "utf-8")) as T;
const line = (s = "") => console.log(s);
const h = (s: string) => line(`\n${"=".repeat(3)} ${s} ${"=".repeat(Math.max(0, 60 - s.length))}`);

// 1) RESOLVE — parse __NEXT_DATA__ for event+uuid (never hardcoded)
h("1. RESOLVE event + uuid from __NEXT_DATA__");
const nextData = readJson<unknown>("__NEXT_DATA__.json");
const ref = extractSourceRef(nextData);
line(`event = ${ref.event}`);
line(`uuid  = ${ref.uuid}`);
const urls = cdnUrls(ref);
line("Derived CDN URLs:");
line(`  config : ${urls.config}`);
line(`  stages : ${urls.stages}`);
line(`  W1     : ${urls.weekend("W1")}`);
line(`  W2     : ${urls.weekend("W2")}`);

// 2) LOAD — the JSON those URLs return (here from fixtures captured in the HAR)
const cdnFile = (basename: string) => `artist-lineup-cdn.tomorrowland.com_${basename}`;
const config = readJson<SourceConfig>(cdnFile(`config-${ref.event}-${ref.uuid}.json`));
const stages = readJson<SourceStages>(cdnFile(`stages-${ref.event}-${ref.uuid}.json`));
const weekendFiles = config.config.weekends.map((w) => ({
  name: w.name,
  file: readJson<SourceWeekendFile>(cdnFile(`${ref.event}-${w.name}-${ref.uuid}.json`)),
}));

// 3) NORMALIZE
h("2. NORMALIZE");
const lineup = buildNormalizedLineup({ event: ref.event, uuid: ref.uuid, config, stages, weekendFiles });
line(`timezone           : ${lineup.timezone}`);
line(`weekends           : ${lineup.weekends.map((w) => `${w.name} (${w.startDate} -> ${w.endDate})`).join(", ")}`);
line(`stages             : ${lineup.stages.length}`);
line(`performances total : ${lineup.performances.length}`);

// 4) VALIDATE — the quirks the research doc warned about
h("3. VALIDATE (the tricky bits)");
const fixedCount = lineup.performances.filter((p) => p.endTimeFixed).length;
const midnightCount = lineup.performances.filter((p) => p.crossesMidnight).length;
const placeholders = lineup.performances.filter((p) => p.isPlaceholder).length;
line(`+1s end-time quirk corrected : ${fixedCount} / ${lineup.performances.length}`);
line(`midnight-crossing sets       : ${midnightCount}`);
line(`"More to be announced" slots : ${placeholders}`);

const stageIds = new Set(lineup.stages.map((s) => s.sourceId));
const orphanStageIds = new Set(
  lineup.performances.filter((p) => !stageIds.has(p.stageId)).map((p) => `${p.stageId} (${p.stageName})`)
);
line(`performances on unknown stages: ${orphanStageIds.size}${orphanStageIds.size ? " -> " + [...orphanStageIds].join(", ") : ""}`);

const byWeekendDay = new Map<string, number>();
for (const p of lineup.performances) {
  const key = `${p.weekend} / ${p.festivalDay}`;
  byWeekendDay.set(key, (byWeekendDay.get(key) ?? 0) + 1);
}
line("performances per weekend/day:");
for (const [k, v] of [...byWeekendDay.entries()].sort()) line(`  ${k.padEnd(18)} ${v}`);

// show a real corrected example
const example = lineup.performances.find((p) => p.endTimeFixed && !p.isPlaceholder);
if (example) {
  h("Example: +1s correction in action");
  line(`${example.name} @ ${example.stageName}`);
  line(`  raw end : ${example.rawEndTime}`);
  line(`  fixed   : ${example.endAt.toISOString()} (UTC) — ${example.durationMinutes} min set`);
}

// 5) SAMPLE QUERY — answer the exact question Julio asked earlier, from structured data
h('4. QUERY: "Who plays at ELIXIR on FRIDAY (W1)?"');
const elixirFriday = lineup.performances
  .filter((p) => p.weekend === "W1" && p.festivalDay === "FRIDAY" && /ELIXIR/i.test(p.stageName) && !p.isPlaceholder)
  .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
for (const p of elixirFriday) {
  line(`  ${p.rawStartTime.slice(11, 16)}-${p.rawEndTime.slice(11, 16)}  ${p.name}`);
}
if (!elixirFriday.length) line("  (no announced acts yet for this stage/day)");

// 6) CLASH DEMO — the heart of Pillar 2, on real data
h("5. CLASH DEMO (Pillar 2): favorites on FRIDAY W1");
const fridayReal = lineup.performances.filter(
  (p) => p.weekend === "W1" && p.festivalDay === "FRIDAY" && !p.isPlaceholder
);
// pick a few well-known acts as a fake "favorites" set, falling back to the first few
const wanted = ["Charlotte de Witte", "Martin Garrix", "Amelie Lens", "ARTBAT", "KETTAMA", "Adam Beyer"];
let favorites = fridayReal.filter((p) => wanted.some((w) => p.name.toLowerCase().includes(w.toLowerCase())));
if (favorites.length < 4) favorites = fridayReal.slice(0, 8);
line(`favorited acts (${favorites.length}):`);
for (const p of favorites) {
  line(`  ${p.rawStartTime.slice(11, 16)}-${p.rawEndTime.slice(11, 16)}  ${p.name.padEnd(28)} @ ${p.stageName}`);
}
const clashes: Array<[Performance, Performance]> = [];
for (let i = 0; i < favorites.length; i++) {
  for (let j = i + 1; j < favorites.length; j++) {
    if (overlaps(favorites[i]!, favorites[j]!)) clashes.push([favorites[i]!, favorites[j]!]);
  }
}
line(`\ndetected clashes: ${clashes.length}`);
for (const [a, b] of clashes) {
  line(`  ⚔ ${a.name} (${a.stageName}) overlaps ${b.name} (${b.stageName})`);
}

h("DONE — pipeline validated end-to-end on real data");
