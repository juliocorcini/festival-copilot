import { test, expect } from "@playwright/test";

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
// Live Tomorrowland Belgium 2026 "W1" weekend id (stable D1 row) so the grid scopes to one weekend.
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

// Phase 2 / Gate 2.2: the TML-style timetable grid (#15e) — stages as rows, time as columns,
// dark-glass cards, gold favorites, per-card heart, "only my favs" filter and 1h/2h zoom.
test.describe("Phase 2 — timetable grid", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((w1) => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    }, W1);
  });

  test("renders the grid, favorites a set, filters and zooms", async ({ page }) => {
    await page.goto("/timetable");
    await page.addStyleTag({ content: FREEZE });

    // Grid renders: stage rows + positioned set cards.
    await expect(page.locator(".tt-content .stage").first()).toBeVisible({ timeout: 20_000 });
    expect(await page.locator(".set").count()).toBeGreaterThan(0);
    await page.screenshot({ path: "e2e/screenshots/phase2-timetable.png" });

    // Favoriting via a card heart turns it gold and flags its stage.
    await page.locator(".set .heart").first().click();
    await expect(page.locator(".set.fav").first()).toBeVisible();
    await expect(page.locator(".stage.has-fav").first()).toBeVisible();

    // "Only my favs" filter hides non-favorite sets (still in DOM, but display:none).
    await page.locator(".tt-toggle", { hasText: "Only my favs" }).click();
    await expect(page.locator(".tt-content.filtered")).toBeVisible();
    await expect(page.locator(".set:not(.fav)").first()).toBeHidden();
    await expect(page.locator(".set.fav").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase2-timetable-favs.png" });

    // Turn the filter back off, then zoom 2h → 1h changes the grid width.
    await page.locator(".tt-toggle", { hasText: "Only my favs" }).click();
    const before = await page.locator(".tt-content").evaluate((el) => el.getBoundingClientRect().width);
    await page.locator(".tt-toggle", { hasText: "view" }).click();
    const after = await page.locator(".tt-content").evaluate((el) => el.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before);
  });
});
