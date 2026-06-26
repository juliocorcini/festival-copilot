import { test, expect } from "./fixtures.js";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

// R8: My Plan is editable without re-walking Lock-in. Build a clash-free plan, then remove / add /
// swap sets straight from the timeline — the zero-overlap math is proven by domain/planEdit unit tests.
test.describe("R8 — My Plan is editable (remove / add / swap), stays clash-free", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((w1) => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    }, W1);
  });

  test("removes, adds and swaps a set from the timeline", async ({ page }) => {
    // Build a plan: favorite a few sets across stages, lock in, view My Plan.
    await page.goto("/timetable");
    await expect(page.locator(".tt-content .stage").first()).toBeVisible({ timeout: 20_000 });
    const stages = page.locator(".tt-content .stage");
    const stageCount = Math.min(await stages.count(), 5);
    for (let s = 0; s < stageCount; s++) {
      const hearts = stages.nth(s).locator(".set .heart");
      if (await hearts.count()) await hearts.first().click();
    }

    await page.locator(".tt-lk").click();
    // Wait for the resolver to actually render before polling it. The lock-in screen shows a
    // LoadingState until the lineup is in hand (LockInScreen.tsx), so checking `.lk-clash-title`
    // immediately can read 0 and exit the loop before any clash appears — then the celebration
    // never comes. Same guard the stable lockin.spec uses.
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

    const before = await page.locator(".plan-card").count();
    expect(before).toBeGreaterThan(1);

    // Swap (best-effort: only if a non-clashing alternative exists around that slot). The card body
    // opens the artist sheet; the per-set menu (Swap / Remove / Map) opens from the more_vert button.
    await page.locator(".plan-state-ico-btn").first().click();
    await expect(page.locator(".sheet .sheet-title")).toBeVisible();
    await page.locator(".plan-menu-item", { hasText: "Swap set" }).click();
    await expect(page.locator(".sheet .sheet-title", { hasText: "Swap" })).toBeVisible();
    const swapRows = page.locator(".sheet .row");
    if (await swapRows.count()) {
      await swapRows.first().locator(".addpill").click();
      await expect(page.locator(".plan-card")).toHaveCount(before); // a swap keeps the set count
    } else {
      await page.locator(".sheet-x").click();
    }

    // Remove a set → the timeline drops exactly one card.
    await page.locator(".plan-state-ico-btn").first().click();
    await page.locator(".plan-menu-item", { hasText: "Remove from plan" }).click();
    await expect(page.locator(".plan-card")).toHaveCount(before - 1);
    await page.screenshot({ path: "e2e/screenshots/r8-myplan-removed.png" });

    // Add a fitting set back → only non-clashing acts are offered → count returns to `before`.
    await page.locator(".plan-chip", { hasText: "Add a set" }).click();
    await expect(page.locator(".sheet .sheet-title", { hasText: "Add a set" })).toBeVisible();
    const addRows = page.locator(".sheet .row");
    await expect(addRows.first()).toBeVisible({ timeout: 10_000 });
    await addRows.first().locator(".addpill").click();
    await expect(page.locator(".plan-card")).toHaveCount(before);
    await page.screenshot({ path: "e2e/screenshots/r8-myplan-added.png" });
  });
});
