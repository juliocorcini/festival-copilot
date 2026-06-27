import { afterEach, describe, expect, it } from "vitest";
import { applyThemeColor, THEME_COLOR } from "./chrome";

function themeMeta(): HTMLMetaElement | null {
  return document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
}

afterEach(() => {
  themeMeta()?.remove();
});

describe("applyThemeColor (D11/DEC-088)", () => {
  it("creates the theme-color meta when missing and sets the palette color", () => {
    expect(themeMeta()).toBeNull();
    applyThemeColor("night");
    expect(themeMeta()?.content).toBe(THEME_COLOR.night);
  });

  it("reuses the existing meta (one tag, content updated) rather than duplicating it", () => {
    applyThemeColor("night");
    applyThemeColor("day");
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(themeMeta()?.content).toBe(THEME_COLOR.day);
  });

  it("keeps the bars matching the chrome: both palettes are the warm near-black base today", () => {
    // If a distinct day chrome ever lands, this is the single place that diverges (and this test flips).
    expect(THEME_COLOR.day).toBe("#0F0D09");
    expect(THEME_COLOR.night).toBe("#0F0D09");
  });
});
