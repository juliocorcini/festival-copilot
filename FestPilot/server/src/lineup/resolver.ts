// Resolve the lineup source reference (event + uuid) and build the CDN URLs.
// The reference is NEVER hardcoded: it is parsed from the official page's
// __NEXT_DATA__ (props.pageProps.doc.blocks[] -> block with type === "line-up").
// Ported from spikes/lineup-ingestion/src/resolver.ts.

export interface LineupSourceRef {
  event: string;
  uuid: string;
}

export const DEFAULT_CDN_BASE = "https://artist-lineup-cdn.tomorrowland.com";
export const DEFAULT_LINEUP_PAGE =
  "https://belgium.tomorrowland.com/en/line-up/?page=timetable";

interface LineupBlock {
  type?: string;
  event?: string;
  uuid?: string;
}

function isLineupRef(b: unknown): b is Required<Pick<LineupBlock, "event" | "uuid">> {
  const x = b as LineupBlock;
  return !!x && x.type === "line-up" && typeof x.event === "string" && typeof x.uuid === "string";
}

/** Deep fallback search for a {type:"line-up", event, uuid} object anywhere in the tree. */
function deepFindLineupRef(node: unknown): LineupSourceRef | null {
  if (!node || typeof node !== "object") return null;
  if (isLineupRef(node)) return { event: node.event, uuid: node.uuid };
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = deepFindLineupRef(value);
    if (found) return found;
  }
  return null;
}

/** Extract event+uuid from a parsed __NEXT_DATA__ object. */
export function extractSourceRef(nextData: unknown): LineupSourceRef {
  const blocks = (nextData as any)?.props?.pageProps?.doc?.blocks;
  if (Array.isArray(blocks)) {
    const block = blocks.find(isLineupRef);
    if (block) return { event: block.event, uuid: block.uuid };
  }
  const fallback = deepFindLineupRef(nextData);
  if (fallback) return fallback;
  throw new Error("No line-up block (type:'line-up' with event+uuid) found in __NEXT_DATA__");
}

/** Extract event+uuid from the raw HTML of the lineup page. */
export function extractSourceRefFromHtml(html: string): LineupSourceRef {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("No __NEXT_DATA__ script found on the page");
  return extractSourceRef(JSON.parse(m[1]!));
}

/** Build the CDN file URLs for a resolved source reference. */
export function cdnUrls(ref: LineupSourceRef, base: string = DEFAULT_CDN_BASE) {
  const { event, uuid } = ref;
  return {
    config: `${base}/config-${event}-${uuid}.json`,
    stages: `${base}/stages-${event}-${uuid}.json`,
    weekend: (weekendName: string) => `${base}/${event}-${weekendName}-${uuid}.json`,
  };
}

/**
 * Live resolution (production): fetch the page, parse __NEXT_DATA__, return the ref.
 * This is the exact production entry point used by the Worker ingestion.
 */
export async function resolveSourceRefLive(
  pageUrl: string = DEFAULT_LINEUP_PAGE,
  fetchImpl: typeof fetch = fetch
): Promise<LineupSourceRef> {
  const res = await fetchImpl(pageUrl, { headers: { accept: "text/html" } });
  if (!res.ok) throw new Error(`Lineup page returned ${res.status}`);
  return extractSourceRefFromHtml(await res.text());
}
