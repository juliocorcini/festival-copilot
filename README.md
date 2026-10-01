<p align="center">
  <img src="FestPilot/web/public/icons/icon-512.png" alt="FestPilot" width="120" />
</p>

<h1 align="center">FestPilot</h1>

<p align="center">
  <strong>A festival companion app that resolves lineup clashes, accounts for walking time between stages, and keeps your group together with live presence.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.69-teal" alt="Version" />
  <img src="https://img.shields.io/badge/tests-840%20unit%20%2B%2037%20E2E-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript Strict" />
  <img src="https://img.shields.io/badge/React-18-61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/Cloudflare-D1%20%2B%20DO%20%2B%20R2-F38020" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/platform-Web%20%2B%20Android-green" alt="Platform" />
</p>

<p align="center">
  <a href="https://festpilot.pages.dev">🌐 Live App</a> · Reference festival: Tomorrowland Belgium 2026
</p>

---

## The Problem

A big multi-stage festival is overwhelming in a very specific way:

- **Clashes are brutal.** Hundreds of artists across 16+ stages, and the ones you love are constantly scheduled at the same time.
- **Raw schedules ignore reality.** Real festival-going involves leaving one set early, walking 8 minutes to another stage, and catching the next act from the start. No tool accounts for that.
- **You lose your friends.** Everyone wants different acts, phones die, signal is bad, and "I'm at the main stage" is useless when the main stage holds 30,000 people.

FestPilot solves this with three pillars: **pick everyone you want** (favorites), **turn wishes into a conflict-free plan** (clash resolution with partial sets and walking time), and **stay together** (shared timetable, live presence, meeting points).

---

## What I Built

A full-stack festival companion — from lineup ingestion to live WebSocket presence to GPS-to-stage mapping — built solo and tested with real Tomorrowland 2026 data (813 performances, 15 stages, 2 weekends).

### By the Numbers

| Metric | Value |
|--------|-------|
| Source files | 237 |
| Lines of code | ~38,500 |
| React components | 91 |
| Backend API modules | 24 |
| Domain modules (pure TS) | 49 |
| Database tables / migrations | 28 tables · 16 migrations |
| Unit tests | 840 (Vitest) |
| E2E specs | 37 (Playwright) |
| Documented decisions | 122 (DEC-001 through DEC-124) |
| Commits | 178 |

---

## Key Features

### 🎵 Lineup & Clash Resolution
- Browse 813+ performances by artist, stage, or day
- **Partial set support** — "leave early" cuts a performance at a custom point so you can catch the start of another
- **Walk-time validation** — the app knows stage-to-stage travel times and warns if you can't physically make it
- Lock in a conflict-free personal timetable from your favorites

### 👥 Squad Coordination (Real-time)
- Create/join groups via link, QR, scan, or code
- **Shared plan** with auto-aggregation: see where each member will be, block by block
- Owner override + per-block follow/split ("I'll join you for this one")
- Plan change history — the group sees when someone changes their mind
- Group events and a message board

### 📍 Live Presence & Meeting Points
- **Coarse GPS-to-stage mapping** with confidence levels: "at Mainstage" / "near Freedom" / "between stages"
- **"Where is everyone?"** pings — one tap, everyone replies with their stage
- **Precise sharing** is opt-in, squad-scoped, and time-boxed (TTL)
- **Meeting points** with photo + note + expiry + compass navigation
- **"I'm lost" SOS** — shares exact location + nearest exit/medical

### 🗺️ Interactive Map
- **Georeferenced SVG** — real stage coordinates with affine transform from control points
- Pan/zoom/pinch, day/night modes
- Live presence overlay showing squad member positions
- Stage markers, POIs (toilets, water, medical, exits)

### 🔄 Automated Lineup Ingestion
The lineup is never hardcoded — a cron pipeline runs every 6 hours:
1. Resolve source → fetch CDN data → normalize timezone quirks (midnight crossing, +1s end times)
2. SHA-256 hash + structured diff (added / removed / time changed / stage changed)
3. Idempotent D1 upsert in a transaction — removed acts marked `active = false`, never deleted
4. Bump `lineup_revision` so clients know when to refresh

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

### Design Principles

- **Full-stack TypeScript** — end-to-end type safety across client, server, and database queries
- **Domain purity** — 49 business logic modules with zero side effects, co-located with tests
- **Edge-native backend** — Cloudflare D1 for relational data, Durable Objects for WebSocket rooms, R2 for media, all on the free tier
- **Lineup as ingested data** — the app never scrapes live; a cron pipeline normalizes and versions the data
- **Privacy-first presence** — coarse by default (stage-level), precise only on explicit opt-in with TTL

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | npm workspaces (`server/` + `web/`) |
| **Backend** | Cloudflare Worker + Hono (24 API modules) |
| **Database** | Cloudflare D1 (SQLite at edge, 28 tables, 16 migrations) |
| **Realtime** | Durable Objects (per-group WebSocket rooms) |
| **Storage** | Cloudflare R2 (avatars, meeting-point photos) |
| **Scheduled** | Cron Triggers (lineup auto-ingestion every 6h) |
| **Frontend** | React 18, TypeScript (strict), Vite, react-router-dom |
| **Native** | Capacitor (GPS, push notifications, haptics, status bar) |
| **Auth** | Firebase Auth (anonymous-first, Google/Apple upgrade for groups) |
| **Testing** | Vitest (840 unit) + Playwright (37 E2E) |
| **i18n** | Custom layer (EN source, PT overlay, live switch) |
| **Deploy** | Cloudflare Pages (web) + signed APK (Android) |

---

## Testing

**840 unit tests** + **37 E2E specs**, all green.

- **Server (260 tests)** — resolver, normalizer, diff engine, ingestion orchestration, SHA-256 hash vectors, ULID generation, admin metrics, runway estimation. Integration tests run against real D1 migrations via `sql.js`.
- **Web (579 tests)** — all 49 domain modules: plan editing invariants (zero-overlap by construction), clash detection, travel time, squad plan aggregation, member comparison, reminders, timezone formatting, i18n, data state transitions.
- **E2E (37 specs)** — golden paths from onboarding through squad coordination. Deterministic runs with Service Worker settlement and a freeze fixture.

```bash
npm test             # 840 unit tests (both workspaces)
npm run typecheck    # tsc --noEmit (both workspaces)
cd web && npx playwright test   # 37 E2E specs
```

---

## Project Structure

```
FestPilot/                        # npm-workspaces monorepo root
├── server/                       # Cloudflare Worker (Hono)
│   ├── src/
│   │   ├── api/                  # Route handlers (24 modules)
│   │   ├── ingest/               # Cron pipeline: source → fetch → hash → diff → store
│   │   ├── lineup/               # Resolver + normalizer
│   │   ├── domain/               # Business logic (presence, meetings, plans)
│   │   ├── group/                # Durable Object: per-group WebSocket room
│   │   └── media/                # R2 media adapter
│   └── migrations/               # 16 D1 migrations (28 tables)
├── web/                          # React + TypeScript PWA (Vite + Capacitor)
│   ├── src/
│   │   ├── domain/               # Pure business logic (49 modules, co-located tests)
│   │   ├── routes/               # 50+ screens across 7 feature clusters
│   │   ├── map/                  # Georeferenced SVG map engine
│   │   └── utils/native/         # Capacitor boundary (GPS, notifications)
│   └── android/                  # Capacitor Android project
└── brain/                        # Product knowledge base (spec, 122 decisions)
```

---

## Selected Engineering Decisions

| Decision | What & Why |
|----------|-----------|
| **Edge-native, free tier** | The entire backend runs on Cloudflare's free tier: D1 for relational data, Durable Objects for WebSocket rooms, R2 for media, Cron Triggers for ingestion. Zero cost at current scale. |
| **Clash = overlap, not coincidence** | `overlaps(a, b) = a.startAt < b.endAt && b.startAt < a.endAt` — a partial overlap is still a clash. Partial sets let you resolve it by cutting one performance short. |
| **Coarse presence by default** | GPS maps to the nearest stage (within radius), not to a coordinate. Precision is opt-in, squad-scoped, and time-boxed — festival privacy matters. |
| **Lineup is data, not code** | A cron pipeline re-ingests from the source every 6h. SHA-256 hash + structured diff. Removed acts are soft-deleted. The app survives schedule changes automatically. |
| **Anonymous-first auth** | Firebase anonymous sign-in on first open. Google/Apple upgrade required only for group creation — no friction for solo use. |

---

## Running Locally

```bash
cd FestPilot
npm install

# Backend
npm run db:create            # create local D1
npm run db:migrate:local     # apply 16 migrations
npm run dev:server           # Worker on localhost

# Frontend
npm run dev:web              # Vite dev server
```

---

## Live

The app is deployed at **[festpilot.pages.dev](https://festpilot.pages.dev)** with real Tomorrowland 2026 lineup data.

---

## AI-Assisted Development

This project was built with AI as part of the engineering workflow (Cursor + Claude). Architecture decisions, code review, and validation remain under human responsibility. The product knowledge base (`brain/`) contains 122 documented decisions — each with rationale, alternatives, and status.

---

<p align="center">
  Built for Tomorrowland 2026 by <a href="https://github.com/juliocorcini">Julio Corcini</a>
</p>
