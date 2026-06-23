/**
 * Terrain relief for the map generator (DEC-033) — pluggable provider.
 *
 * Relief (shaded hills) is the single biggest "this is a real place" win. We pick
 * the best open, license-clean source for the venue automatically:
 *   - "flanders": Flanders DHMV-II pre-rendered hillshade (25 cm) via WMS — best
 *      quality, no math needed (covers Tomorrowland / De Schorre).
 *   - "global":   AWS Open Terrain Tiles (terrarium PNG, worldwide, no key) → we
 *      stitch + compute hillshade in JS. Works for ANY venue on Earth.
 *   - "auto":     Flanders where the bbox falls inside Flanders, else global.
 *
 * Output is a PNG draped under the art via the proven affine (DEC-030). No GDAL.
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";
import { geoToXY, type Scene } from "./geo.js";
import { curlGetToFile } from "./http.js";
import type { ReliefMode } from "./types.js";

export interface Hillshade {
  dataUri: string;
  x: number; y: number; w: number; h: number;
  attribution: string;
}

const R = 20037508.342789244;
const x3857 = (lng: number): number => (lng * R) / 180;
const y3857 = (lat: number): number =>
  (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180);

const FLANDERS = { west: 2.5, east: 5.95, south: 50.67, north: 51.51 };
function inFlanders(s: Scene): boolean {
  const cx = (s.bbox.west + s.bbox.east) / 2;
  const cy = (s.bbox.south + s.bbox.north) / 2;
  return cx >= FLANDERS.west && cx <= FLANDERS.east && cy >= FLANDERS.south && cy <= FLANDERS.north;
}

type Log = (m: string) => void;

export function fetchRelief(scene: Scene, outDir: string, mode: ReliefMode, width = 2048, log: Log = () => {}): Hillshade | null {
  if (mode === "none") return null;
  const chosen = mode === "auto" ? (inFlanders(scene) ? "flanders" : "global") : mode;
  try {
    if (chosen === "flanders") return flanders(scene, outDir, width, log);
    return global(scene, outDir, log);
  } catch (e) {
    log(`  ! relief (${chosen}) failed: ${String(e).slice(0, 160)} — continuing without`);
    return null;
  }
}

function drapeRect(scene: Scene, b: { west: number; east: number; south: number; north: number }) {
  const [tlx, tly] = geoToXY(scene.affine, b.west, b.north);
  const [brx, bry] = geoToXY(scene.affine, b.east, b.south);
  return { x: tlx, y: tly, w: brx - tlx, h: bry - tly };
}

// ---- provider: Flanders DHMV-II hillshade (WMS) ----------------------------
function flanders(scene: Scene, outDir: string, width: number, log: Log): Hillshade | null {
  const { bbox } = scene;
  const minX = x3857(bbox.west), maxX = x3857(bbox.east);
  const minY = y3857(bbox.south), maxY = y3857(bbox.north);
  const aspect = (maxX - minX) / (maxY - minY);
  const height = Math.round(width / aspect);
  const url =
    `https://geo.api.vlaanderen.be/DHMV/wms?service=WMS&request=GetMap&version=1.3.0` +
    `&layers=DHMV_II_HILL_25cm&styles=&crs=EPSG:3857&bbox=${minX},${minY},${maxX},${maxY}` +
    `&width=${width}&height=${height}&format=image/png`;

  const cache = join(outDir, "relief-flanders.png");
  if (!existsSync(cache) || process.env["REFRESH"]) {
    log(`  relief: Flanders DHMV-II HILL 25cm (${width}x${height}) …`);
    curlGetToFile(url, cache);
  } else {
    log("  relief: cached relief-flanders.png");
  }
  const buf = readFileSync(cache);
  if (!(buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50)) throw new Error("not a PNG");
  return {
    dataUri: `data:image/png;base64,${buf.toString("base64")}`,
    ...drapeRect(scene, bbox),
    attribution: "Relief: DHMV-II, Digitaal Vlaanderen",
  };
}

// ---- provider: global AWS terrain tiles (terrarium) ------------------------
const lon2tile = (lng: number, z: number): number => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2tile = (lat: number, z: number): number =>
  Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z);
const tile2lon = (x: number, z: number): number => (x / 2 ** z) * 360 - 180;
const tile2lat = (y: number, z: number): number =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

function global(scene: Scene, outDir: string, log: Log): Hillshade | null {
  const { bbox } = scene;
  // Pick the highest zoom whose tile span stays small.
  let z = 16;
  for (; z >= 11; z--) {
    const tx = lon2tile(bbox.east, z) - lon2tile(bbox.west, z) + 1;
    const ty = lat2tile(bbox.south, z) - lat2tile(bbox.north, z) + 1;
    if (tx <= 6 && ty <= 8) break;
  }
  const x0 = lon2tile(bbox.west, z), x1 = lon2tile(bbox.east, z);
  const y0 = lat2tile(bbox.north, z), y1 = lat2tile(bbox.south, z);
  const txN = x1 - x0 + 1, tyN = y1 - y0 + 1;
  const W = txN * 256, H = tyN * 256;
  const draped = {
    west: tile2lon(x0, z), east: tile2lon(x1 + 1, z),
    north: tile2lat(y0, z), south: tile2lat(y1 + 1, z),
  };
  const attribution = "Relief: AWS Terrain Tiles (Mapzen/SRTM)";

  // Cache the computed hillshade so re-runs are instant (zoom/extent are deterministic).
  const cache = join(outDir, "relief-global.png");
  if (existsSync(cache) && !process.env["REFRESH"]) {
    log("  relief: cached relief-global.png");
    return { dataUri: `data:image/png;base64,${readFileSync(cache).toString("base64")}`, ...drapeRect(scene, draped), attribution };
  }
  log(`  relief: global terrain tiles z${z} (${txN}x${tyN} tiles, ${W}x${H}px) …`);

  const tmp = mkdtempSync(join(tmpdir(), "festpilot-dem-"));
  const elev = new Float32Array(W * H);
  for (let ty = 0; ty < tyN; ty++) {
    for (let tx = 0; tx < txN; tx++) {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x0 + tx}/${y0 + ty}.png`;
      const f = join(tmp, `${z}-${x0 + tx}-${y0 + ty}.png`);
      let png: PNG | null = null;
      try {
        curlGetToFile(url, f, 60);
        png = PNG.sync.read(readFileSync(f));
      } catch {
        png = null; // missing tile (e.g. ocean) -> elevation 0
      }
      for (let py = 0; py < 256; py++) {
        for (let px = 0; px < 256; px++) {
          const gx = tx * 256 + px, gy = ty * 256 + py;
          let h = 0;
          if (png) {
            const i = (py * 256 + px) * 4;
            h = png.data[i]! * 256 + png.data[i + 1]! + png.data[i + 2]! / 256 - 32768;
          }
          elev[gy * W + gx] = h;
        }
      }
    }
  }

  const midLat = (bbox.north + bbox.south) / 2;
  const cell = (156543.0339 * Math.cos((midLat * Math.PI) / 180)) / 2 ** z; // meters/px
  const png = hillshadePng(elev, W, H, cell);
  writeFileSync(cache, png);
  return { dataUri: `data:image/png;base64,${png.toString("base64")}`, ...drapeRect(scene, draped), attribution };
}

/** Horn (1981) hillshade -> 8-bit grey PNG. azimuth 315°, altitude 45°. */
function hillshadePng(elev: Float32Array, W: number, H: number, cell: number, zFactor = 1): Buffer {
  const out = new PNG({ width: W, height: H });
  const az = (315 * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const cosZ = Math.cos(Math.PI / 2 - alt);
  const sinZ = Math.sin(Math.PI / 2 - alt);
  const at = (x: number, y: number): number => elev[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]!;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1);
      const d = at(x - 1, y), f = at(x + 1, y);
      const g = at(x - 1, y + 1), h = at(x, y + 1), i = at(x + 1, y + 1);
      const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cell) * zFactor;
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cell) * zFactor;
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      let v = cosZ * Math.cos(slope) + sinZ * Math.sin(slope) * Math.cos(az - aspect);
      v = Math.max(0, Math.min(1, v));
      const g8 = Math.round(v * 255);
      const idx = (y * W + x) * 4;
      out.data[idx] = g8; out.data[idx + 1] = g8; out.data[idx + 2] = g8; out.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(out);
}
