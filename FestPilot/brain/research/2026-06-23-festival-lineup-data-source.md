# Festival Lineup Data Source — How to Ingest Reliable Data

> Date: 2026-06-23
> Methodology: Technical investigation of the Tomorrowland Belgium 2026 official lineup (page inspection + HAR analysis) to find a reliable, structured data source for an app.
> Scope: How to obtain "day + stage + start/end time + artist" reliably, keep it fresh, and not break when the source changes.

> ✅ **CONFIRMED by spike (2026-06-23)** — a runnable spike validated this end-to-end offline against the captured HAR (`FestPilot/spikes/lineup-ingestion/`):
> - **Resolver target:** `__NEXT_DATA__` → `props.pageProps.doc.blocks[]` → block with `type:"line-up"` → `{ event, uuid }`. Exactly as hypothesized; never hardcode.
> - **This edition:** `event = TL26BE`, `uuid = 9205196e-3eef-45c0-a82e-72aa1bb3cf8f`, CDN `artist-lineup-cdn.tomorrowland.com`.
> - **Files:** `config-{e}-{u}.json` (2 weekends, Brussels datetimes), `stages-{e}-{u}.json` (**15 stages**), `{e}-W1-{u}.json` / `{e}-W2-{u}.json` (**813 performances** total).
> - **Quirks (real):** the **+1s** end-time quirk is on **every** performance (`…:01` → floor to minute); **53** sets cross midnight (keep the prior festival `day` label); **13** "More to be announced" placeholders; **0** performances on unknown stages.
> - Clash detection (`overlaps()`) and a "who plays at ELIXIR on Friday?" query both work on the normalized data.

## Problem

The app needs accurate, structured lineup data. Copy-pasting the page (Ctrl+A), OCR of screenshots, and reading the visual grid by eye are all unreliable: the timetable is a CSS grid, and flattened text loses which act belongs to which stage. We need the data **before** it becomes layout.

## Key Findings

- The official site (Next.js) **embeds the source identifiers in the page**: inside `__NEXT_DATA__` there is a `type: "line-up"` block with `event` (e.g. `TL26BE`) and a `uuid`.
- A CDN (`artist-lineup-cdn.tomorrowland.com`) serves clean JSON built from those identifiers:
  - `config-{event}-{uuid}.json` → `weekends` (start/end dates) + `withTimetable`.
  - `stages-{event}-{uuid}.json` → the stage list (HAR showed 15 stages).
  - `{event}-{weekendName}-{uuid}.json` → performances (HAR: W1 = 408, W2 = 405).
- Each **performance** is already structured:

```json
{
  "id": "2649985576",
  "name": "Milinguap",
  "artists": [{ "id": "1536128465", "name": "Milinguap", "image": "https://..." }],
  "stage": { "id": "2643140613", "name": "ELIXIR" },
  "date": "2026-07-17",
  "day": "FRIDAY",
  "startTime": "2026-07-17 16:00:00+02:00",
  "endTime": "2026-07-17 17:00:01+02:00"
}
```

- The page is the **manifest**; the CDN is the **heavy data**. So: resolve `event`+`uuid` from the page, then fetch the CDN JSON.

## Important Details / Gotchas

- **Do not hardcode the `uuid`.** It can change, and the page is the reliable way to get the current one. There was no obvious "latest" route in the HAR.
- **The same `uuid` can receive updated data.** In the HAR, the page's `updated_at` (2026-06-18) differed from a weekend JSON `Last-Modified` (2026-06-22) → data updates without the uuid changing. So re-fetch periodically even when the uuid is stable.
- **End-time +1 second quirk:** some `endTime` values end in `:01` (e.g. `17:00:01`). Normalize to `:00` or treat the end as exclusive by minute, or a query at exactly `:00` can match two acts.
- **Midnight-crossing sets** (e.g. `23:30 → 01:00`): `endAt` must roll to the next day, with the festival timezone (`Europe/Brussels`), or clash math breaks.
- **Stage drift:** the visual page showed a "DISCOVERY" stage that wasn't in the stages JSON; trust the JSON but allow new stages to appear.
- **CDN caching:** `cache-control: public, max-age=300` (5 min) — the practical floor for update frequency; faster just returns cache or wastes calls.

## Recommended Architecture

1. **Resolve source:** fetch the official lineup page → parse `__NEXT_DATA__` → get `event` + `uuid`.
2. **Fetch data:** `config` → `stages` → each weekend in `config.weekends` (don't hardcode W1/W2).
3. **Normalize:** timezone, +1s end-time, midnight crossing; store `startAt`/`endAt` as instants plus the raw strings.
4. **Persist:** store in our DB; users read our DB, never the festival site.
5. **Auto-update (worker):** re-resolve + re-fetch on a schedule; detect change via **ETag / Last-Modified / SHA-256** of raw JSON; on change, diff (added/removed/time_changed/stage_changed/artist_changed), apply in a transaction, bump a **lineup revision**, log changes, and alert affected users (favorited/locked acts). **Never hard-delete** removed acts — mark inactive.
6. **Fallback chain:** saved event/uuid → on error re-resolve from page → if `__NEXT_DATA__` is gone, render with Playwright and extract → else keep last snapshot flagged "possibly stale."

## Update Cadence (proposed)

- Far from the festival: daily.
- Days before: every few hours.
- Festival week: ~30 min.
- During the festival: ~5–10 min (respecting the 5-min CDN cache).

## Decisions Made

- DEC-009 (APPROVED): ingest the structured source, never hardcode the uuid, auto-update with change detection + affected-user alerts, never hard-delete; users read our DB.
- DEC-020 (APPROVED): Tomorrowland 2026 is the reference festival; design the model to generalize via per-source adapters.

## Impact on Brain Files

- `product-spec.md` §7, `technical-direction.md` §3, `decision-log.md` DEC-009/DEC-020.

## Reference facts (from the session)

- Tomorrowland Belgium 2026: two weekends — 17–19 Jul and 24–26 Jul; ~16 stages; hundreds of artists. Stages seen in JSON: MAINSTAGE, FREEDOM BY BUD, THE ROSE GARDEN, ELIXIR, CAGE, THE RAVE CAVE, PLANAXIS, MELODIA BY CORONA, CELESTIA BY KUCOIN, ATMOSPHERE, CORE, CRYSTAL GARDEN, THE GREAT LIBRARY, MOOSE BAR, HOUSE OF FORTUNE BY JBL (+ DISCOVERY appeared only in the visual page).
