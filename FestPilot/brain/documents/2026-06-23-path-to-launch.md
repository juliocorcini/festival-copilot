# FestPilot — Path to Launch (what's left to build + decide)

> Created 2026-06-23, after building the **admin map editor** (`spikes/map-art/admin`) and the
> **app map view** (`web/` — the PWA shell's first screen: georeferenced map + live presence
> overlay). This is the running checklist to take FestPilot from "spikes + backend" to a
> shippable V1. Pairs with `implementation-phases.md` (the 6-phase plan), `project-status.md`,
> and the map plan (`2026-06-23-realtime-map-technical-plan.md` §11).

## Where we are now (built)

- **Backend (Phase 1)**: Cloudflare Worker — lineup ingest (cron) + read API + **full V1 D1 schema** (28 tables). 25 tests green. *Not yet deployed to a live D1.*
- **Map generator (DEC-033/034)**: one-call `generateMap(input)` → beautiful, georeferenced map (twilight+day SVG, transform.json) for any venue. **Node-only** (resvg + curl).
- **Admin map editor (NEW)**: `cd spikes/map-art && npm run admin` → drag/name/verify stage pins on a reference base map → **Generate** runs the engine → previews day/night. Exports the `MapInput`.
- **App map view (NEW)**: `npm run dev:web` → loads the generated **SVG + transform**, pan/zoom (drag/wheel/pinch), **live presence overlay** (me/friends/meet via the affine), **day/night** (auto by local time + manual), **coarse "at STAGE" labels** (privacy). Mock presence for now.

## A. Build tasks (engineering)

### A1. Map → production (turn the spike into a real feature)
1. **Externalize the relief** so the shipped SVG is small. Today the SVG inlines a 13 MB base64 hillshade (→ ~20 MB/file) — too heavy for mobile. Make `generateMap` write `relief-<id>.png` and reference it (`<image href>`); SVG drops to ~2–3 MB. *(Blocks in-app map.)*
2. **Asset storage + serving**: provision **R2**; add a `festival_map` table (festivalId, svg keys night/day, relief key, `transform_json`, revision, updated_at). Worker route `GET /api/festivals/:id/map` → URLs + transform. App reads from there instead of `/public/maps`.
3. **Where `generateMap` runs in prod** (it can't run in a Worker): stand up a **small Node job** — a container/CI step/cron — invoked by an admin "Generate & publish" action; it runs the engine and uploads to R2 + upserts `festival_map`. (For now the admin tool runs locally and uploads manually.)
4. **Admin editor → persist pins**: on save, write pins to **`stage_location`** (lat/lng, `verified`, source) and trigger A3. Today the editor only writes files. Add a Worker admin route (guarded) for this.
5. **Deep-zoom delivery decision in code**: ship the slim vector SVG (good to ~10×) and/or pre-bake a raster tile pyramid for extreme zoom. Start with SVG.
6. **POI layer** (Phase 3): toilets/water/food/medical/exits/ATM/charging/lockers from the KML seed, admin-verified, rendered as a togglable overlay (same affine).
7. *(Polish)* bespoke **per-stage icons** (Recraft V4 Vector) replacing the generic medallion; optional **Route B** painterly skin (needs GPU).

### A2. App shell / PWA (Phase 1–2 frontend)
8. **App scaffolding around the map**: nav (Home/Lineup/Timetable/Map/Group), routing, offline **service worker** (cache app shell + map asset + lineup JSON), install manifest icons.
9. **Lineup + Timetable screens** wired to the Worker API (`/api/festivals`, `/lineup`, `/stages`) — the TML-style timetable (DEC-026) and onboarding (festival→week→days→favorite, DEC-027).
10. **My Plan / "Lock in"** (Phase 2): favorites, gated clash resolver, partial-set editor (travel-time stub → real matrix in Phase 3).

### A3. Realtime + presence (Phase 5/6) — needed for the live map to be real
11. **Per-group Durable Object** (DEC-004): presence state + WebSocket fan-out; raw GPS **server-only**, clients get **coarse** stage labels (DEC-015). Replace mock presence in `web/src/map/presence.ts`.
12. **Battery-aware GPS sampling** (DEC-012/022): on map-open + significant-move + low-freq timer; last-known fallback.
13. **Meeting points + bearing arrow** (Phase 6) on the same overlay.

### A4. Cross-cutting platform
14. **Auth (DEC-024)**: Firebase Auth (anonymous-first + social upgrade); Worker verifies ID tokens; per-user data keyed by uid.
15. **Push (FCM)**: lineup-change alerts (Phase 3) + walk-time reminders + where-is-everyone nudges; web-push has iOS PWA limits → informs A-decision on native.
16. **Deploy**: Worker to production + live **D1** (`wrangler d1 create` → migrate → first ingest), **R2** bucket, **PWA hosting** (Cloudflare Pages) + domain, secrets (`ADMIN_TOKEN`, Firebase, FCM).
17. **Privacy/legal**: location-consent UX, privacy policy, attribution/credits screen (OSM ODbL + DHMV + AWS terrain).

## B. Decisions — RESOLVED 2026-06-23 (see DEC-035)

- **Client target**: **PWA now → wrap with Capacitor before public launch** (web-first, then native for iOS push + background GPS).
- **Release cut line**: **DEC-023 reaffirmed — all 6 phases ship before any public release** (presence + meeting points are in V1).
- **Presence transport**: **WebSocket via per-group Durable Object**.
- **Auth**: Firebase **anonymous-first + Google + email/password**. ⚠️ **Apple Sign-In deferred** — the iOS App Store *requires* "Sign in with Apple" when any third-party social login (Google) is offered, so Apple must be added before the native iOS release (or the iOS build ships email/anonymous only).
- **Venues**: **Tomorrowland / De Schorre only for V1** (engine already generalizes; 2nd venue is post-launch).
- **Tech (recommended, accepted)**: `generateMap` runs as a **managed Node job** triggered from admin (local tool + manual upload for now); **slim vector SVG + external relief + R2** for the map asset; **admin pin editor = source of truth** for `stage_location` (KML = seed); **relief `auto`** default; **Cloudflare** stack (Workers + D1 + R2 + DO + Pages).

## B (original). Decisions considered

1. **`generateMap` host in prod** — local admin tool + manual upload (now) vs a managed **Node container/CI job** triggered from admin (target). Pick the V1 answer.
2. **V1 client target** — **PWA-only** vs **Capacitor native** at launch (DEC-003 says web-first). Drives push/background-GPS capability for presence; decide before A3/A4.
3. **Presence transport** — **WebSocket via Durable Object** (richer, live) vs short-poll (simpler) for V1. Affects battery + cost.
4. **Map base in app** — slim **vector SVG** (recommended) vs raster **tiles**; and whether to keep **both palettes** as two assets (current) or one + CSS filter.
5. **Stage-placement workflow** — is the **admin pin editor the single source of truth** for `stage_location` (recommended), with the KML import as a one-time seed? Confirm.
6. **Relief everywhere** — keep `auto` (Flanders LiDAR + global AWS fallback) as default for any festival? Confirm the global tier is acceptable quality for non-Flanders venues.
7. **Auth providers** — which social logins for the upgrade path (Google/Apple/email)? Apple needed if we ship native iOS.
8. **Hosting/region + cost ceiling** — Cloudflare Pages + Workers + D1 + R2 + DO; confirm the plan/limits for festival-weekend spikes.
9. **Scope cut line for first public release** — full 6 phases (DEC-023 says all MUST) vs a soft-launch with Phases 1–4 (personal + group plan) and presence/meeting (5–6) as a fast-follow. Reaffirm or relax.
10. **Multi-festival timing** — De Schorre/Tomorrowland only for V1, or prove a 2nd venue end-to-end (the generator already generalizes) before launch?

## C. Suggested sequence (fastest credible path)

1. **Map to prod**: A1.1 (slim SVG) → A1.2 (R2 + `festival_map` + map API) → point `web` at the API. *(Map becomes a real, light, in-app feature.)*
2. **Deploy the spine**: A4.16 (live D1 + first ingest + Worker deploy) → wire **Lineup/Timetable** (A2.9) + onboarding. *(A usable app: real lineup + beautiful map.)*
3. **Personal**: A2.10 My Plan / Lock in (Phase 2). + **Auth** (A4.14).
4. **Groups**: Phase 4 (shared timetable + board) → **presence DO** (A3.11–12) replacing mock → meeting points (A3.13).
5. **Push + polish**: A4.15, POI layer (A1.6), privacy/legal (A4.17), per-stage icons.
6. **Decide native vs PWA** (B2) before investing in push/background-GPS depth.

> Two things are the immediate unblockers for the *map* specifically: **(1) slim the SVG** and
> **(2) store/serve the asset from R2 + a map API**. Everything else in the app layer can proceed
> against the running `web` shell built today.
