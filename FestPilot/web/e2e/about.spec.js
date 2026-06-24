import { test, expect } from "@playwright/test";

/**
 * About + What's New (settings/about). Identity (what the app is, the maker, the version) + the human
 * changelog with a collapsible "How to test" block per release. Pure screen — API is stubbed empty.
 */

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

const SEED = (arg) => {
  localStorage.setItem("fp.auth.v1", JSON.stringify({ token: arg.token, user: arg.user }));
  localStorage.setItem(
    "fp.store.v1",
    JSON.stringify({
      v: 1,
      onboarding: { festivalId: arg.festivalId, weekendIds: [arg.w1], dayKeys: [], completed: true },
      favorites: {},
      plans: {},
    })
  );
};

test.use({ serviceWorkers: "block" });

test.describe("About & what's new", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SEED, {
      token: "anon.01KVVF5VVAGC7PAYZE127P2GZG",
      user: { displayName: "Julio", avatarColor: "#F5A623" },
      festivalId: FESTIVAL_ID,
      w1: W1,
    });
    await page.route("**/api/**", async (route) => route.fulfill({ json: {} }));
  });

  test("renders identity, creator and the changelog (#about)", async ({ page }) => {
    await page.goto("/settings/about");
    await page.addStyleTag({ content: FREEZE });

    // Identity (decoupled from any specific release so the changelog can grow freely).
    await expect(page.getByRole("heading", { name: "FestPilot" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Created by")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Julio Corcini").first()).toBeVisible();
    await expect(page.locator(".about-section-label", { hasText: "What's new" })).toBeVisible();

    // A multi-release history, with exactly one "Current" pill on the newest entry.
    await expect(page.locator(".changelog-item")).not.toHaveCount(0, { timeout: 10_000 });
    expect(await page.locator(".changelog-item").count()).toBeGreaterThan(3);
    await expect(page.locator(".changelog-current")).toHaveCount(1);
    await page.screenshot({ path: "e2e/screenshots/phase-about.png", fullPage: true });

    // The maker's "How to test" block expands to reveal its checklist.
    const firstTest = page.locator(".changelog-test").first();
    await firstTest.getByText("How to test").click();
    await expect(firstTest.locator(".changelog-testlist li").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/phase-about-test.png" });
  });
});
