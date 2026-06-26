import { test, expect } from "./fixtures.js";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

// Phase 3 / Gate 3.2-3.3: stage-to-stage routing (#29 B7.4/B7.5). With no locked plan the screen
// runs in ad-hoc mode (origin/destination default to the first two stages, real coords from the
// live map API), so it deterministically exercises the picker, the walk-time sheet and the
// GPS-free walking guidance. The "leave by" math is covered by domain/route + domain/nowNext units.
test.describe("Phase 3 — stage routing", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((w1) => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    }, W1);
  });

  test("routes between two stages and toggles walking guidance", async ({ page }) => {
    await page.goto("/route");
    await expect(page.locator(".route-mins")).toContainText("min", { timeout: 20_000 });
    await expect(page.locator(".route-sub")).toContainText("walk to");
    await expect(page.locator('select[aria-label="From stage"]')).toBeVisible();
    await expect(page.locator('select[aria-label="To stage"]')).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase3-route.png" });

    await page.getByRole("button", { name: /Start walking/i }).click();
    await expect(page.locator(".route-head")).toContainText("Head to");
    await page.screenshot({ path: "e2e/screenshots/phase3-route-walking.png" });

    await page.getByRole("button", { name: "End walking" }).click();
    await expect(page.locator(".route-mins")).toBeVisible();
  });
});
