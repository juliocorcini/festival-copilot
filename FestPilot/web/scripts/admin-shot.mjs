/**
 * Admin visual-verification harness (DEC-063). Drives the admin back-office with Playwright
 * headless and writes a screenshot per route, so the build can be checked visually in a
 * no-display (WSL) environment.
 *
 * Usage:
 *   node scripts/admin-shot.mjs                 # all routes against the live Pages admin
 *   ADMIN_BASE=http://localhost:4174 node scripts/admin-shot.mjs
 *   ROUTES="index:/admin,metrics:/admin/metrics" node scripts/admin-shot.mjs
 *
 * Env:
 *   ADMIN_BASE          origin (default https://festpilot.pages.dev)
 *   ADMIN_TOKEN_VALUE   x-admin-token (default = the rotated prod token)
 *   OUT                 output dir (default e2e/.output/admin)
 *   ROUTES              comma list of name:path (default = the six current screens)
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.ADMIN_BASE || "https://festpilot.pages.dev";
const TOKEN = process.env.ADMIN_TOKEN_VALUE || "fpadm_ea8380ebc6f53b1bf407d417881c7ff80e836bf4a2dfbb3b";
const OUT = process.env.OUT || "e2e/.output/admin";

const DEFAULT_ROUTES = [
  "index:/admin",
  "lineup:/admin/lineup",
  "data-sources:/admin/data-sources",
  "metrics:/admin/metrics",
  "suggestions:/admin/suggestions",
  "test-console:/admin/test-console",
];

const routes = (process.env.ROUTES ? process.env.ROUTES.split(",") : DEFAULT_ROUTES).map((r) => {
  const idx = r.indexOf(":");
  return { name: r.slice(0, idx), path: r.slice(idx + 1) };
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript((token) => {
  try {
    localStorage.setItem("fp.admin.token.v1", token);
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
let failures = 0;
for (const { name, path } of routes) {
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log("OK  ", name, "->", page.url());
  } catch (e) {
    failures += 1;
    console.log("FAIL", name, "-", e.message);
  }
}
await browser.close();
console.log(`\nDone. ${routes.length - failures}/${routes.length} shots in ${OUT}`);
if (failures > 0) process.exitCode = 1;
