# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-23-v1-implementation-orchestrator.md` and its §3 non-negotiables.
> Seeded 2026-06-23.

## Current State
- Active Phase / Gate: **P0 G0.1** (bring-up & map-to-production — not started)
- Last green test run: 2026-06-23 — server **25 pass / 0 fail** (web has no tests yet)
- typecheck / build: clean (server + web)
- Live: D1 **not created** · Worker **not deployed** · Pages **not connected** · R2 **no bucket**
- Confidence: n/a (build not started)

## Completed (most recent first)
- [x] Authored the master orchestrator `brain/documents/2026-06-23-v1-implementation-orchestrator.md`.
- [x] Initialized git on `master` (baseline commit pending in P0 G0.1).
- [x] Phase 1 backend — Worker ingestion + full V1 D1 schema (28 tables) + read API + cron. 25 tests green.
- [x] Map generator productized (`generateMap`) + admin map editor (`spikes/map-art`).
- [x] PWA shell started (`web/`): georeferenced map view (SVG + affine, live overlay, day/night, coarse labels).

## Decisions made this session (mirror into decision-log if structural)
- Adopted the V1 implementation orchestrator as the execution source of truth (DEC-036).

## Known issues / ⏳ blocked-on-credentials
- Live Cloudflare bring-up (D1/Worker/R2/Pages) and Firebase/FCM need the operator one-time prerequisites
  (orchestrator §19). Until then, use the `--local` / `wrangler dev` equivalents and mark live steps ⏳.
- Shipped map SVG currently inlines the relief raster (~heavy) — slimmed in P0 G0.2.

## Next
- P0 G0.1: git baseline commit + `.node-version` = 22 + (optional) ESLint/Prettier; tests green; commit.
