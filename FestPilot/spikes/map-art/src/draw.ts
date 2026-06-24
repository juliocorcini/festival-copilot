/**
 * Visual assembly for the map-art spike (DEC-033, Route A).
 * Builds a beautiful, illustrated map from the projected Scene, in a selectable
 * palette (TWILIGHT = on-brand Amber Glass; DAY = bright like the official refs).
 *
 * Layers: textured land + real LiDAR relief, painterly luminous water with a
 * shoreline, a scattered tree canopy (2.5D, painter-ordered), soft shadows,
 * golden-hour light, bespoke amber stage medallions, frame + legend + compass.
 */
import type { Ring, Poly, Scene, TreePoint } from "./geo.js";
import type { Hillshade } from "./relief.js";

// ---- palette ---------------------------------------------------------------
export interface Palette {
  bgInner: string; bgOuter: string;
  landTop: string; landBot: string;
  grass: string; woodFloor: string;
  waterTop: string; waterBot: string;
  shoreline: string;
  road: string; path: string; parking: string;
  venueEdge: string;
  amber: string; amberHi: string; accentText: string;
  textPrimary: string; textHalo: string; ink: string;
  veil: string; vignetteOuter: string;
  legendPanel: string; legendText: string;
  subtitle: string; attr: string;
}

export const TWILIGHT: Palette = {
  bgInner: "#1b1509", bgOuter: "#070502",
  landTop: "#33491f", landBot: "#21331a",
  grass: "#3c5b25", woodFloor: "#24381b",
  waterTop: "#1f7790", waterBot: "#0c3548",
  shoreline: "rgba(186,231,250,.6)",
  road: "rgba(225,210,176,.45)", path: "rgba(245,200,130,.55)", parking: "rgba(255,255,255,.045)",
  venueEdge: "rgba(245,166,35,.55)",
  amber: "#F5A623", amberHi: "#FFD874", accentText: "#FFD874",
  textPrimary: "#F5F0E6", textHalo: "#0F0D09", ink: "#0F0D09",
  veil: "rgba(6,4,2,.55)", vignetteOuter: "rgba(0,0,0,.55)",
  legendPanel: "rgba(15,13,9,.6)", legendText: "#F5F0E6",
  subtitle: "rgba(245,200,130,.85)", attr: "rgba(245,240,230,.45)",
};

export const DAY: Palette = {
  bgInner: "#ece0c6", bgOuter: "#cbb88f",
  landTop: "#6fa948", landBot: "#4f8732",
  grass: "#80bd51", woodFloor: "#4c8330",
  waterTop: "#37acd0", waterBot: "#1e6f97",
  shoreline: "rgba(255,255,255,.72)",
  road: "rgba(110,86,52,.5)", path: "rgba(150,100,40,.7)", parking: "rgba(80,70,50,.1)",
  venueEdge: "rgba(180,120,30,.6)",
  amber: "#E8902A", amberHi: "#F6B445", accentText: "#9a5e16",
  textPrimary: "#2a2417", textHalo: "#fbf4e3", ink: "#2a2417",
  veil: "rgba(233,221,191,.55)", vignetteOuter: "rgba(150,120,70,.16)",
  legendPanel: "rgba(255,250,238,.78)", legendText: "#3a2f1c",
  subtitle: "rgba(120,80,30,.85)", attr: "rgba(60,50,30,.5)",
};

const TREE_GREENS = [
  ["#2c5222", "#3a6a2c", "#4d8038", "#74a44e"],
  ["#28491f", "#356226", "#467534", "#6c9c47"],
  ["#305a26", "#417031", "#54883d", "#7cab53"],
];

// ---- path builders ---------------------------------------------------------
const fx = (n: number): string => n.toFixed(1);
function ringPath(ring: Ring): string {
  if (ring.length === 0) return "";
  const p0 = ring[0]!;
  let d = `M${fx(p0[0])},${fx(p0[1])}`;
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i]!;
    d += `L${fx(p[0])},${fx(p[1])}`;
  }
  return d + "Z";
}
function areaPath(polys: Poly[]): string {
  return polys.map((poly) => poly.map(ringPath).join("")).join("");
}
function linePath(line: Ring): string {
  if (line.length === 0) return "";
  const p0 = line[0]!;
  let d = `M${fx(p0[0])},${fx(p0[1])}`;
  for (let i = 1; i < line.length; i++) {
    const p = line[i]!;
    d += `L${fx(p[0])},${fx(p[1])}`;
  }
  return d;
}
function linesPath(lines: Ring[]): string {
  return lines.map(linePath).join("");
}

// ---- defs ------------------------------------------------------------------
function defs(P: Palette): string {
  const trees = TREE_GREENS.map((g, i) => treeSymbol(`tree${i}`, g)).join("\n");
  return `<defs>
  <radialGradient id="bg" cx="50%" cy="42%" r="80%">
    <stop offset="0%" stop-color="${P.bgInner}"/>
    <stop offset="100%" stop-color="${P.bgOuter}"/>
  </radialGradient>
  <linearGradient id="land" x1="0" y1="0" x2="0.25" y2="1">
    <stop offset="0%" stop-color="${P.landTop}"/>
    <stop offset="100%" stop-color="${P.landBot}"/>
  </linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0.15" y2="1">
    <stop offset="0%" stop-color="${P.waterTop}"/>
    <stop offset="100%" stop-color="${P.waterBot}"/>
  </linearGradient>
  <linearGradient id="waterHi" x1="0" y1="0" x2="0.1" y2="1">
    <stop offset="0%" stop-color="rgba(220,245,255,.4)"/>
    <stop offset="42%" stop-color="rgba(220,245,255,0)"/>
    <stop offset="100%" stop-color="rgba(220,245,255,0)"/>
  </linearGradient>
  <radialGradient id="amberMed" cx="38%" cy="32%" r="75%">
    <stop offset="0%" stop-color="${P.amberHi}"/>
    <stop offset="100%" stop-color="${P.amber}"/>
  </radialGradient>
  <radialGradient id="leafDark" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="rgba(16,28,11,.55)"/>
    <stop offset="100%" stop-color="rgba(16,28,11,0)"/>
  </radialGradient>
  <radialGradient id="leafLite" cx="42%" cy="38%" r="55%">
    <stop offset="0%" stop-color="rgba(120,165,75,.42)"/>
    <stop offset="100%" stop-color="rgba(120,165,75,0)"/>
  </radialGradient>
  <radialGradient id="sun" cx="30%" cy="24%" r="85%">
    <stop offset="0%" stop-color="rgba(255,212,140,.16)"/>
    <stop offset="55%" stop-color="rgba(255,212,140,0)"/>
    <stop offset="100%" stop-color="rgba(20,30,45,.14)"/>
  </radialGradient>
  <radialGradient id="vignette" cx="50%" cy="44%" r="72%">
    <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
    <stop offset="78%" stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="${P.vignetteOuter}"/>
  </radialGradient>
  <filter id="landShadow" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#000000" flood-opacity="0.5"/>
  </filter>
  <filter id="edgeBlur" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="3.2"/>
  </filter>
  <filter id="waterShadow" x="-25%" y="-25%" width="150%" height="150%">
    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#031018" flood-opacity="0.6"/>
  </filter>
  <filter id="waterGlow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#39c6e6" flood-opacity="0.4"/>
  </filter>
  <filter id="stageGlow" x="-120%" y="-120%" width="340%" height="340%">
    <feDropShadow dx="0" dy="0" stdDeviation="5.5" flood-color="${P.amber}" flood-opacity="0.95"/>
  </filter>
  <filter id="ripple" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="11" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0.08 0"/>
  </filter>
  <filter id="reliefShadow" x="0" y="0" width="100%" height="100%">
    <feGaussianBlur stdDeviation="0.6"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.27 -0.531 -0.099 0 0.45"/>
  </filter>
  <filter id="reliefLight" x="0" y="0" width="100%" height="100%">
    <feGaussianBlur stdDeviation="0.6"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.9  0 0 0 0 0.66  0.252 0.4956 0.0924 0 -0.42"/>
  </filter>
${trees}
</defs>`;
}

/** A small stylized tree: baked soft shadow + lit crown (light from upper-left). */
function treeSymbol(id: string, g: string[]): string {
  const [back, mid, top, hi] = g as [string, string, string, string];
  return `  <g id="${id}">
    <ellipse cx="1.8" cy="3.2" rx="6.6" ry="2.5" fill="rgba(0,0,0,.34)"/>
    <circle cx="1.6" cy="1.2" r="5.1" fill="${back}"/>
    <circle cx="-0.3" cy="-0.2" r="4.9" fill="${mid}"/>
    <circle cx="-1.7" cy="-2.0" r="3.7" fill="${top}"/>
    <circle cx="-2.5" cy="-3.1" r="1.5" fill="${hi}"/>
  </g>`;
}
function treeLayer(trees: TreePoint[]): string {
  let s = "";
  for (const t of trees) {
    const k = (t.r / 5).toFixed(2);
    const id = `tree${Math.min(2, Math.floor(t.v * 3))}`;
    s += `<use href="#${id}" transform="translate(${fx(t.x)},${fx(t.y)}) scale(${k})"/>`;
  }
  return s;
}
function groundMottle(blobs: TreePoint[]): string {
  let s = "";
  for (const b of blobs) {
    const fill = b.v > 0.5 ? "url(#leafLite)" : "url(#leafDark)";
    s += `<circle cx="${fx(b.x)}" cy="${fx(b.y)}" r="${fx(b.r)}" fill="${fill}"/>`;
  }
  return s;
}

function reliefOverlay(hill: Hillshade | null): string {
  if (!hill) return "";
  const img = (filter: string): string =>
    `<image href="${hill.dataUri}" x="${fx(hill.x)}" y="${fx(hill.y)}" width="${fx(hill.w)}" height="${fx(hill.h)}" preserveAspectRatio="none" filter="url(#${filter})"/>`;
  return `<g clip-path="url(#venueClip)">${img("reliefShadow")}${img("reliefLight")}</g>`;
}

// ---- stage marker ----------------------------------------------------------
function starPath(cx: number, cy: number, r: number, rin: number, n = 5): string {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? r : rin;
    const ang = (Math.PI / n) * i - Math.PI / 2;
    d += (i === 0 ? "M" : "L") + fx(cx + Math.cos(ang) * rad) + "," + fx(cy + Math.sin(ang) * rad);
  }
  return d + "Z";
}
function stageMarker(x: number, y: number, name: string, matched: boolean, P: Palette): string {
  const label = `<text x="${fx(x + 13)}" y="${fx(y + 4)}" class="stage-label">${escapeXml(name.toUpperCase())}</text>`;
  if (!matched) {
    // Needs admin review: muted, dashed, no pedestal.
    return `<g opacity="0.92">
      <circle cx="${fx(x)}" cy="${fx(y)}" r="7.5" fill="rgba(245,166,35,.16)" stroke="${P.amber}" stroke-width="1.6" stroke-dasharray="2.4 2.4"/>
      <circle cx="${fx(x)}" cy="${fx(y)}" r="1.6" fill="${P.amber}"/>
    </g>` + label;
  }
  const r = 10;
  // Illuminated medallion lifted off the ground: pedestal shadow → glow → disc →
  // ink rim → inner rim-light → star → top gloss. Reads as a 2.5D beacon.
  return `<g>
    <ellipse cx="${fx(x)}" cy="${fx(y + r + 2.5)}" rx="${fx(r * 0.95)}" ry="${fx(r * 0.34)}" fill="rgba(0,0,0,.42)"/>
    <g filter="url(#stageGlow)"><circle cx="${fx(x)}" cy="${fx(y)}" r="${r}" fill="url(#amberMed)"/></g>
    <circle cx="${fx(x)}" cy="${fx(y)}" r="${r}" fill="none" stroke="${P.ink}" stroke-width="2.2"/>
    <circle cx="${fx(x)}" cy="${fx(y)}" r="${fx(r - 1.4)}" fill="none" stroke="${P.amberHi}" stroke-width="0.9" opacity="0.85"/>
    <path d="${starPath(x, y, 5, 2.1)}" fill="${P.ink}" opacity="0.9"/>
    <ellipse cx="${fx(x - 2.6)}" cy="${fx(y - 3.6)}" rx="3.1" ry="1.7" fill="rgba(255,255,255,.55)"/>
  </g>` + label;
}

// ---- frame / compass / legend ----------------------------------------------
function frame(w: number, h: number, P: Palette): string {
  const m = 14, i = 22;
  const corner = (cx: number, cy: number, sx: number, sy: number): string =>
    `<path d="M${fx(cx + sx * 16)},${fx(cy)} L${fx(cx)},${fx(cy)} L${fx(cx)},${fx(cy + sy * 16)}" fill="none" stroke="${P.accentText}" stroke-width="2"/>`;
  return `<g opacity="0.9">
    <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="rgba(245,166,35,.30)" stroke-width="1"/>
    <rect x="${i}" y="${i}" width="${w - 2 * i}" height="${h - 2 * i}" fill="none" stroke="rgba(245,166,35,.22)" stroke-width="0.6"/>
    ${corner(i, i, 1, 1)}${corner(w - i, i, -1, 1)}${corner(i, h - i, 1, -1)}${corner(w - i, h - i, -1, -1)}
  </g>`;
}
function compass(x: number, y: number, P: Palette): string {
  // 8-point rose; each ray split into a lit (upper-left) and shadow half.
  const ray = (len: number, hw: number, rot: number, lit: string, dark: string): string =>
    `<g transform="rotate(${rot})"><path d="M0,${-len} L${-hw},0 L0,0Z" fill="${lit}"/><path d="M0,${-len} L${hw},0 L0,0Z" fill="${dark}"/></g>`;
  const major = [0, 90, 180, 270].map((r) => ray(15, 3.4, r, P.amberHi, P.amber)).join("");
  const minor = [45, 135, 225, 315].map((r) => ray(8.5, 2.2, r, "rgba(245,200,130,.65)", "rgba(245,166,35,.5)")).join("");
  return `<g transform="translate(${x},${y})" opacity="0.95">
    <circle r="20" fill="${P.legendPanel}" stroke="rgba(245,166,35,.45)" stroke-width="1"/>
    <circle r="13.5" fill="none" stroke="rgba(245,166,35,.22)" stroke-width="0.6"/>
    ${minor}${major}
    <circle r="1.7" fill="${P.ink}"/>
    <text x="0" y="-23" text-anchor="middle" class="compass-n">N</text>
  </g>`;
}
function legend(x: number, y: number, P: Palette): string {
  const row = (dy: number, swatch: string, text: string): string =>
    `<g transform="translate(0,${dy})">${swatch}<text x="20" y="4" class="legend-t">${text}</text></g>`;
  return `<g transform="translate(${x},${y})">
    <rect x="-12" y="-20" width="150" height="116" rx="12" fill="${P.legendPanel}" stroke="rgba(245,166,35,.28)" stroke-width="1"/>
    <text x="-2" y="-2" class="legend-h">LEGEND</text>
    ${row(16, `<circle cx="4" cy="0" r="6" fill="url(#amberMed)" stroke="${P.ink}" stroke-width="1.5"/>`, "Stage")}
    ${row(38, `<rect x="-2" y="-5" width="12" height="10" rx="2" fill="url(#water)"/>`, "Water")}
    ${row(60, `<use href="#tree1" transform="translate(4,0) scale(1.05)"/>`, "Forest")}
    ${row(82, `<path d="M-3,0 H11" stroke="${P.path}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 4"/>`, "Path")}
  </g>`;
}

function styleOf(P: Palette): string {
  return `
  .stage-label{font-family:"Oswald","DejaVu Sans Condensed",sans-serif;font-weight:700;font-size:10.5px;letter-spacing:.04em;fill:${P.textPrimary};stroke:${P.textHalo};stroke-width:2.6px;paint-order:stroke;}
  .title{font-family:"Oswald","DejaVu Sans",sans-serif;font-weight:700;letter-spacing:.14em;fill:${P.textPrimary};}
  .subtitle{font-family:"Oswald","DejaVu Sans",sans-serif;font-weight:500;letter-spacing:.34em;fill:${P.subtitle};}
  .legend-h{font-family:"Oswald","DejaVu Sans",sans-serif;font-weight:700;font-size:11px;letter-spacing:.18em;fill:${P.accentText};}
  .legend-t{font-family:"Albert Sans","DejaVu Sans",sans-serif;font-weight:600;font-size:11px;fill:${P.legendText};}
  .compass-n{font-family:"Oswald","DejaVu Sans",sans-serif;font-weight:700;font-size:11px;fill:${P.accentText};}
  .attr{font-family:"Albert Sans","DejaVu Sans",sans-serif;font-size:8.5px;fill:${P.attr};}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) =>
    ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch === "'" ? "&apos;" : "&quot;",
  );
}

export interface ArtOptions {
  trees: TreePoint[];
  mottle: TreePoint[];
  hillshade: Hillshade | null;
  title: string;
  subtitle: string;
  attribution: string;
  /**
   * Bake the stage medallions + name labels into the art. Default true (poster/admin use).
   * The app sets this false (DEC-050) so stages render as a crisp, tappable vector overlay
   * instead of pixelating inside the raster base.
   */
  stageMarkers?: boolean;
}

export function buildArtSvg(scene: Scene, opts: ArtOptions, P: Palette = TWILIGHT): string {
  const { width: w, height: h, areas, lines, stages } = scene;
  const venue = areaPath(areas.venue);
  const grass = areaPath(areas.grass);
  const wood = areaPath(areas.wood);
  const water = areaPath(areas.water);
  const parking = areaPath(areas.parking);
  const roads = linesPath(lines.road);
  const paths = linesPath(lines.path);

  const stageSvg = opts.stageMarkers === false
    ? ""
    : stages
        .map((s) => {
          const x = scene.affine.a * s.lng + scene.affine.b * s.lat + scene.affine.c;
          const y = scene.affine.d * s.lng + scene.affine.e * s.lat + scene.affine.f;
          return stageMarker(x, y, s.name, s.matched, P);
        })
        .join("\n");

  const fullRect = `M0,0H${w}V${h}H0Z`;
  const inner = `
  <defs><clipPath id="venueClip">${venue ? `<path d="${venue}"/>` : `<rect width="${w}" height="${h}"/>`}</clipPath></defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g clip-path="url(#frameClipRect)">
    ${venue ? `<g filter="url(#landShadow)"><path d="${venue}" fill="url(#land)"/></g>
    <path d="${venue}" fill="none" stroke="${P.venueEdge}" stroke-width="2" stroke-linejoin="round"/>` : ""}
    ${grass ? `<path d="${grass}" fill="${P.grass}" fill-opacity="0.5"/>` : ""}
    ${wood ? `<path d="${wood}" fill="${P.woodFloor}" fill-rule="evenodd"/>` : ""}
    <g id="mottle">${groundMottle(opts.mottle)}</g>
    ${parking ? `<path d="${parking}" fill="${P.parking}" stroke="rgba(255,255,255,.06)" stroke-width="0.6"/>` : ""}
    ${roads ? `<path d="${roads}" fill="none" stroke="${P.road}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${water ? `<g filter="url(#waterGlow)"><g filter="url(#waterShadow)"><path d="${water}" fill="url(#water)" fill-rule="evenodd" filter="url(#ripple)"/></g></g>
    <path d="${water}" fill="url(#waterHi)" fill-rule="evenodd"/>
    <path d="${water}" fill="none" stroke="${P.shoreline}" stroke-width="1.4" fill-rule="evenodd"/>` : ""}
    ${paths ? `<path d="${paths}" fill="none" stroke="${P.path}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2 3.5" opacity="0.9"/>` : ""}
    <g id="canopy">${treeLayer(opts.trees)}</g>
    ${reliefOverlay(opts.hillshade)}
    <path d="${venue || fullRect}" fill="url(#sun)"/>
  </g>
  ${venue ? `<path d="M0,0H${w}V${h}H0Z${venue}" fill="${P.veil}" fill-rule="evenodd"/>
  <path d="${venue}" fill="none" stroke="rgba(245,166,35,.22)" stroke-width="5" filter="url(#edgeBlur)"/>` : ""}
  <rect width="${w}" height="${h}" fill="url(#vignette)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.55"/>
  ${frame(w, h, P)}
  <text x="${w / 2}" y="46" text-anchor="middle" class="title" font-size="30">${escapeXml(opts.title.toUpperCase())}</text>
  ${opts.subtitle ? `<text x="${w / 2}" y="64" text-anchor="middle" class="subtitle" font-size="10">${escapeXml(opts.subtitle.toUpperCase())}</text>` : ""}
  <g transform="translate(${w / 2},${opts.subtitle ? 75 : 60})" opacity="0.85">
    <line x1="-62" y1="0" x2="-9" y2="0" stroke="${P.accentText}" stroke-width="1"/>
    <line x1="9" y1="0" x2="62" y2="0" stroke="${P.accentText}" stroke-width="1"/>
    <path d="M0,-3.4 L4.4,0 L0,3.4 L-4.4,0Z" fill="${P.accentText}"/>
  </g>
  ${compass(w - 50, 98, P)}
  ${legend(46, h - 116, P)}
  <g id="layer-stages">
${stageSvg}
  </g>
  <text x="${w / 2}" y="${h - 20}" text-anchor="middle" class="attr">${escapeXml(opts.attribution)}</text>
  <g id="live"></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<style>${styleOf(P)}</style>
${defs(P)}
<clipPath id="frameClipRect"><rect x="0" y="0" width="${w}" height="${h}"/></clipPath>
${inner}
</svg>`;
}
