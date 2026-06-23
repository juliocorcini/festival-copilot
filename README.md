# FestPilot

Festival companion app — build your personal lineup, resolve clashes into a fixed timetable, and stay together with your group through a shared timetable, stage map, walking times, live presence, and temporary meeting points.

> `FestPilot` is the current working name (parallel to `TripPilot`). It is easy to change — it only appears in a few config files and the brain.

## Workspace Structure

```
festival-copilot/
├── .cursor/                    # AI orchestration layer (copied from trip-budget-copilot)
│   ├── techlead.md             # Execution playbook (single agent, inline, no subagents)
│   ├── scope-template.md       # Template for new scoped work
│   ├── rules/                  # Always-on AI behavior rules (incl. festpilot-project-brain)
│   ├── skills/                 # Workflow skills (council, phases, design, brain, etc.)
│   ├── tools/                  # Document generators (PDF, DOCX, XLSX) — run `npm install` in tools/doc-generator
│   └── docs/                   # Plans, reports, scopes, diagrams
├── .agents/skills/             # UI/UX design quality skills
└── FestPilot/                  # npm-workspaces root (the app)
    ├── brain/                  # Source of truth (product spec, decisions, status, research)
    ├── spikes/                 # Validated data spikes (lineup ingestion, map import)
    ├── server/                 # Cloudflare Worker: lineup ingestion (cron) + read API on D1
    └── package.json            # workspaces: ["server"]; scripts: typecheck | test | build
```

### Backend (`FestPilot/server/`)

Cloudflare Worker (Hono). `src/lineup/` ports the validated spike (resolve `event`+`uuid` → CDN → normalize); `src/ingest/` is the cron pipeline (hash → fetch → diff → idempotent D1 upsert → bump `lineup_revision`); `src/api/` serves `/api/festivals`, `/festivals/:id/lineup`, `/festivals/:id/stages`. Schema: `migrations/0001_init.sql` (full V1, 28 tables). Run `npm install` at the `FestPilot/` root, then `npm test` / `npm run typecheck`. Local D1: `npm run db:create` (paste the id into `wrangler.toml`) → `npm run db:migrate:local` → `npm run dev` → `POST /admin/ingest`.

## How It Works

### Planning Phase (current)
1. **Define the product** — `FestPilot/brain/product-spec.md` is the first source of truth
2. **Research the data source** — `FestPilot/brain/research/` (lineup ingestion strategy)
3. **Choose the tech stack** — Use `/council` for multi-perspective analysis
4. **Design the app** — Use `/design` for wireframes
5. **Break into phases** — Use `/phases` for implementation ordering

### Implementation Phase
1. **Generate phase package** — Use `/deliver` to create a self-contained phase folder
2. **Execute** — The single agent plans briefly, then implements directly (inline, no subagents)
3. **Test** — Write and run tests directly (`npm run test`, Playwright)
4. **Report** — Final report written to `.cursor/docs/reports/`

## Available Commands

| Command | Purpose |
|---------|---------|
| `/council` | Multi-perspective analysis (4 experts) |
| `/debate` | Structured pro vs con argument |
| `/review` | Multi-angle code/architecture review |
| `/assess` | Risk + opportunity + cost + timeline |
| `/brainstorm` | Creative ideation (4 thinking styles) |
| `/product` | Feature/scope analysis |
| `/research` | Marketing & competitive research |
| `/finance` | Financial modeling |
| `/design` | Visual design & wireframes |
| `/phases` | Implementation phasing |
| `/deliver` | Generate phase delivery package |
| `/report` | Process developer phase report |
| `/diagrams` | Use case & class diagrams |
| `/doc` | Generate PDF/DOCX/XLSX documents |
| `/brain` | Manage knowledge base |

## Key Principles

- **Brain = Source of Truth** — All product decisions live in `FestPilot/brain/`
- **Lineup data is never hardcoded** — resolve `event` + `uuid` from the official page, then fetch the CDN JSON (see `technical-direction.md`)
- **Single inline executor** — one agent does all the work in this session; no subagents, no Task tool (`inline-council-no-subagents.mdc`)
- **Plan briefly, then build** — a short plan, then direct implementation
- **Gate checkpoints** — tests must pass between implementation gates
- **Finish with a question** — at the terminal moment, offer next steps via AskQuestion to save requests (`never-end-chat.mdc`)
