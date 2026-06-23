# FestPilot — AI Execution Guide

> Last updated: 2026-06-23. How to drive each phase from `implementation-phases.md` with the
> inline, single-agent workflow (no subagents — see `.cursor/rules/`). The AI plans briefly, then
> writes the code itself. Pair this with the phase's **AI Execution Brief**.

## Principles (apply every phase)
1. **Full context at phase start** — read the phase in `implementation-phases.md`, the relevant `product-spec.md` sections, `technical-direction.md`, and `decision-log.md` entries it cites.
2. **One feature at a time** — never build a whole phase in one prompt.
3. **Backend before frontend** — D1/API first, then React.
4. **Reuse the spikes** — `spikes/lineup-ingestion` (resolver/normalize/overlaps) and `spikes/map-import` (kml/match) are validated; port, don't reinvent.
5. **Test alongside build** — unit-test the invariants (no-overlap plan, +1s/midnight normalization, coord→stage, presence-never-raw).
6. **Update the brain** — at minimum `project-status.md` when a phase completes; log scope changes in `decision-log.md`.
7. **All code in English**; UI copy localizable.

## Stack quick-reference (DEC-003 / DEC-004)
- **Frontend:** Vite + React + TypeScript (PWA). Capacitor shell added when Phase 5 needs native location/push.
- **Backend:** Cloudflare Workers + **Cron Triggers** (ingestion), **D1** (relational), **Durable Objects** (per-group realtime), **KV** (cache), **R2** (photos). **FCM** for push.

## Phase-start prompt template
```
We are starting Phase {N}: {name} of FestPilot.
Read: brain/implementation-phases.md (Phase {N}), the product-spec sections it cites,
technical-direction.md, and the decisions it references.
Reuse: {relevant spike}.
Build feature-by-feature, backend before frontend. Confirm the plan for THIS phase in
a few bullets, then implement the FIRST feature only and stop for review.
```

## One-feature prompt template
```
Implement only: {UC-XX / feature}.
Inputs: {entities, endpoints, wireframe if any}.
Constraints: {spec rules, e.g. "locked plan must have zero overlaps", "clients never get raw coords"}.
Add tests for: {invariant}. Then summarize what changed and what to review.
```

## Per-phase pointers
- **Phase 1:** Port `resolver.ts`/`normalize.ts` into the Worker; design the **full D1 schema** now; cron→detect→diff→upsert→revision; test on `spikes/lineup-ingestion/fixtures`.
- **Phase 2:** Gated clash resolver as an explicit state machine (chronological unlock); travel-time is a **stubbed interface** here (real matrix in Phase 3); test the no-overlap invariant.
- **Phase 3:** Productionize `spikes/map-import` admin verify; offline cache/sync contract; introduce FCM; swap the travel-time stub.
- **Phase 4:** Closed-first / favorites-fallback aggregation; Durable Object per group; link+QR; no chat.
- **Phase 5:** Coarse, honest presence (raw lat/lng server-side only); consent-at-point-of-use; battery-aware sampling; interactive "where is everyone?" push.
- **Phase 6:** Meeting points + R2 photo + lifecycle/fade + compass-arrow nav + safety; exact coords only via explicit intent.

## Phase transition checklist
- [ ] All MUST done + tested; SHOULD done or consciously deferred.
- [ ] No blocking bugs in scope; integration with prior phases verified.
- [ ] `project-status.md` updated; scope changes in `decision-log.md`.
- [ ] Next phase's first-feature prompt ready.
