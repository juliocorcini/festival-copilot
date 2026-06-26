import { test, expect } from "./fixtures.js";

// Phase 1 smoke: the PWA shell boots, the bottom nav has exactly 5 tabs, the Now screen
// renders the LIVE lineup from the API, tab navigation works, and Settings is reachable
// from the header avatar (no 6th tab — DEC-032).
test.describe("Phase 1 — app shell", () => {
  // Skip first-run onboarding so the shell renders directly (Phase 2 gate).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "fp.store.v1",
        JSON.stringify({ v: 1, onboarding: { festivalId: "x", weekendIds: [], dayKeys: [], completed: true }, favorites: {}, plans: {} })
      );
    });
  });

  test("boots, renders live lineup, navigates tabs, opens settings", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".appbar h1")).toHaveText("Now & Next");
    await expect(page.locator(".nav .navitem")).toHaveCount(5);

    // With no favorites/plan seeded, the Now screen shows its honest empty state with a way forward
    // (R6 — never an arbitrary hero). Live data is proven on the Timetable grid below.
    await expect(page.getByRole("heading", { name: "Pick the acts you can't miss" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".state .btn-primary", { hasText: "Browse the lineup" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase1-now.png", fullPage: false });

    // Tab navigation + live data path: the Timetable grid (Gate 2.2) renders its header and real stages.
    await page.locator(".nav .navitem", { hasText: "Timetable" }).click();
    // The Timetable header is an eyebrow (festival name + "TIMETABLE" view tag), not an <h1>.
    await expect(page.locator(".tt-top .view")).toHaveText("TIMETABLE");
    await expect(page.locator(".tt-content .stage").first()).toBeVisible({ timeout: 20_000 });

    await page.locator(".nav .navitem", { hasText: "Map" }).click();
    await expect(page.locator("img.base")).toBeVisible({ timeout: 15_000 });

    // Settings stack via the header avatar's profile menu (Now screen) — no bottom nav there (R9.6).
    await page.locator(".nav .navitem", { hasText: "Now" }).click();
    await page.locator(".ava").click();
    await page.locator(".ava-menu-item", { hasText: "Settings" }).click();
    await expect(page.locator(".appbar h1")).toHaveText("Settings");
    await expect(page.getByText("Appearance & language")).toBeVisible();
    await expect(page.locator(".nav")).toHaveCount(0);
    await page.screenshot({ path: "e2e/screenshots/phase1-settings.png", fullPage: false });
  });
});
