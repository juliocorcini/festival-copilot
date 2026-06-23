# FestPilot — Decision Log

> Last updated: 2026-06-23 (Initial set DEC-001→DEC-020 from the product-definition session; **2026-06-23 discovery-council session** advanced DEC-003/004/013/015 to APPROVED and added DEC-021/DEC-022 — see `documents/2026-06-23-discovery-councils-and-decisions.md`; the **/phases session** added DEC-023 (V1 cut line) and the **/council** added DEC-024 (auth) — see `implementation-phases.md`; the **2026-06-23 UI prototype-review** added DEC-025→DEC-029 (visual identity + Timetable/Onboarding/Lock in specs) — see `documents/2026-06-23-ui-decisions-locked.md` — and **DEC-030** (map rendering), **DEC-031** (map asset pipeline: OSM + AI art, not satellite tracing), **DEC-032** (Lineup/Timetable nav), and **DEC-033** (map *beauty* pipeline: stylized cartography + LiDAR relief now, AI-paint & 3D as upgrades), and **DEC-034** (map *generator* productized into a one-call engine + admin map-editor workflow) — see `documents/2026-06-23-realtime-map-technical-plan.md` §8/§10/§11; and **DEC-035** (V1 path-to-launch decisions: PWA→Capacitor, all-6 phases, WebSocket presence, auth providers, TML-only) — see `documents/2026-06-23-path-to-launch.md`; and **DEC-036** (adopt the V1 implementation orchestrator as the execution source of truth + git on `master`) — see `documents/2026-06-23-v1-implementation-orchestrator.md`; and **DEC-037** (V1 runs entirely on free tiers — Durable Objects are free on the Workers Free plan, direct Pages upload, token-based deploy); **DEC-038** (operator intake — no R2, both weekends, Firebase deferred, PWA-only, squad cap 50); **DEC-039** (design-pass answers + Android-only native, no Apple/iOS); **DEC-040** (V1 map = pre-rendered raster base + live overlay, drop the 20 MB inline-relief SVG). APPROVED = decided direction. PROPOSED/PENDING = not yet confirmed. Next new id = DEC-041.)

## Format

- **ID**: DEC-NNN
- **Date**: YYYY-MM-DD
- **Status**: APPROVED | PENDING | SUPERSEDED | REJECTED
- **Decision**: What was decided
- **Rationale**: Why
- **Alternatives considered**: What else was on the table

> Note on "APPROVED" here: these are **product-direction** approvals from the definition session, not yet implementation-locked. They become firm as we design/build and Julio confirms specifics.

---

## Decisions

### DEC-001 — Project: festival companion app on the brain methodology
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Build a new festival-goer app, reusing the trip-budget-copilot AI orchestration layer (rules, agents, skills, tools) and the brain source-of-truth methodology.
- **Rationale**: Julio's proven setup from TripPilot; keeps planning rigorous and decisions traceable.
- **Alternatives**: Start tooling from scratch (rejected — the existing setup is strong).

### DEC-002 — App name: "FestPilot"
- **Date**: 2026-06-23 (confirmed by Julio)
- **Status**: APPROVED
- **Decision**: The app name is **"FestPilot"** (repo `festival-copilot`), parallel to TripPilot / trip-budget-copilot.
- **Rationale**: Clean parallel to Julio's existing brand; not category-limited (does favorites/groups/map, not only clashes).
- **Alternatives considered**: Clashless, Lineup, Setlist, Headliner, MyFest, SquadUp, Reunite (rejected — FestPilot keeps the brand family).

### DEC-003 — Platform / stack
- **Date**: 2026-06-23 (council)
- **Status**: APPROVED (recommended default — reversible early; confirm at will)
- **Decision**: **Web-first React + TypeScript (PWA), wrapped with Capacitor for the mobile build.** Pillars 1–2 (favorites + closed timetable) can ship as a pure PWA first; the Capacitor shell is added when Pillar-3/location/push work begins — same codebase, no rewrite.
- **Rationale**: The dealbreakers (interactive push with the app closed, offline, good foreground GPS) are where pure PWAs fail (esp. iOS). Capacitor reuses the web UI Julio is fast in and exposes native geo/push plugins; React Native would discard web reuse for little gain here.
- **Constraint**: presence must rely on **foreground GPS + push-reply fallback** (DEC-012), never *require* background location — that keeps us Play Store / App Store compliant.
- **Alternatives**: Pure PWA forever (rejected — kills Pillar 3); React Native/Expo (rejected — rewrite, no net benefit here).
- **What would flip it**: if Julio wants Pillars 1–2 validated as a zero-install pure web app, start PWA-only and defer the Capacitor step (backend choice unaffected).
- **Detail**: `documents/2026-06-23-discovery-councils-and-decisions.md` Part B; `technical-direction.md` §1.

### DEC-004 — Backend platform
- **Date**: 2026-06-23 (council)
- **Status**: APPROVED (recommended default — confirm at will)
- **Decision**: **Cloudflare** — Workers + **Cron Triggers** (lineup auto-updater), **D1** (relational), **Durable Objects** (per-group presence/realtime + group-plan state), **KV** (source hashes/snapshots), **R2** (meeting-point photos). Push via **FCM** (Capacitor plugin).
- **Rationale**: Fits the exact workload (scheduled ingestion + per-group realtime + push fan-out + photo upload) at low ops/cost; Julio already has Cloudflare tooling/skills. The backend is needed regardless of the stack decision (ingestion alone requires it).
- **Alternatives**: Node (Express/Fastify) + Postgres + queue + cron (rejected for V1 — more to run, no clear win).
- **Detail**: `documents/2026-06-23-discovery-councils-and-decisions.md` Part B; `technical-direction.md` §6.

### DEC-005 — Name for the "closed timetable" concept
- **Date**: 2026-06-23 (confirmed by Julio)
- **Status**: APPROVED
- **Decision**: The user-facing name is the noun **"My Plan"**, built by the verb **"Lock in"** ("Lock in your Saturday"). Pillar 1 stays "Want to see" / Favorites. ("Closed timetable" remains an internal/conceptual term only.)
- **Rationale**: The gamified clash flow already feels like locking choices; "My Plan" is instantly understood and doesn't collide with Favorites.
- **Alternatives considered**: My Lineup, My Schedule, Setlist, Game Plan, My Route, Final Cut (rejected).

### DEC-006 — GPS is the default posture; consent requested at point of use
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: The experience assumes GPS is on. Permission is requested the moment the user first uses a location feature (behind a friendly pre-prompt). After granting, location stays on. Anyone can turn it off; the app still works via manual/push fallbacks.
- **Rationale**: Julio wants location to be the norm, not buried; but the OS requires explicit consent, so ask at the right moment.
- **Alternatives**: Off-by-default (rejected by Julio); force-on (impossible — OS-gated).

### DEC-007 — Coarse presence by default; exact location never shared automatically
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Presence is shown coarsely from GPS: "at STAGE" / "near STAGE" / "between A and B" / none — never raw coordinates. Exact coordinates only via the explicit meeting point (DEC-014).
- **Rationale**: Privacy + honesty; "at the main stage" precision is enough most of the time.
- **Alternatives**: Always-exact (rejected — invasive, false precision).

### DEC-008 — Presence has confidence + expiry
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Presence carries a confidence (from GPS accuracy + distance to area) and expires (GPS ~15 min; manual/push-reply ~45 min) so stale data never looks current.
- **Rationale**: Festival GPS is noisy and apps get backgrounded; don't show old data as live.
- **Alternatives**: No expiry (rejected — misleading).

### DEC-009 — Lineup ingestion: resolve source, never hardcode, auto-update, never hard-delete
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Ingest the structured lineup from the official source (Tomorrowland: resolve `event`+`uuid` from `__NEXT_DATA__`, then fetch CDN JSON). Never hardcode the uuid. A scheduled worker re-checks for changes (ETag/Last-Modified/hash), diffs, updates the DB, bumps a lineup revision, and alerts affected users. Removed acts are marked inactive, never hard-deleted. Users read our DB, never the festival site.
- **Rationale**: The data is born structured; Ctrl+A/OCR/visual reading are unreliable. The uuid can change and data can update under the same uuid.
- **Alternatives**: Hardcoded uuid (rejected — brittle); scraping the visual grid (rejected — unreliable).
- **Detail**: `research/2026-06-23-festival-lineup-data-source.md`, `technical-direction.md`.

### DEC-010 — Stage map areas: center+radius (V1), polygon (V2)
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Admins place each stage on a real map (tap location) and define its area as a circle (center + radius) in V1; polygons come later for irregular areas.
- **Rationale**: Circles cover ~80% of cases with minimal effort; polygons add precision later.
- **Alternatives**: Polygon-only V1 (rejected — heavier to build/use first).

### DEC-011 — Stage-to-stage travel time: manual matrix (V1), learned (V2)
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: V1 uses a per-festival manual matrix (typical + crowded minutes) and/or a distance estimate with a festival-friction factor. V2 learns real transition times from aggregated, consented movement.
- **Rationale**: Real walking time (crowds, terrain, allowed paths) differs from straight-line distance; manual is reliable to start.
- **Alternatives**: Pure straight-line distance (rejected — inaccurate at festivals).

### DEC-012 — "Where is everyone?" interactive push + manual/push-reply fallbacks
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Anyone can ping the group; recipients get an interactive notification pre-filled with their nearest stage ("Are you at X watching Y? [Yes] [Change]"). Manual status and push-reply are first-class fallbacks to GPS.
- **Rationale**: Background GPS fails (closed app, throttling, dead battery); asking well beats guessing.
- **Alternatives**: GPS-only presence (rejected — unreliable in practice).

### DEC-013 — Group coordination & communication mechanics
- **Date**: 2026-06-23 (council)
- **Status**: APPROVED (confirmed 2026-06-23: a pinned **group board** is IN V1; full real-time chat is NOT)
- **Decision**: The group plan is an **auto-generated suggestion, owner-adjustable, member-optional**:
  1. **Auto plan** per time block: **plurality of members' locked picks** wins; **tie / no-majority → most-favorited across the group**, else **owner picks**.
  2. **Member fallback (DEC-019)**: if your lock ≠ winner, the app offers your best favorite at that block (same/adjacent stage).
  3. **Per-block follow / do-my-own** with **split visualization** ("22:00 split: 4→MAINSTAGE, 2→CORE") — splitting is shown, never prevented.
  4. **Owner override** per slot (`method: owner`) layered on the auto suggestion.
  5. **Never silently override a locked must-see**: "group → X, you're locked Y · [Join] / [Keep]."
  6. **Comms in V1**: group plan + reactions + where-is-everyone / meeting-point flows **plus a lightweight pinned group board** — short notes/announcements the whole group sees (e.g. "meet at gate 3 at 18h", "bag check is slow"). **No full real-time chat in V1** (people use WhatsApp). *(Board confirmed by Julio 2026-06-23.)*
  7. **Invites**: share link + QR.
- **Rationale**: For 4–8 friends, social glue beats democratic governance; majority alone causes "minority dragged along," so opt-in following + visible splits + owner override keep it fair and used.
- **Alternatives**: Pure majority (rejected — minority tyranny); owner-builds-all (rejected — bottleneck/passive); per-block voting (deferred to V1.x if a more democratic feel is wanted).
- **Detail**: `documents/2026-06-23-discovery-councils-and-decisions.md` Part C. Refines DEC-019.

### DEC-014 — Meeting points: exact, opt-in, photo + expiry + lifecycle
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: "I'm here, come to me" drops an exact point with optional photo + note, an expiry (10/20/30/60 min), and visibility (group or selected). Lifecycle: active → expiring_soon → expired → empty → archived; the pin fades over time; the record (who went) is kept.
- **Rationale**: Coarse presence isn't enough to find someone in a huge crowd; a photo ("under the blue beer sign") is what actually helps.
- **Alternatives**: Always-on exact sharing (rejected — invasive; see DEC-007).

### DEC-015 — Privacy defaults (specifics)
- **Date**: 2026-06-23 (council)
- **Status**: APPROVED
- **Decision**:
  - **Scope**: sharing is **per active group only** (never global); presence is **coarse** (stage / near / between + confidence + expiry).
  - **Modes**: manual-only · while-using-the-app · opt-in **live-during-festival** (time-boxed, e.g. "until 03:00").
  - **Exact coordinates**: only via **meeting points** (opt-in, expiring) and the **safety/"I'm lost"** action (DEC-022).
  - **Retention**: raw `lat/lng` server-only → compute coarse stage → not exposed, aggressively purged (keep only last fix); presence expires per DEC-008 and purges after the festival day; meeting points archive (who-went kept) and purge after the weekend.
  - **"Disappear from map"**: one toggle stops all sharing immediately and hides your marker.
  - **Consent pre-prompt copy**: "See where your group is and let them find you. Your exact spot is never shared unless you tap 'come to me.' You only share with your group, and you can stop anytime."
- **Rationale**: Location is sensitive; coarse-by-default + per-group + time-boxed + aggressive purge earns trust while keeping the features useful.
- **Detail**: `documents/2026-06-23-discovery-councils-and-decisions.md` Part E. Builds on DEC-006/007/008/014.

### DEC-016 — Product structure: three pillars
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: The product is organized as three distinct pillars: (1) Favorites, (2) Closed timetable, (3) Groups. Pillars 1–2 personal, pillar 3 social; each builds on the prior.
- **Rationale**: Matches how Julio described the app and how users will actually flow through it.
- **Alternatives**: One merged "schedule" feature (rejected — conflates wishing with committing).

### DEC-017 — Clash resolution is chronological, one-at-a-time, gated
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Closing the timetable resolves clashes in time order, one decision at a time; the next choice unlocks only after the chosen slot ends. Conflicting acts are shown side by side with genre/context to inform the choice.
- **Rationale**: Guarantees no overlaps slip through and keeps the decision load light and game-like.
- **Alternatives**: Resolve all at once / free reordering (rejected — error-prone, overwhelming).

### DEC-018 — Partial sets: custom cut points + travel-time validation
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: A closed-timetable slot can have a custom cut point ("watch A until 19:30, then go to B"); the engine validates the transition against stage-to-stage travel time and tells the user whether they'll make it.
- **Rationale**: Real festival-going stitches partial sets together; raw time slots aren't enough.
- **Alternatives**: Whole-set-only blocks (rejected — doesn't match reality).

### DEC-019 — Group matching: closed timetables first, favorites as fallback
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: The group timetable matches members on their closed timetables first; when a member's locked pick doesn't fit the group, fall back to that member's other favorited acts for that slot, so they stay with the group and still see someone they like.
- **Rationale**: Locked picks are too personal to align across people; favorites give a richer pool to find common ground.
- **Alternatives**: Match only on locked picks (rejected — groups would rarely align).

### DEC-020 — Reference festival: Tomorrowland 2026; model generalizes
- **Date**: 2026-06-23
- **Status**: APPROVED
- **Decision**: Build and validate against Tomorrowland Belgium 2026 first; design the data model (festival → editions/weekends → days → stages → performances) to generalize to other festivals via per-source ingestion adapters.
- **Rationale**: One real, complex festival to prove the model; generic shape avoids a rewrite for festival #2.
- **Alternatives**: Multi-festival from day one (rejected — premature; ship one well first).

### DEC-021 — Map seed from community Google My Maps (KML), used as unverified seed
- **Date**: 2026-06-23 (council)
- **Status**: APPROVED
- **Decision**: Use the fan-made "TML 22 + Dreamland" Google My Maps export (KML) as an **unverified seed** for the festival map. Import every feature → **auto-match the 10 high-confidence stages** (Freedom, Rose Garden, Mainstage, CAGE, Rave Cave, Atmosphere, CORE, Crystal Garden, The Library, Moose Bar) → **flag 5 old/renamed venues** (Harbour House, Mesa Garden, Youphoria, LEAF, Kara Savi) as "needs review" via a **StageAlias** table → an **admin verifies** location + radius before the app trusts it. DreamVille districts/areas/entrances seed the **practical POI layer** (DEC-022). After verification the app uses **our DB**, never the old map.
- **Rationale**: The map gives real coordinates for the stages that match 2026, saving hours of manual pin-placing; but it's years old (names/areas drift), so it must be verified, not trusted blindly.
- **Gotcha**: KML coordinates are `longitude,latitude` (not lat,lng). Stored correctly in the extracted GeoJSON.
- **Alternatives**: Hand-place every stage from scratch (slower); trust the old map as-is (rejected — stale).
- **Detail**: `research/2026-06-23-festival-map-seed-kml.md` (+ raw files in `research/assets/tml-map-seed-2026-06-23/`).
- ✅ **Validated by spike (2026-06-23)**: `FestPilot/spikes/map-import/` parsed 47 features and auto-matched exactly the 10 expected stages (9 high-confidence + `The Library`→`THE GREAT LIBRARY` via alias), flagged the 5 old venues (+ "Home Base") as needs-review, and listed the 5 sponsor-named 2026 stages with no seed location (ELIXIR, PLANAXIS, MELODIA BY CORONA, CELESTIA BY KUCOIN, HOUSE OF FORTUNE BY JBL) for manual placement. Emits an offline admin verify map.

### DEC-022 — Festival-context "survival" features are V1-critical
- **Date**: 2026-06-23 (brainstorm)
- **Status**: APPROVED (V1 additions; final V1 cut line to confirm with Julio)
- **Decision**: Beyond the three pillars, V1 must include the features that make the pillars usable **on-site** (no signal, dying battery, sunlight, one hand):
  1. **Offline-first** — lineup, my closed timetable, last-synced group plan, and cached map work with no network.
  2. **"Now & Next" home** — glanceable: on now / my next pick / where / **when to leave** (walk-time countdown).
  3. **Walk-time-aware reminders** — push before a locked act, accounting for travel time from the current/previous stage.
  4. **Battery-aware location** — adaptive GPS sampling + low-power mode + graceful "last known."
  5. **Practical POI map layer** — toilets, water, food, medical, exits, ATM, charging, lockers (seeded from the KML, admin-verified).
  6. **Meeting-point navigation** — compass arrow + distance (no turn-by-turn).
  7. **Fast favoriting onboarding** — swipe through the lineup to build Pillar 1 quickly.
  8. **Safety / "I'm lost"** — one tap shares exact location with the group + shows nearest exit/medical.
- **SHOULD (V1.x)**: discovery / fill-empty-slots; group split visualization; undo + "what did I give up" on clash decisions; share my timetable.
- **LATER (V2)**: post-festival recap & ratings/journal; weather/sunset; crowd/heat; richer comms; learned travel times.
- **Rationale**: A festival app that needs live network at 22:00 Saturday effectively doesn't exist; the highest-value additions are context-survival features, not social ones.
- **Anti-scope**: explicitly **no full in-app chat** and no social feed in V1 (DEC-013).
- **Detail**: `documents/2026-06-23-discovery-councils-and-decisions.md` Part A.

### DEC-023 — V1 cut line & phase order
- **Date**: 2026-06-23 (`/phases`)
- **Status**: APPROVED (confirmed by Julio 2026-06-23 — **everything is V1**)
- **Decision**: Build V1 in **6 phases** (`implementation-phases.md`): (1) Foundation & lineup spine, (2) Favorites + "My Plan", (3) Map + travel time + on-site essentials, (4) Groups + shared timetable + board, (5) Live presence + "where is everyone?", (6) Meeting points + nav + safety. **All 6 phases are MUST SHIP in V1** — Julio: live presence + meeting points are **non-negotiable**, the togetherness promise is core. The phase *order* still follows risk (riskiest realtime-location work last); "cut from the bottom" is only an **emergency lever**, not a planned V1 reduction. Schema is designed fully in Phase 1; behavior added incrementally.
- **Resolves**: **Open Q1 (DEC-022 essentials)** — **all** ship in V1, distributed by phase (offline + Now&Next + walk-time reminders in Phase 3; POI layer in Phase 3; battery-aware sampling in Phase 5; nav + safety in Phase 6). **Open Q2 (DEC-013 group board)** — **YES**, a lightweight pinned group board ships in V1 (Phase 4).
- **Rationale**: Pillars 1–2 are the unique core and can be validated as a **PWA first** (DEC-003), but the full vision requires the togetherness layer, so it's in scope. Ordering still front-loads lower-risk value and isolates the riskiest realtime work last so it can be built carefully. Each phase is independently testable.
- **Alternatives**: Build all three pillars in parallel (higher risk, nothing shippable early); ship presence before the group plan (rejected — riskier first).
- **Detail**: `implementation-phases.md` (scoring, per-phase scope, acceptance, AI briefs) + `ai-execution-guide.md`.

### DEC-024 — Authentication: Firebase Auth, anonymous-first with social upgrade
- **Date**: 2026-06-23 (`/council`)
- **Status**: APPROVED (recommended by council; confirm if you want a different provider)
- **Decision**: Use **Firebase Auth** with a **tiered** model:
  1. **Anonymous by default** — the app starts with no auth wall; Pillars 1–2 (favorites + "Lock in") work immediately on an anonymous account (matches DEC-003 "PWA first").
  2. **Upgrade required for groups** — to **create or join a group** (Pillar 3, which shares real-time location), the user must upgrade to a **permanent account**: **Google + Apple** sign-in (ship both — App Store requires Apple if Google is offered), with **email magic-link** as a fallback. Firebase's anonymous→permanent **linking preserves the `uid`**, so favorites/plan made anonymously carry over.
  3. **Workers verify the Firebase ID token** (JWT via JWKS) behind a thin internal `getUserFromRequest()` so the provider can be swapped later (Clerk/Supabase/multi-festival SSO) without touching app code.
- **Rationale**: Lowest onboarding friction at the festival gate (no typing/waiting for the personal app; one-tap social only when a social feature needs a trustworthy identity); **reuses the Firebase project already required for FCM** (DEC-004); anonymous-only would invite impersonation in a location-sharing group and risk silent identity loss.
- **Alternatives**: custom JWT sessions in Workers (more surface area: refresh/revocation/reset — rejected for V1); magic-link only (painful at the gate); Clerk/Supabase/Auth0 (good, but an extra vendor when Firebase is already in the stack); pure anonymous (unsafe for location sharing).
- **Implications**: `app_user` carries `firebase_uid` + `auth_provider` + `is_anonymous`; Pillar-3 actions are gated behind a permanent account; identity is a **Phase-4 prerequisite** but anonymous identity can ship from Phase 1.
- **Open**: provider choice is HIGH-confidence-pattern / MEDIUM-confidence-vendor — flip to Clerk/Supabase is cheap thanks to the `getUserFromRequest()` seam.

### DEC-025 — Visual identity: "Amber Glass"
- **Date**: 2026-06-23 (prototype review with Julio)
- **Status**: APPROVED
- **Decision**: The app's visual direction is **"Amber Glass"** — warm dark base (`#0F0D09`), amber/gold accent (`#F5A623 → #FFD060`), **heavy but polished/reflective frosted glass**. Titles in **Oswald** (condensed poster), body in **Albert Sans**. Softly rounded corners; auto dark/light theme (dark = identity + battery). Stage colors are a functional accent, never the dominant surface color.
- **Rationale**: Matches Julio's UI DNA (glass obsession, hype+premium+social, original "non-AI" look); gold differentiates from every festival app (which are purple/neon) and from generic AI palettes.
- **Hard rule**: must NOT look "AI-made" — no cliché neon pink/purple/green, no cliché AI fonts (Inter/DM Sans). Glass must be reflective/layered, not flat opaque tint (flat tint read as "anos 90").
- **Alternatives considered**: "Reef Glass" (teal/coral), "Magma Glass" (orange/red) — kept as documented alternates.
- **Detail**: `documents/2026-06-23-ui-dna-and-directions.md`, `documents/2026-06-23-ui-decisions-locked.md`, prototypes in `brain/wireframes/directions/`.

### DEC-026 — Nomenclature: Lineup ≠ Timetable ≠ My Plan
- **Date**: 2026-06-23 (Julio)
- **Status**: APPROVED
- **Decision**: Three distinct surfaces, named separately: **Lineup** = the *people* (all artists, no schedule); **Timetable** = *when/where* each artist plays (stages × time grid); **My Plan** = the locked, conflict-free personal schedule (DEC-005), one line per day.
- **Rationale**: Julio flagged that conflating "Lineup" with the schedule grid is wrong; favoriting is about people, scheduling is about time.
- **Detail**: `documents/2026-06-23-ui-decisions-locked.md` §2.

### DEC-027 — Timetable layout & card model (Tomorrowland-style)
- **Date**: 2026-06-23 (prototype #15e, validated by Julio)
- **Status**: APPROVED
- **Decision**: Rows = stages, columns = time (horizontal scroll = time, vertical = stages); ~6 stages fill the full height, more scroll vertically. **Sticky-left stage name** in the gap above each row (no left name column). **Sticky-top** time header; fixed day selector. Cards **positioned by real time** (gaps are real). **Continuous amber NOW line** top→bottom. **No visible scrollbars anywhere in the app.** Cards are **consistent dark glass** (dark bg + gray border); **favorites = gold** (not per-stage colored backgrounds — that looked dated); stage color only as a dot in the name pill + a **thin top line** on the card (a **left-only colored strip is rejected — reads as "AI-made"**). **Each card has a heart** to favorite in place (flips to gold), shows the **DJ photo** + name + time; on horizontal scroll the **photo+name+time stay pinned to the card's left** until the card ends, then slide out. **"Only my favs" toggle** (hides stages with no favorites; favorited acts still appear only at their real slot). **Zoom 1h/2h** user choice (default 2h).
- **Rationale**: Mirrors the Tomorrowland app pattern Julio loves; consistent cards + gold favorites keep it modern and on-brand; sticky content keeps context while scanning a wide grid.
- **Detail**: `documents/2026-06-23-ui-decisions-locked.md` §3; prototype `brain/wireframes/directions/15e-amber-timetable-tml.html`.

### DEC-028 — Onboarding asks festival → week → days BEFORE favoriting
- **Date**: 2026-06-23 (Julio)
- **Status**: APPROVED
- **Decision**: Before the favoriting flow, ask: **(1) which festival** (now: only Tomorrowland; future: a list), **(2) which week** (TML runs 2 weekends with *different* artists), **(3) which days**. Then favoriting is filtered to only artists playing the chosen week(s)/day(s). Favoriting uses a **swipe "Would you see this set?"** flow that is **not Tinder-styled** (text actions, not heart/X), always with Skip + a visible progress counter; an artist playing multiple days appears **once** (dedup). It's explicitly **not final** — it builds favorites; conflicts are resolved later in Lock in.
- **Rationale**: Without week/day filtering the artist list is simply wrong (W1 artists shown to a W2 attendee). Non-negotiable for correctness.
- **Detail**: `documents/2026-06-23-ui-decisions-locked.md` §4; prototype `14b-amber-onboarding-v2.html` (needs the pre-step added).

### DEC-029 — Lock in is multi-option (not 1v1) + "add nearby artist"
- **Date**: 2026-06-23 (prototype review with Julio)
- **Status**: APPROVED
- **Decision**: A clashing slot can have **2–6+ favorites**, so the Lock in UI is **multi-option select** (not a 1-vs-1 "VS"). Add an **"All clashes"** overview to jump to any conflict (not a forced chronological walk), and an **"add another artist"/search** that surfaces artists playing **around that time window** (so the user can pick someone not auto-listed or not yet favorited). **No "smart AI" auto-picking** — just surface nearby options; the user decides. Keep it gamified-but-skippable with a final celebration ("LOCKED IN!", #13) and a visible end-counter.
- **Rationale**: 16 stages means more than two acts can clash; 1v1 can't represent that. Users also need to reach acts the engine didn't surface, and some users want to skip the whole ritual.
- **Detail**: `documents/2026-06-23-ui-decisions-locked.md` §5; prototypes `12b-amber-lockin-multi.html` (+ search to add), `13-amber-lockin-done.html`.

### DEC-030 — Map rendering: custom georeferenced SVG (V1), MapLibre as upgrade path
- **Date**: 2026-06-23 (map-plan research with Julio)
- **Status**: APPROVED (V1 direction; revisit if heading-rotation/deep-zoom/turn-by-turn is needed)
- **Decision**: Render the interactive map as a **custom illustrated SVG georeferenced via a 2D affine transform**. Fit the transform once (offline) from **Ground Control Points** = our admin-verified stage coordinates (from the KML seed, DEC-021); store 6 coefficients per festival map in D1. At runtime, `geoToSvg(lng,lat)` places "me", friends, and meeting pins on the illustration. Presence flows through the **per-group Durable Object** (DEC-004), is **opt-in + coarse-by-default** (snap to nearest stage; precise is explicit, DEC-015), and is **battery-aware** (adaptive GPS, last-known fallback, DEC-012/DEC-022). The SVG + POI/stage JSON + transform are **cached for full offline use**. **MapLibre GL JS** (georeferenced `ImageSource` overlay or custom vector style + PMTiles offline) is the documented **upgrade path** if we later need heading rotation, deep zoom, or turn-by-turn — the GCP/transform work carries over.
- **Rationale**: A custom SVG gives full Amber-Glass brand control, the lightest bundle/battery, and trivial offline (it's an asset), which matches the festival reality (no signal, dying battery) better than a tile engine for V1. The site is ~1 km, so a simple affine is accurate.
- **Alternatives**: MapLibre/Mapbox tiles from day one (heavier, less brand control, harder offline — deferred to upgrade path); raw lat/lng with no illustration (rejected — Julio wants an illustrated map).
- **Stage icons**: bespoke per-stage icons (not letter initials).
- **Detail**: `documents/2026-06-23-realtime-map-technical-plan.md`.

### DEC-031 — Map asset pipeline: rebuild geometry from OSM + AI for the art (NOT trace a satellite photo)
- **Date**: 2026-06-23 (map asset research with Julio)
- **Status**: APPROVED (V1 production approach)
- **Decision**: Produce the illustrated map SVG as a **one-time design task per venue**, **not** a runtime "satellite → SVG" conversion. **Do not trace satellite imagery with AI.** Instead, a **3-layer pipeline**: **(A) Spatial truth from OpenStreetMap** — the real geometry (lake, paths, tree masses, parking, roads, park outline) is *already vector + georeferenced* in OSM; pull via Overpass/QuickOSM → GeoJSON (license ODbL, attribute). **(B) Festival overlay** — stages + POIs from our KML seed (DEC-021, admin-verified) placed at real coords. **(C) Style + art** — GeoJSON → styled SVG (QGIS Print Layout, or d3-geo + `geojson2svg`) in the Amber-Glass palette, enhanced with **Recraft V4 Vector** (the only AI that emits *native* SVG) for bespoke stage/POI icons + decor, hand-polished in Figma/Illustrator + SVGO. Building from a projection makes the **GPS↔SVG transform exact** (folds into DEC-030's `geoToSvg`).
- **Rationale**: (1) **Legal** — Google Maps/Earth ToS §21 **explicitly forbids tracing/derivative works** from their imagery; we'd be building a derivative map dataset. (2) **Wrong tool** — "Groq" is a fast **LLM** inference provider (text/vision), it does **not** generate images/SVG; vision-LLMs can describe/label but can't author an accurate map; only **Recraft V4 Vector** outputs native SVG, and it's for icons/illustrations, not terrain. (3) **Quality** — auto-tracers (VTracer/Potrace) on a photo yield thousands of messy, non-georeferenced paths. OSM gives clean, accurate, license-safe geometry directly.
- **AI's real role**: Recraft V4 Vector → icons + decorative art; a vision-LLM (Groq/Gemini) → optional auto-label/sanity-check only; VTracer → optional fallback to trace a **license-clean** aerial (Esri/Bing/OpenAerialMap — never Google) into rough contours.
- **Alternatives**: satellite photo → AI/VTracer → SVG (rejected — Google ToS + messy/non-georeferenced output); hand-illustrate from scratch with no geo base (rejected — slower, less accurate); MapLibre vector tiles instead of an illustration (already the DEC-030 upgrade path, not the V1 branded look).
- **Detail**: `documents/2026-06-23-realtime-map-technical-plan.md` §8.
- ✅ **Validated by spike (2026-06-23)**: `FestPilot/spikes/map-svg/` pulls De Schorre from Overpass (OSM/ODbL), classifies layers (water/green/park/parking/roads/paths), renders a stylized Amber-Glass base SVG, overlays the 10 seeded stages at real coords, and **fits + exports the GPS→SVG affine** with **residual ≈0.007 px** (confirms DEC-030: an affine is exact at ~1 km). The viewer drops live "you/friends/meeting" dots using only the 6 coefficients. Key gotchas captured: Google imagery forbidden (use OSM); drop the tidal Rupel; fill polygons / stroke lines; `fitExtent` on a MultiPoint not a Polygon; project vertices ourselves (d3 `geoPath` mis-winds OSM polygons into globe-size smears); sanitize `(0,0)` nodes; exclude town buildings.

### DEC-032 — Lineup/Timetable navigation: Timetable is the full-height pillar; Lineup via a single header icon
- **Date**: 2026-06-23 (Julio)
- **Status**: APPROVED
- **Decision**: The **Timetable is the bottom-nav pillar** and must stay **full height** — **no top menu / segmented "Lineup | Timetable" bar is ever placed on the Timetable** (it steals the vertical space the grid needs). The **Lineup is a separate full-height screen** reached by a **single icon** in the Timetable header (`groups`); the Lineup header has a single icon back to the Timetable (`calendar_month`), and the bottom "Timetable" tab also returns. Both screens exist independently (DEC-026); they are bridged by one small icon, not a menu.
- **Rationale**: Julio: combining them under one tab with a top toggle "diminishes the Timetable's height, and that's bad." A single icon in the existing header row costs zero vertical space while still giving the cross-shortcut he wants.
- **Alternatives**: top segmented toggle on a shared screen (rejected — steals Timetable height); two separate bottom tabs (6 total — possible but crowds the bar; offered to Julio as an option).
- **Detail**: `documents/2026-06-23-ui-decisions-locked.md` §2; prototypes `15e-amber-timetable-tml.html` (Lineup icon) + `22-amber-lineup.html` (Timetable icon).

### DEC-033 — Map *beauty* pipeline: stylized cartography now (LiDAR relief + textures + bespoke art), AI-paint & 3D as upgrade tiers
- **Date**: 2026-06-23 (map-beauty research with Julio)
- **Status**: APPROVED (direction) — **Route A BUILT & validated 2026-06-23** (`spikes/map-art`); Routes B/C documented as upgrades
- **Context**: The `map-svg` spike (DEC-031) proved we can build an **accurate, georeferenced** base SVG from OSM. Julio's new bar is **beauty on par with the official Tomorrowland maps** (he sent 4 refs: 2022 flat-illustrated, 2025 photoreal 3D, the botanical "Floorplan & Timetable", the Dreamville master): *"the app is beautiful, the map can't be ugly."*
- **✅ Built (Route A, `spikes/map-art`)**: beautiful illustrated De Schorre, fully automated (~10 s), reusing the `map-svg` geo base + affine. Has **real terrain relief** (Mainstage amphitheatre bowl + quarry hills), a **2.5-D scattered tree canopy** (~3.3 k painter-ordered sprites + tonal masses), **luminous water**, golden-hour light, soft shadows, an **ornate amber frame/legend/compass**, real **Oswald/Albert Sans** in the PNG, and **two palettes** (`desschorre-art.png` twilight on-brand + `-day.png` bright ≈ official refs). Live dots still drop via the affine (viewer.html). **Plan correction:** GDAL **not** needed — Flanders ships a **pre-rendered hillshade** (`DHMV_II_HILL_25cm`) pulled from **WMS** (EPSG:3857) and draped via `feColorMatrix` filters. **Ceiling for local generation reached** (Node + resvg, no Blender/GPU); Routes B/C need external GPU/services.
- **Finding**: the official/pro maps are **illustrated or 3D-rendered by artists** (Rock in Rio 2024 = 3D model + texture/light/shadow passes; Lightning in a Bottle = drone + 3D + digital illustration; TML = in-house art). We **copy the method, not the photo**, and automate steps 1–3 (geo base → relief/massing → art passes), leaving thin polish.
- **Decision**: Three tiers, all sharing the same OSM geometry + DEC-030 affine; **labels/pins/friends/meeting always stay a live vector overlay** (never baked into the art):
  - **Route A — Stylized illustrated cartography (BUILD NOW).** Extend `map-svg` with **Flanders DHMV-II LiDAR 1 m hillshade** underlay (real relief of the ex-quarry — the biggest "alive" win), **textured fills** (paper grain, painterly water), **scattered tree sprites** on wood/park polygons, soft shadows, **bespoke Recraft V4 stage/POI icons**, ornate frame + legend. Deterministic, georeferenced, light, offline-friendly, 100% ours, multi-festival. Output ≈ the 2022/Floorplan refs.
  - **Route B — AI-painted skin, geometry-locked (optional wow).** Our render (or the license-clean Flanders orthophoto) as a **ControlNet** conditioning image (segmentation/depth-from-LiDAR/canny) → **SDXL/Flux + ControlNet** painterly pass; composition preserved (per Cartographic-ControlNet, Aug 2025; map-sat/ControlEarth). GPU + per-festival tuning; less deterministic.
  - **Route C — True 3D render (high-end future = 2025 map).** **blosm** imports OSM buildings + forests/trees draped on DHMV terrain + water shader + 3D stage models; top-down ortho camera + lighting + post → high-res raster; vector labels on top. Highest beauty, highest effort.
- **Legal unlock**: Google imagery stays **forbidden** (ToS §21, DEC-031), but De Schorre is in **Flanders**, which publishes **license-clean** open data we *can* use: **Orthofotomozaïek 15 cm** ("Modellicentie voor gratis hergebruik", WMS/WMTS) as texture/AI-conditioning, and **DHMV-II LiDAR 1 m DSM/DTM** for relief. So Julio's "use the real aerial to make it beautiful" instinct is viable — with the government orthophoto, not Google.
- **"Groq" (closes the recurring question)**: Groq = fast **LLM** inference (text/vision); it cannot paint or emit a map. Image AI = **diffusion + ControlNet** (Route B) and **Recraft V4 Vector** (icons). Accurate shape always comes from **OSM + LiDAR**, never from an AI reading a photo.
- **License note**: **prettymaps** (AGPL-3.0) is used as **method/inspiration / optional offline build tool only** — our renderer stays independent so no AGPL coupling reaches the shipped app.
- **Alternatives**: flat vector base only (rejected — Julio: too plain/"dead"); hand-illustrate per festival (rejected — not automated, doesn't scale); trace Google satellite with AI (rejected — DEC-031 legal + quality).
- **Detail**: `documents/2026-06-23-realtime-map-technical-plan.md` §10. Next spike: `FestPilot/spikes/map-art/`.

### DEC-034 — Map generator productized: one-call engine + admin map-editor workflow
- **Date**: 2026-06-23 (Julio: *"turn this whole process into a real reusable system — in admin I drop where each stage is and it generates exactly this, for any festival, any location. Mandatory."*)
- **Status**: APPROVED — **BUILT & validated 2026-06-23** (`spikes/map-art` is now standalone; De Schorre via `npm start`, non-Flanders proof via `config/red-rocks-demo.json`).
- **Decision**: Route A is now a **reusable engine** `generateMap(input, outDir)` (no `map-svg` dependency). Input = a **`MapInput`**: venue `title`/`subtitle` + **stage pins** (`{name,lng,lat,matched}`) that **double as the affine GCPs**; everything else (bbox, Mercator fit, OSM geometry via Overpass, classification, projection, **affine fit**, terrain relief, tree canopy, both palettes, the `geoToSvg` transform) is **derived automatically**. Outputs per festival: `<id>.svg` + `<id>-day.svg` (**deep-zoom vector, shipped**), `<id>.png`/`-day.png` previews, `<id>-transform.json` (6 affine coeffs + residual), `<id>-viewer.html`.
- **Day/night**: both palettes ship every run; **app picks by local time (Auto) with manual Day/Night override** — a selection concern, not a re-generation. Demonstrated in the viewer.
- **Relief, globally**: `relief:"auto"` → **Flanders DHMV-II hillshade** (WMS) where available, else **AWS Open Terrain Tiles** (worldwide, JS hillshade) — any venue on Earth gets relief; `reliefWidth` configurable (flagship 3072).
- **Deep zoom**: the **vector SVG** is the deep-zoom asset (markers/labels/trees/paths crisp at ≈10×, verified); relief stays a soft underlay. Prod: ship SVG and/or a raster tile pyramid; reference relief as an external file (the spike inlines it).
- **Admin map-editor workflow**: admin drops/drag-corrects **stage pins on a plain reference base map** (Google/Mapbox **for placement only — never traced/baked**, DEC-031), names + verifies them ⇒ that **is** the `MapInput`; a **Worker/queue** job runs `generateMap`, stores assets in **R2/D1** by `festivalId`; app loads them for offline use. **Stage-placement accuracy is owned by the admin UI (drag pins), not the generator** (Julio's framing — Google's own pins are sometimes off).
- **Out of scope (decided)**: manual terrain editing (add/remove trees, carve land) — Julio: *"leave it automatic, it complicates more than it's worth; the map already looks great."*
- **Beauty pass 2 also landed** (DEC-033 Route A, same session): illuminated 2.5-D stage medallions (+ dashed needs-review pins), 8-point compass rose, title flourish, dual-palette as first-class.
- **Detail**: `documents/2026-06-23-realtime-map-technical-plan.md` §11 (+ §10.7). Engine: `spikes/map-art/src/{generate,geo,relief,draw,types}.ts`.

### DEC-035 — V1 path-to-launch decisions
- **Date**: 2026-06-23 (after building the admin map editor + the PWA map view)
- **Status**: APPROVED (Julio decided)
- **Context**: With the backend (Phase 1), the productized map generator (DEC-034), the **admin map editor** (`spikes/map-art/admin`) and the **PWA map view** (`web/`) all built, we locked the open product/infra choices to unblock the V1 build. Full checklist: `documents/2026-06-23-path-to-launch.md`.
- **Decisions**:
  - **Client target**: ship **PWA first, wrap with Capacitor before public launch** (web-first per DEC-003; native added for iOS web-push + background GPS that presence needs).
  - **Release scope**: **DEC-023 reaffirmed — all 6 phases must ship before any public release** (live presence + meeting points are non-negotiable in V1).
  - **Presence transport**: **WebSocket via a per-group Durable Object** (DEC-004), not polling — raw GPS server-only, clients get coarse stage labels (DEC-015).
  - **Auth**: Firebase **anonymous-first + Google + email/password** (DEC-024). **Apple Sign-In deferred** ⚠️ — App Store policy requires "Sign in with Apple" when a third-party social login (Google) is present, so **Apple must be added before the native iOS release** (or the iOS build offers email/anonymous only). Tracked as a launch blocker for iOS.
  - **Venues**: **Tomorrowland / De Schorre only for V1**; the generator already generalizes, so a 2nd venue is a post-launch proof.
  - **Tech (accepted recommendations)**: `generateMap` runs as a **managed Node job** triggered from admin (local tool + manual R2 upload until then); ship a **slim vector SVG + external relief PNG stored in R2** (drop the ~20 MB inline-relief asset); **admin pin editor is the source of truth** for `stage_location` (KML import = initial seed only); **relief `auto`** (Flanders LiDAR + global AWS fallback) is the default; hosting is the **Cloudflare** stack (Workers + D1 + R2 + Durable Objects + Pages).
- **Immediate unblockers (map)**: (1) externalize relief → slim SVG; (2) R2 + `festival_map` table + `GET /api/festivals/:id/map`; then point `web` at the API.
- **Detail**: `documents/2026-06-23-path-to-launch.md` (§B resolved, §C sequence).

### DEC-036 — Adopt the V1 implementation orchestrator as the execution source of truth (+ git on `master`)
- **Date**: 2026-06-23 (Julio: *"a super document I'll give to an AI: read it and implement everything — all steps, tests, deploys, commits, a git, all constraints so it flows without asking me anything. Research how Trip Copilot works and do something very similar."*)
- **Status**: APPROVED
- **Decision**: `documents/2026-06-23-v1-implementation-orchestrator.md` is the **master execution document** — the single source of *execution* truth (the brain remains the *product* truth). It is **modeled on TripPilot's `brain/documents/implementation-prompt.md`**: Identity (executor, not coordinator) → absolute autonomy rules (no subagents, no asking, don't stop, English code / PT UI) → reading order → §3 non-negotiables (DEC-referenced) → locked stack + **current baseline** (what's already built, don't rebuild) → services/environments → **git workflow** (trunk on `master`, Conventional Commits, one commit/milestone, deploy+dev-log/gate) → **testing strategy** (Vitest + Testing Library + Playwright + sql.js real-migration; >90% domain) → **deploy playbook** (Worker `wrangler deploy` + Pages on `master` + D1 migrate + R2 + map job) → CI → **`dev-log.md` state file** → gate-checkpoint/self-check/recovery protocols → **Phases 0–7** (Phase 0 = git baseline + slim SVG + R2 `festival_map` + `GET /api/festivals/:id/map` + point web at API + live bring-up; Phases 1–6 from `implementation-phases.md`; Phase 7 = Capacitor + launch hardening) → problem table (incl. WSL pager safety) → **Stop Criteria** → anti-patterns → a **TripPilot-parallels** section (what we mirror vs. deliberately diverge). **Git is initialized on `master`** with a baseline commit; commit/deploy cadence is per the orchestrator §6/§9.
- **Rationale**: Julio's proven Tier-3 method (TripPilot) shipped via exactly this kind of START-HERE orchestrator + dev-log + gate hardening; FestPilot reuses the pattern so a single AI can implement V1 autonomously, end-to-end, without per-step approvals.
- **Mirror vs. diverge (from TripPilot)**: *Mirror* — brain-as-constitution + orchestrator, inline no-subagent no-ask execution, React/Vite/TS + Capacitor, Cloudflare Worker (+ Hono) + Pages on `master`, Vitest/Playwright + sql.js, npm + Node 22, Conventional Commits, dev-log, OTA upgrade path, AI-via-Worker-secret proxy. *Diverge* — FestPilot is **server-authoritative** (D1 + Durable Objects + R2), **not** TripPilot's local-first Dexie, because it is multi-user (shared lineup, groups, presence, meeting points); plus real auth (Firebase), FCM, cron ingestion, per-group WS realtime, and a georeferenced map engine — none of which TripPilot needed. Improvements: pin Node 22 (`.node-version`) and add ESLint/Prettier from the start (gaps in TripPilot).
- **Alternatives**: keep driving phase-by-phase from `ai-execution-guide.md` prompts only (rejected — no single autonomous "build it all" contract with tests/deploys/commits/constraints); a thinner checklist (rejected — Julio wants the document to *be* the thing that makes it all happen without questions).
- **Detail**: `documents/2026-06-23-v1-implementation-orchestrator.md`; state in `FestPilot/dev-log.md`.

### DEC-037 — V1 runs entirely on free tiers (Durable Objects are free; direct Pages upload; token-based deploy)
- **Date**: 2026-06-23 (Julio: *"não quero pagar nada"* — confirmed direct Pages upload + I deploy with a Cloudflare API token)
- **Status**: APPROVED
- **Decision**: Ship FestPilot V1 at **zero infra cost**. **Verified 2026-06-23 against Cloudflare docs** ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)): **Durable Objects ARE available on the Workers *Free* plan** with the **SQLite storage backend** (the recommended default and the only backend offered on Free). Therefore **DEC-035's WebSocket-via-per-group-DO presence/groups/meeting realtime stands at $0 — no Workers Paid plan is required for V1.** (This corrects the earlier assumption that DO needed the paid plan.)
- **Free-tier ceilings that matter**: **100,000 Worker/DO requests per day** (counts HTTP requests, WebSocket *messages*, RPC sessions, and alarm invocations), 13,000 GB-s/day DO duration, 5M row reads/day, 100k row writes/day, 5 GB storage; Workers Free = 100k req/day + 10 ms CPU/invocation. **Ample for V1 + friends-scale testing.** A public **Tomorrowland-scale** launch would exceed 100k req/day and then need **Workers Paid ($5/mo + usage)** — a future-scale cost, not a V1 cost. WebSocket is *more* request-efficient than polling, so DO+WS is the right Free-tier choice anyway; **polling-over-D1 was the considered fallback and is now unnecessary**.
- **Implementation constraint**: the `GroupRoom` DO class must use **`new_sqlite_classes`** in its wrangler migration (SQLite backend) — KV-backed DOs are paid-only.
- **Hosting/deploy (Julio's choices)**: **Cloudflare Pages via direct `wrangler pages deploy web/dist --project-name=festpilot --branch=master`** (no GitHub); **deploys run from the dev machine** using a scoped **Cloudflare API token** + account id placed in `FestPilot/server/.dev.vars` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; scopes: Workers Scripts/D1/R2/Pages/KV Edit + Account Settings Read). GitHub repo + push-to-deploy + CI is a later add.
- **Firebase** stays on the **free Spark plan** (Auth: Anonymous/Google/Email + FCM send + Web Push VAPID) — also $0 for V1.
- **Rationale**: Julio doesn't want to pay; the entire V1 architecture (DEC-004/024/035) fits within Cloudflare + Firebase free tiers, so no spend is needed until real festival-scale traffic.
- **Alternatives**: Workers Paid $5/mo for DO (rejected for V1 — unnecessary now that DO is free); polling-over-D1 realtime (rejected — DO+WS is free and better); a non-Cloudflare free realtime vendor like Firebase RTDB/Supabase (rejected — adds a vendor; DO already covers it at $0).
- **Detail**: orchestrator §19 (provisioning) + §5/§13; supersedes the "needs Workers Paid" note implied by DEC-035's WS-via-DO choice (the *transport* is unchanged; only the cost premise is corrected).

### DEC-038 — Operator intake answers (V1 build inputs locked)
- **Date**: 2026-06-23 (Julio filled `brain/operator-intake.md`; said "terminei")
- **Status**: APPROVED
- **Decisions** (by intake question):
  - **Q1 R2 — NO R2 for V1.** Ship the De Schorre map as a **static asset** (card-free); wire R2 later for multi-festival. (R2 not enabled on the account — `code 10042`; avoids card-on-file.)
  - **Q2 Lineup — ingest BOTH weekends** from the official Tomorrowland timetable, **following the documented capture process in `brain/research/2026-06-23-festival-lineup-data-source.md`** (fetch the page's data routes with the required codes). Julio: *"você tem no brain todo um processo… não invente."* → do **NOT** improvise a scraper; cross-check vs Clashfinder only as validation.
  - **Q3 Firebase — deferred.** Build runs on **anonymous/device-local identity**; **push deferred** (in-app alerts only) for V1. Add Firebase web config + FCM later (orchestrator §19.3 / intake Part 5).
  - **Q4 Stores — installable PWA only** for V1; paid native store publishing (Apple $99/yr, Google $25) deferred.
  - **Q5 Name/brand — executor decides** ("FestPilot"); **consult the council** `brain/documents/2026-06-23-discovery-councils-and-decisions.md` when a brand/UX judgment is needed. Tagline TBD by build.
  - **Q6 Domain — `festpilot.pages.dev`** (web) + `*.workers.dev` (API). No custom domain.
  - **Q7 Icons — generate placeholder** PWA icon set (192/512/maskable/favicon/apple-touch) + theme from the UI palette.
  - **Q8 Service names — defaults** (Worker/Pages/D1 `festpilot`; `festpilot-assets` reserved for later R2).
  - **Q9 Squad cap — 50** members per squad (raised from default 20).
  - **Q10 Privacy/location — per brain** (`product-spec.md` / `documents/v1-use-cases.md`): coarse stage labels default, precise GPS opt-in; follow the brain's expiry/consent spec (DEC-015).
  - **Q11 Invites — link does NOT expire while the event is ongoing** (invite code + shareable link valid until the festival ends; overrides the 24h default).
  - **Q12 Analytics — Cloudflare Web Analytics** (free, privacy-friendly, no third-party trackers).
  - **Q13 Git remote — create a PRIVATE GitHub repo + push** for backup. ⚠️ **Blocked:** GitHub CLI `gh` is **not installed/authed** on this machine; needs install+auth or a repo URL + token/SSH. Local `git` on `master` continues meanwhile (not a build blocker).
  - **Q14 Autonomy — confirmed.** Build/test/commit/deploy without pausing; **stop only on cost or a missing credential**, noting it in `dev-log.md` (no one-by-one questions).
  - **Q15 Legal/contact — generate `PRIVACY.md` + `TERMS.md`**; support email **juliojcmedeiros@gmail.com**.
- **Process rule added this session**: every operator hand-off turn ends with an `AskQuestion` — workspace rule `.cursor/rules/always-end-with-askquestion.mdc` (alwaysApply) + orchestrator §1 rule 2 clarified (don't pause mid-build; end hand-off turns with an AskQuestion).
- **Detail**: `brain/operator-intake.md` (filled).

### DEC-039 — Design-completion answers (screen pass) + Android-only native
- **Date**: 2026-06-23 (Julio answered §4 of `documents/2026-06-23-screen-inventory-and-open-questions.md`)
- **Status**: APPROVED
- **Decisions** (by question):
  - **Q-A** Group-plan blocks = **per performance/set boundaries** (not fixed 30/60-min).
  - **Q-B** Group-plan interaction = **auto-plan visible to all + per-block follow/do-my-own + owner override; no member voting** in V1.
  - **Q-C** **No dedicated Favorites screen** — reuse the **Lineup (grid)** with an "only favorites" filter (+ Timetable "only my favs"). Removes that screen from the build.
  - **Q-D** Lock in = sequential flow **+ an "All clashes" overview** screen; **split editor is a sheet**.
  - **Q-E** Auth = **anonymous + Google + email-link**. **No Apple, no iOS** — the future native build is **Android-only** (Capacitor→Android). ⇒ **Apple Sign-In is dropped** (supersedes the Apple/iOS blocker noted in DEC-035); orchestrator Phase 7 becomes Android-only.
  - **Q-F** Profile = ask **display name + avatar at first group join** (editable in Settings); avatar = **upload or initials** (no preset gallery).
  - **Q-G** **Light in-app notification inbox** in V1 + contextual banners; OS push primary.
  - **Q-H** **Safety/"I'm lost"** = persistent action in **Squad**, also surfaced on **Map**.
  - **Q-I** Admin V1 = **map/stage verify + lineup dashboard**; travel-time matrix + POI as simple editors; alias only if needed.
  - **Q-J** Map V1 includes the **POI layer** (nearest toilet/water/medical) **and stage-to-stage routing**.
  - **Q-K** Language = **default English**, switchable in **Settings** (i18n; per-user, not auto-forced).
  - **Q-L** **Breaks** (food/toilet/drinks) are first-class **My Plan** items (already in `21`).
- **Process**: now executing the **design pass** (Amber Glass prototypes) in batches B1→B8, then upgrade the orchestrator to be screen-complete, then build (per the screen-inventory doc §5).
- **Detail**: `documents/2026-06-23-screen-inventory-and-open-questions.md` (§4 answered).

### DEC-040 — V1 map ships as a pre-rendered raster base + live vector overlay (not an inline-relief SVG)
- **Date**: 2026-06-23 (build, Phase 0 G0.2)
- **Status**: APPROVED (executor decision, consistent with DEC-034/035/038)
- **Decision**: The shipped De Schorre map base is a **pre-rendered raster** (`<id>.webp`/`-day.webp`, generated by rasterizing the engine's SVG with resvg) loaded as a single `<img>` layer; the **live overlay** (me/friends/meeting/POIs/labels) stays a **separate vector SVG layer** positioned via the exported affine (DEC-030/034 — overlay never baked in). The ~20 MB SVG that **inlined** the relief raster as base64 is **dropped from the shipped web assets** (kept only in git history / the engine's `out/`).
- **Why (the real constraint)**: an SVG loaded via `<img src>` runs in the browser's *secure static mode*, where **external** `<image href="relief.png">` references are **not fetched** — so the orchestrator's literal "slim SVG + external-href relief" would render the art **without** relief in the current `<img>`-based `MapView`. Inlining relief keeps it ~20 MB (violates DEC-022 offline/low-data + DEC-035 "slim"). A pre-rendered raster is small (~1–2 MB WebP), pixel-identical to the engine art (it *is* the rendered SVG, same as the engine's own `viewer.html`), works perfectly with the existing base/overlay split, and needs **no network** to produce (resvg + local fonts). This is exactly DEC-034's allowed "**ship SVG and/or a raster tile pyramid**" and DEC-038's "**static asset**" path.
- **Trade-off**: lose vector deep-zoom crispness on the base. Mitigated by rendering at ~2.4–3× (≈2400–3000 px wide) so pinch-zoom to ~3–4× stays sharp on phones. The vector deep-zoom SVG + external relief is revisited with **R2/multi-festival** (already deferred by DEC-038).
- **Generator note**: `generateMap` is also updated so future runs can emit an **external** relief reference (`reliefHref`) for the R2 path; the V1 web app uses the raster base regardless.
- **Supersedes**: the literal wording of orchestrator §13 P0.2/P0.3 ("externalize relief via external href in the shipped SVG", "R2 + map API") — the *intent* (slim shipped map, no 20 MB asset, served statically) is satisfied; R2 stays out per DEC-038.
- **Detail**: orchestrator §13 Phase 0; `web/src/map/MapView.tsx`; `spikes/map-art/scripts/rasterize-base.ts`.
