# FestPilot Brain — Source of Truth

> Last updated: 2026-06-27 (**Leva 2 "Squad Vivo, Localização & Polimento Nativo" authored** — Julio's *second* usage review (on iPhone, inside a squad, two devices) normalized into `documents/2026-06-27-squad-location-native-orchestrator.md` (**ACTIVE**, non-blocking §16 lock) + kickoff; **DEC-089→107 PROPOSED**. The prior **"Review & Polish" leva is COMPLETE & DEPLOYED** (`documents/2026-06-27-review-polish-orchestrator.md`, v0.41.0, DEC-075→088 APPROVED). Earlier: **Initial product definition** + **discovery-council session** + **two validated spikes** + **V1 phase plan**. First document `product-spec.md`; lineup data-source in `research/2026-06-23-festival-lineup-data-source.md`; **map seed** in `research/2026-06-23-festival-map-seed-kml.md`; councils + decisions in `documents/2026-06-23-discovery-councils-and-decisions.md`; the **6-phase plan** in `implementation-phases.md` (+ `ai-execution-guide.md`). Decisions DEC-001→DEC-024 in `decision-log.md` — **names resolved (app = FestPilot; Pillar 2 = "My Plan" / verb "Lock in")**, plus stack/backend/group/privacy/map. The data spikes live in `FestPilot/spikes/`. **All V1 scope is decided** (DEC-023: all 6 phases MUST SHIP; DEC-013: group board in V1).)

## Truth Policy

1. This folder is the **single source of truth** for all product decisions about FestPilot
2. If something is not documented here, it has NOT been decided
3. AI agents MUST read relevant brain files before answering product questions
4. Contradictions between brain files must be flagged, not silently resolved
5. All updates must include `> Last updated: YYYY-MM-DD` at the top
6. **Lineup data is never hardcoded** — resolve the source (`event` + `uuid`) from the official page, then fetch the CDN JSON (see `technical-direction.md`)

## File Index

| File | Purpose | When to read |
|------|---------|--------------|
| `product-spec.md` | **THE first document** — what FestPilot is, who it's for, how it works, the 3 pillars, scope boundaries | Any product question |
| `decision-log.md` | All decisions DEC-001.. with status (APPROVED/PENDING/SUPERSEDED) | Before making new decisions |
| `technical-direction.md` | Stack candidates, lineup ingestion architecture, data model, geo/map, backend, notifications | Any technical question |
| `implementation-phases.md` | **The V1 build plan** — 6 scored/tiered phases, V1/V2 cut line, per-phase scope + acceptance + AI briefs | Planning what to build next |
| `documents/2026-06-23-v1-implementation-orchestrator.md` | **THE master execution document** — the single source of *execution* truth: phase/gate order, tests, deploys, git/commits, services, autonomy constraints. Hand this to an AI to build V1 end-to-end without stopping. Modeled on TripPilot's `implementation-prompt.md` | Building V1; any "how do we ship this?" question |
| `../dev-log.md` | **The live execution-state file** (FestPilot root) — current phase/gate, last green tests, deploy state. Updated every milestone | During the build; on context loss |
| `ai-execution-guide.md` | Per-phase prompt templates + the inline (no-subagent) execution workflow | Starting/driving a phase |
| `project-status.md` | Current status, open decisions, next steps | Status checks, standups |
| `documents/` | Plans, specs, audits, epic delivery reports | Execution, backlog |
| `research/` | Research outputs and raw source material | Deep dives on specific topics |

## Research Files

| File | Topic |
|------|-------|
| `research/2026-06-23-festival-lineup-data-source.md` | How to ingest accurate lineup data (day + stage + time + artist). Tomorrowland reference: `__NEXT_DATA__` → `event`+`uuid` → CDN JSON; normalization; the auto-updater + change detection; fallback chain |
| `research/2026-06-23-festival-map-seed-kml.md` | Map seed from a community Google My Maps (KML): 10 stages matched to 2026 + DreamVille areas/entrances; import → alias → admin-verify flow; `ImportedMapFeature`/`StageAlias` shapes; lng,lat gotcha. Raw files in `research/assets/tml-map-seed-2026-06-23/` |
| `research/base.txt` | Raw product-definition source material (Julio's own words: the 3 pillars, the map/GPS/groups vision, the location-privacy model) |

## Key Documents

| File | Topic |
|------|-------|
| `documents/2026-06-23-discovery-councils-and-decisions.md` | The 2026-06-23 inline councils: festival-goer **brainstorm** (V1 essentials), **stack+backend** decision, **group-mechanics** decision, naming recommendations, privacy defaults, map seed. Source for DEC-003/004/013/015/021/022 |
| `documents/v1-data-model-d1-schema.md` | **The concrete Cloudflare D1 schema** — ER diagram + every table's columns/types/FKs/indexes, privacy enforcement, D1 notes. The Phase-1 schema source of truth |
| `documents/v1-use-cases.md` | **The canonical V1 use-case list** (56 UCs in 10 domains) + actor↔domain diagram + the Pillar-2 "Lock in" flow + coverage check + open assumptions (auth) |
| `documents/2026-06-27-squad-location-native-orchestrator.md` | **CURRENT ACTIVE execution doc (Leva 2)** — Julio's *second* usage review: squad live-sync + history + transparency, precise presence, location defaults, SOS redesign, meeting mural, notifications, and the native feel (iOS + Android system bars) (E01–E28, P0/P1/P2; gates G0→G10, v0.42.0→v0.51.0). Root-cause map (code↔fix), 5 full + 2 quick inline councils, DEC-089→107. Paired kickoff: `documents/2026-06-27-squad-location-native-kickoff-prompt.md`. §16 has a non-blocking lock (precise presence / presence default / notifications) |
| `documents/2026-06-27-review-polish-orchestrator.md` | **COMPLETE & DEPLOYED** — the "Review & Polish" leva (Leva 1) from Julio's first 2026-06-27 usage review (D01–D26; gates G0→G10, v0.32.0→**v0.41.0** live). Root-cause map, 5 inline councils, DEC-075→088 (APPROVED). Paired kickoff: `documents/2026-06-27-review-polish-kickoff-prompt.md` |

## The Product in One Paragraph

FestPilot is a festival companion. You (1) browse the full lineup and **favorite** every artist you'd like to see (overlaps allowed — favoriting is a wish, not a commitment); (2) **close your timetable**, resolving every clash one at a time, chronologically, into a conflict-free personal lineup that respects partial sets and walking time between stages; and (3) create or join a **group** so friends can build a shared timetable and stay together, see each other's coarse presence on a stage map ("at MAINSTAGE"), ask "where is everyone?", and drop temporary exact **meeting points** (with photo + expiry) to find each other.

## How to Update

1. Read the existing file first
2. Make the update
3. Update the `> Last updated` date
4. If it's a decision, add it to `decision-log.md`
5. If it contradicts an existing entry, mark the old one as `SUPERSEDED` with a reference

## Naming Conventions

- Files: `kebab-case.md`
- Research: `research/YYYY-MM-DD-topic-name.md`
- Decisions: `DEC-NNN` format in decision-log.md
- Meetings: `MTG-YYYY-MM-DD` format
