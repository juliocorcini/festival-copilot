import { test, expect } from "@playwright/test";

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

// Phase 4 / Gate 4.1: identity. Empty Squad → sign-in (guest, DEC-039 no Apple) → profile
// (name + dot colour, DEC-039 profile-at-first-join) → signed-in "ready" state. Hits the live
// anonymous /api/me (creates an anonymous app_user behind the getUserFromRequest seam).
test.describe("Phase 4 — squad identity", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((w1) => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    }, W1);
  });

  test("empty → sign in as guest → set profile → ready", async ({ page }) => {
    await page.goto("/squad");
    await page.addStyleTag({ content: FREEZE });

    // 1 · empty hero
    await expect(page.getByRole("heading", { name: "Festivals are better together" })).toBeVisible({
      timeout: 20_000,
    });
    await page.screenshot({ path: "e2e/screenshots/phase4-squad-empty.png" });
    await page.getByRole("button", { name: "Create a squad" }).click();

    // 2 · sign-in gate
    await expect(page.getByRole("heading", { name: "Keep your squad across devices" })).toBeVisible();
    await page.getByRole("button", { name: /Continue as guest/ }).click();

    // 3 · profile setup
    await expect(page.getByRole("heading", { name: "How should the squad see you?" })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator("#display-name").fill("Julio");
    await page.getByRole("button", { name: "Color #0EA5E9" }).click();
    await page.screenshot({ path: "e2e/screenshots/phase4-profile.png" });
    await page.getByRole("button", { name: "Continue" }).click();

    // 4 · ready state on the Squad tab
    await expect(page.getByText("Hey, Julio", { exact: false })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase4-squad-ready.png" });
  });
});
