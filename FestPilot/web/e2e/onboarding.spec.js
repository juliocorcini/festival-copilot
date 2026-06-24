import { test, expect } from "@playwright/test";

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;

// Phase 2 / Gate 2.1: a first-run user is gated into onboarding (#17), walks festival →
// weekend → days → swipe, and the chosen favorites then show up on the Lineup (#22).
test.describe("Phase 2 — onboarding + lineup favorites", () => {
  test("walks onboarding and builds favorites visible in the Lineup", async ({ page }) => {
    await page.goto("/");
    await page.addStyleTag({ content: FREEZE });

    // Gated into onboarding on first run.
    await expect(page).toHaveURL(/onboarding/);

    // Step 0 — lightweight identity (DEC-060): name required, email optional. Leaving email empty
    // must still proceed (the AC), and the "Let's go" button is gated on a valid name.
    await expect(page.locator(".ob-head h1")).toContainText("What should we call you", { timeout: 20_000 });
    const letsGo = page.getByRole("button", { name: "Let's go" });
    await expect(letsGo).toBeDisabled();
    await page.locator("#ob-name").fill("Julio");
    await expect(letsGo).toBeEnabled();
    await letsGo.click();

    // Step 1 — festival.
    await expect(page.locator(".ob-head h1")).toContainText("Which festival", { timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase2-onboarding-festival.png" });
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 — weekend.
    await expect(page.locator(".ob-head h1")).toHaveText("Which weekend?");
    await page.locator(".opt").first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — days (all selected by default).
    await expect(page.locator(".ob-head h1")).toHaveText("Which days?");
    await page.getByRole("button", { name: "Start picking artists" }).click();

    // Step 4 — swipe a few favorites.
    await expect(page.locator(".art-card")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase2-onboarding-swipe.png" });

    // Undo a swipe: the counter advances on a swipe and steps back on undo (DEC: V1.x).
    const counter = page.locator(".swipe-head .count");
    const firstCount = await counter.textContent();
    await page.locator(".swipe-actions .yes").click();
    await expect(counter).not.toHaveText(firstCount ?? "");
    await page.locator(".swipe-undo.sm").click();
    await expect(counter).toHaveText(firstCount ?? "");

    for (let i = 0; i < 5; i++) await page.locator(".swipe-actions .yes").click();

    // Finish → app shell.
    await page.locator(".ob-skip").click();
    await expect(page.locator(".appbar h1")).toHaveText("Now & Next", { timeout: 20_000 });

    // Lineup shows the favorites we just built.
    await page.goto("/lineup");
    await page.addStyleTag({ content: FREEZE });
    await expect(page.locator(".fav-count .n")).not.toHaveText("0", { timeout: 20_000 });
    await expect(page.locator(".sec").first()).toContainText("YOUR FAVORITES");
    await expect(page.locator(".heart-btn.on").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase2-lineup.png" });

    // Toggling a favorite off updates the counter live.
    const before = Number(await page.locator(".fav-count .n").textContent());
    await page.locator(".art-row .heart-btn.on").first().click();
    await expect(page.locator(".fav-count .n")).toHaveText(String(before - 1));
  });

  // R5.2: the "Grid" pick mode is an alternative to the swipe deck and writes the same favorites.
  test("picks favorites via the grid mode and they reach the Lineup", async ({ page }) => {
    await page.goto("/");
    await page.addStyleTag({ content: FREEZE });

    await page.locator("#ob-name").fill("Julio", { timeout: 20_000 });
    await page.getByRole("button", { name: "Let's go" }).click();
    await page.getByRole("button", { name: "Continue" }).click(); // festival
    await page.locator(".opt").first().click(); // weekend
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Start picking artists" }).click();

    // Switch swipe → grid and tap two acts.
    await expect(page.locator(".art-card")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "Grid" }).click();
    const cards = page.locator(".gcard");
    await expect(cards.first()).toBeVisible();
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(page.locator(".gcard.on")).toHaveCount(2);
    await page.screenshot({ path: "e2e/screenshots/phase2-onboarding-grid.png" });

    await page.getByRole("button", { name: "See my plan" }).click();
    await expect(page.locator(".appbar h1")).toHaveText("Now & Next", { timeout: 20_000 });

    await page.goto("/lineup");
    await page.addStyleTag({ content: FREEZE });
    await expect(page.locator(".fav-count .n")).toHaveText("2", { timeout: 20_000 });
  });
});
