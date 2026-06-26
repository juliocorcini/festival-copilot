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
    // Inject the animation-freeze CSS from the first document init (not via a post-goto addStyleTag),
    // so it's present before paint and survives an early reload — e.g. the service worker's
    // controllerchange → location.reload(), which otherwise destroyed the execution context that a
    // post-goto addStyleTag runs in ("Execution context was destroyed" flake, ~10% per goto).
    await page.addInitScript((css) => {
      const inject = () => {
        const style = document.createElement("style");
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inject, { once: true });
      } else {
        inject();
      }
    }, FREEZE);
  });

  test("renders the grid, favorites a set, filters and zooms", async ({ page }) => {
    await page.goto("/timetable");

    // Grid renders: stage rows + positioned set cards, with the hour lines always on (no toggle).
    await expect(page.locator(".tt-content .stage").first()).toBeVisible({ timeout: 20_000 });
    expect(await page.locator(".set").count()).toBeGreaterThan(0);
    await expect(page.locator(".tt-grid").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase2-timetable.png" });

    // Favoriting via a card heart turns it gold and flags its stage.
    await page.locator(".set .heart").first().click();
    await expect(page.locator(".set.fav").first()).toBeVisible();
    await expect(page.locator(".stage.has-fav").first()).toBeVisible();

    // "Only my favs" filter (icon button) hides non-favorite sets (still in DOM, but display:none).
    await page.getByRole("button", { name: "Show only my favorites" }).click();
    await expect(page.locator(".tt-content.filtered")).toBeVisible();
    await expect(page.locator(".set:not(.fav)").first()).toBeHidden();
    await expect(page.locator(".set.fav").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase2-timetable-favs.png" });

    // Turn the filter back off, then zoom from the 1h default → 2h narrows the grid width.
    await page.getByRole("button", { name: "Show only my favorites" }).click();
    const before = await page.locator(".tt-content").evaluate((el) => el.getBoundingClientRect().width);
    await page.getByRole("button", { name: "Zoom out to 2-hour view" }).click();
    const after = await page.locator(".tt-content").evaluate((el) => el.getBoundingClientRect().width);
    expect(after).toBeLessThan(before);
  });

  // DEC-049: the Lineup is discoverable in ≤1 tap from the Timetable via the segmented switch.
  test("reaches the Lineup in one tap via the Timetable⇄Lineup switch", async ({ page }) => {
    await page.goto("/timetable");
    await expect(page.locator(".tt-content .stage").first()).toBeVisible({ timeout: 20_000 });

    await page.locator(".view-switch .vs-seg", { hasText: "Lineup" }).click();

    await expect(page).toHaveURL(/\/lineup$/);
    await expect(page.locator(".lu-top .view", { hasText: "LINEUP" })).toBeVisible();
    // And back to the Timetable in one tap.
    await page.locator(".view-switch .vs-seg", { hasText: "Timetable" }).click();
    await expect(page).toHaveURL(/\/timetable$/);
  });
});
