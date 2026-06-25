/**
 * Visual verification for the festival onboarding screen (R11.1c / DEC-063). Drives the built
 * preview with Playwright headless: opens /admin, the Add-festival form (+ advanced), and the
 * inline edit row, writing a screenshot of each so the build can be checked without a display.
 *
 * Prereq: a preview server is serving the built dist (default http://localhost:4174).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.ADMIN_BASE || "http://localhost:4174";
const TOKEN = process.env.ADMIN_TOKEN_VALUE || "fpadm_ea8380ebc6f53b1bf407d417881c7ff80e836bf4a2dfbb3b";
const OUT = process.env.OUT || "e2e/.output/festivals";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await ctx.addInitScript((t) => {
  try {
    localStorage.setItem("fp.admin.token.v1", t);
  } catch {
    /* storage disabled */
  }
}, TOKEN);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE.ERR:", m.text());
});
await mkdir(OUT, { recursive: true });

async function shot(name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot", name);
}

await page.goto(BASE + "/admin", { waitUntil: "networkidle", timeout: 30000 });
await shot("overview");

await page.getByRole("button", { name: /Add festival/i }).click();
await shot("add-form");

const adv = page.getByRole("button", { name: /Advanced: saved source ref/i });
if (await adv.count()) {
  await adv.click();
  await shot("add-advanced");
}

await page.getByRole("button", { name: /^\s*close\s*Cancel\s*$/i }).first().click().catch(async () => {
  await page.getByRole("button", { name: /Cancel/i }).first().click();
});
const editBtn = page.locator('.admin-row-actions button[title="Edit name / timezone"]');
if (await editBtn.count()) {
  await editBtn.first().click();
  await shot("edit-row");
}

await browser.close();
console.log("done");
