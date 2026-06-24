import { test, expect } from "@playwright/test";

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;

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
    await page.addStyleTag({ content: FREEZE });

    await expect(page.locator(".appbar h1")).toHaveText("Now & Next");
    await expect(page.locator(".nav .navitem")).toHaveCount(5);

    // Live data path: the hero set appears after the festivals + lineup fetch resolves.
    await expect(page.locator(".now-hero .now-title")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".list-card .lineup-row").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase1-now.png", fullPage: false });

    // Tab navigation: the Timetable grid (Gate 2.2) renders with its header.
    await page.locator(".nav .navitem", { hasText: "Timetable" }).click();
    await expect(page.locator(".tt-top h1")).toHaveText("Timetable");

    await page.locator(".nav .navitem", { hasText: "Map" }).click();
    await expect(page.locator("img.base")).toBeVisible({ timeout: 15_000 });

    // Settings stack via the header avatar (Now screen) — no bottom nav there.
    await page.locator(".nav .navitem", { hasText: "Now" }).click();
    await page.locator(".ava").click();
    await expect(page.locator(".appbar h1")).toHaveText("Settings");
    await expect(page.getByText("Appearance & language")).toBeVisible();
    await expect(page.locator(".nav")).toHaveCount(0);
    await page.screenshot({ path: "e2e/screenshots/phase1-settings.png", fullPage: false });
  });
});
