// Loads the validated lineup fixtures captured in the spike (real TL26BE HAR)
// and builds the RawLineupPayload the ingestion pipeline consumes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractSourceRef, type LineupSourceRef } from "../src/lineup/resolver";
import type { SourceConfig } from "../src/lineup/types";
import type { LineupFetcher, RawLineupPayload } from "../src/ingest/source";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, "..", "..", "spikes", "lineup-ingestion", "fixtures");

export function loadFixtureText(name: string): string {
  return fs.readFileSync(path.join(FIX, name), "utf-8");
}

/** The CDN files were saved as `artist-lineup-cdn.tomorrowland.com_<basename>`. */
const cdnFixture = (basename: string): string => `artist-lineup-cdn.tomorrowland.com_${basename}`;

export function fixtureRef(): LineupSourceRef {
  return extractSourceRef(JSON.parse(loadFixtureText("__NEXT_DATA__.json")));
}

export interface FixturePayloadOptions {
  /** Mutate a weekend file's raw text (used to simulate a lineup change). */
  weekendTransform?: (name: string, text: string) => string;
}

export function buildFixturePayload(options: FixturePayloadOptions = {}): RawLineupPayload {
  const ref = fixtureRef();
  const configText = loadFixtureText(cdnFixture(`config-${ref.event}-${ref.uuid}.json`));
  const stagesText = loadFixtureText(cdnFixture(`stages-${ref.event}-${ref.uuid}.json`));
  const config = JSON.parse(configText) as SourceConfig;

  const weekendTexts = config.config.weekends.map((w) => {
    let text = loadFixtureText(cdnFixture(`${ref.event}-${w.name}-${ref.uuid}.json`));
    if (options.weekendTransform) text = options.weekendTransform(w.name, text);
    return { name: w.name, text };
  });

  return { ref, configText, stagesText, weekendTexts };
}

/** A LineupFetcher that returns a fixed (fixture) payload — no network. */
export class FixtureLineupFetcher implements LineupFetcher {
  constructor(private readonly payload: RawLineupPayload) {}
  async fetchLineup(): Promise<RawLineupPayload> {
    return this.payload;
  }
}
