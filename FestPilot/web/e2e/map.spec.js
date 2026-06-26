import { test, expect } from "./fixtures.js";

// Phase 0 visual smoke: the De Schorre map base renders, the topbar shows the venue +
// stage count, the day/night segment is present, the stages are a crisp tappable vector overlay
// (DEC-050), and — with no squad — the map shows an HONEST empty state, never invented friends
// (DEC-051/058, R2.3). Freeze animations so the screenshot is stable.
test.describe("Phase 0 — map bring-up", () => {
  // Skip first-run onboarding so deep links render directly (Phase 2 gate).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    });
  });

  test("renders the georeferenced map with overlay and controls", async ({ page }) => {
    await page.goto("/map");
    const base = page.locator("img.base");
    await expect(base).toBeVisible();
    await expect.poll(async () => base.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);

    await expect(page.locator(".topbar .title strong")).toHaveText("De Schorre");
    await expect(page.locator(".topbar .title span")).toContainText("stages");
    await expect(page.locator(".seg button")).toHaveCount(3);

    // Stages are a crisp, tappable vector overlay (DEC-050) — not baked into the raster.
    await expect(page.locator("svg.overlay [role='button']").first()).toBeVisible();

    // No squad → an honest empty state, never invented friends (DEC-051/058).
    await expect(page.getByText(/Join a squad to see where everyone is/i)).toBeVisible();
    await expect(page.locator("svg.overlay text.me-lbl")).toHaveCount(0);

    await page.waitForTimeout(300);
    await page.screenshot({ path: "e2e/screenshots/phase0-map.png", fullPage: false });
  });
});
