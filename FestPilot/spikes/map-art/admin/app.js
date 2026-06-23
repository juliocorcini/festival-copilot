/* FestPilot admin map editor — vanilla JS over Leaflet.
 * Stage pins are the only spatial input; "Generate" posts a MapInput to the
 * Node engine (generateMap) and previews the result. (DEC-034, §11.7) */

const state = {
  input: {
    festivalId: "tomorrowland-deschorre",
    title: "De Schorre",
    subtitle: "Tomorrowland · Boom",
    padMeters: 230,
    relief: "auto",
    reliefWidth: 3072,
    stages: [],
  },
};
const markers = [];

const $ = (id) => document.getElementById(id);
const map = L.map("map", { zoomControl: true }).setView([51.0875, 4.3485], 16);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap (reference only — never traced/baked)",
}).addTo(map);

map.on("click", (e) => addStage(e.latlng.lat, e.latlng.lng));

function icon(idx, matched) {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${matched ? "" : "unverified"}">${idx + 1}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function addStage(lat, lng, name, matched) {
  const stage = {
    name: name ?? `STAGE ${state.input.stages.length + 1}`,
    lng: +lng.toFixed(6),
    lat: +lat.toFixed(6),
    matched: matched ?? true,
  };
  state.input.stages.push(stage);
  redraw();
}

function redraw() {
  for (const m of markers) m.remove();
  markers.length = 0;
  state.input.stages.forEach((s, i) => {
    const m = L.marker([s.lat, s.lng], { icon: icon(i, s.matched), draggable: true })
      .addTo(map)
      .bindTooltip(s.name, { direction: "right", offset: [12, 0] });
    m.on("drag", (e) => {
      const ll = e.target.getLatLng();
      s.lng = +ll.lng.toFixed(6);
      s.lat = +ll.lat.toFixed(6);
    });
    m.on("dragend", renderList);
    markers.push(m);
  });
  renderList();
}

function renderList() {
  const n = state.input.stages.length;
  $("count").textContent = `· ${n} pin${n === 1 ? "" : "s"}${n < 3 ? " (need ≥3)" : ""}`;
  const box = $("stages");
  box.innerHTML = "";
  state.input.stages.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "stage" + (s.matched ? "" : " unverified");
    row.innerHTML = `
      <div class="idx" title="toggle verified">${i + 1}</div>
      <input class="name" value="${escapeHtml(s.name)}" />
      <button class="del" title="remove">✕</button>`;
    row.querySelector(".idx").onclick = () => { s.matched = !s.matched; redraw(); };
    row.querySelector(".name").oninput = (e) => {
      s.name = e.target.value;
      markers[i]?.setTooltipContent(s.name || " ");
    };
    row.querySelector(".del").onclick = () => { state.input.stages.splice(i, 1); redraw(); };
    box.appendChild(row);
  });
  $("generate").disabled = n < 3;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---- top inputs <-> state ----
const bind = (id, key, num) => {
  const el = $(id);
  el.value = state.input[key] ?? "";
  el.oninput = () => { state.input[key] = num ? +el.value : el.value; };
};
function bindAll() {
  bind("festivalId", "festivalId");
  bind("title", "title");
  bind("subtitle", "subtitle");
  bind("padMeters", "padMeters", true);
  bind("reliefWidth", "reliefWidth", true);
  const r = $("relief");
  r.value = state.input.relief;
  r.onchange = () => { state.input.relief = r.value; };
}

function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), ms);
}

// ---- actions ----
async function loadSeed() {
  try {
    const seed = await fetch("/api/seed/deschorre").then((r) => r.json());
    state.input = { ...seed, stages: seed.stages ?? [] };
    bindAll();
    redraw();
    if (state.input.stages.length) {
      map.fitBounds(L.latLngBounds(state.input.stages.map((s) => [s.lat, s.lng])).pad(0.4));
    }
    toast(`Loaded ${state.input.stages.length} stages from the KML seed`);
  } catch (e) {
    toast("Seed unavailable — add pins manually");
  }
}

function download() {
  const blob = new Blob([JSON.stringify(state.input, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.input.festivalId || "festival"}.json`;
  a.click();
}

let lastId = null;
async function generate() {
  const btn = $("generate");
  btn.disabled = true;
  btn.textContent = "Generating… (OSM + relief, ~30s)";
  try {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state.input),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "generate failed");
    lastId = state.input.festivalId;
    showPreview("night");
    const res = data.transform.residualPx;
    $("meta").innerHTML =
      `Canvas ${data.transform.canvas.width}×${data.transform.canvas.height} · ` +
      `affine residual max ${res.maxPx.toFixed(2)} px · ${data.transform.source}<br/>` +
      `<a href="/out/${lastId}-viewer.html" target="_blank">Open live viewer (day/night + GPS dots)</a>`;
    $("overlay").classList.add("show");
    toast("Map generated");
  } catch (e) {
    toast("Error: " + e.message, 5000);
  } finally {
    btn.disabled = state.input.stages.length < 3;
    btn.textContent = "Generate map";
  }
}

function showPreview(palette) {
  if (!lastId) return;
  const file = palette === "day" ? `${lastId}-day.png` : `${lastId}.png`;
  $("preview").src = `/out/${file}?t=${Date.now()}`;
  for (const b of document.querySelectorAll("#seg button")) b.classList.toggle("on", b.dataset.p === palette);
}

$("seg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) showPreview(b.dataset.p);
});
$("loadSeed").onclick = loadSeed;
$("download").onclick = download;
$("generate").onclick = generate;

bindAll();
redraw();
loadSeed();
