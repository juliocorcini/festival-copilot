/**
 * Visual verification for the map editor (R11.1c / DEC-064). Drives the built preview headless:
 * opens /admin, clicks the per-festival "Map" action, then screenshots the loaded editor (the seed
 * festival already has an affine + stages, so pins must render), exercises the "Add control point"
 * tool by clicking the canvas, and reports any runtime/console errors.
 *
 * Prereq: a preview server is serving the built dist (default http://localhost:4174), and the
 * Worker map routes are live (the editor fetches /admin/festivals/:id/map).
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.ADMIN_BASE || "http://localhost:4174";
const TOKEN = process.env.ADMIN_TOKEN_VALUE || "fpadm_ea8380ebc6f53b1bf407d417881c7ff80e836bf4a2dfbb3b";
const OUT = process.env.OUT || "e2e/.output/map-editor";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript((t) => {
  try {
    localStorage.setItem("fp.admin.token.v1", t);
  } catch {
    /* storage disabled */
  }
}, TOKEN);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => {
  errors.push("PAGEERROR: " + e.message);
  console.log("PAGEERROR:", e.message);
});
page.on("console", (m) => {
  if (m.type() === "error") {
    errors.push("CONSOLE.ERR: " + m.text());
    console.log("CONSOLE.ERR:", m.text());
  }
});
await mkdir(OUT, { recursive: true });

async function shot(name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot", name);
}

await page.goto(BASE + "/admin", { waitUntil: "networkidle", timeout: 30000 });

// Reach the editor through the contextual per-festival "Map" action (tests the routing wiring).
const mapBtn = page.locator('.admin-row-actions button[title^="Map editor"]');
await mapBtn.first().waitFor({ timeout: 15000 });
await mapBtn.first().click();

// The editor header title.
await page.getByRole("heading", { name: /Map editor/i }).waitFor({ timeout: 20000 });
await page.waitForTimeout(1200); // let the map + dashboard fetch settle
await shot("editor-loaded");

// Diagnostics: did the base raster + stage pins render?
const svgCount = await page.locator("svg.map-editor-svg").count();
const pinCount = await page.locator("svg.map-editor-svg .map-pin").count();
const stageRows = await page.locator(".map-editor-stage-table tbody tr").count();
console.log("DIAG svg:", svgCount, "pins:", pinCount, "stageRows:", stageRows);

// Exercise the "Add control point" tool: pick the tool, click the canvas, expect a CP marker.
await page.getByRole("button", { name: /Add control point/i }).click();
const svg = page.locator("svg.map-editor-svg");
const box = await svg.boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.4);
  await page.waitForTimeout(300);
}
const cpMarks = await page.locator("svg.map-editor-svg .map-cp").count();
const cpRows = await page.locator(".map-editor-cp-table tbody tr").count();
console.log("DIAG after click — cpMarks:", cpMarks, "cpRows:", cpRows);
await shot("editor-control-point");

await browser.close();
console.log("ERRORS:", errors.length ? errors.join(" | ") : "none");
console.log("done");
