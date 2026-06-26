import { test, expect } from "./fixtures.js";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

// Phase 3 / Gate 3.3: the offline cache/sync contract (#28 B6.5). Surfaces what's cached for
// no-signal use and primes the lineup + map caches via the service worker on demand.
test.describe("Phase 3 — offline & data", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((w1) => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    }, W1);
  });

  test("lists cacheable data and saves it for offline", async ({ page }) => {
    await page.goto("/settings/offline");
    await expect(page.locator(".appbar h1")).toHaveText("Offline & data", { timeout: 20_000 });
    await expect(page.getByText("Lineup", { exact: true })).toBeVisible();
    await expect(page.getByText("Venue map", { exact: true })).toBeVisible();
    await expect(page.getByText("Map artwork", { exact: true })).toBeVisible();

    const prime = page.getByRole("button", { name: /Make available offline|Refresh offline data/ });
    await expect(prime).toBeEnabled({ timeout: 20_000 });
    await prime.click();
    await expect(page.getByText("Saved for offline")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase3-offline.png" });
  });
});
