/**
 * Dev-only crop/zoom utility for inspecting rendered PNGs up close.
 *   npx tsx scripts/crop.ts <in.png> <x> <y> <w> <h> <scale> <out.png>
 * Coordinates/sizes are in source pixels; <scale> nearest-neighbor upscales.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const [, , inPath, xs, ys, ws, hs, ss, outPath] = process.argv;
if (!inPath || !outPath) throw new Error("usage: crop.ts in x y w h scale out");
const x = +xs!, y = +ys!, w = +ws!, h = +hs!, scale = +ss!;

const src = PNG.sync.read(readFileSync(inPath));
const out = new PNG({ width: w * scale, height: h * scale });
for (let oy = 0; oy < h * scale; oy++) {
  for (let ox = 0; ox < w * scale; ox++) {
    const sx = Math.min(src.width - 1, x + Math.floor(ox / scale));
    const sy = Math.min(src.height - 1, y + Math.floor(oy / scale));
    const si = (sy * src.width + sx) * 4;
    const di = (oy * out.width + ox) * 4;
    out.data[di] = src.data[si]!;
    out.data[di + 1] = src.data[si + 1]!;
    out.data[di + 2] = src.data[si + 2]!;
    out.data[di + 3] = src.data[si + 3]!;
  }
}
writeFileSync(outPath, PNG.sync.write(out));
console.log(`wrote ${outPath} (${w * scale}x${h * scale}) from ${src.width}x${src.height}`);
