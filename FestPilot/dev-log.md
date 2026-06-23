# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-23-v1-implementation-orchestrator.md` and its §3 non-negotiables.
> Seeded 2026-06-23.

## Current State
- Active Phase / Gate: **P0 G0.1** (bring-up & map-to-production — not started; waiting on operator intake answers)
- Last green test run: 2026-06-23 — server **25 pass / 0 fail** (web has no tests yet)
- typecheck / build: clean (server + web)
- Live: D1 **not created** · Worker **not deployed** · Pages **not connected** · R2 **not enabled (code 10042)**
- Credentials: Cloudflare token **saved + verified active** (D1/Pages/Workers scopes confirmed via list calls). Firebase: none yet.
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

## What the operator must supply
- **Cloudflare token:** ✅ DONE — in `server/.dev.vars`, verified.
- **Operator intake (`brain/operator-intake.md`):** ⏳ created 2026-06-23, awaiting answers. Blanks default to recommendations,
  so the build can start the moment the user says "intake done". Key forks: R2 enable vs static-asset map (Q1);
  lineup ingest from official site vs file (Q2); Firebase now vs later (Q3).
- **Firebase (Spark/free):** optional until Phase 4 (auth) / Phase 3 (push) — see intake Q3 + Part 5.

## Known issues / ⏳ blocked-on-credentials
- **R2 not enabled** on the account (`code 10042`). Needs a one-time dashboard enable (free tier; may ask for a card).
  Decision deferred to intake Q1 (default = ship map as static asset, no R2, fully card-free).
- Shipped map SVG currently inlines the relief raster (~19MB) — slimmed in P0 G0.2.
- System default node is v18; **must `nvm use 22`** before any wrangler/build command (`.node-version` = 22 is set).

## Next
- Wait for `brain/operator-intake.md` answers (or "intake done" to use defaults), then mirror answers into decision-log
  and start P0 G0.1: git baseline already done → slim SVG (G0.2) → D1 create + migrate + deploy Worker/Pages.
