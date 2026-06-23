# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-23-v1-implementation-orchestrator.md` and its §3 non-negotiables.
> Seeded 2026-06-23.

## Current State
- Active Phase / Gate: **P0 G0.1** (bring-up & map-to-production — ready to start; intake answered, decisions locked DEC-038)
- Last green test run: 2026-06-23 — server **25 pass / 0 fail** (web has no tests yet)
- typecheck / build: clean (server + web)
- Live: D1 **not created** · Worker **not deployed** · Pages **not connected** · R2 **NOT used in V1** (DEC-038 Q1 → static-asset map)
- Credentials: Cloudflare token **saved + verified active** (D1/Pages/Workers scopes confirmed via list calls). Firebase: deferred (DEC-038 Q3).
- Confidence: n/a (build not started)

## Completed (most recent first)
- [x] Authored the master orchestrator `brain/documents/2026-06-23-v1-implementation-orchestrator.md`.
- [x] Initialized git on `master` (baseline commit pending in P0 G0.1).
- [x] Phase 1 backend — Worker ingestion + full V1 D1 schema (28 tables) + read API + cron. 25 tests green.
- [x] Map generator productized (`generateMap`) + admin map editor (`spikes/map-art`).
- [x] PWA shell started (`web/`): georeferenced map view (SVG + affine, live overlay, day/night, coarse labels).

## Decisions made this session (mirror into decision-log if structural)
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
- Start **P0 G0.1**: git baseline already done → slim SVG (G0.2: externalize relief, no R2 → bundle as static asset) →
  D1 create + migrate + deploy Worker + Pages (`festpilot.pages.dev`) → live lineup API + map. Then P1 lineup ingest
  per `research/2026-06-23-festival-lineup-data-source.md`.
