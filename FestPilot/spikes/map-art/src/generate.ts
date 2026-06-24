/**
 * generateMap — the reusable engine (DEC-033).
 *
 * Input: a MapInput (venue + stage pins). Output: the beautiful, georeferenced map
 * (twilight + day PNG previews, the source SVG, the GPS->SVG transform, a viewer).
 * This is exactly what the admin map-editor will call, for any festival anywhere.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import {
  buildScene, scatterTrees, pointInRings, rng,
  type Poly, type TreePoint, type Scene,
} from "./geo.js";
import { fetchRelief } from "./relief.js";
import { buildArtSvg, TWILIGHT, DAY } from "./draw.js";
import type { MapInput } from "./types.js";

const inAny = (x: number, y: number, polys: Poly[]): boolean =>
  polys.some((rings) => pointInRings(x, y, rings));

export interface GenerateOptions {
  fontFiles?: string[];
  refresh?: boolean;
  log?: (m: string) => void;
  /** Bake stage medallions/labels into the base. Default true; the app base sets it false (DEC-050). */
  bakeStageMarkers?: boolean;
}
export interface GenerateResult {
  scene: Scene;
  files: string[];
}

export function generateMap(input: MapInput, outDir: string, opts: GenerateOptions = {}): GenerateResult {
  const log = opts.log ?? (() => {});
  mkdirSync(outDir, { recursive: true });
  const id = input.festivalId;
  const scale = input.scale ?? 2;

  const scene = buildScene(input, {
    cacheFile: join(outDir, `osm-${id}.json`),
    refresh: opts.refresh,
    log,
  });
  log(`  canvas ${scene.width}x${scene.height}  affine residual max=${scene.residualPx.maxPx.toFixed(3)}px`);

  // Canopy: dense over woods + medium over the rest of the park; clearings on
  // lawns / water / parking. Densities are area-independent (per-pixel grid).
  const rand = rng(20260623);
  const wood = scatterTrees(scene.areas.wood, 9.5, 0.9, 3.4, 7.2, 12000, rand).filter((t) => !inAny(t.x, t.y, scene.areas.water));
  const big = scatterTrees(scene.areas.wood, 24, 0.95, 8.5, 13, 2200, rand).filter((t) => !inAny(t.x, t.y, scene.areas.water));
  const park = scatterTrees(scene.areas.venue, 16, 0.92, 3.2, 6.6, 8000, rand).filter(
    (t) => !inAny(t.x, t.y, scene.areas.water) && !inAny(t.x, t.y, scene.areas.parking) && !inAny(t.x, t.y, scene.areas.grass),
  );
  const trees: TreePoint[] = [...wood, ...big, ...park].sort((a, b) => a.y - b.y);
  const mottle = scatterTrees(scene.areas.wood, 34, 0.95, 14, 30, 1600, rand).filter((t) => !inAny(t.x, t.y, scene.areas.water));
  log(`  trees=${trees.length} mottle=${mottle.length}`);

  const hillshade = fetchRelief(scene, outDir, input.relief ?? "auto", input.reliefWidth ?? 2048, log);
  const attribution = `Base © OpenStreetMap (ODbL)${hillshade ? ` · ${hillshade.attribution}` : ""}`;
  const art = {
    trees, mottle, hillshade,
    title: input.title,
    subtitle: input.subtitle ?? "",
    attribution,
    stageMarkers: opts.bakeStageMarkers !== false,
  };

  const rasterize = (svg: string, file: string): void => {
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: Math.round(scene.width * scale) },
      font: { fontFiles: opts.fontFiles ?? [], loadSystemFonts: true, defaultFontFamily: "Albert Sans" },
    })
      .render()
      .asPng();
    writeFileSync(join(outDir, file), png);
  };

  const files: string[] = [];
  const svgNight = buildArtSvg(scene, art, TWILIGHT);
  const svgDay = buildArtSvg(scene, art, DAY);
  writeFileSync(join(outDir, `${id}.svg`), svgNight); files.push(`${id}.svg`);
  writeFileSync(join(outDir, `${id}-day.svg`), svgDay); files.push(`${id}-day.svg`);
  rasterize(svgNight, `${id}.png`); files.push(`${id}.png`);
  rasterize(svgDay, `${id}-day.png`); files.push(`${id}-day.png`);
  writeFileSync(join(outDir, `${id}-transform.json`), JSON.stringify(transformDoc(input, scene), null, 2));
  files.push(`${id}-transform.json`);
  writeFileSync(join(outDir, `${id}-viewer.html`), viewer(scene, `${id}.png`, `${id}-day.png`));
  files.push(`${id}-viewer.html`);

  return { scene, files };
}

function transformDoc(input: MapInput, scene: Scene): unknown {
  return {
    festival: input.festivalId,
    venue: input.title,
    canvas: { width: scene.width, height: scene.height },
    bbox: scene.bbox,
    affine: scene.affine,
    residualPx: scene.residualPx,
    // Stages travel with the transform so the app is self-contained: it can label
    // coarse presence ("at MAINSTAGE", DEC-015) and draw stage markers without a DB call.
    stages: scene.stages.map((s) => ({ name: s.name, lng: s.lng, lat: s.lat, matched: s.matched })),
    note: "x = a*lng + b*lat + c ; y = d*lng + e*lat + f. Apply at runtime as geoToSvg(lng,lat).",
    source: scene.attribution,
  };
}

function viewer(scene: Scene, nightPng: string, dayPng: string): string {
  const t = scene.affine;
  const s = scene.stages;
  const cx = s.reduce((a, p) => a + p.lng, 0) / s.length;
  const cy = s.reduce((a, p) => a + p.lat, 0) / s.length;
  const tests = [
    { lng: cx, lat: cy, kind: "me", label: "You" },
    ...(s[0] ? [{ lng: s[0].lng, lat: s[0].lat, kind: "friend", label: s[0].name.split(" ")[0] }] : []),
    ...(s[6] ? [{ lng: s[6].lng, lat: s[6].lat, kind: "meet", label: "Meet" }] : []),
  ];
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>FestPilot map — ${scene.attribution}</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Albert+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#08070a;color:#F5F0E6;font-family:"Albert Sans",system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;gap:14px;padding:22px}
  h1{font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.05em;font-size:18px;margin:0;color:#FFD874}
  .seg{display:inline-flex;background:#15110a;border:1px solid rgba(245,166,35,.3);border-radius:999px;padding:3px;gap:2px}
  .seg button{appearance:none;border:0;background:transparent;color:#cdbfa3;font:600 13px "Albert Sans",sans-serif;padding:7px 16px;border-radius:999px;cursor:pointer}
  .seg button.on{background:linear-gradient(180deg,#FFD874,#F5A623);color:#1a1206}
  .hint{font-size:12px;color:#8a7c64}
  .wrap{position:relative;width:min(94vw,560px);border-radius:20px;overflow:hidden;box-shadow:0 40px 100px -30px rgba(245,166,35,.35)}
  .wrap img{width:100%;height:auto;display:block;position:absolute;inset:0;transition:opacity .5s ease}
  .wrap img.base{position:relative}
  .wrap svg{position:absolute;inset:0;width:100%;height:100%}
  .att{font-size:11px;color:#8a7c64;max-width:560px;text-align:center}
  .pulse{animation:p 1.8s ease-out infinite}@keyframes p{0%{r:6;opacity:.55}100%{r:22;opacity:0}}
</style></head><body>
  <h1>Auto day / night — manual override</h1>
  <div class="seg" id="seg">
    <button data-m="auto" class="on">Auto</button>
    <button data-m="day">Day</button>
    <button data-m="night">Night</button>
  </div>
  <div class="hint" id="hint"></div>
  <div class="wrap">
    <img class="base" id="night" src="${nightPng}" alt="night map"/>
    <img id="day" src="${dayPng}" alt="day map"/>
    <svg viewBox="0 0 ${scene.width} ${scene.height}" preserveAspectRatio="none"><g id="live"></g></svg>
  </div>
  <p class="att">Both palettes are shipped. The app picks one by local time (Auto) and the user can override. Dots are real GPS coords through the exported affine (geoToSvg).</p>
<script>
  const T=${JSON.stringify(t)}; const TESTS=${JSON.stringify(tests)};
  const NS="http://www.w3.org/2000/svg";
  const g2s=(lng,lat)=>[T.a*lng+T.b*lat+T.c,T.d*lng+T.e*lat+T.f];
  const live=document.getElementById("live");
  const C={me:"#5ad1ff",friend:"#7CF59A",meet:"#F5A623"};
  for(const p of TESTS){const[x,y]=g2s(p.lng,p.lat);const c=C[p.kind]||"#5ad1ff";
    const ring=document.createElementNS(NS,"circle");ring.setAttribute("cx",x);ring.setAttribute("cy",y);ring.setAttribute("r","6");ring.setAttribute("fill",c);ring.setAttribute("class","pulse");
    const dot=document.createElementNS(NS,"circle");dot.setAttribute("cx",x);dot.setAttribute("cy",y);dot.setAttribute("r","5");dot.setAttribute("fill",c);dot.setAttribute("stroke","#08070a");dot.setAttribute("stroke-width","2");
    const tx=document.createElementNS(NS,"text");tx.setAttribute("x",x);tx.setAttribute("y",y-9);tx.setAttribute("text-anchor","middle");tx.setAttribute("font-size","11");tx.setAttribute("font-weight","700");tx.setAttribute("fill",c);tx.setAttribute("stroke","#08070a");tx.setAttribute("stroke-width","3");tx.setAttribute("paint-order","stroke");tx.setAttribute("font-family","Oswald,sans-serif");tx.textContent=p.label;
    live.appendChild(ring);live.appendChild(dot);live.appendChild(tx);}
  // Auto rule: daytime palette between 07:00 and 19:00 local, twilight otherwise.
  const isDaytimeNow=()=>{const h=new Date().getHours();return h>=7&&h<19;};
  let mode="auto";
  const dayImg=document.getElementById("day"),hint=document.getElementById("hint");
  function apply(){const day=mode==="day"||(mode==="auto"&&isDaytimeNow());dayImg.style.opacity=day?"1":"0";
    const h=new Date().getHours();hint.textContent=mode==="auto"?("Auto · local time "+String(h).padStart(2,"0")+":00 → "+(day?"Day":"Night")):("Manual · "+(day?"Day":"Night"));}
  document.getElementById("seg").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;mode=b.dataset.m;
    for(const x of document.querySelectorAll("#seg button"))x.classList.toggle("on",x===b);apply();});
  apply();setInterval(()=>{if(mode==="auto")apply();},60000);
</script></body></html>`;
}
