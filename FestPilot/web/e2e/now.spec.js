import { test, expect } from "@playwright/test";

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

const seed = (favorites) => ({
  v: 1,
  onboarding: { festivalId: "x", weekendIds: [W1], dayKeys: [], completed: true },
  favorites,
  plans: {},
});

// Seed once, before the FIRST navigation only — `addInitScript` re-runs on every page load, so an
// unconditional write would wipe favorites built through the UI on a later goto().
const seedOnce = (page, store) =>
  page.addInitScript((s) => {
    if (!localStorage.getItem("fp.store.v1")) localStorage.setItem("fp.store.v1", JSON.stringify(s));
  }, store);

// Phase 3 / R6: the Now & Next home (#18, DEC-022). The hero is NEVER an arbitrary lineup act — it is
// the day's locked plan, else the user's own favorites, else an honest empty state. The plan-driven
// LEAVE-IN hero + the chronology math are covered deterministically by domain/nowNext unit tests.
test.describe("R6 — now & next is sourced, never arbitrary", () => {
  test("with no plan and no favorites: an honest empty state, not a random act", async ({ page }) => {
    await seedOnce(page, seed({}));
    await page.goto("/");
    await page.addStyleTag({ content: FREEZE });

    await expect(page.locator(".appbar h1")).toHaveText("Now & Next", { timeout: 20_000 });
    // No hero is invented from the lineup; the user is pointed at picking artists instead.
    await expect(page.locator(".now-hero")).toHaveCount(0);
    await expect(page.locator(".state h2")).toContainText("Pick the acts");
    await expect(page.getByRole("button", { name: "Browse the lineup" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/r6-now-empty.png" });
  });

  test("with favorites: the hero + up-next come only from the user's picks", async ({ page }) => {
    await seedOnce(page, seed({}));

    // Build a handful of favorites through the Lineup UI (each click favorites the top "all artists"
    // row, which then jumps into the favorites section). Seeded once, so this survives goto("/").
    await page.goto("/lineup");
    await page.addStyleTag({ content: FREEZE });
    await expect(page.locator(".art-row").first()).toBeVisible({ timeout: 20_000 });
    for (let i = 1; i <= 6; i++) {
      await page.locator(".heart-btn:not(.on)").first().click();
      await expect(page.locator(".fav-count .n")).toHaveText(String(i));
    }
    const favNames = await page.locator(".art-row:has(.heart-btn.on) .nm").allTextContents();
    expect(favNames.length).toBe(6);

    // Now & Next: a real hero, explicitly labelled as favorites-sourced.
    await page.goto("/");
    await page.addStyleTag({ content: FREEZE });
    await expect(page.locator(".now-hero")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".src")).toContainText("From your favorites");

    // The hero act MUST be one the user favorited — never an arbitrary lineup act.
    const heroTitle = (await page.locator(".now-title").textContent())?.trim() ?? "";
    expect(favNames.map((n) => n.trim())).toContain(heroTitle);

    // Every act surfaced in the "up next" list is also one of the user's favorites.
    const laterNames = await page.locator(".list-card .lineup-row .n").allTextContents();
    for (const name of laterNames) expect(favNames.map((n) => n.trim())).toContain(name.trim());

    await page.screenshot({ path: "e2e/screenshots/r6-now-favorites.png" });
  });
});
