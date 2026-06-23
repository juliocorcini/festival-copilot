/**
 * Dev-only: rasterize a map SVG at an arbitrary width to prove deep-zoom headroom.
 *   npx tsx scripts/render.ts <in.svg> <width> <out.png>
 * The shipped SVG is vector, so geometry/markers/text stay crisp at any width.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const [, , inPath, ws, outPath] = process.argv;
if (!inPath || !outPath) throw new Error("usage: render.ts in.svg width out.png");
const width = +ws!;

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(HERE, "..", "fonts");
const fontFiles = [join(FONT_DIR, "Oswald.ttf"), join(FONT_DIR, "AlbertSans.ttf")].filter(existsSync);

const png = new Resvg(readFileSync(inPath, "utf8"), {
  fitTo: { mode: "width", value: width },
  font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Albert Sans" },
})
  .render()
  .asPng();
writeFileSync(outPath, png);
console.log(`wrote ${outPath} @ ${width}px`);
