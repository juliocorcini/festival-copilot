# FestPilot

Festival companion app for planning personal schedules, resolving lineup conflicts, coordinating groups, estimating walking time between stages, and tracking temporary meeting points.

**Live:** [festpilot.pages.dev](https://festpilot.pages.dev) · **Current version:** v0.69.0 · **Reference festival:** Tomorrowland Belgium 2026

---

## The Problem

A big multi-stage festival is overwhelming in a very specific way:

- **Clashes are brutal.** Hundreds of artists across 16+ stages, and the ones you love are constantly scheduled at the same time. You end up improvising and missing the sets you cared about most.
- **Raw schedules ignore reality.** Real festival-going involves leaving one set early, walking 8 minutes to another stage, and catching the second act from the start. No tool accounts for that.
- **You lose your friends.** Everyone wants different acts, phones die, signal is bad, and "I'm at the main stage" is useless when the main stage holds 30,000 people.

FestPilot solves this with three pillars: **pick everyone you want to see** (favorites), **turn wishes into a conflict-free plan** (clash resolution with partial sets and walking time), and **stay together with your group** (shared timetable, live presence, meeting points).

---

## Architecture

```
Official festival site ──(resolve event+uuid)──▶ Lineup Resolver
                                                      │
                                   CDN JSON (config, stages, performances)
                                                      ▼
                            Ingestion + Normalizer (timezone, +1s quirk, midnight crossing)
                                                      ▼
               ┌──────────────────────────────────────────────────────────────────┐
               │                     Cloudflare D1 (SQLite at edge)              │
               │  28 tables · 16 migrations · lineup + user plans + groups +     │
               │  presence + meeting points + media ledger + usage metrics        │
               └──────────────────────────────────────────────────────────────────┘
                      ▲                    ▲                    ▲
                      │                    │                    │
               Cron Trigger          Durable Objects         R2 Bucket
            (auto-ingestion           (per-group             (avatars +
              every 6h)            WebSocket rooms)       meeting photos)
                      │                    │                    │
               ┌──────┴────────────────────┴────────────────────┴──────┐
               │              Cloudflare Worker (Hono)                 │
               │   REST API · admin back-office · cron handler ·       │
               │   presence fan-out · media upload · Firebase JWT      │
               └───────────────────────┬───────────────────────────────┘
                                       │
                              React + TypeScript PWA
                            (Vite · Capacitor for native)
```

Users always read FestPilot's database — never the festival site directly. The backend ingests, normalizes, and serves the lineup; the app consumes the API.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (end-to-end) |
| **Monorepo** | npm workspaces (`server/` + `web/`) |
| **Backend** | Cloudflare Worker + Hono |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **Realtime** | Durable Objects (per-group WebSocket rooms) |
| **Storage** | Cloudflare R2 (media: avatars + meeting-point photos) |
| **Scheduled jobs** | Cron Triggers (lineup auto-ingestion) |
| **Frontend** | React 18 + Vite + react-router-dom |
| **Native** | Capacitor (GPS, push notifications, haptics, status bar) |
| **Auth** | Firebase Auth (anonymous-first, Google/Apple upgrade for groups) |
| **Unit tests** | Vitest (~840 tests across server + web) |
| **E2E tests** | Playwright (37 specs) |
| **i18n** | Custom layer (EN source of truth, PT overlay, live switch) |
| **Deploy** | Cloudflare Pages (web) + signed APK (Android) |

---

## Backend

The backend is a Cloudflare Worker built with [Hono](https://hono.dev). It is not a thin wrapper — it handles lineup ingestion, group coordination, live presence, media upload, and an admin back-office.

### API Surface

**Public API** — lineup, favorites, personal plan, squad management, presence, meeting points, pings ("where is everyone?"), group events, board messages.

**Admin API** — festival management (CRUD + multi-festival ingest), lineup dashboard, data-source registry, usage metrics with free-tier runway estimation, map editor (georeference + stage placement), and a live test console that creates test squads through the real presence pipeline.

### Key Modules

```
server/src/
├── api/           # Hono route handlers (24 modules)
├── ingest/        # Cron pipeline: source → fetch → hash → diff → store
├── lineup/        # Resolver + normalizer (CDN → structured data)
├── domain/        # Business logic (presence, meetings, plan changes, group events)
├── group/         # Durable Object: per-group WebSocket room
├── media/         # R2 adapter with app-enforced quota
├── db/            # ID generation (ULID)
└── auth.ts        # Firebase JWT verification (JWKS)
```

### Infrastructure Bindings

The Worker binds to D1 (relational), a Durable Object class (`GroupRoom` with SQLite storage — free tier), R2 (media bucket), and a Cron Trigger (`0 */6 * * *`). Auth is token-based (`ADMIN_TOKEN` as a Wrangler secret). Firebase ID tokens are verified via JWKS.

---

## Database

Cloudflare D1 with **28 tables** across **16 incremental migrations**. The schema covers:

- **Lineup domain** — festivals, editions/weekends, stages, performances, artists (M:N), lineup sources, import runs, change log, revision tracking
- **Map/geo domain** — stage locations (center + radius), stage-to-stage travel times, POIs (toilets, water, medical, exits), imported map features (KML), stage aliases
- **Personal domain** — users, favorites, closed timetable slots (with custom cut points for partial sets)
- **Social domain** — groups, members, group timetable slots, presence (with confidence and expiry), meeting points (with lifecycle states), pings, group events, board messages, plan change history
- **Infrastructure** — media objects (quota ledger), data sources, usage counters, festival suggestions

All migrations are additive and forward-only. The schema was designed upfront from a documented data model (`documents/v1-data-model-d1-schema.md`).

---

## Ingestion Pipeline

The lineup is never hardcoded. A cron-triggered pipeline resolves the source, fetches, normalizes, and stores the data:

1. **Resolve** — fetch the official festival page, parse `__NEXT_DATA__`, extract `event` + `uuid` identifiers. The UUID can change between runs; re-resolve every time.
2. **Fetch** — use the identifiers to build CDN URLs (`config-{event}-{uuid}.json`, `stages-{event}-{uuid}.json`, `{event}-{weekend}-{uuid}.json`) and fetch structured performance data.
3. **Normalize** — store times in the festival timezone (`Europe/Brussels`), strip the known +1-second end-time quirk, handle sets that cross midnight (end time rolls to the next day).
4. **Hash + diff** — SHA-256 the raw JSON; on change, compute a structured diff (added / removed / time changed / stage changed / artist changed).
5. **Store** — idempotent D1 upsert in a transaction. Removed acts are marked `active = false` (never hard-deleted). Bump a `lineup_revision` counter so clients know when to refresh.

**Cadence:** every 6 hours by default. The pipeline supports re-import on demand (per-festival or bulk) through the admin API.

**Fallback chain:** saved `event`/`uuid` → on 404, re-resolve from page → if `__NEXT_DATA__` is gone, keep last snapshot flagged as "possibly stale."

---

## Frontend

The web app is a React + TypeScript PWA (Vite), wrapped with Capacitor for native Android distribution. 50+ screens across seven feature clusters:

- **Lineup & Timetable** — browse by artist/stage/day, search, grid view, favorites with swipe gestures
- **Lock-in (My Plan)** — chronological clash resolution, partial set support ("leave early"), walk-time validation between stages
- **Map** — georeferenced SVG base (affine transform from control points), pan/zoom/pinch, day/night modes, live presence overlay, stage markers
- **Squad** — create/join (link, QR, scan, code), shared plan with auto-aggregation, owner override, per-block follow/split, plan change history, group events, board
- **Presence** — coarse GPS-to-stage mapping with confidence ("at" / "near" / "between"), "where is everyone?" pings, precise opt-in sharing (squad-scoped, TTL)
- **Meeting points** — exact location with photo + note + expiry, lifecycle states (active → expiring → expired → empty → archived), compass navigation
- **Safety** — "I'm lost" SOS with exact location sharing + nearest exit/medical

### Domain Logic

Core business logic lives in `web/src/domain/` as **pure, tested functions** (24 modules):

`clash detection` · `plan building` · `plan editing` · `partial sets` · `travel time` · `squad plan aggregation` · `squad timeline` · `now/next computation` · `member comparison` · `reminders` · `festival day derivation` · `timetable layout` · `intervals` · `routing` · `swipe gesture` · `data state`

Each domain module is co-located with its test file. No side effects, no API calls — pure inputs and outputs.

---

## Tests

**~840 unit tests** (Vitest) + **37 E2E specs** (Playwright). All green, `tsc --noEmit` clean across both workspaces.

### Unit Tests

- **Server (260 tests)** — resolver, normalizer, diff engine, ingestion orchestration, hash (SHA-256 vectors), ULID generation, admin metrics, runway estimation. Integration tests run against real D1 migrations via `sql.js`.
- **Web (579 tests)** — all 24 domain modules, plan editing invariants (zero-overlap by construction), clash detection, travel time, squad plan aggregation, member comparison, reminders, timezone formatting, i18n, data state transitions, lineup diff.

### E2E Tests

Playwright specs cover the golden paths: onboarding → favorites → lock-in → plan editing → squad creation → join → presence → meeting points. Shared freeze fixture with Service Worker settlement for deterministic runs (zero flaky after hardening rounds R7–R9).

### Running Tests

```bash
npm install          # from FestPilot/
npm test             # unit tests (both workspaces)
npm run typecheck    # tsc --noEmit (both workspaces)

cd web
npx playwright test  # E2E
```

---

## Technical Decisions

All product and architecture decisions are documented in `FestPilot/brain/decision-log.md` — **122 decisions** (DEC-001 through DEC-124), each with date, status, rationale, and alternatives considered. Key decisions:

| ID | Decision |
|----|----------|
| DEC-003 | Web-first React/TS + Capacitor (not React Native) |
| DEC-004 | Cloudflare backend (Workers + D1 + Durable Objects + R2) |
| DEC-007 | Coarse presence by default; exact location only via explicit meeting points |
| DEC-009 | Lineup source resolved at runtime, never hardcoded; auto-update with change detection |
| DEC-013 | Group plan: auto-aggregation + owner override + per-block follow/split; no in-app chat in V1 |
| DEC-017 | Clash detection: `overlaps(a, b) = a.startAt < b.endAt && b.startAt < a.endAt` |
| DEC-024 | Firebase Auth, anonymous-first; upgrade required for groups |
| DEC-037 | V1 runs entirely on Cloudflare free tiers |
| DEC-095 | Squad plan is live and auditable: auto re-share on change + history |
| DEC-099 | Precise live presence is opt-in, squad-scoped, and time-boxed (TTL) |

---

## Project Status

**Deployed and functional.** The app is live at [festpilot.pages.dev](https://festpilot.pages.dev) with a signed Android APK available for download.

**What's built:**
- Full lineup ingestion pipeline (Tomorrowland 2026: 813 performances, 15 stages, 2 weekends)
- Favorites with swipe/grid picking and per-day progress
- Lock-in clash resolution with partial sets and walk-time validation
- Squad creation, joining (link/QR/code), shared plan with aggregation and history
- Live coarse presence (GPS → stage mapping with confidence + expiry)
- Precise presence sharing (opt-in, squad-scoped, TTL)
- Meeting points with photo upload, lifecycle states, and compass navigation
- Interactive georeferenced map with day/night modes
- "Where is everyone?" pings with one-tap stage replies
- SOS / "I'm lost" safety feature
- Admin back-office with metrics, data-source registry, and map editor
- i18n (English + Portuguese) with live language switch
- PWA with offline support + Android APK via Capacitor

**What's next:** Firebase project setup (FCM for server push), on-device smoke testing, and the remaining V1.x features (discovery/fill-empty-slots, undo on clash decisions, share timetable as image).

---

## Repository Structure

```
festival-copilot/
└── FestPilot/                     # npm-workspaces monorepo root
    ├── brain/                     # Product knowledge base (spec, decisions, research)
    │   ├── product-spec.md        # What the app is, features, rules, scope
    │   ├── decision-log.md        # 122 decisions with rationale and status
    │   ├── technical-direction.md # Stack, architecture, data model, algorithms
    │   ├── implementation-phases.md # 6-phase build plan
    │   ├── research/              # Data-source study, map seed analysis
    │   └── documents/             # Execution orchestrators, wireframes, audits
    ├── server/                    # Cloudflare Worker (Hono + D1 + Durable Objects + R2)
    │   ├── src/
    │   │   ├── api/               # Route handlers (24 modules)
    │   │   ├── ingest/            # Cron ingestion pipeline
    │   │   ├── lineup/            # Resolver + normalizer
    │   │   ├── domain/            # Business logic
    │   │   ├── group/             # Durable Object (WebSocket room)
    │   │   └── media/             # R2 media adapter
    │   └── migrations/            # 16 D1 migrations (28 tables)
    ├── web/                       # React + TypeScript PWA (Vite + Capacitor)
    │   ├── src/
    │   │   ├── domain/            # Pure business logic (24 modules, co-located tests)
    │   │   ├── routes/            # 50+ screens across 7 feature clusters
    │   │   ├── map/               # Georeferenced SVG map engine
    │   │   ├── i18n/              # EN/PT with live switch
    │   │   ├── ui/                # Shared components
    │   │   ├── data/              # API client + caching
    │   │   ├── utils/native/      # Capacitor boundary (GPS, notifications, status bar)
    │   │   └── tests/             # E2E specs (Playwright)
    │   └── android/               # Capacitor Android project
    └── spikes/                    # Validated data spikes (lineup ingestion, map import)
```

---

## Getting Started

```bash
# Install dependencies (from FestPilot/)
npm install

# Run unit tests
npm test

# Type-check both workspaces
npm run typecheck

# Start the Worker locally (requires wrangler + local D1)
npm run db:create          # create local D1 (paste ID into wrangler.toml)
npm run db:migrate:local   # apply all 16 migrations
npm run dev:server         # start Worker on localhost

# Start the web app
npm run dev:web            # Vite dev server

# Trigger a lineup ingestion
curl -X POST http://localhost:8787/admin/ingest \
  -H "x-admin-token: YOUR_TOKEN"
```

---

## AI-Assisted Engineering Workflow

This project uses AI-assisted development (Cursor + Claude) to accelerate implementation while keeping architectural decisions, code review, and validation under human responsibility.

**How it works:**
- A product knowledge base (`FestPilot/brain/`) acts as the single source of truth — product spec, decision log, technical direction, and research are written and maintained by the developer.
- Multi-perspective analysis ("council" sessions) guides strategic decisions: stack choice, group mechanics, privacy model, naming. Each council weighs trade-offs from 4 lenses (strategy, architecture, risk, user value) before a human makes the call.
- Implementation is organized in phased delivery packages with explicit scope, acceptance criteria, and gate checkpoints.
- All 122 architectural decisions are documented with rationale, alternatives, and status — the AI proposes, the developer decides.
- Domain logic is tested with real values (not trivial assertions), and every financial/scheduling function gets math verification tests.

The AI accelerates the mechanical work (boilerplate, migrations, test scaffolding, i18n strings); the human drives product direction, reviews every decision, and validates the result on real devices.
