// Fetches the raw lineup payload from the official source: resolves the
// (event + uuid) reference from the page's __NEXT_DATA__, then downloads the
// config / stages / weekend CDN files. The reference is NEVER hardcoded.

import {
  BROWSER_HEADERS,
  cdnUrls,
  DEFAULT_CDN_BASE,
  resolveSourceRefLive,
  type LineupSourceRef,
} from "../lineup/resolver";
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
    private readonly cdnBase: string = DEFAULT_CDN_BASE,
    // Documented fallback chain (research §6): a saved event/uuid used ONLY when the page
    // is unreachable (e.g. WAF 403 on the Worker egress). The page is always tried first, so
    // a changed uuid is still detected when reachable — DEC-009 is preserved.
    private readonly fallbackRef: LineupSourceRef | null = null
  ) {}

  async fetchLineup(pageUrl: string): Promise<RawLineupPayload> {
    const ref = await this.resolveRef(pageUrl);
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

  /** Resolve from the page; on failure fall back to a saved ref if one is configured. */
  private async resolveRef(pageUrl: string): Promise<LineupSourceRef> {
    try {
      return await resolveSourceRefLive(pageUrl, this.fetchImpl);
    } catch (err) {
      if (this.fallbackRef) {
        console.warn(
          `[ingest] page resolve failed (${err instanceof Error ? err.message : String(err)}); ` +
            `using saved ref ${this.fallbackRef.event}/${this.fallbackRef.uuid}`
        );
        return this.fallbackRef;
      }
      throw err;
    }
  }

  private async getText(url: string): Promise<string> {
    // Call through a local ref so the global `fetch` keeps its `this` (a method call
    // `this.fetchImpl(...)` triggers a Workers "Illegal invocation").
    const doFetch = this.fetchImpl;
    const res = await doFetch(url, { headers: { ...BROWSER_HEADERS, accept: "application/json" } });
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return await res.text();
  }
}
