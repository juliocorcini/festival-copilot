import { test, expect } from "@playwright/test";

// Phase 0 visual smoke: the De Schorre map base renders, the topbar shows the venue +
// stage count, the day/night segment is present, and the live overlay (you/friends/meeting)
// is placed through the affine. Freeze animations so the screenshot is stable.
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
    await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important}` });

    const base = page.locator("img.base");
    await expect(base).toBeVisible();
    await expect.poll(async () => base.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);

    await expect(page.locator(".topbar .title strong")).toHaveText("De Schorre");
    await expect(page.locator(".topbar .title span")).toContainText("stages");
    await expect(page.locator(".seg button")).toHaveCount(3);

    // Live overlay seeded deterministically: "You" + at least one named friend.
    await expect(page.locator("svg.overlay text.me-lbl")).toHaveText("You");
    await expect(page.locator(".friends-sheet li").first()).toBeVisible();

    await page.waitForTimeout(300);
    await page.screenshot({ path: "e2e/screenshots/phase0-map.png", fullPage: false });
  });
});
