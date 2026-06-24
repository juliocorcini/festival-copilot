/**
 * CLI for the FestPilot map generator (DEC-033).
 *
 *   npm start                       # reproduces De Schorre from the KML seed (DEC-021)
 *   npm start -- config/<x>.json    # generate for any venue from an input config
 *   REFRESH=1 npm start             # refetch OSM + relief (otherwise cached)
 *
 * This proves the productized pipeline: give it an input, it returns exactly the
 * beautiful, georeferenced map — no matter the location.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { generateMap } from "./generate.js";
import { deSchorreInput } from "./seed.js";
import type { MapInput } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "out");
const FONT_DIR = join(HERE, "..", "fonts");
const fontFiles = [join(FONT_DIR, "Oswald.ttf"), join(FONT_DIR, "AlbertSans.ttf")].filter(existsSync);

function main(): void {
  const configArg = process.argv.slice(2).find((a) => a.endsWith(".json"));
  const input: MapInput = configArg
    ? (JSON.parse(readFileSync(resolve(configArg), "utf8")) as MapInput)
    : deSchorreInput();

  console.log(`FestPilot map generator (DEC-033) — ${input.festivalId}, ${input.stages.length} stages\n`);
  const res = generateMap(input, OUT, {
    fontFiles,
    refresh: !!process.env["REFRESH"],
    // The app ships a label-free base (DEC-050): stages are a crisp, tappable vector overlay.
    bakeStageMarkers: !process.env["NO_STAGE_MARKERS"],
    log: (m) => console.log(m),
  });
  console.log(`\n  wrote ${res.files.length} files to out/:\n    ${res.files.join("\n    ")}\n`);
}

main();
