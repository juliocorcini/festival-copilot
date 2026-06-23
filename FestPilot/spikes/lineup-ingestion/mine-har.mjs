// One-off mining tool (throwaway, not app code): extracts the real Tomorrowland
// lineup source from a captured HAR so the ingestion spike can be built and tested
// fully offline. Prints the relevant request URLs, parses event+uuid from the CDN
// filenames, and saves JSON responses into ./fixtures/.
//
// Usage: node mine-har.mjs [path-to-har]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const HAR_PATH =
  process.argv[2] || "/mnt/c/Users/julio/Downloads/belgium.tomorrowland.com.har";
const OUT_DIR = path.join(here, "fixtures");
fs.mkdirSync(OUT_DIR, { recursive: true });

const har = JSON.parse(fs.readFileSync(HAR_PATH, "utf-8"));
const entries = har.log?.entries ?? [];
console.log(`HAR entries: ${entries.length}`);

const INTERESTING =
  /line-?up|lineup|cdn|stages|config|performance|timetable|TL\d{2}[A-Z]{2}/i;

const decodeBody = (content) => {
  if (!content?.text) return null;
  if (content.encoding === "base64") {
    try {
      return Buffer.from(content.text, "base64").toString("utf-8");
    } catch {
      return null;
    }
  }
  return content.text;
};

const safeName = (url) =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/[?#].*$/, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(-120);

const urls = new Set();
const sources = new Set(); // "event uuid" pairs found in CDN filenames
let savedCount = 0;
let pageSaved = false;

for (const e of entries) {
  const url = e.request?.url ?? "";
  if (!INTERESTING.test(url)) continue;
  urls.add(url);

  // event+uuid are encoded in CDN filenames: e.g. config-TL26BE-<uuid>.json
  const m = url.match(/(?:config|stages|performances|[A-Za-z0-9]+)-([A-Z0-9]{4,})-([0-9a-f-]{16,})\.json/i);
  if (m) sources.add(`${m[1]} ${m[2]}`);

  const body = decodeBody(e.response?.content);
  if (!body) continue;
  const mime = e.response?.content?.mimeType ?? "";
  const isJson = mime.includes("json") || /\.json(\?|$)/.test(url);

  if (isJson) {
    fs.writeFileSync(path.join(OUT_DIR, safeName(url)), body);
    savedCount++;
  } else if (!pageSaved && /line-?up/i.test(url) && mime.includes("html")) {
    // save the lineup page once, to inspect __NEXT_DATA__
    fs.writeFileSync(path.join(OUT_DIR, "lineup-page.html"), body);
    pageSaved = true;
    const nd = body.match(/__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nd) {
      try {
        fs.writeFileSync(path.join(OUT_DIR, "__NEXT_DATA__.json"), nd[1]);
      } catch {}
    }
  }
}

console.log("\n=== Interesting request URLs ===");
for (const u of [...urls].sort()) console.log(u);
console.log(`\nSaved ${savedCount} JSON responses + ${pageSaved ? "the lineup page" : "no page"} to fixtures/`);
console.log("=== event/uuid pairs found in CDN filenames ===");
for (const s of sources) console.log("  ", s);
