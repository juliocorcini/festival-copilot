# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-23-v1-implementation-orchestrator.md` and its §3 non-negotiables.
> Seeded 2026-06-23.

## Current State
- 🔨 **BUILD STARTED (2026-06-23).** Executing the orchestrator autonomously from P0. Design pass + brain are done
  (all 59 screens locked, prototypes `23`–`30`; refs `2026-06-23-screen-catalog.md` + `-design-system.md`).
- Active Phase / Gate: **P0 G0.4 — point web at API + LIVE bring-up** (G0.1✅ G0.2✅ G0.3✅). Order: P0 (raster
  map → D1 → deploy Worker+Pages → live lineup API) → P1 shell → P2 … per the screen-complete §13.
- **G0.2 ✅**: map base now **444 KB / 415 KB WebP** (was 19.8 MB SVG ×2). Render pixel-faithful. 3 asset tests green.
- **G0.3 ✅**: migration `0002_festival_map.sql` + `GET /api/festivals/:id/map` (static keys → URLs + affine) +
  guarded `POST /admin/festivals/:id/map`. No R2 (DEC-038). Server tests **29 pass / 0 fail**.
- **DEC-040 (this session):** V1 map ships as a **pre-rendered raster base** (WebP) + live vector overlay; the
  ~20 MB inline-relief SVG is dropped from shipped assets (the `<img>`-loaded SVG can't fetch external relief; raster
  is small, identical, needs no network). R2 stays out (DEC-038). This satisfies orchestrator P0.2/P0.3 intent.
- Last green test run: 2026-06-23 — server **25 pass / 0 fail** on Node 22 (web tests land in P1/P2)
- typecheck: clean (server + web). build: server dry-run OK; web build pending raster swap.
- Live: D1 **not created** · Worker **not deployed** · Pages **not connected** · R2 **NOT used in V1** (DEC-038 Q1)
- Credentials: Cloudflare token **saved + verified** (D1/Pages/Workers). Firebase: deferred (DEC-038 Q3).
- Confidence: 80% (clean baseline, all context loaded).

## Completed (most recent first)
- [x] **P0 G0.3** — map data API: `festival_map` table (migration 0002) + `GET /api/festivals/:id/map` +
  guarded admin upsert; static asset keys → URLs (no R2, DEC-038); 4 sql.js tests (29 total).
- [x] **P0 G0.2** — slim the map (DEC-040): `rasterize-base.ts` (resvg+sharp) → WebP base; dropped the 20 MB SVGs;
  MapView reads `.webp`; web Vitest+Testing-Library+jsdom stack added; 3 asset tests. typecheck+build green.
- [x] **P0 G0.1** — toolchain baseline: Node 22 confirmed, server 25 tests green, brain synced (DEC-040). commit 053a35c.
- [x] Authored the master orchestrator `brain/documents/2026-06-23-v1-implementation-orchestrator.md`.
- [x] Initialized git on `master` (baseline commit pending in P0 G0.1).
- [x] Phase 1 backend — Worker ingestion + full V1 D1 schema (28 tables) + read API + cron. 25 tests green.
- [x] Map generator productized (`generateMap`) + admin map editor (`spikes/map-art`).
- [x] PWA shell started (`web/`): georeferenced map view (SVG + affine, live overlay, day/night, coarse labels).

## Decisions made this session (mirror into decision-log if structural)
- **DEC-039** — design-pass answers (group blocks per-set; no Favorites screen; auth Google+email-link, **no Apple/iOS,
  native Android-only**; profile at first join; in-app inbox; safety in Squad; admin = map-verify+lineup-dash; map POI +
  stage routing; default language English). Apple Sign-In dropped (supersedes the DEC-035 iOS blocker).
- Adopted the V1 implementation orchestrator as the execution source of truth (DEC-036).
- V1 is **$0 infra** (DEC-037): Durable Objects are FREE on the Workers Free plan (SQLite backend), so the
  WS-via-DO presence (DEC-035) costs nothing; Pages via direct upload; deploy with a Cloudflare API token.
- **Intake answered → DEC-038** (locked): no R2 (static-asset map); lineup = both weekends via the brain's
  documented capture process (`research/2026-06-23-festival-lineup-data-source.md`, don't invent); Firebase + push
  deferred (anon/local); PWA only; domain `festpilot.pages.dev`; squad cap 50; invite link no-expiry-until-event-ends;
  Cloudflare Web Analytics; **private GitHub repo wanted (gh blocker)**; autonomy confirmed; generate PRIVACY/TERMS.
- **Process:** every operator hand-off turn ends with an `AskQuestion` (workspace rule
  `.cursor/rules/always-end-with-askquestion.mdc`, alwaysApply; orchestrator §1 rule 2 clarified).

## What the operator must supply
- **Cloudflare token:** ✅ DONE — in `server/.dev.vars`, verified.
- **Operator intake (`brain/operator-intake.md`):** ⏳ created 2026-06-23, awaiting answers. Blanks default to recommendations,
  so the build can start the moment the user says "intake done". Key forks: R2 enable vs static-asset map (Q1);
  lineup ingest from official site vs file (Q2); Firebase now vs later (Q3).
- **Firebase (Spark/free):** optional until Phase 4 (auth) / Phase 3 (push) — see intake Q3 + Part 5.

## Known issues / ⏳ blocked-on-credentials
- **R2 decided OUT for V1** (DEC-038 Q1) — map ships as a static asset; no R2 bucket, no card. (`code 10042` moot.)
- **GitHub repo (DEC-038 Q13) ✅ done:** remote `origin` = `git@github.com:juliocorcini/festival-copilot.git`
  (SSH auth works for `juliocorcini`); `master` pushed + tracking. Push per phase from now on.
- Shipped map SVG currently inlines the relief raster (~19MB) — slimmed in P0 G0.2.
- System default node is v18; **must `nvm use 22`** before any wrangler/build command (`.node-version` = 22 is set).

## Next
- **Review Batch 1** (`brain/wireframes/directions/23-amber-groups-flow.html`, 8 screens) + **Batch 2**
  (`24-amber-group-timetable.html`, 6 screens: plan overview · block detail · locked-conflict+fallback · owner override ·
  split view · needs-input) → apply Julio's edits.
- **Batch 3** delivered (`25-amber-presence-consent.html`, 6 screens: pre-prompt · OS dialog · sharing mode
  (stage/precise-60min/ghost) · where's-the-squad · precise-active control · privacy settings).
- **Batch 4** delivered (`26-amber-meeting-safety.html`, 6 screens: pick spot · details · active detail w/ ETAs ·
  lifecycle (here/on-the-way/expired/cancelled) · "I'm lost" menu · safety-active broadcast + nearest help).
- **Batch 5** delivered (`27-amber-identity-settings.html`, 6 screens: sign-in (Google/email-link/guest, no Apple) ·
  magic-link sent · edit profile (upload/initials) · account (guest→save, sign out, delete) · settings hub ·
  language (EN default/PT) & appearance (auto/day/night)).
- **Batch 6** delivered (`28-amber-states-notifications.html`, 6 screens: personal gap (+ first-class breaks, Q-L) ·
  notification inbox (Q-G) · alert prefs (reminders+lead time, walk alerts, clashes, pings, squad) · OS push lock-screen ·
  offline/sync · empty/loading/error states).
- **Batch 7** delivered (`29-amber-map-poi-routing.html`, 6 screens: map+POI layer (filter chips) · nearest essentials ·
  POI detail · stage-to-stage routing ("leave by" nudge) · walking nav · layers/legend — DEC-039 Q-J).
- **Batch 8** delivered (`30-amber-admin.html`, 6 desktop screens: overview/festivals · lineup dashboard (source =
  documented capture) · **map editor drag-pins→generate** · georeference/verify (affine, fix off-position stages) ·
  POI editor · travel-time matrix — DEC-039 Q-I).
- ✅ **DESIGN PASS COMPLETE (8/8)** + ✅ **brain UI docs updated** (ui-decisions-locked §§9–16, screen-catalog,
  design-system; screen-inventory marked RESOLVED) + ✅ **orchestrator upgraded to screen-complete** (every §13
  gate lists its screens; DEC-039 Apple/iOS fixes applied throughout).
- **NEXT = START THE BUILD at P0 G0.1** (`brain/documents/2026-06-23-v1-implementation-orchestrator.md` §13):
  git baseline + node-22 pin → P0 G0.2 slim SVG → P0 G0.3 D1 create+migrate + map row → P0 G0.4 deploy
  Worker + Pages (`festpilot.pages.dev`) → live lineup API + in-app map. Then P1 shell → P2 favorites/My Plan → …
- Remember: `nvm use 22` before any wrangler/build; push per phase; end each operator hand-off with an `AskQuestion`.
