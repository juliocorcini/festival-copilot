# FestPilot — Project Status

> Last updated: 2026-06-24 (review-remediation pass active)

## Review-Remediation Pass (2026-06-24) — ACTIVE

V1 is built and live; this pass hardens it against the live-app review (orchestrator
`documents/2026-06-24-v1-review-remediation-orchestrator.md`, gates R0→R11, P0 first). Live execution state is
`FestPilot/dev-log.md`. **Done so far: R0 (setup) ✅ · R1 (P0 data/logic) ✅ CLOSED** — festival-day derived as a
contiguous midnight-crossing block (DEC-048), Lock-in clashes now offer only true overlaps of the anchor (the
headline bug), artist photos re-ingested + live (DEC-061); app **v0.8.1**, deployed. **Next: R2 (P0 map).**

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
