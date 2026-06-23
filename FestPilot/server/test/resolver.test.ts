import { describe, expect, it } from "vitest";

import { cdnUrls, extractSourceRef } from "../src/lineup/resolver";
import { fixtureRef, loadFixtureText } from "./fixtures";

describe("resolver", () => {
  it("extracts event + uuid from the real __NEXT_DATA__ fixture", () => {
    const ref = fixtureRef();
    expect(ref.event).toBe("TL26BE");
    expect(ref.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("builds the CDN URLs from a resolved ref", () => {
    const ref = fixtureRef();
    const urls = cdnUrls(ref);
    expect(urls.config).toBe(
      `https://artist-lineup-cdn.tomorrowland.com/config-${ref.event}-${ref.uuid}.json`
    );
    expect(urls.weekend("W1")).toContain(`/${ref.event}-W1-${ref.uuid}.json`);
  });

  it("never relies on a hardcoded ref — parses it from the page each time", () => {
    const parsed = extractSourceRef(JSON.parse(loadFixtureText("__NEXT_DATA__.json")));
    expect(parsed).toEqual(fixtureRef());
  });

  it("throws when no line-up block is present", () => {
    expect(() => extractSourceRef({ props: { pageProps: { doc: { blocks: [] } } } })).toThrow();
  });
});
