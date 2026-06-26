import { test, expect } from "@playwright/test";

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
// Live Tomorrowland Belgium 2026 "W1" weekend id (stable D1 row) so the day scopes to one weekend.
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

// Phase 2 / Gate 2.3: the full plan-building flow — favorite clashing acts on the timetable, then
// Lock in (#12c) resolves them one at a time, the celebration (#13) confirms, and My Plan (#21)
// renders the clash-free timeline.
test.describe("Phase 2 — lock-in clash resolver → my plan", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((w1) => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    }, W1);
  });

  test("resolves clashes and builds a clash-free My Plan", async ({ page }) => {
    await page.goto("/timetable");
    await page.addStyleTag({ content: FREEZE });
    await expect(page.locator(".tt-content .stage").first()).toBeVisible({ timeout: 20_000 });

    // Favorite the earliest sets across several stages — early sets overlap, guaranteeing clashes.
    const stages = page.locator(".tt-content .stage");
    const stageCount = Math.min(await stages.count(), 6);
    for (let s = 0; s < stageCount; s++) {
      const hearts = stages.nth(s).locator(".set .heart");
      const perStage = Math.min(await hearts.count(), 2);
      for (let k = 0; k < perStage; k++) await hearts.nth(k).click();
    }
    expect(await page.locator(".set.fav").count()).toBeGreaterThan(0);

    // Into the resolver.
    await page.locator(".tt-lk").click();
    await page.addStyleTag({ content: FREEZE });
    await Promise.race([
      page.locator(".lk-clash-title").waitFor({ state: "visible", timeout: 20_000 }),
      page.locator(".celebrate-title").waitFor({ state: "visible", timeout: 20_000 }),
    ]);

    // If a clash is up, exercise the overview + add sheets, then screenshot the clash UI.
    if (await page.locator(".lk-clash-title").count()) {
      await page.locator(".lk-link", { hasText: "All clashes" }).click();
      await expect(page.locator(".sheet .sheet-title", { hasText: "All clashes" })).toBeVisible();
      await page.locator(".sheet-x").click();

      await page.locator(".add-btn").click();
      await expect(page.locator(".sheet .sheet-title", { hasText: "Add an artist" })).toBeVisible();
      await page.locator(".sheet-x").click();

      await page.screenshot({ path: "e2e/screenshots/phase2-lockin-clash.png" });
    }

    // Undo / "what did I give up": locking a pick surfaces the give-up banner; undo steps back.
    if (await page.locator(".lk-clash-title").count()) {
      await page.locator(".lk-lock").click();
      await page.waitForTimeout(120);
      if (await page.locator(".lk-clash-title").count()) {
        await expect(page.locator(".lk-giveup")).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: "e2e/screenshots/phase2-lockin-giveup.png" });
        await page.locator(".lk-giveup-undo").click();
        await expect(page.locator(".lk-giveup")).toHaveCount(0);
      } else {
        // A single clash resolved straight to the celebration — undo lives there.
        await expect(page.locator(".lk-celebrate-undo")).toBeVisible({ timeout: 10_000 });
        await page.locator(".lk-celebrate-undo").click();
        await expect(page.locator(".lk-clash-title")).toBeVisible();
      }
    }

    // Resolve every clash by locking the pre-selected option until the celebration appears.
    let guard = 0;
    while ((await page.locator(".lk-clash-title").count()) > 0 && guard++ < 40) {
      await page.locator(".lk-lock").click();
      await page.waitForTimeout(80);
    }

    // Celebration.
    await expect(page.locator(".celebrate-title")).toHaveText("LOCKED IN!", { timeout: 20_000 });
    await expect(page.locator(".celebrate-row").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase2-lockin-done.png" });

    // View My Plan → timeline of locked sets (clash-free).
    await page.locator(".celebrate-actions .btn-primary", { hasText: "View My Plan" }).click();
    await expect(page).toHaveURL(/\/plan/);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.locator(".plan-tl")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".plan-card").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase2-myplan.png" });

    // Share my plan as a branded image: open the sheet, the poster previews, formats toggle, save.
    await page.locator(".ava-sm[aria-label='Share plan']").click();
    await expect(page.locator(".share-sheet")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".share-canvas")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase2-share-poster.png" });
    await page.locator(".share-format button", { hasText: "Square" }).click();
    await expect(page.locator(".share-canvas.square")).toBeVisible();
    await page.locator(".share-actions .btn-ghost", { hasText: "Save" }).click();
    await expect(page.locator(".share-note")).toHaveText("Saved to your device", { timeout: 15_000 });
  });
});
