import { test, expect } from "@playwright/test";

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

// Phase 3 / Gate 3.3: the Now & Next home (#18). Pre-festival it renders the lineup-driven hero
// (NEXT UP + a DOORS-IN day countdown) and the "Up next" list. The plan-driven LEAVE-IN hero is
// covered deterministically by domain/nowNext unit tests.
test.describe("Phase 3 — now & next home", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((w1) => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    }, W1);
  });

  test("renders the hero + up-next list", async ({ page }) => {
    await page.goto("/");
    await page.addStyleTag({ content: FREEZE });

    await expect(page.locator(".appbar h1")).toHaveText("Now & Next", { timeout: 20_000 });
    await expect(page.locator(".now-hero")).toBeVisible();
    await expect(page.locator(".now-title")).not.toBeEmpty();
    // Pre-festival: a DOORS-IN countdown and an Up-next list.
    await expect(page.locator(".now-hero .big-count")).toBeVisible();
    await expect(page.locator(".list-card .lineup-row").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase3-now.png" });
  });
});
