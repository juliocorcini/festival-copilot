import { test, expect } from "./fixtures.js";

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

  // G7 / D14 (DEC-084): once a day is planned, the Lock-in button becomes "Edit plan" → My Plan.
  test("Lock-in button reflects the planned state of the day", async ({ page }) => {
    await page.goto("/timetable");
    await expect(page.locator(".tt-content .stage").first()).toBeVisible({ timeout: 20_000 });

    // Fresh day: the button is "Lock in".
    await expect(page.locator(".tt-lk")).toContainText("Lock in");

    // Build a plan: favorite a set, lock in, resolve any clashes.
    await page.locator(".set .heart").first().click();
    await page.locator(".tt-lk").click();
    await Promise.race([
      page.locator(".lk-clash-title").waitFor({ state: "visible", timeout: 20_000 }),
      page.locator(".celebrate-title").waitFor({ state: "visible", timeout: 20_000 }),
    ]);
    let guard = 0;
    while ((await page.locator(".lk-clash-title").count()) > 0 && guard++ < 40) {
      await page.locator(".lk-lock").click();
      await page.waitForTimeout(80);
    }
    await expect(page.locator(".celebrate-title")).toHaveText("LOCKED IN!", { timeout: 20_000 });
    await page.locator(".celebrate-actions .btn-primary", { hasText: "View My Plan" }).click();
    await expect(page.locator(".plan-tl")).toBeVisible({ timeout: 20_000 });

    // Navigate client-side back to the timetable (a full reload re-runs the seed init-script and would
    // wipe the just-built plan). The same day now reads "Edit plan" and routes to My Plan (D14).
    await page.locator(".nav .navitem", { hasText: "Timetable" }).click();
    await expect(page).toHaveURL(/\/timetable/);
    await expect(page.locator(".tt-lk.planned")).toContainText("Edit plan", { timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/g7-lockin-planned.png" });
    await page.locator(".tt-lk.planned").click();
    await expect(page).toHaveURL(/\/plan/);
    await expect(page.locator(".plan-tl")).toBeVisible({ timeout: 20_000 });
  });

  // G7 / D16: the "Your Favorites" section header collapses and re-opens its grid.
  test("collapses the Your Favorites section in the lineup", async ({ page }) => {
    await page.goto("/lineup");
    await expect(page.locator(".gc").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".grid")).toHaveCount(1); // all-artists only

    await page.locator(".gc-heart").first().click();
    const toggle = page.locator(".sec-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".grid")).toHaveCount(2); // favorites + all-artists

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".grid")).toHaveCount(1); // favorites grid collapsed
    await page.screenshot({ path: "e2e/screenshots/g7-favorites-collapsed.png" });

    await toggle.click(); // re-open
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".grid")).toHaveCount(2);
  });
});
