# Spike — Lineup Ingestion

Proves the FestPilot lineup pipeline end-to-end, **offline**, against real fixtures
mined from a captured HAR (`belgium.tomorrowland.com.har`):

```
resolve event+uuid (from __NEXT_DATA__) → build CDN URLs → load config/stages/weekends
→ normalize (timezone, +1s quirk, midnight-crossing) → validate + sample queries + clash demo
```

## Why it exists

De-risk DEC-009 (lineup ingestion) before building the real Cloudflare Worker: confirm the
source shapes, the resolver target, and the normalization quirks the research doc predicted.

## Run

```bash
npm install        # dev: tsx + typescript (run once)
npm start          # tsx src/run.ts  — runs the pipeline against fixtures
npm run typecheck  # tsc --noEmit
npm run mine       # node mine-har.mjs [path-to-har]  — re-extract fixtures from a HAR
```

## What's confirmed (event `TL26BE`)

- **Resolver target:** `__NEXT_DATA__` → `props.pageProps.doc.blocks[]` → block with `type:"line-up"` → `{ event, uuid }`. Never hardcoded.
- **CDN:** `https://artist-lineup-cdn.tomorrowland.com/` with `config-{event}-{uuid}.json`, `stages-{event}-{uuid}.json`, and per-weekend `{event}-{W1|W2}-{uuid}.json`.
- **Quirks handled:** the `+1s` end-time quirk (`23:00:01` → `23:00:00`) and midnight-crossing sets (a `00:30` set keeps the previous festival `day` label).

## Files

- `src/resolver.ts` — event+uuid extraction (from `__NEXT_DATA__` / HTML / live page) + CDN URL builder.
- `src/normalize.ts` — instant parsing, `+1s` correction, midnight detection, `overlaps()` (clash core).
- `src/types.ts` — source + normalized domain types.
- `src/run.ts` — the offline validation run.
- `mine-har.mjs` — one-off HAR miner that produced `fixtures/`.
- `fixtures/` — real captured JSON (config, stages, W1, W2) + `__NEXT_DATA__.json`.

## Port to production

This logic moves into a **Cloudflare Worker** (DEC-004): `resolver.ts`/`normalize.ts` are
runtime-agnostic TypeScript and port directly; live fetching uses `resolveSourceRefLive()` +
`fetch` of the CDN URLs; the auto-updater adds change detection (ETag/Last-Modified/SHA-256),
diffing, a lineup-revision bump, and affected-user alerts (see `../../brain/technical-direction.md` §3).
