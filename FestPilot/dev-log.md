# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-23-v1-implementation-orchestrator.md` and its §3 non-negotiables.
> Seeded 2026-06-23.

## Current State
- 🔨 **BUILD IN PROGRESS (2026-06-23).** Executing the orchestrator autonomously. **PHASE 0 + PHASE 1 + PHASE 2 COMPLETE + LIVE; PHASE 3 in progress.**
  Design pass + brain are done (59 screens locked, prototypes `23`–`30`).
- Active Phase / Gate: **P3 in progress** — G3.2 (travel matrix + coord→stage) ✅ domain · G3.3 (Now & Next home) ✅ — next: offline contract, map coord→stage UI, POI layer.
  Phase 0: G0.1–G0.4 ✅ (live). Phase 1: **G1.1 ✅ · G1.2 ✅**. Phase 2: **G2.1 ✅ · G2.2 ✅ · G2.3 ✅ (Lock-in + Celebration + My Plan)** — deployed.
- **P3 G3.2/G3.3 ✅ (this session):** pure `domain/travel.ts` — `metersBetween` (haversine), `buildTravelMatrix`
  (auto-estimate walk minutes from georeferenced stage coords: detour ×1.3, ~67 m/min, min 2 min, fallback flat),
  `coordToStage` (in-radius hit + nearest fallback + HIGH/MED/LOW confidence). `data/useTravelMatrix.ts` joins the
  lineup stages with the map transform's georeferenced stages → a real `TravelMatrix` (flat fallback when map absent).
  Wired into `MyPlanScreen`, `LockInScreen` (real partial-set cut feasibility). `domain/nowNext.ts` — `buildNowNext`
  (live set + next + **leave-in countdown** accounting for walk time + progress + later list). `NowScreen` rebuilt:
  plan-driven **LEAVE IN** hero when a plan exists for the active day; lineup-driven **DOORS IN** fallback pre-festival.
  11 new domain tests (travel + nowNext) + a `now` Playwright spec (hero + up-next + screenshot `phase3-now.png`).
- **P2 G2.3 ✅ (this session):** A5 **Lock in** (#12c) — gated one-at-a-time clash picker (`LockInScreen`) over the day's
  favorites: progress bar, **all-clashes** overview (`resolver.previewRemainingClashes`), **add-nearby** sheet
  (`lineup.nearbySets`), **partial-set scissors** (`resolver.pickSet`/`pickOption(cut)` + `partialSet.latestFeasibleDeparture`).
  A6 **Celebration** (#13) → persists the plan locally (DEC-041), View My Plan / Share (`lib/share.ts`, Web Share + clipboard).
  A7 **My Plan** (#21) — pure `domain/plan.ts` timeline (done/now/upcoming + walk/break gap chips); empty-state CTA; a
  **Lock in** entry added to the Timetable controls. 8 new domain tests + a full Playwright flow (favorite→resolve→celebrate→plan)
  with 3 screenshots. commit **cbdbc9b**, deployed to Pages (**5b294f17**, alias festpilot.pages.dev).
- **P2 G2.2 ✅ (this session):** A3 Timetable (#15e) — pure numeric layout (`domain/timetable.ts`: window snapped to
  local hours, sets as time-percentages, stage ordering, per-stage/​per-set fav flags) + `stageColorRgb` for the
  card recipe. `TimetableScreen` renders the TML grid: sticky time header + stage pills, dark-glass cards w/ gold
  favorites + per-card heart, live NOW line, **only-my-favs** filter and **1h/2h zoom**. Day pills from the onboarding
  weekend. 5 domain tests + Playwright grid spec (favorite→gold, filter hides non-favs, zoom widens). commit pending.
- **P2 G2.1 ✅ (this session):** pure clash-resolution **domain** (`web/src/domain/`: intervals, gated chronological
  resolver, partial-set feasibility, lineup act-mapping) — framework-free, **property-tested for the zero-overlap invariant**;
  **local-first store** (DEC-041) — versioned localStorage for onboarding/favorites/plan + React hooks (no server identity
  until Phase 4 auth); **Onboarding #17** (festival→weekend→days→swipe) gated by `RequireOnboarding`; **Lineup #22**
  (search, favorites/day filters, heart toggles). `festival.ts` weekend-date parsing hardened for the API's
  `"YYYY-MM-DD HH:MM"` shape (rolls early-morning ends back a night; never throws). commit **c89b81b**, deployed to Pages.
- **P1 ✅ (this session):** Amber-Glass app shell — 5-tab bottom nav (Now/Timetable/My Plan/Map/Squad, DEC-032),
  design-system §1–§4 tokens + glass recipe in `styles.css`, PWA manifest + branded icons (192/512/maskable +
  apple-touch), hand-written **service worker** (network-first nav, cache-first assets, network-first /api with
  offline fallback; precaches shell + map + lineup), SPA `_redirects`, typed API client (`data/api.ts`, `VITE_API_URL`),
  `react-router-dom` routing (tabs + settings stack). Screens: **Now** (A2, renders the LIVE 813-set lineup), Timetable/
  My Plan/Squad shells, **Map** (wraps the working MapView), Settings hub (B5.5), Appearance+language (B5.6),
  Offline/sync shell (B6.5), system states (B6.6). Appearance/lang are a persisted single source of truth (map palette reads it).
- **🌎 LIVE URLs (test on phone):** App → **https://festpilot.pages.dev** · API → **https://festpilot.trippilot.workers.dev**
  (`/api/festivals`, `/api/festivals/:id/lineup`, `/api/festivals/:id/stages`, `/api/festivals/:id/map`).
- **Live festival id:** `01KVVF5VERH4AB28NAM6NM65VD` (Tomorrowland Belgium 2026) — **813 performances**, 15 stages,
  2 weekends (W1/W2), all UTC instants correct. `festival_map` row published (affine + 10 georeferenced stages).
- **G0.4 ✅ (live bring-up):** D1 `festpilot` created + migrated (remote); Worker deployed (cron `0 */6 * * *`);
  live lineup ingest **status=updated, 813 changes**; Pages project `festpilot` created + `dist` deployed.
  Fixed two live issues: WAF **403** on the page (→ added `BROWSER_HEADERS`) and Workers **Illegal invocation**
  (→ call `fetch` via a local ref). Added a documented **saved-ref fallback** (`LINEUP_EVENT`/`UUID`, page tried first).
- **G0.2 ✅**: map base **444 KB / 415 KB WebP** (was 19.8 MB SVG ×2). **G0.3 ✅**: `festival_map` + map API.
- **DEC-040:** V1 map ships as a pre-rendered raster base (WebP) + live vector overlay; the ~20 MB inline-relief SVG
  is dropped from shipped assets. R2 stays out (DEC-038).
- Last green test run: 2026-06-23 — **server 32 pass**, **web 57 vitest** (domain: intervals/resolver/partialSet/lineup/
  timetable/**plan** + festival + localStore + api client + SW reg + map assets), **5 Playwright** e2e (phase0-map + phase1 shell
  + phase2 onboarding→lineup-favorites + phase2 timetable grid + **phase2 lock-in→celebrate→my-plan**). Screenshots in
  `web/e2e/screenshots/` (… + phase2-lockin-clash / phase2-lockin-done / phase2-myplan).
- typecheck: clean (server + web). build: server deploy OK; **web build OK + deployed to Pages (v0.2.0)**.
- Live: D1 **created+migrated** · Worker **deployed+ingesting** · Pages **deployed** · R2 **NOT used** (DEC-038 Q1).
- Credentials: Cloudflare token **saved + verified**. Firebase: deferred (DEC-038 Q3).
- Confidence: 90% (Phase 0 verified end-to-end in production).

## Completed (most recent first)
- [x] **P2 G2.3** — Lock-in resolver + Celebration + My Plan (DEC-017/018/029): `LockInScreen` (#12c) gated multi-option
  picker w/ progress, all-clashes overview, add-nearby sheet, partial-set scissors; Celebration (#13) persists plan
  (DEC-041) + Share (`lib/share.ts`); `MyPlanScreen` (#21) pure `domain/plan.ts` timeline (done/now/upcoming + walk/break
  chips) + empty-state CTA; Timetable "Lock in" entry. 8 new domain tests + full Playwright flow + 3 screenshots
  (57 web unit + 5 e2e green). commit **cbdbc9b**, deployed to Pages (**5b294f17**).
- [x] **P2 G2.2** — A3 Timetable (#15e, DEC-027): pure `domain/timetable.ts` (local-hour window snap, time-% set
  positions, stage ordering, fav flags) + `stageColorRgb`; `TimetableScreen` TML grid (sticky time header + stage
  pills, dark-glass cards + gold favorites + per-card heart, live NOW line, only-favs filter, 1h/2h zoom). 5 domain
  tests + Playwright grid spec. commit **b4dfc8c**, deployed to Pages.
- [x] **P2 G2.1** — onboarding + Lineup favorites + local-first domain: pure `web/src/domain/` (intervals, gated
  resolver w/ zero-overlap property tests, partial-set feasibility, lineup mapping); `localStore.ts` (DEC-041);
  `OnboardingScreen` (#17) + `RequireOnboarding` gate; `LineupScreen` (#22). Hardened `festival.ts` date parsing
  (fixed `RangeError: Invalid time value` from the API's `"YYYY-MM-DD HH:MM"` weekend dates). 44 web unit + 3 e2e green.
  Playwright config + specs ported to ESM `.js` (Node 18). commit **c89b81b**, deployed to Pages (preview 98a3beea).
- [x] **P1 (G1.1 + G1.2)** — Amber-Glass PWA shell: 5-tab nav, tokens+glass in `styles.css`, manifest + icons,
  hand-written service worker, SPA `_redirects`, typed API client (`VITE_API_URL`), react-router (tabs + settings stack);
  **Now screen reads the LIVE lineup**; Timetable/Plan/Squad shells; Map wraps MapView; Settings/Appearance/Offline/states.
  10 web unit tests + 2 Playwright e2e. Deployed to Pages, **v0.2.0**. commit pending.
- [x] **P0 G0.4** — LIVE bring-up: D1 created+migrated (remote), Worker deployed (cron), **live ingest 813 perfs**
  (fixed WAF 403 via browser headers + Workers illegal-invocation via local `fetch` ref + saved-ref fallback),
  `festival_map` published, **Pages deployed** (festpilot.pages.dev). Playwright mobile visual smoke green (+screenshot).
  Server **32 tests**, web **3 vitest + 1 e2e**. commit pending.
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
