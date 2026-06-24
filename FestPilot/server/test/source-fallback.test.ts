import { describe, expect, it } from "vitest";
import { HttpLineupFetcher } from "../src/ingest/source";

function json(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}

// Documented fallback chain (research §6): resolve from the page FIRST; only when the page
// is unreachable (e.g. a WAF 403 on the Worker egress) use the saved event/uuid.
describe("HttpLineupFetcher saved-ref fallback", () => {
  it("uses the saved ref + CDN when the page is blocked (403)", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("line-up")) return new Response("blocked", { status: 403 });
      if (String(url).includes("config-")) return json('{"config":{"weekends":[{"name":"W1"}]}}');
      return json("{}");
    }) as unknown as typeof fetch;

    const fetcher = new HttpLineupFetcher(fetchImpl, undefined, { event: "TL26BE", uuid: "U123" });
    const payload = await fetcher.fetchLineup("https://x/en/line-up/?page=timetable");

    expect(payload.ref).toEqual({ event: "TL26BE", uuid: "U123" });
    expect(calls.some((u) => u.includes("config-TL26BE-U123.json"))).toBe(true);
    expect(calls.some((u) => u.includes("TL26BE-W1-U123.json"))).toBe(true);
    expect(payload.weekendTexts).toHaveLength(1);
  });

  it("still prefers the page when reachable (uuid-change detection, DEC-009)", async () => {
    const html = `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { doc: { blocks: [{ type: "line-up", event: "TL26BE", uuid: "FRESH" }] } } },
    })}</script></head></html>`;
    const fetchImpl = (async (url: string) => {
      if (String(url).includes("line-up")) return new Response(html, { status: 200 });
      if (String(url).includes("config-")) return json('{"config":{"weekends":[]}}');
      return json("{}");
    }) as unknown as typeof fetch;

    const fetcher = new HttpLineupFetcher(fetchImpl, undefined, { event: "STALE", uuid: "STALE" });
    const payload = await fetcher.fetchLineup("https://x/en/line-up/?page=timetable");
    expect(payload.ref.uuid).toBe("FRESH");
  });

  it("throws when the page fails and no saved ref is configured", async () => {
    const fetchImpl = (async () => new Response("blocked", { status: 403 })) as unknown as typeof fetch;
    const fetcher = new HttpLineupFetcher(fetchImpl, undefined, null);
    await expect(fetcher.fetchLineup("https://x/en/line-up")).rejects.toThrow(/403/);
  });
});
