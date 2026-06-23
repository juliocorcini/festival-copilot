# askFestPilot — V1 Implementation Orchestrator (the single source of execution truth)

> Last updated: 2026-06-23
> **Status:** ACTIVE — this is the master execution document for shipping FestPilot V1.
> **Modeled on** TripPilot's `brain/documents/implementation-prompt.md` (proven Tier-3 autonomous build),
> adapted to FestPilot's npm-workspaces monorepo + Cloudflare D1/Hono/Durable-Objects stack and the
> 6-phase plan in `implementation-phases.md`.
>
> **How to read everything else:** the brain is the source of *product* truth (`product-spec.md`,
> `decision-log.md`, `technical-direction.md`, `implementation-phases.md`, `documents/v1-data-model-d1-schema.md`,
> `documents/v1-use-cases.md`). **This document is the source of *execution* truth:** the order, the tests,
> the deploys, the commits, the git workflow, the constraints. When product detail is needed, this doc points
> you to the exact brain section. When sequencing/tests/deploy/commits are needed, the answer is *here*.

---

## 0. Mission (read this first)

You are a senior full-stack engineer implementing **FestPilot V1 end-to-end, alone, in this session**.
Everything the app does is already decided (3 pillars + on-site essentials + togetherness layer, DEC-016/022/023).
The data model, the UI direction, the map engine, and the Phase-1 backend **already exist** (see §4 Baseline).
**The full UI is also designed (2026-06-23 8-batch pass): all 59 V1 screens are locked as Amber-Glass prototypes
(`brain/wireframes/directions/`), catalogued in `2026-06-23-screen-catalog.md`, with tokens in
`2026-06-23-design-system.md`. Each gate in §13 lists its exact screens — build only what the catalog defines
(DEC-039).** Your job is to turn the current state — *spikes + backend + a PWA map view* — into a **shipped,
deployed, tested V1** following the 6 phases, **without stopping and without asking the user anything**.

**One-paragraph product reminder:** FestPilot is a festival companion. You (1) browse the lineup and **favorite**
artists (overlaps allowed); (2) **Lock in** a conflict-free personal **My Plan** (chronological clash resolution,
partial sets, walk-time); (3) create/join a **group** to build a shared timetable, see each other **coarsely**
on a beautiful georeferenced **map**, ask "where is everyone?", and drop temporary exact **meeting points**.
Reference festival: **Tomorrowland Belgium 2026 / De Schorre** (DEC-020); the model generalizes.

**Go to §20 to start.** Everything between here and there is the contract you execute under.

---

## 1. Identity & absolute rules (autonomy contract)

You are the **executor**, not a coordinator. You implement, test, deploy, and commit yourself.

**ABSOLUTE RULES — never violate (these mirror TripPilot's `inline-council-no-subagents.mdc`,
`tech-lead-delegation.mdc`, `execution-style.mdc`, plus this project's autonomous mandate):**

1. **NO subagents / NO Task tool / NO delegation.** Everything is done inline, in this one session. Multiple
  perspectives = multiple *sections of one response*, never multiple agents. (Override only if the user says,
   in that message, "use a subagent / run in parallel".)
2. **DO NOT ask the user for confirmation to proceed.** The scope is fully specified here and in the brain.
  The user is not available to give OK. Decide with the documented defaults and keep going.
   *(Hand-off exception — workspace rule `always-end-with-askquestion.mdc`:* never pause **mid-build** to ask,
   but when you **do** yield control — gate reached, context out, done, or a **cost/credential blocker** —
   the **final message ends with an `AskQuestion`** offering next steps: continue / review / handle blocker / stop.)
3. **DO NOT stop because "this is a lot of work" or "the chat is long."** Continue until the §15 Stop Criteria
  are all TRUE, or until context genuinely runs out (then finish the current gate cleanly, commit+deploy,
   write the dev-log handoff, and PARE LIMPO).
4. **DO NOT summarize what you are about to do — do it.** Minimize narration; every token counts in a long run.
5. **All code, identifiers, comments, commit messages, file names → English.** UI copy → Portuguese via i18n
  (localizable). This document and the brain are English.
6. **Backend before frontend**, one feature at a time, **test alongside build** (§8).
7. **Reuse the spikes and the existing code — never reinvent** what §4 says is already built.
8. **Respect WSL pager safety** (§14): always `git --no-pager …`, always `git commit -m`, never open
  `less`/`vim`/interactive flags in the agent terminal.
9. **Keep the brain in sync** (§17): update `dev-log.md` every milestone, `project-status.md` every phase,
  `decision-log.md` on any new decision.

If a genuine ambiguity appears that the brain does not resolve: **pick the most reasonable option consistent
with the decisions, write it as a new `DEC-NNN` (PROPOSED) in `decision-log.md`, and continue.** Do not block.

---

## 2. Reading order (load context once per phase, then build)

At the **start of each phase**, read (in this order), then implement:

1. **This document** — the phase's gate(s) in §13.
2. `brain/implementation-phases.md` — the matching Phase section (use cases, ACs, AI brief, risks).
3. `brain/technical-direction.md` — the relevant architecture/algorithm section.
4. `brain/documents/v1-data-model-d1-schema.md` — the tables/columns you touch.
5. `brain/documents/v1-use-cases.md` — the UC IDs the phase implements.
6. `brain/decision-log.md` — only the `DEC-NNN` entries cited by the phase.
7. UI phases additionally: `brain/documents/2026-06-23-ui-decisions-locked.md` (DEC-025→029, §§9–16 for the social
  layer/identity/notifications/map/admin), the `**2026-06-23-screen-catalog.md`** entries for the gate's screens,
   `2026-06-23-design-system.md` (tokens/components), and the relevant prototype in `brain/wireframes/directions/`.
8. Map phases additionally: `brain/documents/2026-06-23-realtime-map-technical-plan.md` (§8/§10/§11) and
  `spikes/map-art/README.md`.

Do **not** re-read the whole brain every milestone — read once per phase, then rely on the dev-log + this doc.

---

## 3. Non-negotiables (re-read before EVERY gate)

These are invariants. Breaking one is a defect even if tests pass. (Each cites its decision.)

- **Lineup is never hardcoded** — resolve `event`+`uuid` from the official page, then fetch CDN JSON (DEC-009).
Users always read **our** DB, never the festival site. Removed acts → `active=false`, never hard-deleted.
- **Times are correct** — store UTC instants + festival timezone; strip the **+1s** end quirk; handle
**midnight-crossing** sets so clash math is right (technical-direction §3).
- **A locked My Plan has ZERO overlaps** — the clash resolver is chronological, one-at-a-time, gated (DEC-017).
- **Money/identity/time are pure-TS in the domain layer** — no business math inside React components.
- **Presence is coarse + honest** — raw `lat/lng` lives **server-side only**; clients receive
**stage + confidence + expiry** (DEC-007/008/015). Clients **never** receive raw presence coordinates.
- **Exact coordinates leave a device only via explicit intent** — meeting points or the safety action (DEC-014/015).
- **Sharing is per-active-group and time-boxed**, with a one-tap "disappear from map" (DEC-015).
- **No background-location requirement** — presence = foreground GPS + push-reply + manual fallbacks (DEC-012);
this keeps us store-compliant (DEC-003).
- **No full real-time chat in V1** — a lightweight pinned **group board** only (DEC-013).
- **All 6 phases MUST SHIP in V1** (DEC-023); "cut from the bottom" is an emergency lever, not a plan.
- **Map: live overlay is always a separate vector layer** — labels/pins/friends/meeting are **never baked**
into the illustration (DEC-030/034). Stage placement truth = the **admin pin editor** (DEC-034/035).
- **Visual identity = "Amber Glass"** (DEC-025): warm dark base, amber/gold accent, reflective glass,
Oswald titles / Albert Sans body. Must not look "AI-made" (no neon purple/pink, no Inter/DM Sans).
- **Auth**: Firebase, **anonymous-first**; permanent account (**Google + email-link only — no Apple, no iOS**;
native is **Android-only**, DEC-039) required only to create/join a group; Workers verify the ID token behind
`getUserFromRequest()` (DEC-024/039).

---

## 4. Baseline — what is ALREADY BUILT (do NOT rebuild)

> Verified 2026-06-23. Treat this as done; extend it, don't recreate it.

**Monorepo** — `FestPilot/` is an **npm-workspaces** root (`package.json` → workspaces `["server","web"]`).
Root scripts fan out: `npm run typecheck | test | build` (`--workspaces --if-present`), plus
`npm run dev:server`, `npm run dev:web`. Node engine `>=18.17` (we standardize on **Node 22** — see §5).
`tsconfig.base.json` is the shared TS base.

`**FestPilot/server/` — Cloudflare Worker (`@festpilot/server`), Phase 1 DONE, 25 tests green:**

- `src/index.ts` — Worker entry: mounts `/api`, guards `POST /admin/ingest`, `scheduled` cron handler.
- `src/api/{routes,repo,dto}.ts` — Hono read API: `GET /api/health`, `/api/festivals`,
`/api/festivals/:id/lineup?weekend&day`, `/api/festivals/:id/stages`. CORS enabled.
- `src/lineup/{resolver,normalize,types}.ts` — ported verbatim from the validated spike (resolve source,
normalize times: +1s, midnight, timezone).
- `src/ingest/{hash,source,normalize→via lineup,diff,ingest,store}.ts` — change-detect → fetch → normalize →
diff (added/removed/time/stage/artist) → idempotent D1 upsert (mark-inactive) → record run/changes →
bump `lineup_revision`.
- `src/db/ids.ts`, `src/env.ts`.
- `migrations/0001_init.sql` — **full V1 D1 schema, 28 tables** (from `documents/v1-data-model-d1-schema.md`).
- `wrangler.toml` — `main`, `compatibility_date`, cron `0 */6 * * *`, `[vars]` (LINEUP_PAGE_URL, FESTIVAL_*),
`[[d1_databases]]` binding `DB` name `festpilot` `**database_id = "REPLACE_WITH_DATABASE_ID"`** (placeholder),
`migrations_dir`. ADMIN_TOKEN is a secret.
- Scripts: `dev` (`wrangler dev`), `typecheck`, `test` (`vitest run`), `build` (`wrangler deploy --dry-run`),
`db:create`, `db:migrate:local`, `db:migrate`. Deps: `hono`. Dev: `wrangler ^3`, `vitest ^2`, `sql.js`
(real-migration integration test), `@cloudflare/workers-types`, `typescript`.
- **NOT yet:** deployed to a live D1; no R2; no `festival_map`/map API; no auth verification; no groups/presence.

`**FestPilot/web/` — PWA shell (`@festpilot/web`), Phase 1 frontend STARTED:**

- Vite 5 + React 18 + TS. `src/{App,main}.tsx`, `src/styles.css` (Amber Glass).
- `src/map/` — `MapView.tsx` (loads SVG + transform, pan/zoom/pinch, live overlay via affine, day/night
auto+manual, coarse "at STAGE" labels), `transform.ts` (`geoToSvg`, `nearestStage`, `coarseLabel`),
`usePalette.ts`, `usePanZoom.ts`, `presence.ts` (**mock** — replace in Phase 5).
- `public/maps/` — `tomorrowland-deschorre.svg`, `-day.svg`, `-transform.json` (current heavy SVG inlines
relief — Phase 0 slims this). Build = `tsc --noEmit && vite build`.
- **NOT yet:** app shell/nav/routing, service worker, lineup/timetable/onboarding/My-Plan/group screens,
reads still from `/public/maps` (not the API).

`**FestPilot/spikes/` — validated, Node-only (don't ship as-is; port what each phase needs):**

- `lineup-ingestion/` (resolver/normalize/overlaps — already ported into `server/`).
- `map-import/` (KML → `ImportedMapFeature` + auto-match + admin verify map).
- `map-svg/` (OSM → georeferenced base SVG + affine fit, residual ≈0.007px).
- `map-art/` — **the productized map engine** `generateMap(input, outDir)` + the **admin map editor**
(`npm run admin`, port 8799: drag/name/verify stage pins → generate → preview day/night → export `MapInput`).
Outputs `<id>.svg` + `-day.svg` (deep-zoom vector) + `-transform.json` + previews + viewer. See its README.

**Repo-level:** `.gitignore` (covers node_modules/dist/.wrangler/.dev.vars/out/coverage/playwright),
`.github/workflows/ci.yml` (Node 22 → `npm ci` → typecheck → test → build; **no e2e/deploy yet**),
`.cursor/rules/` (14 rules incl. inline-no-subagents, never-end-chat, phase-delivery-hardening,
velocity-standard, test-routing). **Git initialized on `master` 2026-06-23** (baseline commit is Phase-0 task).

---

## 5. Services, accounts & environments

**Platform = Cloudflare** (DEC-004) + **Firebase** (auth + FCM, DEC-024). Hosting mirrors TripPilot
(Worker + Pages), with the additions FestPilot needs (D1, R2, Durable Objects) because it is **server-authoritative**
(multi-user), unlike TripPilot's local-first Dexie model.


| Concern               | Service / binding                                  | Notes                                                                                                           |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| API + cron + realtime | **Cloudflare Workers**                             | one Worker `festpilot`; entry `server/src/index.ts`                                                             |
| Relational store      | **D1** `festpilot`, binding `DB`                   | schema in `migrations/`; created in Phase 0                                                                     |
| Per-group realtime    | **Durable Objects** (Free plan, **SQLite-backed**) | `GroupRoom` DO (Phase 4 plan + board + presence fan-out via WS); `new_sqlite_classes` in wrangler. $0 (DEC-037) |
| Map assets + photos   | **R2** bucket `festpilot-assets`                   | map SVG/relief (Phase 0), meeting-point photos (Phase 6)                                                        |
| Source hashes / cache | **KV** `LINEUP_CACHE`                              | optional; change-detection snapshots                                                                            |
| Web hosting           | **Cloudflare Pages** project `festpilot`           | builds `web/`; production branch `**master`**                                                                   |
| Auth                  | **Firebase Auth**                                  | anonymous-first + Google + email-link; **no Apple/iOS** (DEC-039)                                               |
| Push                  | **FCM**                                            | Phase 3+ (lineup alerts, walk-time, where-is-everyone)                                                          |
| Native shell          | **Capacitor 8** (**Android only**)                 | added before public launch (DEC-003/039)                                                                        |
| Map generation        | **managed Node job**                               | `generateMap` can't run in a Worker; admin-triggered (local now)                                                |


**Environments:** `dev` (local `wrangler dev` + `db:migrate:local` + Vite), `production` (live Worker + remote D1

- Pages on `master`). No separate staging for V1 (add only if needed). Node **22** everywhere (CI already uses 22;
add `FestPilot/.node-version` = `22` in Phase 0 — wrangler + Web Crypto need it; resolves TripPilot's 20/22 drift).

**Secrets (never commit; set via `wrangler secret put` / `.dev.vars` locally):**
`ADMIN_TOKEN` (guards admin routes), `FIREBASE_PROJECT_ID` + JWKS verification config, `FCM_*`,
and any map-job R2 credentials. `.dev.vars` and `.env*` are gitignored.

**The ONLY human-in-the-loop steps** (credential-gated; listed in §19 as one-time operator prerequisites):
`wrangler login`, creating the Cloudflare account/D1/R2/Pages project once, creating the Firebase project and
dropping its config, and putting secrets. Everything else is automated. Do **not** pause mid-build for these —
if a live deploy step needs them and they're absent, run the **local** equivalent (`--local` D1, `wrangler dev`),
mark the live step ⏳ in the dev-log, and continue building.

---

## 6. Repository & Git workflow

**Repo root = `/home/julio/projetos/festival-copilot`** (parallel to `trip-budget-copilot`). Branch model =
**trunk-based on `master`** (mirrors TripPilot; Pages production = `master`).

**Commit conventions — Conventional Commits with a phase/area scope (TripPilot style):**

```text
feat(phase-0): externalize map relief + R2 map asset API
feat(lineup): GET /api/festivals/:id/map serves SVG + transform from R2
fix(ingest): handle weekend with no timetable yet
test(my-plan): lock-in resolver keeps zero overlaps across 200 random favorites
chore(release): deploy worker + pages, bump version 0.3.0
docs(dev-log): record Phase 2 Gate 1 green + deploy
```

Types: `feat`, `fix`, `test`, `chore`, `docs`, `refactor`. Scope = phase or area (`lineup`, `my-plan`, `map`,
`groups`, `presence`, `meeting`, `auth`, `push`, `ci`). **Subject in English, imperative, ≤ ~72 chars.**

**Commit cadence (DEFINITION):**

- **One commit per milestone** (a milestone is a coherent feature slice — see each gate in §13).
- **Never commit with failing tests or a broken `typecheck`/`build`.** Run §8 first.
- **At each gate close:** a scoped commit + (when live infra exists) a deploy + a `dev-log.md` entry.
- Use HEREDOC for multi-line messages; always `git commit -m` (never bare `git commit` — pager safety §14).

**Push:** only push when the user asks, or when a gate's deploy depends on Pages auto-build from `master`
(then `git push origin master`). **Never force-push `master`.** Do not change git config or skip hooks.

`**.gitignore`** is already correct (node_modules, dist, `.wrangler`, `.dev.vars`, `out/`, coverage, Playwright).
Keep generated heavy map rasters out of git (they live in R2); commit only the **slim** SVG + transform that
`web/public/maps` needs as a fallback.

---

## 7. Versioning & release

- App version lives in `web` (and later the Capacitor shell). Start **0.1.0**; bump **minor per shipped phase**,
**patch per gate** with user-visible change. Record the version in each `chore(release)` commit + dev-log.
- TripPilot's **OTA self-host** (Capgo + `version.json` + bundles) is the **documented upgrade path** for the
native phase; V1 web ships via Pages on push. Add OTA only when the Capacitor shell lands (post-Phase-6, §13).
- A short release note per gate (one line) goes in the dev-log and the `chore(release)` commit body.

---

## 8. Testing strategy (test alongside build — this is the gate)

Mirror TripPilot: **Vitest** (unit + component + integration) and **Playwright** (E2E), with a real-migration
DB integration shim.

**Server (`@festpilot/server`)** — Vitest + **sql.js** runs the real `migrations/*.sql` against an in-memory
SQLite so D1 logic is tested without network (already in place; 25 tests). Test the **invariants**, not lines:

- normalize: +1s stripped, midnight rolls, timezone correct.
- diff: added/removed/time/stage/artist classified; idempotent re-run; removed→inactive; revision bumped.
- API repo: festivals/lineup/stages shapes; 404s; filters.
- *(new per phase)* favorites/clashes/plan, group aggregation, presence-coarsening, meeting-point lifecycle.

**Web (`@festpilot/web`)** — add Vitest + Testing Library (jsdom) for domain/hooks/components, and
**Playwright** E2E (chromium) for golden paths. **Pure domain logic (clash resolver, plan build,
coord→stage, group aggregation) is plain TS in `web/src/domain/` (or a shared package) tested with real numbers**
— mock only boundaries (network, geolocation, push). Target **>90% on domain**, >70% on critical UI.

**Setup files:** `web/src/tests/setup.ts` (jest-dom + jsdom; WebCrypto polyfill if needed). Test layout:
`server/test/`** and `web/src/tests/**/*.test.{ts,tsx}`; E2E in `web/e2e/*.spec.ts`.

**Commands** (run before every commit, all from `FestPilot/`):

```bash
npm run typecheck   # tsc --noEmit across workspaces
npm run test        # vitest run across workspaces
npm run build       # worker dry-run bundle + vite build
# E2E (once web has screens):
npm --workspace @festpilot/web run test:e2e
```

**Golden-path smoke (3 core flows, must pass at every gate once they exist):**
(1) load festival + lineup → (2) favorite + **Lock in** a conflict-free plan → (3) open the **map** with the
live overlay. Group/presence/meeting smokes are added as those phases land.

---

## 9. Deploy playbook

Two deploy targets (like TripPilot): the **Worker** (manual `wrangler deploy`) and **Pages** (auto-build on
push to `master`). Plus the **map asset job** (Node, admin-triggered) and **D1 migrations**.

**First live bring-up (Phase 0/1):**

```bash
cd FestPilot/server
npm run db:create                 # wrangler d1 create festpilot → paste database_id into wrangler.toml
npm run db:migrate                # apply migrations to remote D1
wrangler r2 bucket create festpilot-assets
wrangler secret put ADMIN_TOKEN   # + Firebase/FCM secrets as phases need them
npx wrangler deploy               # deploy the Worker (Node 22)
# seed live lineup end-to-end:
curl -X POST https://festpilot.<account>.workers.dev/admin/ingest -H "authorization: Bearer $ADMIN_TOKEN"
curl https://festpilot.<account>.workers.dev/api/festivals   # smoke
```

**Web (Pages):** connect the Pages project to the repo (root dir `FestPilot`, build `npm run build`, output
`web/dist`, production branch `master`); thereafter `git push origin master` deploys. Manual fallback:
`npx wrangler pages deploy web/dist --project-name=festpilot --branch=master`.

**Map asset publish (Phase 0):** run `generateMap` (local Node job for now) → upload slim `<id>.svg`/`-day.svg`

- `relief-<id>.png` to R2 → upsert `festival_map` → app reads `GET /api/festivals/:id/map`.

**Migrations discipline:** every schema change is a **new** `migrations/000N_*.sql` (never edit `0001_init.sql`
once it's applied live). Apply `--local` in dev, `--remote` in deploy. D1 logic is covered by the sql.js test.

**Deploy cadence:** deploy at each gate that produces a user-visible change, **after** tests are green. Put the
URL in the dev-log. If live infra/secrets are absent, do the local-equivalent and mark the live step ⏳.

---

## 10. CI/CD

Extend `.github/workflows/ci.yml` (already: Node 22 → `npm ci` → typecheck → test → build):

- **Add an `e2e` job** (Playwright chromium, `npx playwright install --with-deps chromium`,
`npm --workspace @festpilot/web run test:e2e`, upload report artifact) — returns once web screens exist
(the workflow comment already anticipates this).
- **Keep CI deploy-free** (TripPilot pattern): Worker deploy stays manual `wrangler deploy`; Pages auto-builds
from `master`. (Optional later: a guarded deploy job on tags.)
- `concurrency` cancel-in-progress is already set. Cache `FestPilot/package-lock.json`.

---

## 11. State file — `FestPilot/dev-log.md` (your persistent memory)

Maintain `FestPilot/dev-log.md` (seeded 2026-06-23). Update **every milestone**. On context loss, **re-read it
first** (then this doc's current gate + the non-negotiables). Schema:

```markdown
# FestPilot — Dev Log (execution state)

## Current State
- Active Phase / Gate: P{n} G{n}
- Last green test run: <when> — <X pass / 0 fail>
- typecheck / build: clean | broken
- Live: D1 <created?> · Worker <deployed url?> · Pages <url?> · R2 <bucket?>
- Confidence: XX%

## Completed (most recent first)
- [x] P0.G0 git baseline + slim SVG + R2 map API (N tests) — deployed <url>

## Decisions made this session (mirror into decision-log if structural)
- <decision> : <rationale>

## Known issues / ⏳ blocked-on-credentials
- <none | item>

## Next
- <the very next milestone>
```

---

## 12. Execution protocol (the loop, the checkpoints, recovery)

**The loop, per milestone:** read the gate → implement backend slice → implement frontend slice → write/extend
tests for the invariant → `typecheck && test && build` green → **commit** (one per milestone) → dev-log entry →
next milestone.

**Per-milestone self-check (5-point, before each commit — from `phase-delivery-hardening.mdc`):**

1. List the AC IDs this milestone satisfies. 2. Name 3 earlier ACs at regression risk and verify them.
2. Run tests — confirm **no NEW failures**. 4. Flag any files changed outside this milestone's scope.
3. Add the dev-log entry.

**Gate Checkpoint (between gates — mandatory ritual, in order):**

1. **Tests green** for everything the gate touched (+ impacted areas) — `typecheck`, `test`, `build` clean.
2. **Golden-path smoke** (§8) passes for the flows that exist.
3. **Cumulative ACs** of all prior gates re-verified.
4. **Deploy** the gate's user-visible change (§9) when live infra exists; capture the URL.
5. **Scoped commit** (§6) + `**chore(release)`/version bump** if user-visible.
6. **Brain sync** (§17): dev-log always; `project-status.md` at phase end; `decision-log.md` for new decisions.
7. **Context refresh:** re-read this doc's next gate + the §3 non-negotiables + the dev-log Current State;
  re-emit the non-negotiables to yourself; drop the build "noise" from the prior gate.

**Anchor (re-state to yourself every ~3 milestones):** *No subagents. No asking. Don't stop. English code,
PT UI. Backend before frontend. Test the invariant. Coarse presence; raw coords server-only. Zero-overlap plan.
Commit per milestone; deploy + dev-log per gate. `git --no-pager`, `git commit -m`.*

**Batch operations:** when steps are independent (multi-file reads, parallel edits, independent shell checks),
do them together to move fast. When dependent, sequence them.

**Progressive compression:** VERBOSE in P0–P2 (foundations); NORMAL in P3–P4; COMPACT in P5–P6 — fewer words,
same rigor.

**Recovery protocol (something broke / context fuzzy):** (a) read `dev-log.md` Current State; (b) `npm run test`
to find the real failure; (c) re-read only the failing area + its brain section; (d) fix forward with a new
commit (don't `--amend` pushed work); (e) if a shell hangs, see §14.

---

## 13. THE BUILD — phases & gates

> Each phase below adds the **execution layer** (sequence, tests, deploy, commit) on top of the full product
> detail in `implementation-phases.md`. **Read that phase's section before building** (§2). Phases 1–6 and their
> ACs are defined there; **Phase 0 is defined fully here** (it's the bring-up + map-to-prod the user asked for).
> Status legend: ✅ done · 🔨 build now · ⏳ needs live credentials.
>
> **🆕 Screen-complete (2026-06-23).** After the 8-batch design pass, **every gate now lists its exact screens** as
> `Screens:` (IDs from `2026-06-23-screen-catalog.md` → prototypes in `brain/wireframes/directions/`, tokens in
> `2026-06-23-design-system.md`). **A gate is not done until its listed screens are built and match the prototype +
> design-system.** All 59 V1 screens are designed & locked; nothing may be built outside the catalog (DEC-039).
> The **Admin desktop (B8.1–B8.6)** is a parallel back-office track folded into Phase 3 (the map editor is the
> source of truth for stage positions) + ingest ops — see each gate below.

### Phase 0 — Bring-up & Map-to-Production (the immediate unblockers) 🔨

**Objective:** establish git, slim the map asset, store/serve it from R2 via the API, point `web` at the API,
and stand the spine up on **live** Cloudflare (D1 + Worker + Pages). After P0 the app is a *real, light,
deployed* thing: live lineup API + a fast in-app map. This folds in the user's 1→2→3 (slim SVG → R2 + map API
→ point web at API).

**Gate 0.1 — Repo & toolchain baseline**

- Make the **git baseline commit** of the current state (already initialized on `master`).
- Add `FestPilot/.node-version` = `22`; confirm root scripts and CI (Node 22) align.
- (Optional) add ESLint flat config + Prettier to match TripPilot (`.prettierrc`: semi, singleQuote,
trailingComma all, printWidth 100) — non-blocking; skip if it costs time.
- Tests: `npm run typecheck && npm run test && npm run build` green.
- Commit: `chore(repo): git baseline + node 22 pin + tooling`.

**Gate 0.2 — Slim the map SVG (externalize relief)**

- In `spikes/map-art`, change `generateMap` to write `relief-<id>.png` and reference it via `<image href>`
instead of inlining the ~13 MB base64 hillshade (SVG → ~2–3 MB). Regenerate De Schorre.
- Copy the slim `tomorrowland-deschorre.svg` + `-day.svg` + `relief-tomorrowland-deschorre.png` + transform
into `web/public/maps/` (fallback assets).
- Tests: a Node assertion that the emitted SVG has no base64 `data:image` relief and references an external
href; web still renders (Playwright smoke when present).
- Commit: `feat(map): externalize relief raster; slim shipped SVG`.

**Gate 0.3 — R2 + `festival_map` + map API**

- New migration `migrations/0002_festival_map.sql`: table `festival_map(festival_id PK/FK, svg_night_key, svg_day_key, relief_key, transform_json, revision, updated_at)`.
- R2 bucket `festpilot-assets`; add the binding to `wrangler.toml`.
- Worker route `GET /api/festivals/:id/map` → `{ svgNightUrl, svgDayUrl, reliefUrl, transform }` (R2 public or
signed URLs + the affine). Guarded admin route `POST /admin/festivals/:id/map` to upsert the row after upload.
- A small **Node publish step** (extend the admin tool) uploads the slim assets to R2 + calls the admin route.
- Tests (sql.js): `festival_map` upsert + the map route shape + 404.
- Commit: `feat(map): R2 asset storage + GET /api/festivals/:id/map`.

**Gate 0.4 — Point `web` at the API + live spine**

- `web/src/map/MapView.tsx` loads the map from `GET /api/festivals/:id/map` (with `/public/maps` as offline
fallback). Add a typed API client `web/src/data/api.ts` (base URL via `VITE_API_URL`).
- ⏳ Live bring-up (§9): `db:create` → paste `database_id` → `db:migrate` → `wrangler deploy` → R2 bucket →
`POST /admin/ingest` (live TML lineup) → Pages project on `master`. If credentials absent: do the `--local`
  - `wrangler dev` equivalent, mark live ⏳, continue.
- Smoke: `/api/festivals` returns TML; the web map loads from the API.
- Gate close: deploy, `chore(release): 0.1.0 — live spine + in-app map`, dev-log, `project-status.md` update.

**Phase 0 acceptance:** git history started; shipped SVG ≤ ~3 MB with external relief; `festival_map` + map API
serve the asset; `web` renders the map from the API; lineup API live (or fully local-proven + ⏳ live).

---

### Phase 1 — Foundation & Lineup Spine ✅ (backend) / 🔨 (frontend shell)

Backend is **done** (§4). Remaining P1 work = the **app shell** the rest of the UI hangs on.
**Read:** `implementation-phases.md` Phase 1; `ai-execution-guide.md` Phase 1.

- **Gate 1.1 — App shell + nav + offline groundwork:** routing (Now/Timetable/My Plan/Map/Squad per DEC-032),
Amber-Glass theme tokens (implement `2026-06-23-design-system.md` §1–§4 into `web/src/styles.css`), install
**manifest** + icons, a hand-written **service worker** (cache app shell + map asset + lineup JSON; network-first
nav, cache-first assets — TripPilot pattern). Typed API client (from P0).
**Screens:** `B5.5` Settings hub shell (`27`#5, grows per phase) · `B5.6` language(EN default)/appearance
(`27`#6) · `B6.5` offline/sync shell (`28`#5) · `B6.6` system states — empty/loading skeleton/error+retry
(`28`#6, reused by every later screen). Avatar/header entry to the Settings stack (no 6th tab — DEC-032).
- **Gate 1.2 — Raw lineup read (UC-03):** a screen that fetches `/api/festivals` + `/festivals/:id/lineup`
and renders it (no styling battle yet) to prove end-to-end data.
**Screens:** `A2` Home/"Now & Next" minimal shell (`18`, fully built in P3 G3.3).
- **Tests:** web unit for the API client + SW registration; Playwright smoke "app loads, lineup renders".
- **ACs:** `implementation-phases.md` Phase 1 (lineup ingested ✅; app shell fetches + renders raw lineup;
`tsc` clean; ingestion tests pass in CI ✅).
- **Close:** deploy Pages; `feat(shell): PWA app shell + nav + service worker`; bump `0.2.0`.

### Phase 2 — Favorites & "My Plan" (Pillars 1–2, shippable PWA) 🔨

The product's unique core; ships as a **standalone PWA**. **Read:** `implementation-phases.md` Phase 2;
DEC-005/017/018/026/027/028/029; prototypes `15e` (timetable), `17` (onboarding), `12c`/`13` (lock-in), `21`/`22`.

- **Gate 2.1 — Onboarding + Favorites (UC-04/05, DEC-028):** festival→week→days pre-step (correctness:
filter artists to the chosen weekend/day; dedup multi-day artists), then the **swipe "Would you see this set?"**
flow (text actions, Skip, progress). Backend: `POST/DELETE /api/favorites`, `GET /api/me/favorites`.
**Screens:** `A1` Onboarding flow (`17`). Favorites = the Lineup grid filter (no separate screen — DEC-039 Q-C).
- **Gate 2.2 — Timetable (DEC-026/027/032):** TML-style grid (rows=stages, cols=time, real-time positioning,
sticky stage name + time header, continuous NOW line, **no scrollbars**, dark-glass cards, **gold favorites**,
per-card heart, "only my favs", 1h/2h zoom). Lineup as a separate full-height screen via one header icon.
**Screens:** `A3` Timetable grid (`15e`) · `A4` Lineup list + filters / favorites grid (`22`).
- **Gate 2.3 — Lock in → My Plan (UC-06/07/08, DEC-017/018/029):** the **gated clash resolver** as an explicit
state machine (queue of clashes by start; unlock pointer = last locked slot's end); **multi-option** select
(2–6+), "all clashes" overview, "add nearby artist" search, partial-set cut points with a **stubbed
travel-time interface** (real matrix in Phase 3); celebration. Backend: `GET /api/me/clashes?day`,
`POST /api/me/plan/slots`, `GET /api/me/plan?day`.
**Screens:** `A5` Lock-in multi-option + add-nearby search (`12c`) · `A6` Lock-in celebration (`13`) ·
`A7` My Plan vertical timeline + walk + breaks + share (`21`).
- **Tests (critical):** the **no-overlap invariant** — property test: for N random favorite sets, the locked
plan has zero overlaps; partial-set transition feasibility; favorites persist. Domain logic pure-TS, real numbers.
- **ACs:** `implementation-phases.md` Phase 2 (free overlapping favorites; one-at-a-time chronological resolve →
zero overlaps; partial-set records cut + flags feasibility; installable PWA + offline read).
- **Close:** deploy; `feat(my-plan): gated clash resolver + partial sets`; bump `0.3.0`.

### Phase 3 — Map, Travel Time & On-Site Essentials 🔨

Make it usable in the field. **Read:** `implementation-phases.md` Phase 3; DEC-010/011/021/022/030/031/034;
map plan §11; `spikes/map-import`.

> **Admin desktop track starts here** (B8). It is the productized map/lineup engine onboarding any festival;
> implement against prototype `30` + design-system (desktop variant). `B8.1` Festivals overview + `B8.2` Lineup
> dashboard (source = the **documented capture**, never invented — intake Q2) come online with G3.1.

- **Gate 3.1 — Admin map verify → `stage_location` (DEC-034/035):** productionize the admin pin editor as the
**source of truth**: persist pins to `stage_location` (lat/lng, radius, `verified`, source) via a guarded
Worker route; KML import = initial seed only. Trigger the map publish job (P0.3).
**Screens (admin desktop):** `B8.1` Festivals overview (`30`#1) · `B8.2` Lineup dashboard (`30`#2) ·
`B8.3` **Map editor — drag stage pins → Generate SVG** (`30`#3, the productized `generateMap`) ·
`B8.4` Georeference/verify — 3-point affine SVG↔GPS + fix off-position stages (`30`#4).
- **Gate 3.2 — Map data API + coord→stage (UC-11):** `GET /api/festivals/:id/map` already serves art+transform;
add stages/areas/POIs + travel-times endpoints; implement coord→stage (circle area + nearest fallback +
confidence) as pure TS (shared with presence later).
**Screens:** `B7-base` Map base — illustrated SVG + affine overlay (`19`) · `B7.4` stage-to-stage routing
scaffolding (`29`#4, "leave by" wired in G3.3).
- **Gate 3.3 — Now & Next + offline (UC-12/13, DEC-022):** glanceable home (on-now / next pick / where /
**when to leave** countdown); finalize the **offline cache/sync contract** (lineup, my plan, map/POIs, last
group plan). Swap Phase-2's travel-time stub for the **manual matrix** (DEC-011).
**Screens:** `A2` Home/"Now & Next" full (`18`) · `A8`/`B6.1` personal gap filler — favorite/popular/**break**
(`28`#1, DEC-039 Q-L) · `B7.5` walking navigation (`29`#5) · `B6.5` offline/sync (`28`#5) ·
admin `B8.6` travel-time matrix — auto-estimate + manual overrides (`30`#6).
- **Gate 3.4 — FCM groundwork + walk-time reminders (UC-14) + POI layer (UC-15, T2):** stand up **FCM**
(registration + first push types: lineup-change alerts from P1 + walk-time reminders scheduled server-side via
DO alarms); togglable **POI overlay** (toilets/water/medical/exits/…) on the same affine. Plus the **in-app
notification inbox** (DEC-039 Q-G — push primary, inbox mirrors it).
**Screens:** `B7.1` Map + POI layer (`29`#1) · `B7.2` nearest essentials (`29`#2) · `B7.3` POI detail (`29`#3) ·
`B7.6` map layers/legend (`29`#6) · `B6.2` notification inbox (`28`#2) · `B6.3` alert preferences (`28`#3) ·
`B6.4` OS push lock-screen (`28`#4) · admin `B8.5` POI editor — click-to-place (`30`#5).
- **Tests:** coord→stage cases (at/near/between); offline render; a reminder fires accounting for travel time.
- **Close:** deploy; `feat(map): admin verify + now&next + offline + reminders`; bump `0.4.0`.

### Phase 4 — Groups & Shared Timetable (Pillar 3a) 🔨 — first Durable Object + auth gate

**Read:** `implementation-phases.md` Phase 4; DEC-013/019/024/038/039; technical-direction §6.1.

- **Gate 4.1 — Auth (DEC-024) — prerequisite:** Firebase anonymous-first; **upgrade to permanent**
(Google + email-link) required to create/join a group; Worker verifies the ID token behind
`getUserFromRequest()` (JWT via JWKS). `app_user` carries `firebase_uid` + `auth_provider` + `is_anonymous`.
Anonymous favorites/plan **carry over** on link. **No Apple / no iOS** auth — native is Android-only (DEC-039 Q-E).
**Profile asked at first join** (display name + avatar upload/initials — DEC-039 Q-F).
**Screens:** `B1.2` sign-in gate (`23`#2) · `B1.3` profile setup (`23`#3) · `B5.1` sign-in Google/email-link/guest
(`27`#1) · `B5.2` magic-link sent (`27`#2) · `B5.3` edit profile (`27`#3) · `B5.4` account — guest→save / sign out /
**delete account & data** (`27`#4).
- **Gate 4.2 — Groups + invites (UC-16/17):** `POST /api/groups`, `POST /api/groups/:id/join` (link + QR token),
membership; share my plan with the group. `**GroupRoom` Durable Object** per group (plan + board fan-out).
**Use the SQLite storage backend** — declare it with `new_sqlite_classes` in a new wrangler migration (the only
DO backend on the Free plan; free per DEC-037). Add the DO binding to `wrangler.toml`. **Squad cap 50; invite link
does not expire until the event ends** (DEC-038).
**Screens:** `B1.1` squad empty → create/join (`23`#1) · `B1.4` create squad — name/festival/cap 50 (`23`#4) ·
`B1.5` invite — link + QR (`23`#5) · `B1.6` join squad (`23`#6) · `B1.7` members list — roles/leave/remove (`23`#7).
- **Gate 4.3 — Shared timetable (UC-18/19/20, DEC-013/019/039 Q-A/Q-B):** **blocks = per-set boundaries** (not fixed
30/60 min); auto-build by **plurality of locked picks**; tie/no-majority → most-favorited → owner picks;
**per-block follow / do-my-own**; **member favorites-fallback** (your best favorite at that block when your lock ≠
winner); **owner override** per slot (revertible to auto); **never silently override a locked must-see**; split viz
  - CTA → meeting point; **no member voting** in V1.
  **Screens:** `B1.8` share my plan with the squad (`23`#8) · `B2.1` squad plan overview (`24`#1) · `B2.2` block
  detail — split + Join/Keep/Override (`24`#2) · `B2.3` locked conflict + favorites-fallback (`24`#3) · `B2.4` owner
  override (`24`#4) · `B2.5` split view (`24`#5) · `B2.6` needs-input/nudge (`24`#6).
- **Gate 4.4 — Group board (UC-20b, DEC-013):** lightweight pinned notes/announcements (post/edit/remove),
fanned out via the DO. **No real-time chat.**
- **Tests:** aggregation correctness (plurality, tie→favorited→owner; fallback; never-silent-override); DO
fan-out; auth token verification + anonymous→permanent linking preserves uid.
- **Close:** deploy; `feat(groups): shared timetable + board over a per-group DO`; bump `0.5.0`.

### Phase 5 — Live Presence & "Where Is Everyone?" (Pillar 3b) 🔨 — highest risk

**Read:** `implementation-phases.md` Phase 5; DEC-006/007/008/012/015/035/039; map plan (overlay).

- **Gate 5.1 — Presence pipeline (UC-21/22, privacy-critical):** `POST /api/presence` (raw fix **in**, coarse
**out**); server keeps raw `lat/lng`, computes stage + confidence + expiry (GPS ~15m, manual/push ~45m);
`GET /api/groups/:id/presence`; **WebSocket** fan-out via `GroupRoom` DO (DEC-035). **Replace mock**
`web/src/map/presence.ts`. Consent-at-point-of-use pre-prompt (DEC-015 copy). Battery-aware sampling
(map-open + significant-move + low-freq timer; last-known fallback). **Precise sharing auto-expires in 60 min**
(DEC-039).
**Screens:** `B3.1` consent pre-prompt (`25`#1) · `B3.2` OS permission dialog moment + coaching (`25`#2) ·
`B3.5` precise-sharing-active control — countdown / extend / downgrade / stop (`25`#5).
- **Gate 5.2 — Group-by-stage + map markers (UC-23/24):** clusters ("MAINSTAGE — Thales, Andy — watching
Martin Garrix"); current-artist auto-detect from presence + lineup; coarse markers on the live overlay.
**Screens:** `B3.4` where's the squad — map peek + roster (live/coarse/offline) + Ping/Nudge (`25`#4).
- **Gate 5.3 — "Where is everyone?" + sharing modes (UC-25/26, DEC-012/015/039):** interactive FCM round-trip
(pre-filled nearest stage; one-tap answer); **three modes — Stage labels (default) / Precise 60-min / Ghost**;
per-group time-boxed sharing; **"disappear from map"** (Ghost) toggle.
**Screens:** `B3.3` sharing mode picker (`25`#3) · `B3.6` location & privacy settings — master switch / default
mode / expiry / audience / pause-all (`25`#6).
- **Tests (must):** clients **never** receive raw coordinates; coarse at/near/between + confidence + expiry
correct; push-reply path works with GPS off.
- **Close:** deploy; `feat(presence): coarse honest presence over WS DO + where-is-everyone`; bump `0.6.0`.

### Phase 6 — Meeting Points, Navigation & Safety (Pillar 3c) 🔨

**Read:** `implementation-phases.md` Phase 6; DEC-014/015/022/039; R2.

- **Gate 6.1 — "Come to me" meeting point (UC-27):** exact point + **R2 photo** + note + expiry (10/20/30/60) +
visibility (group/selected); when = now / after-this-set / custom; `POST /api/groups/:id/meeting-points`; group
notified.
**Screens:** `B4.1` create — pick spot (drag pin / quick-pick) (`26`#1) · `B4.2` create — details: name/when/who/note
(`26`#2).
- **Gate 6.2 — Lifecycle + fade (UC-28):** active→on-the-way→everyone-here→expiring_soon→expired→empty→archived with
smart prompts (creator drifted? empty ~10m?); pin fades, "who went" record kept; purge on archive (DEC-015).
**Screens:** `B4.3` meeting detail — active: convergence map + live ETAs + here/no-response (`26`#3) ·
`B4.4` lifecycle states — everyone-here / on-the-way / expired / cancelled (`26`#4).
- **Gate 6.3 — Navigation + safety (UC-29/30, DEC-039 Q-H):** compass-arrow + distance (no turn-by-turn);
**safety / "I'm lost"** (calm, non-alarmist, reachable from Squad + Map) shares exact location + nearest
exit/medical/info + call a member (reuse Phase-3 POIs); safety-active = broadcast + nearest help + one-tap "I'm okay".
**Screens:** `B4.5` "I'm lost" menu (`26`#5) · `B4.6` safety-active broadcast (`26`#6).
- **Tests:** exact coords leave **only** via meeting point or safety action (never automatically); lifecycle
transitions; photo upload/expire.
- **Close:** deploy; `feat(meeting): meeting points + nav + safety`; bump `0.7.0`.

### Phase 7 — Native shell + launch hardening (before public release) 🔨

- Wrap the PWA with **Capacitor 8 — Android only** (DEC-039 Q-E; supersedes the old "iOS + Sign in with Apple"
note): native geolocation + **FCM** notification actions + local notifications + share; App Links. **No iOS build
and no Sign in with Apple in V1** (auth = Google + email-link only). The PWA remains the cross-platform path for
non-Android users.
- Privacy/legal: location-consent UX, privacy policy, **attribution screen** (OSM ODbL + Flanders DHMV + AWS
terrain). Performance + battery pass. Full **E2E** suite green in CI.
- **Stop Criteria (§15) must all be TRUE.** Final deploy + `chore(release): 1.0.0`.

---

## 14. Problem table (situation → action) + WSL pager safety


| Situation                                                  | Action                                                                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Any git read** (`log`/`diff`/`show`/`branch`)            | Always `git --no-pager …`; commit only with `-m`/HEREDOC. **Never** `-i`/interactive, never `less`/`vim`. (workspace rule `terminal-pager-safety`.) |
| A shell command hangs >30s with no output                  | Don't re-run/wait. Read the terminal file metadata for the bash pid; `ps` for stuck `less`/editor; kill it. (pager-safety rule.)                    |
| Node `fetch` hangs on a WMS/Overpass endpoint              | Use `curl` via `execFileSync` (the map spike already does — `spikes/map-art/src/http.ts`).                                                          |
| `wrangler` fails on Node 20                                | Use **Node 22** (`.node-version`); CI already pins 22.                                                                                              |
| Live deploy needs Cloudflare/Firebase creds you don't have | Run the `--local` / `wrangler dev` equivalent, mark the live step ⏳ in dev-log, **keep building**. Don't ask.                                       |
| `EADDRINUSE` on the admin tool                             | Kill the orphaned `tsx`/node listener on the port, restart via `npx tsx admin/server.ts` (port 8799).                                               |
| Browser/screenshot daemon times out (WSL)                  | Don't block on visual verification; verify via `curl` + tests + build; leave the user a "run it locally" note.                                      |
| `generateMap` "can't run in a Worker"                      | It's a **Node job** (resvg/curl) — run via the admin/CI step, upload to R2. Never import it into the Worker.                                        |
| A decision is missing                                      | Pick the reasonable default consistent with the brain, write `DEC-NNN` (PROPOSED), continue.                                                        |
| Tests fail after a change                                  | Recovery protocol §12; fix forward with a new commit; never `--amend` pushed work.                                                                  |


---

## 15. Definition of Done / Stop Criteria

**A gate is done when:** all its tests + cumulative ACs pass; `typecheck`/`test`/`build` clean; golden-path
smoke passes; deployed (or ⏳ live with local proof); committed; dev-log updated.

**V1 is done — STOP only when ALL are TRUE:**

- [ ] Phases 0–6 implemented, tested, committed, deployed (live Worker + D1 + Pages, or fully local-proven + ⏳).
- [ ] Lineup ingests live and auto-updates (cron); app reads only our API.
- [ ] Favorites → **Lock in** → **My Plan** with **zero overlaps**; partial sets validated by travel time.
- [ ] Beautiful georeferenced **map** loads from R2/API, slim, offline-capable; live overlay via the affine.
- [ ] Groups: create/join (link+QR), shared timetable (plurality + fallback + owner override, never-silent),
  ```
  pinned board; auth gate (anonymous→permanent) works.
  ```
- [ ] **Coarse** presence over the per-group DO (WS); clients never get raw coords; "where is everyone?" round-trip.
- [ ] Meeting points (R2 photo + lifecycle + fade) + arrow nav + safety; exact coords only via explicit intent.
- [ ] On-site essentials: offline, Now&Next, walk-time reminders, POI layer, battery-aware sampling.
- [ ] FCM push works (lineup alerts, walk-time, where-is-everyone).
- [ ] Full test suite green (unit + integration + E2E) in CI; coverage targets met.
- [ ] `project-status.md`, `decision-log.md`, `dev-log.md` current; `README` build/deploy steps accurate.
- [ ] (Native release only) Capacitor **Android** shell + privacy policy + attribution screen (**no iOS/Apple** — DEC-039).

---

## 16. Anti-patterns (do NOT do these)

- Asking the user to confirm a step that's already specified. (§1)
- Spawning subagents / using the Task tool. (§1)
- Stopping early because the chat is long or "that's a lot". (§1)
- Business/clash/plan math inside React components. (§3)
- Sending raw presence coordinates to clients; auto-sharing exact location. (§3)
- Hardcoding the lineup uuid; reading the festival site from the client. (§3)
- Baking labels/pins into the map illustration. (§3)
- Inlining the relief raster into the shipped SVG. (§13 P0.2)
- Editing an already-applied migration instead of adding a new one. (§9)
- Committing with failing tests / broken build; `git --amend` on pushed commits. (§6)
- Neon purple/pink palette or Inter/DM Sans (looks "AI-made"). (§3 DEC-025)
- Real-time chat in V1. (§3 DEC-013)
- `git log` without `--no-pager`; bare `git commit`; any interactive `-i`. (§14)

---

## 17. Brain sync rules

- **Every milestone:** update `FestPilot/dev-log.md` (§11).
- **Every phase end:** update `brain/project-status.md` (what shipped, next).
- **Any new/changed decision:** add `DEC-NNN` to `brain/decision-log.md` (next id currently **DEC-036**);
mark superseded entries; bump the file's `Last updated`.
- **Any doc edit:** update its `> Last updated: YYYY-MM-DD`.
- Keep `README.md` (repo + `FestPilot/`) build/run/deploy commands accurate as they change.

---

## 18. TripPilot parallels — what we mirror, and where we deliberately diverge

> The user asked to "research how Trip Copilot works and do something very similar." Here's the mapping so the
> build stays faithful where it should, and diverges only where FestPilot genuinely differs.

**Mirror (same as TripPilot — proven):**

- **Brain-as-constitution + this orchestrator** modeled on TripPilot's `implementation-prompt.md`
(Identity → non-negotiables → state file → gates with ACs/tests → checkpoint ritual → stop criteria → anti-patterns).
- **Inline single-agent, no-subagents, no-ask** autonomous execution (`.cursor/rules/inline-council-no-subagents`,
`tech-lead-delegation`, `execution-style`, `phase-delivery-hardening`, `velocity-standard`).
- **Stack tooling:** React + Vite + TypeScript (strict) + **Capacitor** native shell; **Cloudflare Worker**
(raw fetch + **Hono** here); **Vitest + Testing Library + Playwright**; **sql.js** real-migration DB test;
**npm** + lockfile; **Node 22**; CI = GitHub Actions (typecheck → test → build [+ e2e]); **no CI deploy**.
- **Hosting:** Worker (`wrangler deploy`) + **Cloudflare Pages** on `**master`**; secrets via `wrangler secret`;
**Conventional Commits**, trunk-based; **dev-log.md** as the execution memory; reports/INDEX workflow.
- **AI proxy pattern:** any AI calls (e.g. optional label/sanity) go through the **Worker** with the key as a
secret (TripPilot's Groq pattern) — never in the client. (Note: the **map art is OSM+LiDAR, not AI** — DEC-031/033.)
- **OTA self-host** (Capgo + `version.json` + bundles) as the native upgrade path (Phase 7).

**Diverge (FestPilot is different — and why):**

- **Server-authoritative D1 + Durable Objects + R2**, not TripPilot's **local-first Dexie/IndexedDB**.
FestPilot is inherently **multi-user** (shared lineup, groups, presence, meeting points), so the source of
truth is the **server**, with offline **caches** on the client — the inverse of TripPilot.
- **npm-workspaces monorepo** (`server` + `web`), not a single app folder — clean backend/frontend split.
- **Real auth (Firebase, anonymous-first)** + **FCM push** + **scheduled ingestion (cron)** + **per-group
realtime (WS over DO)** — TripPilot needed none of these (it had P2P sync + a local PIN lock).
- **A georeferenced map engine** (OSM + LiDAR → SVG + affine) — wholly new; TripPilot had no map.
- Improvements over TripPilot's small gaps: pin **Node 22** (`.node-version`) to kill the 20/22 drift; add an
ESLint flat config + Prettier from the start (TripPilot was missing the ESLint config).

---

## 19. Operator provisioning checklist (the ONLY things the human must supply)

Almost everything is built/tested with **zero credentials** (OSM/Overpass, Flanders WMS hillshade, AWS terrain
tiles are all open; the map engine, lineup logic, plan/clash engine, group logic, and all unit/integration tests
run offline). Credentials are needed **only** for (a) live Cloudflare deploy, (b) auth, (c) push. If a credential
is missing when a live step arrives, the executor runs the **local equivalent** (`--local` D1, `wrangler dev`,
mock auth/push) and marks the live step ⏳ — it never blocks the build.

### 19.1 Needs NO credentials (do nothing) ✅

OSM/Overpass geometry · Flanders DHMV-II hillshade (WMS) · AWS Open Terrain Tiles · the `generateMap` Node job
(runs locally) · the entire test suite · all in-app logic against `--local` D1 and `wrangler dev`.

### 19.2 Cloudflare (required for live deploy) — V1 is FREE (DEC-037)

- **Account + plan:** a Cloudflare account on the **Workers Free plan — no payment**. Verified 2026-06-23:
**Durable Objects are on the Free plan** with the **SQLite storage backend** (the only backend on Free, and the
one we use), so DEC-035's WebSocket presence/groups/meeting realtime runs at **$0**. The only hard ceiling is
**100,000 Worker/DO requests/day** (incl. WebSocket messages, HTTP, alarms) + 5M row reads/day + 100k writes/day
  - 5 GB. Ample for V1 + friends-scale testing; a public Tomorrowland-scale launch would later need Workers Paid
  ($5/mo + usage) — a future cost, not now. (Polling-over-D1 was the fallback; unnecessary since DO is free.)
- **What to hand the build (LOCKED — DEC-037, "token_me"):** a scoped **API token** + the **account id**, dropped
into `FestPilot/server/.dev.vars` (gitignored) as `CLOUDFLARE_API_TOKEN=...` and `CLOUDFLARE_ACCOUNT_ID=...`.
Token scopes: *Workers Scripts: Edit*, *D1: Edit*, *Workers R2 Storage: Edit*, *Cloudflare Pages: Edit*,
*Workers KV Storage: Edit*, *Account Settings: Read*. (DO deploy is covered by Workers Scripts.) The executor
deploys from the dev machine with these env vars; no `wrangler login` needed.
- The build then creates everything else itself: `wrangler d1 create festpilot` (paste the `database_id` into
`wrangler.toml`), `wrangler r2 bucket create festpilot-assets`, `wrangler deploy`.
- **Frontend hosting (LOCKED — DEC-037, "direct"):** direct upload `wrangler pages deploy web/dist --project-name=festpilot --branch=master` (no GitHub). (GitHub repo + push-to-deploy + CI is a later add.)
- **Custom domain (optional, V1):** if wanted, add the domain to Cloudflare; otherwise ship on
`festpilot.pages.dev` + `festpilot.<account>.workers.dev`.

### 19.3 Firebase (required for auth from Phase 4; for push from Phase 3)

- Create a Firebase project; in **Authentication** enable **Anonymous**, **Google**, **Email** (Phase 4 gate).
- **Web app config** (NOT secret — client-side): `apiKey, authDomain, projectId, appId, messagingSenderId` →
`FestPilot/web/.env` as `VITE_FIREBASE_API_KEY=…` etc. (gitignored).
- **Worker verifying ID tokens** needs **only the project id** (`FIREBASE_PROJECT_ID`) — it fetches Google's
public certs over JWKS; **no service account needed for verification**.
- **FCM push (Phase 3+):**
  - **Web push:** generate a **Web Push certificate (VAPID key pair)** in FCM settings → public key in
  `web/.env` (`VITE_FCM_VAPID_KEY`), used to mint device tokens.
  - **Server send:** a **service account JSON** (FCM HTTP v1) → stored as a **Worker secret**
  (`wrangler secret put FIREBASE_SERVICE_ACCOUNT`), used to send notifications. This is the one true secret.
- **Apple Sign-In:** **not used in V1** — native is Android-only and auth is Google + email-link (DEC-039). No
Apple Developer account needed.

### 19.4 Secrets the build sets itself / generates

- `ADMIN_TOKEN` — the executor generates a strong random value and runs `wrangler secret put ADMIN_TOKEN`
(also mirrored into `.dev.vars` for local). You don't need to supply it.
- All `wrangler secret put …` for the Firebase/FCM values above, once you've dropped them in the gitignored files.

### 19.5 How to hand secrets over (safely)

**Do not paste secrets into chat.** Put them in the gitignored files and tell the build they're there:

- `FestPilot/server/.dev.vars` → `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `FIREBASE_PROJECT_ID`,
`FIREBASE_SERVICE_ACCOUNT` (path or JSON).
- `FestPilot/web/.env` → `VITE_FIREBASE_`*, `VITE_FCM_VAPID_KEY`, `VITE_API_URL`.
Both are already covered by `.gitignore`. The non-secret Firebase **web** config can be shared in chat if easier.

### 19.6 Minimal vs full bring-up (all on free tiers — DEC-037)

- **Minimal live demo (no Firebase):** Cloudflare token only → deploy Worker + D1 + R2 + Pages →
live lineup API + live map + My Plan as a PWA. Groups/presence run on mock/local until 19.3 is supplied.
- **Full V1 live (still $0):** Cloudflare token + Firebase **Spark (free)** project + FCM service account + VAPID.
Durable Objects are on the Cloudflare **Free** plan (SQLite backend) — no paid plan for V1.

---

## 20. GO

1. Read §1–§3 and §12. 2. Seed/refresh `FestPilot/dev-log.md`. 3. **Start Phase 0, Gate 0.1** and proceed

gate-by-gate through Phase 7 without stopping, committing per milestone and deploying per gate, until §15 Stop
Criteria are all TRUE. Keep the brain in sync (§17). Don't ask. Don't stop. Build.

> *This orchestrator is the execution truth; the brain is the product truth. If they ever conflict, fix the
> conflict explicitly (update the brain + add a `DEC-NNN`), then continue.*

