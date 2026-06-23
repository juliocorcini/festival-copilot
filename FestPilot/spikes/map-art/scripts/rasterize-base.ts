/**
 * rasterize-base — produce the slim, shippable map base assets (DEC-040).
 *
 * The engine's source SVG inlines the LiDAR relief as a ~10 MB base64 raster (twice:
 * shadow + light passes), so the shipped SVG is ~20 MB — too heavy for a festival PWA
 * (DEC-022: offline, low data, dying battery). An SVG loaded via <img> also runs in the
 * browser's secure-static mode, where an *external* <image href> relief is never fetched.
 *
 * So we pre-render the SVG (relief and all) to a compact WebP with resvg + sharp. The
 * result is pixel-identical to the engine art, small, offline-friendly, and works with the
 * existing base/overlay split in MapView (the live overlay stays a separate vector layer).
 *
 * Run from the spike: `npx tsx scripts/rasterize-base.ts [festivalId] [outDir] [width] [quality]`
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const spikeRoot = resolve(here, "..");
const repoRoot = resolve(spikeRoot, "../../.."); // .../festival-copilot

const festivalId = process.argv[2] ?? "tomorrowland-deschorre";
const outDir = process.argv[3] ?? join(repoRoot, "FestPilot/web/public/maps");
const width = Number(process.argv[4] ?? 2400);
const quality = Number(process.argv[5] ?? 80);

const fontFiles = [join(spikeRoot, "fonts/Oswald.ttf"), join(spikeRoot, "fonts/AlbertSans.ttf")];

async function rasterize(variant: "" | "-day"): Promise<void> {
  const svgPath = join(outDir, `${festivalId}${variant}.svg`);
  const svg = readFileSync(svgPath, "utf8");
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Albert Sans" },
  })
    .render()
    .asPng();
  const outFile = join(outDir, `${festivalId}${variant}.webp`);
  await sharp(png).webp({ quality, effort: 6 }).toFile(outFile);
  const kb = (statSync(outFile).size / 1024).toFixed(0);
  console.log(`  ${festivalId}${variant}.webp  ${width}px wide  q${quality}  ${kb} KB`);
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  console.log(`Rasterizing ${festivalId} base (night + day) -> ${outDir}`);
  await rasterize("");
  await rasterize("-day");
  console.log("Done. Point MapView at the .webp base (DEC-040); the 20 MB SVGs can be dropped.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
