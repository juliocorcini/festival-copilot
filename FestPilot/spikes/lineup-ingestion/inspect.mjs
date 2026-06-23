// Inspect the real CDN fixtures to learn the JSON shapes for the normalizer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const F = (n) => path.join(here, "fixtures", n);
const uuid = "9205196e-3eef-45c0-a82e-72aa1bb3cf8f";

const w1 = JSON.parse(
  fs.readFileSync(F(`artist-lineup-cdn.tomorrowland.com_TL26BE-W1-${uuid}.json`), "utf-8")
);
const top = Array.isArray(w1) ? `array(${w1.length})` : `object{${Object.keys(w1).join(",")}}`;
console.log("W1 top-level:", top);
const perfs = Array.isArray(w1) ? w1 : w1.performances || w1.data || w1.items || [];
console.log("W1 performances count:", perfs.length);
console.log("--- first performance ---");
console.log(JSON.stringify(perfs[0], null, 2));
console.log("--- a performance with multiple artists (if any) ---");
console.log(JSON.stringify(perfs.find((p) => (p.artists?.length ?? 0) > 1) ?? perfs[1], null, 2));

// Locate event+uuid inside __NEXT_DATA__ (resolver target)
const nd = JSON.parse(fs.readFileSync(F("__NEXT_DATA__.json"), "utf-8"));
let found = null;
(function walk(o, p = []) {
  if (found || !o || typeof o !== "object") return;
  for (const k of Object.keys(o)) {
    if (typeof o[k] === "string" && o[k] === uuid) {
      found = { path: [...p, k], parent: o };
      return;
    }
    walk(o[k], [...p, k]);
  }
})(nd);
console.log("\n=== __NEXT_DATA__ uuid path ===");
console.log("path:", found?.path?.join("."));
console.log("parent object:", JSON.stringify(found?.parent, null, 2));
