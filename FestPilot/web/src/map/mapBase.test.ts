import { describe, expect, it } from "vitest";
import { mapBaseUrl } from "./mapBase";

describe("mapBaseUrl", () => {
  it("appends the -day suffix for the day palette", () => {
    expect(mapBaseUrl("tomorrowland-deschorre", "day")).toBe("/maps/tomorrowland-deschorre-day.webp");
  });

  it("uses the bare slug for the night palette", () => {
    expect(mapBaseUrl("tomorrowland-deschorre", "night")).toBe("/maps/tomorrowland-deschorre.webp");
  });

  it("interpolates the festival id verbatim", () => {
    expect(mapBaseUrl("other-fest", "night")).toBe("/maps/other-fest.webp");
    expect(mapBaseUrl("other-fest", "day")).toBe("/maps/other-fest-day.webp");
  });

  it("produces a path under the static /maps root for both palettes", () => {
    for (const palette of ["day", "night"] as const) {
      const url = mapBaseUrl("tomorrowland-deschorre", palette);
      expect(url.startsWith("/maps/")).toBe(true);
      expect(url.endsWith(".webp")).toBe(true);
    }
  });
});
