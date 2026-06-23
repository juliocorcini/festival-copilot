// Fetches the raw lineup payload from the official source: resolves the
// (event + uuid) reference from the page's __NEXT_DATA__, then downloads the
// config / stages / weekend CDN files. The reference is NEVER hardcoded.

import { cdnUrls, DEFAULT_CDN_BASE, resolveSourceRefLive, type LineupSourceRef } from "../lineup/resolver";
import type { SourceConfig } from "../lineup/types";

/** Raw (unparsed) payload — kept as text so we can hash it for change detection. */
export interface RawLineupPayload {
  ref: LineupSourceRef;
  configText: string;
  stagesText: string;
  weekendTexts: Array<{ name: string; text: string }>;
}

export interface LineupFetcher {
  fetchLineup(pageUrl: string): Promise<RawLineupPayload>;
}

/** Production fetcher: hits the live page + CDN over HTTP. */
export class HttpLineupFetcher implements LineupFetcher {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly cdnBase: string = DEFAULT_CDN_BASE
  ) {}

  async fetchLineup(pageUrl: string): Promise<RawLineupPayload> {
    const ref = await resolveSourceRefLive(pageUrl, this.fetchImpl);
    const urls = cdnUrls(ref, this.cdnBase);

    const configText = await this.getText(urls.config);
    const stagesText = await this.getText(urls.stages);

    const config = JSON.parse(configText) as SourceConfig;
    const weekendTexts: Array<{ name: string; text: string }> = [];
    for (const w of config.config.weekends) {
      weekendTexts.push({ name: w.name, text: await this.getText(urls.weekend(w.name)) });
    }

    return { ref, configText, stagesText, weekendTexts };
  }

  private async getText(url: string): Promise<string> {
    const res = await this.fetchImpl(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return await res.text();
  }
}
