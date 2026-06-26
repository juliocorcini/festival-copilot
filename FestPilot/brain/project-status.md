# FestPilot — Project Status

> Last updated: 2026-06-26 (native-polish roadmap **Phases 5–10 COMPLETE** + **8 council-guided improvement rounds R1–R8**; app **v0.31.6**, fully deployed to Production. See `FestPilot/dev-log.md` for the live per-round detail.)

## Native-polish roadmap + improvement rounds (2026-06-26) — COMPLETE & DEPLOYED

Source roadmap: `brain/documents/2026-06-26-native-polish-and-features-roadmap.md`. Live execution detail: `FestPilot/dev-log.md` (newest entries on top).

**Phases 5–10 (native polish & features) — shipped, v0.24.0 → v0.30.0:** group events (`group_event`, fixed-time squad commitments, D1 migration **0015**), a personal **+ squad home** (gated "Squad now" card), unified **toasts/feedback** (favorite, lock, errors), and an **a11y/perf/responsive audit** with P0–P2 fixes + report (Phase 10a `v0.29.0`, 10b `v0.30.0`). Post-phase **general review**: server + web suites, builds, 3-flow smoke, zero regressions, group-lock guardrail (e2e 30/30).

**8 council-guided improvement rounds (R1–R8) — additive, no regressions, nothing removed:**
- **R1** PERF code-split per cluster (initial bundle 555→~360 kB) · `v0.31.0`
- **R2** `StagePickSheet` drag-to-dismiss (full sheet parity) · `v0.31.1`
- **R3** touch a11y (≈44px tap targets) · `v0.31.2`
- **R4** PERF idle-prefetch of the lazy Map/Squad chunks · `v0.31.3`
- **R5** RESILIENCE app-wide `ErrorBoundary` (no blank screen on a failed lazy chunk) · `v0.31.4`
- **R6** SPA-navigation a11y (route announcer + skip-to-content + per-route title) · `v0.31.5`
- **R7** e2e hardening (shared freeze fixture via `addInitScript` → killed the `addStyleTag`/SW-reload race across 18 specs) · test-only, no bump
- **R8** A11y: keyboard **focus-trap** in the base `Sheet` (completes the WAI-ARIA modal-dialog pattern; benefits every sheet) · `v0.31.6`

**Production (deployed 2026-06-26, verified):** web **v0.31.6** at `festpilot.pages.dev` (deploy `d276f936`); Worker at `festpilot.trippilot.workers.dev` (healthy); D1 through migration **0015**. Prod smoke green (`/api/health`, `/festivals/:id/lineup|stages|map`, SPA routes 200). Tests: **web 411 unit · e2e 30/30 (1 retry-recovered SW-interaction flake, deferred R8.A) · builds OK**.

**Next (needs Julio):** safe-polish ceiling reached — the highest-value remaining work is **product** (e.g. lineup search/filters — a new feature requiring a decision-log entry), or closing the last e2e flake (**R8.A**: wait for the SW to settle after `goto`, fidelity-preserving).

---

> Last updated: 2026-06-24 (review-remediation pass **COMPLETE** — **R0–R11 all CLOSED**; admin back-office live, app **v0.14.0**; **R11.1c REOPENED + DONE** per DEC-063/064 — festival onboarding/management + map editor live; only POI editor + travel-matrix still deferred → V1.1)

## Review-Remediation Pass (2026-06-24) — ACTIVE

V1 is built and live; this pass hardens it against the live-app review (orchestrator
`documents/2026-06-24-v1-review-remediation-orchestrator.md`, gates R0→R11, P0 first). Live execution state is
`FestPilot/dev-log.md`. **Done so far: ALL P0 COMPLETE — R0 (setup) ✅ · R1 (data/logic) ✅ · R2 (map) ✅ · R3 (perf)
✅ · R4 (nav/data-states) ✅ — all CLOSED.** R1: festival-day derived as a contiguous midnight-crossing block
(DEC-048), Lock-in clashes now offer only true overlaps of the anchor (the headline bug), artist photos re-ingested +
live (DEC-061). R2: pan-clamp + safe-area fit, **interactive vector stage overlay** with a now-playing/next sheet on a
**de-baked** label-free base (DEC-050), **real coarse squad presence** on the map with an honest **out-of-venue** state
+ "show festival map" button (DEC-051/058), and a **zoomable** meeting-spot picker. R3: **shared lineup cache**
(stale-while-revalidate) — instant tab switches, no refetch/reparse. R4: API exposes the honest **data-state**
(`hasLineup`/`hasTimetable`, DEC-052); a discoverable **Timetable⇆Lineup switch** that defaults to Lineup before the
schedule is out (DEC-049); a **revisit-favorites banner** when the lineup changes (DEC-048/052); and **suggest-a-festival**
capture with an admin inbox (DEC-055). **R5 (P1 favorites) ✅ CLOSED:** a lightweight **identity** (name + optional
email, no password) at first run, persisted locally and synced to the server for metrics with country from
`CF-IPCountry` (DEC-060, migration 0010); a **real swipe** drag gesture with a first-use hint (buttons kept); a **grid**
pick mode that writes the same favorites store; **per-day grouping + per-day progress** with an intent explainer
(DEC-048); and **artist photos on every surface** via a shared `<ArtistPhoto>` (CDN `?width=` right-sizing + placeholder,
DEC-061). App **v0.10.0**, deployed to Production; Worker redeployed (identity metrics) + remote D1 migration 0010.
**R6 (P1 Now & Next) ✅ CLOSED:** the home is now **sourced, never arbitrary** (DEC-022) — the active day's locked **My
Plan** first (rich NOW + live LEAVE-IN hero), else the user's **favorites in chronological order** (now/next/later via the
new pure `chronoNowNext`), else an **honest empty state** that points to the lineup. App **v0.10.1**, deployed to
Production (frontend-only; Worker unchanged).
**R7 (P1 Timetable & Lineup polish) ✅ CLOSED:** set cards now use **one thin top stage-color line** (no doubled/bottom
line), centered heart and photos; discreet hour + **half-hour gridlines** with a Grid toggle (pure `gridLines` in
`domain/timetable.ts`); a small inset so **back-to-back sets** don't glue; and a **compact top bar** (smaller title,
single non-wrapping day row) so controls don't steal grid height. App **v0.10.2**, deployed to Production (frontend-only).
**R8 (P1 My Plan editable) ✅ CLOSED:** the locked plan is editable in place — tap a set for **Swap / Remove / View on
map**, or **Add a set** from a picker that only offers acts that fit. New pure `domain/planEdit.ts`
(`removeFromPlan`/`addToPlan`/`swapInPlan` + `fittingAdds`/`fittingSwaps`) keeps the plan **zero-overlap by construction**;
walk/break chips recompute after each edit. App **v0.10.3**, deployed to Production (frontend-only; Worker unchanged).
**R9 (P1 Squad) ✅ CLOSED:** **multiple squads** with a top switcher (data isolated per group); **honest hero copy** (dropped
the un-deliverable promises); a real **profile photo on Cloudflare R2** with a coloured-initials fallback, plus a **custom
emoji** for squads (DEC-059); **auto-share** plan + favorites on join via a one-time confirm + Settings opt-out (DEC-054);
a **real venue mini-map** on "Where's the squad" (day/night base + squad plotted) while precise sharing keeps the gradient;
**richer meeting cards** with a creator attribution + an optional **meeting-spot photo on R2** (DEC-047); and a denser squad
home (live count + avatar stack). One R2 media adapter + a D1 `media_object` quota ledger backs both photo kinds; client-side
compression keeps uploads small. App **v0.11.0**, deployed to Production; Worker redeployed (R2 binding + media routes + `photoUrl`).
**R10 (P1 Settings/polish) ✅ CLOSED — ALL P1 DONE:** a real **i18n** layer (`web/src/i18n`) with **EN as the source of truth**
and **PT as an overlay**, a pure `translate()` with EN fallback and a reactive `useT()` so the **language switch changes the
app live** (persisted); a genuine **PWA install** (captures `beforeinstallprompt`, iOS Add-to-Home steps, installed-state
detection) and an **honest update check** — the SW is registered version-stamped (`/sw.js?v=<APP_VERSION>`), no longer
`skipWaiting`s on install, and the Offline screen surfaces a real "update ready → reload"; an **About** screen with a build
date + reachable Privacy/Offline links + data-source credit; and an app-feel pass — global **no-text-selection**
(`-webkit-touch-callout` off, inputs exempt) + a WCAG **`readableInkOn()`** contrast helper applied to every initial-avatar
so ink never falls below AA on dark colours. App **v0.12.0**, deployed to Production (frontend-only; Worker unchanged at
`b5f9ce0d`).
**R11 (Admin back-office, DEC-057) ✅ CLOSED — the review-remediation pass is COMPLETE (R0–R11 all done):** a single guarded
admin back-office at `/admin`, one Hono sub-app behind `requireAdmin` (`x-admin-token` === the `ADMIN_TOKEN` secret,
**fail-closed**). It ships **Festivals overview** (KPIs + per-festival health), a **Lineup & timetable dashboard**, a
**Data-source registry** per festival (origin official_page/manual/ai_assisted + capture method, prefilled from the operational
`lineup_source`; migration 0012), a **Festival-suggestions inbox** (DEC-055), **Usage metrics + free-tier runway**, and a
**Live test console**. The metrics engine is **honest by construction**: a **pure, unit-tested** `runway.ts` estimates days-left
against verified Cloudflare free-tier limits (Workers 100k req/day · D1 5M reads / 100k writes / 5GB · R2 10GB + 1M/10M ops;
cumulative vs daily), `metricsRepo.ts` reports **only first-party measured** data (real users **excluding `is_test`**, country +
last-seen, R2 bytes from the `media_object` ledger, `me_touch` app-activity; migration 0013 adds `app_user.is_test` +
`usage_counter`), and any platform figure that needs the CF Analytics token is surfaced as a **`locked` service — never
fabricated**. The **test console** spawns `is_test=1` members into a real squad and drives their presence through the **real**
`recordFix`/`GroupRoom` pipeline (so they appear live on "Where's everyone", badged **`test`** via `isTest` on
`PresenceMemberDto`), then **purges** every test entity FK-safe — so rehearsing the map never pollutes real metrics. App
**v0.13.0**, deployed to Production; **Worker redeployed** (`a83f97e3`, admin routes + metrics + test console + `me_touch`);
remote D1 migrations **0012 + 0013** applied. Tests: **server 183 + web 256 unit · e2e 30/30 · build OK**.
**R11.1c REOPENED + CLOSED (DEC-063/064) ✅:** Julio reversed the DEC-062 deferral and asked for a complete, well-functioning
admin to **add and manage new festivals** plus the map tools, verified in a real browser. With the `plugin-browse-browser`
daemon unavailable in this WSL env, verification runs on **headless Playwright** screenshot scripts (the same engine already
green for e2e). Shipped: (1) **festival onboarding & management** — "add a festival" registers its official lineup page and
runs the **existing parametric ingest** (no new scraper, no hardcoded lineup; honest 502 if a page can't be resolved), with
per-festival + bulk **re-import** and **edit name/timezone**; the cron + "re-import all" now iterate **every** registered
festival. (2) **Map editor** — upload a base raster to **R2**, **georeference** it from ≥3 control points (ported least-squares
`fitAffine`/`residual` → 6-coeff affine + pixel-error readout), **place each stage** (numeric or click-the-map) over a live
`geoToSvg` preview, and save the `MapTransformDoc` the app actually consumes (revision auto-bump); reachable per-festival via a
contextual **Map** action. **Still deferred → V1.1 (DEC-064): the POI editor + travel-time matrix** — their tables have **no
client consumer** today, so building them now would be a dead surface; map **ART** generation stays the local Node spike (a
Worker can't render cartography). App **v0.14.0**, deployed to Production; **Worker redeployed** (`57b3f511`, festival +
multi-festival ingest + map routes). Tests: **server 197 + web 259 unit · build OK · production map-editor smoke green (0 errors)**.

## How we build from here (the orchestrator)

**The master execution plan is `documents/2026-06-23-v1-implementation-orchestrator.md`** — the single source of
*execution* truth (phase/gate order, tests, deploys, git/commits, services, autonomy constraints), modeled on
TripPilot's `implementation-prompt.md`. The live execution state lives in **`FestPilot/dev-log.md`**. The brain
stays the *product* truth; the orchestrator is the *how/when/test/ship* truth. **Git is initialized** (`master`).
Next executable work = the orchestrator's **Phase 0** (git baseline → slim map SVG → R2 + `GET /api/festivals/:id/map`
→ point `web` at the API → live Cloudflare bring-up).

## Phase

**Phase 1 (Foundation & Lineup Spine) — backend BUILT & TESTED; frontend STARTED.** The Cloudflare Worker now ingests, normalizes, stores, auto-updates (cron) and serves the Tomorrowland lineup from **D1**, with the **full V1 schema** (28 tables) designed up front. The **PWA app shell exists** (`web/`, Vite+React+TS) with its first screen — the **georeferenced map view** (SVG + affine, live presence overlay, day/night) — and there is a working **admin map editor** (`spikes/map-art/admin`, drag pins → generate). The two hardest data problems were de-risked by spikes; the V1 work is a **6-phase plan** (`implementation-phases.md` + `ai-execution-guide.md`). **Path-to-launch checklist + open decisions: `documents/2026-06-23-path-to-launch.md`.** The project runs **inline, single-agent, no subagents**.

### Codebase (new)
`FestPilot/` is an **npm-workspaces root**. `FestPilot/server/` = the Worker (Hono API + cron ingestion + D1). Scripts at the root: `npm run typecheck | test | build` (fan out to workspaces). **25 tests green**, `tsc` clean, Worker bundles (`wrangler --dry-run`).

## Done

- [x] Created repo `festival-copilot/` and copied `.cursor/` (rules, skills, doc-generator tools — no node_modules), `.agents/` design skills, `.github/` CI.
- [x] Adapted config to FestPilot (project-brain rule, brain-organizer skill, techlead, scope-template, app-design/test-routing paths, docs indexes reset, CI working-directory, README, .gitignore).
- [x] **Removed the 11 subagent personas** (`.cursor/agents/`) and cleaned every dangling reference — the project runs **inline, single-agent, no subagents** (per `inline-council-no-subagents.mdc`), finishing with AskQuestion (`never-end-chat.mdc`).
- [x] Created the brain: `README.md`, **`product-spec.md` (the first document)**, `decision-log.md`, `technical-direction.md`.
- [x] Saved the lineup data-source study in `research/`, the raw definition source in `research/base.txt`.
- [x] **Imported the Tomorrowland map seed** (KML → 10 stages matched + DreamVille areas) into `research/assets/` + study `research/2026-06-23-festival-map-seed-kml.md` (DEC-021).
- [x] **Ran the discovery councils** (brainstorm + stack/backend + group mechanics) → `documents/2026-06-23-discovery-councils-and-decisions.md`; advanced DEC-003/004/013/015 to APPROVED and added DEC-021/DEC-022.
- [x] **Validated both data spikes** (TypeScript, `tsc` clean): lineup ingestion (`spikes/lineup-ingestion/`, 813 perfs / 15 stages, all quirks handled) and map import (`spikes/map-import/`, 10/15 stages auto-matched + admin verify map).
- [x] **Wrote the V1 phase plan** (`/phases`): `implementation-phases.md` (6 phases, scored, tiered, with AI briefs) + `ai-execution-guide.md` (per-phase prompt templates).
- [x] **Phase 1 backend — Foundation & Lineup Spine (BUILT):**
  - npm-workspaces scaffold (`FestPilot/package.json` + `server/`), `wrangler.toml` (D1 binding + cron), tsconfig/vitest.
  - **Full V1 D1 schema** (`server/migrations/0001_init.sql`, 28 tables) from `documents/v1-data-model-d1-schema.md`.
  - Ported the validated spike logic verbatim → `server/src/lineup/` (resolver/normalize/types).
  - **Ingestion pipeline** (`server/src/ingest/`): hash (change detection) → fetch (resolve event+uuid, never hardcoded) → normalize → diff (added/removed/time/stage/artist) → idempotent D1 upsert (mark-inactive on removal) → record run/changes → bump `lineup_revision`.
  - **Read API** (Hono, `server/src/api/`): `GET /api/festivals`, `/festivals/:id/lineup`, `/festivals/:id/stages`; guarded `POST /admin/ingest`; `scheduled` cron handler.
  - **25 tests green** (resolver, normalize, diff, ingest orchestration, **real-migration D1 integration via sql.js**): correct UTC instants, +1s stripped, midnight handled, idempotent re-run, removed→inactive + revision bump. `tsc` clean; Worker bundles.
- [x] **Map generator productized (DEC-034)** — `spikes/map-art` is a one-call engine (`generateMap`) for any venue; added the **admin map editor** (`spikes/map-art/admin`, `npm run admin`): drag/name/verify stage pins → generate → preview day/night → export `MapInput`. Generator is Node-only (resvg/curl).
- [x] **PWA app shell started** — `web/` workspace (Vite+React+TS); first screen = the **georeferenced map view** (loads the generated **SVG + transform**, pan/zoom/pinch, **live presence overlay** via the affine, **day/night** auto+manual, **coarse stage labels** for privacy; mock presence). Builds + typechecks; dev via `npm run dev:web`.

## Open Decisions (remaining)

**None blocking.** All V1 scope is decided (2026-06-23): **DEC-023** APPROVED — **all 6 phases MUST SHIP in V1** (live presence + meeting points are non-negotiable); **DEC-013** — a pinned **group board** is in V1 (no real-time chat); **DEC-022** essentials all ship, distributed across phases. Further decisions arise per phase during the build.

**Resolved (2026-06-23):** DEC-002 (FestPilot), DEC-003 (stack), DEC-004 (backend), DEC-005 ("My Plan"/"Lock in"), DEC-013 (group mechanics + board), DEC-015 (privacy), DEC-021 (map seed), DEC-022 (V1 essentials), DEC-023 (all-MUST V1 + 6-phase order), DEC-024 (auth = Firebase, anonymous-first + social upgrade).

## Next Immediate Steps (proposed)

1. ✅ **Lineup ingestion spike (DONE)** — `spikes/lineup-ingestion/`: resolve event+uuid → CDN URLs → normalize **813 performances / 15 stages** (W1+W2); +1s fixed on all, 53 midnight-crossing, 0 orphan stages; clash detection + sample queries pass; `tsc` clean.
2. ✅ **Map import spike (DONE)** — `spikes/map-import/`: parse KML (47 features), auto-match **10/15 stages** (9 high + 1 alias), flag 5 old venues, list 5 stages for manual placement; emits `out/admin-verify.html` + `imported-features.json`; `tsc` clean.
3. ✅ **V1 phase plan (DONE)** — `implementation-phases.md` (6 phases) + `ai-execution-guide.md`.
4. ✅ **Phase 1 backend (DONE)** — Worker ingestion + full D1 schema + read API + cron, 25 tests green.
5. **Phase 1 frontend (NEXT)** — scaffold the **PWA app shell** (Vite + React + TS) that reads `/api/festivals` + `/festivals/:id/lineup` and renders the raw lineup (UC-03); add the `web` workspace + service-worker groundwork.
6. **Live D1 acceptance** (needs network): `wrangler d1 create festpilot` → paste `database_id` → `npm run db:migrate:local` → `wrangler dev` → `POST /admin/ingest` to ingest the live Tomorrowland lineup end-to-end. (Offline, this path is fully covered by the sql.js integration test.)
7. **Then Phase 2** (Favorites & "Lock in") — or finish the `/design` track first.
8. **UI direction discovery (ADVANCED)** — questionnaire answered (`documents/2026-06-23-ui-direction-discovery.md`) → **UI DNA + 3 directions** (`documents/2026-06-23-ui-dna-and-directions.md`) → **16 HTML prototypes** in `brain/wireframes/directions/`. Julio **chose "Amber Glass"** (DEC-025) and reviewed prototypes. **Locked UI decisions** captured in `documents/2026-06-23-ui-decisions-locked.md` (DEC-025→DEC-029): Amber Glass identity, Lineup≠Timetable nomenclature, Timetable layout/card model (TML-style, `15e-amber-timetable-tml.html`), onboarding festival→week→days pre-step, Lock in multi-option + nearby search. **NEXT (UI):** prototype the full onboarding flow (festival→week→days→favorite), add artist-search to Lock in, then consolidate into `design-system.md`.

## Notes

- Tomorrowland Belgium 2026 is the reference festival (DEC-020); the model is designed to generalize.
- The big architectural difference vs TripPilot: FestPilot is **not** local-first — it needs a backend (Cloudflare, DEC-004) for groups, presence, push, and the lineup updater.
- Stack is web-first React/TS + Capacitor (DEC-003): Pillars 1–2 can ship as a PWA before the native shell is needed.
