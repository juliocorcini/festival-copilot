import { test, expect } from "@playwright/test";

// R10.4 — app-feel: the UI shouldn't feel like a web page. Body text isn't selectable and long-press
// doesn't pop the iOS callout, but real form fields stay selectable so people can edit/copy.
test.describe("R10.4 — app-feel (no text selection, inputs exempt)", () => {
  test("body disables selection while the onboarding name input keeps it", async ({ page }) => {
    await page.goto("/");

    const bodySelect = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return s.userSelect || s.webkitUserSelect;
    });
    expect(bodySelect).toBe("none");

    // First onboarding step is the name field — it must remain selectable/editable.
    const name = page.locator("#ob-name");
    await expect(name).toBeVisible({ timeout: 20_000 });
    const inputSelect = await name.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.userSelect || s.webkitUserSelect;
    });
    expect(inputSelect).toBe("text");
  });
});
