# FestPilot — Leva 3 Kickoff: Plan Sync, Insert Fix & UX Polish

> Cola isto numa sessão nova para executar a Leva 3 de ponta a ponta.

---

## Role & Mission

You are a **senior full-stack engineer** applying FestPilot Leva 3 ("Plan Sync, Insert Fix & UX Polish") **end-to-end, alone, in this single session**. No subagents, no Task tool, no delegation. You design, code, test, commit (via plumbing), and deploy gate by gate.

## Source of truth

`FestPilot/brain/documents/2026-07-08-plan-sync-ux-orchestrator.md` — read §0–§9 once, then execute G0→G6 in order without stopping.

## Wave state

- Doc is **ACTIVE** (no lock). Execute G0→G6 immediately.
- Starting version: **v0.51.0** (live). Target: **v0.52.0 → v0.57.0** (one bump per gate G1–G6).
- Baseline: web 553 + server 260 = 813 unit. E2E 37/37. Build + tsc clean.

## Autonomy contract (condensed)

1. No subagents / no Task tool. Everything inline.
2. Don't ask permission between gates — commit → deploy → next.
3. Don't narrate — do it. Token count is not a concern; fewer requests is.
4. Reuse what exists (§4 baseline map tells you what).
5. Code in English; UI text via `t()`; i18n EN+PT.
6. Domain before UI, test with the change.
7. Terminal safety: always `git --no-pager`, commit via plumbing (`G=/usr/bin/git; "$G" commit -m "…"` — git 2.25.1 rejects `--trailer`).
8. Brain sync: dev-log every milestone, DEC promotion per gate.
9. End with AskQuestion only at genuine stop (DoD all TRUE or blocker).

## Adopted decisions (no councils needed)

- DEC-109: `fittingAddsInWindow` filters candidates by gap time range.
- DEC-110: SquadPlanScreen filters events by active `dayKey` (tz-aware) before `mergeSquadTimeline`.
- DEC-111: Auto-share does initial bulk sync of all days with a closed plan; live loop observes all days.
- DEC-112: Passive presence publisher at App root + global ping banner overlay.
- DEC-113: "Next up" list uses plan (not favorites) when plan exists; `pickActiveDay` = first day with ≥70% of max stages.
- DEC-114: Lineup day filter → dropdown; squad on Now enriched; tab rename "Agora" → "Início".

## NON-NEGOTIABLES (ÂNCORA)

- `buildSquadPlan` and `mergeSquadTimeline` DO NOT CHANGE (invariance — sets never enter/reorder/drop).
- i18n `t()` always. Never hardcoded UI text.
- Code in English. Docs in Portuguese.
- Hide-never-delete.
- No forced share without prior opt-in (privacy).
- Domain pure, UI orchestrates.
- Portrait-only, native-feel (N6/N7 from Leva 2).

## Gate order

| Gate | What | Version |
|---|---|---|
| G0 | Baseline + seed + DECs PROPOSED | — |
| G1 | F01 (insert gap-filtered) + F02 (event day-filter) | v0.52.0 |
| G2 | F03 (auto-share all days) + F13 (Now "a seguir" = plan) | v0.53.0 |
| G3 | F04 (passive presence) + F05 (global ping) | v0.54.0 |
| G4 | F06 (banner dismiss) + F07 (z-index) + F08 (event day label) + F11 (roster sheet) | v0.55.0 |
| G5 | F09 (photos) + F10 (unify buttons) + F12 (double-tap) + F14 (default day) | v0.56.0 |
| G6 | F15 (dropdown) + F16 (Now squad enriched) + F18 (tab rename) + F17 DEFER | v0.57.0 |

## Deploy pipeline

- **Web:** `npm run build` → `npx wrangler pages deploy dist --project-name=festpilot --branch=master` (creds from `server/.dev.vars`).
- **Server (only if changed):** `npx wrangler deploy` in `server/`.
- **D1 migration:** only if new SQL added.
- Verify: `curl festpilot.pages.dev` new bundle hash + Worker health.

## G0 — Start

```bash
cd FestPilot/web && npm install && npm run test
cd ../server && npm install && npm run test
```

Then: seed dev-log with Leva 3 section, add DEC-109–114 to decision-log as PROPOSED, confirm baseline. **Then execute G1→G6 without stopping until the DoD is all TRUE.**

Confirm in ONE line that you read the orchestrator and started G0 — then continue without waiting for a reply.
