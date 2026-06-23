/**
 * Admin map-editor server (DEC-034, §11.7).
 *
 * The map generator is Node-only (resvg + curl + fs), so it cannot run inside a
 * Cloudflare Worker. This tiny local server is the realistic "admin generate"
 * surface: it serves the pin editor and exposes the engine over HTTP.
 *
 *   npm run admin            # then open http://localhost:8799
 *
 *   GET  /                    -> the editor page
 *   GET  /api/seed/deschorre  -> a ready MapInput (KML seed) to prefill
 *   POST /api/generate        -> body = MapInput JSON -> runs generateMap -> { files, transform }
 *   GET  /out/<file>          -> generated assets (previews / svg / transform / viewer)
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMap } from "../src/generate.js";
import { deSchorreInput } from "../src/seed.js";
import type { MapInput } from "../src/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "out");
const FONT_DIR = join(ROOT, "fonts");
const fontFiles = [join(FONT_DIR, "Oswald.ttf"), join(FONT_DIR, "AlbertSans.ttf")].filter(existsSync);
const PORT = Number(process.env["PORT"] ?? 8799);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function send(res: import("node:http").ServerResponse, status: number, body: string | Buffer, type = "text/plain"): void {
  res.writeHead(status, { "content-type": type, "access-control-allow-origin": "*" });
  res.end(body);
}

function serveFile(res: import("node:http").ServerResponse, path: string): void {
  if (!existsSync(path)) return send(res, 404, "not found");
  send(res, 200, readFileSync(path), MIME[extname(path)] ?? "application/octet-stream");
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (req.method === "GET" && (path === "/" || path === "/index.html")) {
      return serveFile(res, join(HERE, "index.html"));
    }
    if (req.method === "GET" && path === "/app.js") {
      return serveFile(res, join(HERE, "app.js"));
    }
    if (req.method === "GET" && path === "/api/seed/deschorre") {
      return send(res, 200, JSON.stringify(deSchorreInput()), MIME[".json"]!);
    }
    if (req.method === "GET" && path.startsWith("/out/")) {
      const rel = normalize(path.slice("/out/".length)).replace(/^(\.\.(\/|\\|$))+/, "");
      return serveFile(res, join(OUT, rel));
    }
    if (req.method === "POST" && path === "/api/generate") {
      const input = JSON.parse(await readBody(req)) as MapInput;
      if (!input.festivalId || !Array.isArray(input.stages) || input.stages.length < 3) {
        return send(res, 400, JSON.stringify({ error: "need festivalId + >=3 stages" }), MIME[".json"]!);
      }
      const log: string[] = [];
      const res2 = generateMap(input, OUT, { fontFiles, refresh: url.searchParams.has("refresh"), log: (m) => log.push(m) });
      const transform = JSON.parse(readFileSync(join(OUT, `${input.festivalId}-transform.json`), "utf8"));
      return send(res, 200, JSON.stringify({ ok: true, files: res2.files, transform, log }), MIME[".json"]!);
    }
    send(res, 404, "not found");
  } catch (e) {
    send(res, 500, JSON.stringify({ error: String((e as Error)?.message ?? e) }), MIME[".json"]!);
  }
});

server.listen(PORT, () => {
  console.log(`\n  FestPilot admin map-editor → http://localhost:${PORT}\n`);
});
