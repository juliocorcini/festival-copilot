/**
 * make-icons — rasterize the brand SVGs into the PWA PNG icon set.
 * Reuses this spike's resvg toolchain (no extra dep in the web app). Output goes to
 * web/public/icons. Re-run only when the brand SVGs change.
 *   node scripts/make-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const festpilotRoot = resolve(here, "../../.."); // .../FestPilot
const iconsDir = join(festpilotRoot, "web/public/icons");
mkdirSync(iconsDir, { recursive: true });

function render(svgName, outName, size) {
  const svg = readFileSync(join(iconsDir, svgName), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(join(iconsDir, outName), png);
  console.log(`  ${outName}  ${size}px  ${(png.length / 1024).toFixed(0)} KB`);
}

render("icon.svg", "icon-192.png", 192);
render("icon.svg", "icon-512.png", 512);
render("icon-maskable.svg", "icon-maskable-512.png", 512);
render("icon.svg", "apple-touch-icon.png", 180);
console.log("Done.");
