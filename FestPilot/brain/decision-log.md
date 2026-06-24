# FestPilot — Decision Log

> Last updated: 2026-06-24 (Initial set DEC-001→DEC-020 from the product-definition session; **2026-06-23 discovery-council session** advanced DEC-003/004/013/015 to APPROVED and added DEC-021/DEC-022 — see `documents/2026-06-23-discovery-councils-and-decisions.md`; the **/phases session** added DEC-023 (V1 cut line) and the **/council** added DEC-024 (auth) — see `implementation-phases.md`; the **2026-06-23 UI prototype-review** added DEC-025→DEC-029 (visual identity + Timetable/Onboarding/Lock in specs) — see `documents/2026-06-23-ui-decisions-locked.md` — and **DEC-030** (map rendering), **DEC-031** (map asset pipeline: OSM + AI art, not satellite tracing), **DEC-032** (Lineup/Timetable nav), and **DEC-033** (map *beauty* pipeline: stylized cartography + LiDAR relief now, AI-paint & 3D as upgrades), and **DEC-034** (map *generator* productized into a one-call engine + admin map-editor workflow) — see `documents/2026-06-23-realtime-map-technical-plan.md` §8/§10/§11; and **DEC-035** (V1 path-to-launch decisions: PWA→Capacitor, all-6 phases, WebSocket presence, auth providers, TML-only) — see `documents/2026-06-23-path-to-launch.md`; and **DEC-036** (adopt the V1 implementation orchestrator as the execution source of truth + git on `master`) — see `documents/2026-06-23-v1-implementation-orchestrator.md`; and **DEC-037** (V1 runs entirely on free tiers — Durable Objects are free on the Workers Free plan, direct Pages upload, token-based deploy); **DEC-038** (operator intake — no R2, both weekends, Firebase deferred, PWA-only, squad cap 50); **DEC-039** (design-pass answers + Android-only native, no Apple/iOS); **DEC-040** (V1 map = pre-rendered raster base + live overlay, drop the 20 MB inline-relief SVG); the **2026-06-23 build** added **DEC-041→DEC-047** (Phases 3–6 executor decisions); and the **2026-06-24 review-remediation pass** added **DEC-048→DEC-055** (Julio reviewed 2026-06-24: DEC-048/049/050/051/052/054/055 APPROVED, DEC-053 SUPERSEDED by DEC-059; see `documents/2026-06-24-v1-review-remediation-orchestrator.md` §7), and its **round-2 follow-up + 4 inline councils** added **DEC-056→DEC-061** (autonomy hardening, admin back-office, presence guard-rail revision, avatar storage, onboarding identity, artist-photo source). APPROVED = decided direction. PROPOSED/PENDING = not yet confirmed. Next new id = DEC-062.)

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
- **Generator note**: a reusable `spikes/map-art/scripts/rasterize-base.ts` produces the shipped WebP from the engine SVG (resvg + sharp, no network). The vector-SVG-with-external-relief generator path is **deferred to the R2/multi-festival phase** (DEC-038) — the V1 web app uses the raster base.
- **Supersedes**: the literal wording of orchestrator §13 P0.2/P0.3 ("externalize relief via external href in the shipped SVG", "R2 + map API") — the *intent* (slim shipped map, no 20 MB asset, served statically) is satisfied; R2 stays out per DEC-038.
- **Detail**: orchestrator §13 Phase 0; `web/src/map/MapView.tsx`; `spikes/map-art/scripts/rasterize-base.ts`.

### DEC-041 — V1 Favorites & My Plan are local-first (no server identity until auth lands)
- **Date**: 2026-06-23 (build, Phase 2 G2.1)
- **Status**: APPROVED (executor decision; resolves the Phase-2 "server vs local" question from the brain)
- **Decision**: In the current V1 slice, **Favorites and the locked Plan persist on-device** (a versioned `localStorage`
  store, ready to move to IndexedDB), keyed by the festival id + weekend. **No `/api/favorites` or `/api/me/*` server
  routes are built yet.** The pure-domain logic (clash detection, the gated chronological resolver, partial-set
  feasibility, the **zero-overlap invariant**) lives in framework-free TypeScript (`web/src/domain/`) so it is identical
  whether data is local or server-backed, and is covered by property tests.
- **Why (brain-consistent)**: **DEC-038** deferred Firebase ("anon/local"); **DEC-024** states Pillars 1–2 "work
  immediately on an **anonymous** account" and that anonymous→permanent **linking preserves the uid so favorites/plan
  carry over". With no auth there is **no server identity to key rows by**, and **DEC-022** makes offline-first a hard
  requirement — a local store is offline by nature and gives instant reads/writes on a no-signal field. So local-first
  is the only consistent reading for the no-auth slice; the server endpoints from `implementation-phases.md` §Phase-2
  become the **sync target in Phase 4** (auth/groups), when identity exists.
- **Migration**: when Firebase lands (Phase 4), the anonymous uid adopts the local store (one-time upload) — no data loss.
- **Trade-off**: favorites don't roam across devices until sign-in (acceptable pre-auth; matches DEC-024's anonymous tier).
- **Supersedes (timing only)**: the Phase-2 "Backend: POST/DELETE /api/favorites, GET /api/me/favorites" lines — the
  endpoints are **moved to Phase 4**; the *intent* (favorites persist, plan is conflict-free) is fully met locally.
- **Detail**: `web/src/domain/*` (pure logic + property tests); `web/src/data/localStore.ts`; orchestrator §13 Phase 2.

### DEC-042 — V1 squad identity is anonymous-local; permanent accounts deferred behind the auth seam
- **Date**: 2026-06-23 (build, Phase 4 G4.1)
- **Status**: APPROVED (executor decision, consistent with DEC-024/038/039)
- **Decision**: Groups in V1 run on an **anonymous-local identity**: the client mints a stable `anon.<ulid>` bearer
  token once; the Worker turns it into an `app_user` (`is_anonymous=1`, `auth_provider='anonymous'`) on first request,
  **behind a single `getUserFromRequest()` seam** (`server/src/auth.ts`). The DEC-024 rule "a **permanent** account
  (Google + email-link) is required to create/join a group" is **deferred** to the Firebase integration (DEC-038 put
  Firebase ⏳): the sign-in screen ships **"Continue as guest"** as the working path and shows Google/email-link as
  upcoming. **No Apple/iOS** (DEC-039). When Firebase lands, ID-token verification slots into `getUserFromRequest`
  unchanged for all routes, and anonymous→permanent linking preserves the uid so favorites/plan/squad carry over.
- **Why**: DEC-038 explicitly deferred Firebase ("anon/local"); the orchestrator (§5/§19) mandates running the **local
  equivalent** when a credential is absent and marking the live step ⏳ rather than blocking. Anonymous identity is the
  honest V1 slice and is structurally identical to the Firebase path thanks to the seam. Friends-scale V1 does not need
  forgery-proof tokens; that hardening arrives with Firebase.
- **Trade-off**: anon tokens are unverified (a determined user could forge one) — acceptable pre-Firebase at friends
  scale; flagged ⏳ as a launch-hardening item (Phase 7).
- **Detail**: `server/src/auth.ts`, `server/src/api/{me,users}.ts`, `web/src/data/{authToken,identity}.ts`; orchestrator §13 Phase 4 G4.1.

### DEC-043 — Group realtime is a GroupRoom DO "changed-event" fan-out; D1 stays source of truth
- **Date**: 2026-06-23 (build, Phase 4 G4.2)
- **Status**: APPROVED (executor decision, consistent with DEC-037/038)
- **Decision**: Each squad gets one **`GroupRoom` Durable Object** (SQLite backend via `new_sqlite_classes`; free on the
  Workers Free plan — DEC-037). **D1 is the source of truth** for groups/members/invites; the DO's only job is realtime
  **fan-out**: after any write the Worker POSTs the DO `/notify`, which broadcasts a tiny `{type:"changed",rev,topic}` to
  hibernatable WebSocket clients, which then **re-fetch**. Clients also **re-fetch on focus**, so the UI is fully correct
  even if the socket is down (the socket is a pure enhancement, never a correctness dependency). Implementation choices,
  all brain-consistent: **(a)** join is capability-based — `POST /api/groups/join {token}` (the token *is* the auth), not
  the orchestrator's literal `/:id/join`; **(b)** the WS handshake carries the bearer as `?t=` because browsers can't set
  WS headers (upgrade-only; membership still verified); **(c)** a leaving **owner** hands ownership to the earliest-joined
  remaining member (no orphan squad); **(d)** invite token = 6-char Crockford, **no expiry** until the event ends
  (DEC-038); squad **cap 50**; **(e)** group **emoji** added (migration `0004`).
- **Why**: DEC-037 verified DO+SQLite is $0 on Free and is the intended realtime layer; a thin "changed-event + refetch"
  model keeps the DO trivial, avoids duplicating state, and is naturally consistent (D1 read-after-write). Focus-refetch
  guarantees correctness on flaky festival networks (DEC-022 offline-first ethos).
- **Trade-off / ⏳ hardening (Phase 7)**: WS `?t=` token is fine at friends-scale but should become a **short-lived
  ticket** with Firebase; **QR _scanning_** (camera) is deferred — the link is the primary path and pasting a code covers
  the manual case (QR _display_ is shipped, scannable); **deep-link before onboarding** (`/j/:token` for a brand-new user
  who hasn't picked a festival) currently routes through onboarding first — acceptable for friends V1.
- **Detail**: `server/src/group/room.ts`, `server/src/api/{groups,groups-routes}.ts`, `server/wrangler.toml` (DO binding +
  migration v1), `web/src/data/groups.ts`, `web/src/routes/squad/{CreateSquad,Invite,Join}Screen.tsx`,
  `web/src/routes/SquadScreen.tsx`; orchestrator §13 Phase 4 G4.2.

### DEC-044 — Shared timetable is server-raw + client-aggregated (pure `buildSquadPlan`); never-silent
- **Date**: 2026-06-23 (build, Phase 4 G4.3)
- **Status**: APPROVED (executor decision, implements DEC-013/018/019)
- **Decision**: The squad timetable is **aggregated on the client** by a pure function (`web/src/domain/squadPlan.ts`,
  `buildSquadPlan`) — the **server stores and returns only RAW shared data**: each member's locked picks
  (`group_member_plan`, mirroring partial-set cuts per DEC-018), their opt-in shared favorites
  (`group_member_favorite`, **act-keyed**, uploaded **only** when "use as fallback" is on — DEC-019), the sharing
  intent flags on `group_member`, and the owner overrides (reusing the existing `group_plan_slot`). The client joins
  this against the **lineup it already holds** to build per-block winners by the rule **plurality → favorited → owner
  override**, plus the split, the "who's going" avatars, and **YOUR** status (`following` / `own` / **`conflict`**).
  **Never-silent (DEC-013):** when your locked pick ≠ the squad's, the UI **never auto-changes it** — the block screen
  offers explicit **Join squad** (a real local re-lock + re-share, your choice only) or **Keep my lock**, plus your
  favorites-fallback if you also liked something near the squad. Freshness reuses the G4.2 contract (GroupRoom
  `changed` fan-out + refetch-on-focus; `notifyGroup(...,"plan")`).
- **Why (brain-consistent)**: keeping aggregation pure + client-side mirrors the **personal** resolver (one source of
  truth for "one act per moment"), keeps the server a thin store (no heavy joins, no lineup coupling), and makes every
  rule **unit-testable** offline (11 domain tests). Act-keyed favorites match the local favorites store (DEC-026/028).
  Owner override as a pinned `group_plan_slot` makes "owner wins" a trivial last step in the same pipeline.
- **Trade-off**: the client must hold the lineup to render the squad plan (already true on every screen); a member who
  shares a pick for an act not in the viewer's lineup day is dropped (acceptable — same festival/lineup for all).
- **Detail**: migration `0005_group_shared_plan.sql`; `server/src/api/squadPlan.ts` (+ routes in `groups-routes.ts`);
  `web/src/domain/squadPlan.ts` (+ tests), `web/src/data/squadPlan.ts`, `web/src/routes/squad/{ShareMyPlan,SquadPlan,
  SquadBlock,SquadOverride}Screen.tsx`, `web/src/routes/squad/squadUi.tsx`; orchestrator §13 Phase 4 G4.3.

### DEC-045 — Group board is lightweight pinned notes (NOT chat); author-edits, owner-moderates; over the DO
- **Date**: 2026-06-23 (build, Phase 4 G4.4)
- **Status**: APPROVED (executor decision, implements UC-39 / DEC-013)
- **Decision**: The squad board is a **flat list of short pinned notes / announcements — explicitly NOT a real-time
  chat** (UC-39, DEC-013). The pre-existing `group_board_note` table (`0001_init.sql`: id, group_id, author_user_id,
  body, pinned, created_at_utc, updated_at_utc) is reused **as-is — no new migration**. Repo `server/src/api/board.ts`:
  `listNotes` (ordered **pinned-first then newest-first**), `postNote`, `editNote` (**author-only**, stamps
  `updated_at_utc` → drives the "· edited" hint), `setPinned` (**owner-only** moderation), `removeNote` (**author or
  owner**); body capped at `MAX_NOTE_LENGTH = 500`. Four member-gated routes (`GET/POST /:id/board`,
  `PUT/DELETE /:id/board/:noteId`) each call `notifyGroup(...,"board")` so the **GroupRoom DO** fans the change out and
  clients re-fetch (reusing the G4.2 WS+focus contract — DEC-043). No wireframe existed, so the screen
  (`SquadBoardScreen` at `/squad/:id/board`, entered from a new card on the group home #23.7) was designed consistent
  with the squad DNA: glass note cards (avatar + author + relative time + body), an amber "PINNED" flag, an inline
  edit box, and a bottom composer.
- **Why (brain-consistent)**: V1 deliberately ships a board, **not chat** (scope discipline, DEC-013) — it covers
  meet-points / can't-miss shout-outs / after-plans without the moderation + presence cost of chat. Permissions mirror
  the rest of Phase 4 (author owns their content; owner moderates). Reusing the DO fan-out keeps freshness consistent
  with groups + shared plan; pure repo functions stay unit-testable offline (6 board tests via the sql.js D1 shim).
- **Trade-off**: no per-note reactions / threads / read-receipts (not needed at friends-scale V1); board is best-effort
  realtime (correctness still comes from refetch-on-focus, never the socket). The `d1-shim` was upgraded to return
  `meta.changes` (via `getRowsModified()`) so author/owner-gated writes are testable exactly as on real D1.
- **Detail**: `server/src/api/board.ts` (+ `dto.ts BoardNoteDto`, routes in `groups-routes.ts`), `server/test/board.test.ts`;
  `web/src/data/{types,api,board}.ts`, `web/src/routes/squad/SquadBoardScreen.tsx`, entry card in `SquadScreen.tsx`;
  `web/e2e/squad-board.spec.js`; orchestrator §13 Phase 4 G4.4.

### DEC-046 — Phase 5 presence is coarse-only; the "precise live pin" exact dot rides the Phase-6 exact channel
- **Date**: 2026-06-23 (build, Phase 5 — inline council)
- **Status**: APPROVED (executor decision via inline council; implements DEC-006/007/008/012/015/035/039)
- **Context**: The orchestrator §3 non-negotiables + DEC-007/015 + anti-goals are absolute: presence is **coarse**, raw
  `lat/lng` is **server-only**, **clients never receive raw presence coordinates**, and exact coords leave the server
  **only via meeting points** (+ the safety "I'm lost" action). But the approved wireframe `#25` (3/4/5), DEC-039 and the
  Phase 5 gate spec all include a **"Precise live pin"** mode ("a moving dot on the map, auto-off in 60 min"). A 4-lens
  council (Privacy-Strategist / Architect / Critic / User-Advocate) resolved the conflict.
- **Decision**: Phase 5 ships **coarse presence end-to-end** as the must-ship core — `POST /api/presence` takes a raw fix
  in, the server resolves **stage + coarse label (at/near/between/none) + confidence (high/med/low) + expiry** (GPS ~15m,
  manual/push ~45m) and stores raw `lat/lng` **server-only**; `GET /api/groups/:id/presence` returns **coarse-only DTOs
  that never carry `lat/lng`**. The three **sharing modes** are real *state* on `group_member` (`share_location`
  off=Ghost / while_using=Stage / live_until=Precise, with `share_until_utc`). **Precise** is honoured as an explicit,
  **server-side-hard-expiring 60-min** intent: the squad sees the sharer as **"live · precise · Nm left" at a
  high-confidence coarse position** — never a raw coordinate. The truly-exact **moving dot is deferred to Phase 6**,
  delivered by the **same exact-coords channel** that phase builds for "come to me" meeting points (R2 + exact share),
  so we never build two exact-coords privacy surfaces and the approved **consent copy stays literally true**.
- **Why (weightiest lens = Privacy-Strategist)**: the consent pre-prompt copy is **already approved verbatim** ("your
  exact spot is never shared unless you tap 'come to me'") — the data contract must not contradict the words. Coarse-only
  is unambiguous, fully buildable now, and exhaustively unit-testable (pure `coarsenPresence`). Exact-coords-to-clients
  belongs to the phase that builds that infra anyway (Phase 6).
- **Conditions (enforced)**: (a) **no DTO ever carries `lat/lng`** for presence; (b) precise **hard-expires server-side**
  at `share_until_utc` (cron + lazy check), not just in the UI; (c) the precise control is **honestly labeled** (no claim
  others see a meter-accurate dot in Phase 5); (d) the exact moving dot is a **named Phase-6 deliverable**, not vague
  backlog. **Flip condition**: if Julio declares the exact dot a Phase-5 must-ship, build it now — but still as a
  **separate explicit/expiring channel**, never by widening the coarse feed.
- **Detail**: `server/src/domain/presence.ts` (pure `coarsenPresence` + tests), `server/src/api/presence.ts` (repo),
  `POST /api/presence` + `GET/PUT /api/groups/:id/presence|share` routes, cron purge in `index.ts`; web consent +
  precise-control + roster + sharing-mode + privacy screens (proto `25`); orchestrator §13 Phase 5.

### DEC-047 — Phase 6 meeting-point **photo is deferred** (rides the DEC-038 R2 block); everything else ships
- **Date**: 2026-06-23 (build, Phase 6 G6.1)
- **Status**: APPROVED (executor decision; the brain already decides this — see Why)
- **Context**: The orchestrator §13 Phase 6 + DEC-014 describe a meeting point as "exact point + **R2 photo** + note +
  expiry + visibility". But **DEC-038 Q1 is APPROVED and explicit: "NO R2 for V1 … R2 not enabled on the account
  (`code 10042`); avoids card-on-file"** — and the map raster already shipped statically for exactly this reason
  (DEC-040). A meeting-point photo *requires* runtime blob upload, which has no home without R2 (D1 blobs are the wrong
  tool — value-size limits, fan-out bloat, query cost).
- **Decision**: Gate 6.1 ships the **full meeting-point core without the photo**: exact opt-in point (the device's exact
  GPS or a dragged/quick-picked map spot), **name**, **when** (now / after-this-set / in-30-min / custom), **who**
  (whole squad / selected — V1 ships whole-squad, "selected" reuses the same `visibility` column later), **note**, and
  **expiry** (10/20/30/60 min). The `meeting_point.photo_url` column **stays in the schema, unused** (it's already
  there from `0001_init`). The **photo is a named Phase-6.5 / R2-multi-festival deliverable**, deferred by the *same*
  decision that defers the map deep-zoom + multi-festival R2 (DEC-038/040). The create UI omits the photo control in V1
  (no dead "Soon" affordance on a calm flow).
- **Why (brain-consistent, no council needed)**: this is **not an open question** — DEC-038 is an account-level **hard
  blocker** (R2 literally returns `10042`), not a preference, so the only consistent reading is "defer the one feature
  that needs R2", exactly as DEC-040 did for the map. The *intent* of DEC-014 (find your people in a crowd via an exact
  spot + a label like "between FREEDOM & CORE") is **fully met** by the point + note + auto landmark label; the photo is
  the enhancement, not the mechanism.
- **Conditions / flip**: when R2 is enabled (card-on-file or account upgrade), add a `[[r2_buckets]]` binding +
  `POST /api/groups/:id/meeting-points/:id/photo` (multipart → R2 key → `photo_url`) + a `GET` asset route, and surface
  the camera/upload control in B4.2 — no schema change needed. If Julio enables R2 mid-build, do it then.
- **Detail**: schema `meeting_point` already in `0001_init.sql`; `server/src/api/meetingPoints.ts` (+ routes); web
  meeting-point create screens (proto `26` #1/#2); orchestrator §13 Phase 6 G6.1; supersedes the "R2 photo" wording of
  Phase 6 P6.1 (intent preserved, photo deferred per DEC-038).

---

> **DEC-048 → DEC-055 — V1 review-remediation pass (2026-06-24).** Eight decisions opened by Julio's hands-on
> walkthrough of the live app, normalized into `documents/2026-06-24-v1-review-remediation-orchestrator.md` (§7).
> **Julio reviewed them on 2026-06-24 (inline "ok" on the orchestrator §7): DEC-048/049/050/052/054/055 →
> APPROVED; DEC-051 → APPROVED with an added "button to the festival map" requirement; DEC-053 → SUPERSEDED by
> DEC-059.** Each notes what it refines/supersedes. The remediation orchestrator is the execution doc that
> implements them.

### DEC-048 — The "festival day" is a derived contiguous block, not the source `day` field nor the civil date
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24, inline "ok" on the orchestrator §7)
- **Decision**: Day grouping is computed by a pure `assignFestivalDays(performances, gapHours = 3)` (new,
  `web/src/domain/festivalDay.ts`): sort by start, split into a new festival day only when there is a **real gap
  (≥ `gapHours` with no set on any stage)**; each block gets a stable `festivalDayId` + a label taken from the
  block's first set (festival tz). This `festivalDayId` is the **single source of truth** for day grouping across
  onboarding, timetable, My Plan and Now/Next. User-facing labels stay "Friday, Jul 24" etc.
- **Why**: the review found **post-midnight sets landing on the wrong calendar day** (a Friday-night 00:30 set
  shown under Saturday) because grouping used the source's `performance.day` / civil date. A festival night is a
  continuous block that crosses midnight; the block is the correct unit.
- **Refines**: the day handling in `server/src/lineup/normalize.ts` + `web/src/lib/festival.ts`
  (`daysForWeekends`) and `web/src/domain/timetable.ts`.
- **Detail**: review §7 → orchestrator §6 row 2 + gate R1.1.

### DEC-049 — Lineup is made discoverable without breaking DEC-032 (Timetable stays full-height)
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24, inline "ok" on the orchestrator §7)
- **Decision**: Keep DEC-032 (no tall top toggle stealing Timetable grid height). Add a **compact, explicit**
  Timetable⇄Lineup switch (a single minimal-height labeled control, not a tall segmented bar) **and open Lineup
  by default when there is no timetable yet.** Clear empty states for "no lineup yet" and "timetable not released".
- **Why**: the review found Lineup "too hidden" (behind one header icon) and that festivals often publish a
  **lineup before a timetable** — the app must be useful in that phase.
- **Refines**: DEC-032 (Lineup/Timetable nav) — keeps its height rule, adds discoverability + a default.
- **Detail**: review §6 → orchestrator §6 row 10 + gate R4.2; screens `15e` (Timetable), `22`/`LineupScreen`.

### DEC-050 — Map renders all stages/labels/pins as a crisp interactive vector overlay; base zoom is capped honestly
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24, inline "ok" on the orchestrator §7)
- **Decision**: Stage medallions + names (and all pins/markers) render as a **vector overlay** from
  `transform.stages` via `geoToSvg` — screen-stable scaling, **tappable → stage info sheet** — and are **never
  baked into the raster base**. Regenerate the base **without** baked labels (the `spikes/map-art` engine already
  keeps the overlay separate). Cap `MAX_SCALE` to the base's sharp range; evaluate a higher-res raster and/or the
  vector deep-zoom base as an upgrade.
- **Why**: the review found stage names **pixelating**, **looking baked-in**, and **not clickable** — a direct
  violation of the "live overlay is always a separate layer" non-negotiable.
- **Refines/enforces**: enforces DEC-030/DEC-034 (overlay separation, interactive map); refines DEC-040's raster
  trade-off (V1 keeps the raster *base* but de-bakes labels and adds the interactive vector layer the review needs).
- **Detail**: review §11 → orchestrator §6 rows 4–6 + gate R2.

### DEC-051 — Outside the festival bbox, the map shows an honest state, never a black screen
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24 with an added requirement — see Decision)
- **Decision**: Detect an out-of-venue GPS fix; show "You're outside the festival — precise location works inside
  the venue" while still letting the user pan/zoom the festival map. **Julio's requirement: always render a button
  that takes the user to the festival (event) map**, so the screen is *never just black*. **Optional/better** (do
  if not too complex): a real OSM basemap behind a translucent venue overlay.
- **Why**: the review found that using precise location **outside** the venue produced a black screen (the fix
  lands off-canvas with unbounded pan + mock presence).
- **Relates**: complements the R2 pan-clamp + real-presence fixes; consistent with DEC-030 offline-first.
- **Detail**: review §11/§15 → orchestrator §6 row 7 + gate R2.3.

### DEC-052 — Festival data-state model: no-lineup / lineup-without-timetable / full-timetable, with dynamic updates
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24, inline "ok" on the orchestrator §7)
- **Decision**: The API surfaces `hasLineup` / `hasTimetable` (derived from `withTimetable` + performance
  presence); every screen **degrades gracefully** across the three states. Data may update over time (add days
  like **The Gathering**, add artists, add times) — ingestion is already idempotent; the client **re-prompts the
  user to revisit favorites** when new artists/days appear, keeps existing favorites/plans valid, and prompts an
  adjustment when a prior choice becomes invalid (never silently drops it).
- **Why**: the review requires the app to work before a lineup exists, with a lineup but no timetable, and after
  late data changes — the current client assumes a full, fixed timetable.
- **Detail**: review §2/§6/§20 → orchestrator §6 row 11 + gate R4.1/R4.3; also drives the artist-photo source (R1.3).

### DEC-053 — Profile/avatar photo is deferred (rides the DEC-038 R2 block); initials + color ship now
- **Date**: 2026-06-24 (review-remediation)
- **Status**: ⛔ SUPERSEDED by DEC-059 (2026-06-24 — Julio wants the photo to actually ship; a storage path was found)
- **Superseded-by**: **DEC-059** — avatar/profile photo ships via a storage adapter (default **R2 + budget alert +
  app-enforced quota**; no-card fallback **Cloudinary free**). The "initials-only until R2" deferral below no longer
  applies; initials + color remain only as the placeholder when no photo is set.
- **Decision (obsolete, kept for history)**: Squad profile/avatar stays **initials + chosen color** for V1 (already
  shipped). **Photo upload ships only when R2 (or an equivalent blob store) is enabled** — the same deferral and the
  same flip condition as the meeting-point photo (DEC-047). The custom-emoji request (a separate ask) **does** ship
  now (no blob needed).
- **Why**: the review asks for an avatar photo, but a photo needs a runtime blob home and **R2 is OUT for V1**
  (DEC-038, account `code 10042`). Honest default: don't ship a dead "add photo" control on a blocked feature.
- **Refines**: parallels DEC-047 (photo-deferred-by-R2); the *intent* (a recognizable avatar) is met by
  initials + color now.
- **Detail**: review §12.3 → orchestrator §6 row 16 + gate R9.3.

### DEC-054 — Joining a squad auto-shares the member's plan + favorites by default (one-time confirm + Settings opt-out)
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24, inline "ok" on the orchestrator §7)
- **Decision**: On **first join**, a one-time "Share your plan with the squad?" sheet that **defaults to ON**
  (shares plan + favorites), with a **Settings opt-out** — instead of the hidden, manual opt-in. The squad value
  (shared plan / build-the-group-plan) is therefore visible by default, not buried in an action.
- **Why**: the review's product view is that sharing "should happen naturally when you join"; the current
  opt-in (DEC-044) hides the core value.
- **Refines**: DEC-044 (squad plan sharing) — flips the default from manual opt-in to on-by-default-with-opt-out.
  Presence/exact-location sharing is **unchanged** (still explicit, coarse-only — DEC-046/047).
- **Detail**: review §13 → orchestrator §6 row 16 + gate R9.4; `ShareMyPlanScreen` + join flow.

### DEC-055 — Capture user-suggested festivals for admin review (no login required)
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24, inline "ok" on the orchestrator §7)
- **Decision**: A guarded `POST /api/festival-suggestions` + a D1 table (`name`, `suggested_by` nullable,
  `created_at_utc`, `count`, `status` ∈ new/reviewing/planned/added/rejected) with **dedupe-by-name count**, plus
  an admin list route; a **discreet** "Suggest a festival" affordance on the festival-pick onboarding step. No
  full login required.
- **Why**: the review wants users who don't find their festival to suggest one, and the operator to see
  suggestions + frequency.
- **Detail**: review §1 → orchestrator §6 row 19 + gate R4.4 (new migration; `OnboardingScreen` StepFestival).

---

> **DEC-056 → DEC-061 — 2026-06-24 review-remediation, round 2 (Julio's follow-up + 4 inline councils).** Added to the
> remediation orchestrator. All **PROPOSED**. DEC-058/059/060 carry an inline-council synthesis; DEC-061 is a verified
> technical fact; DEC-056/057 are scope/contract hardening.

### DEC-056 — Autonomy hardening: the implementer NEVER stops to ask permission to advance; ambiguity → council-on-the-spot
- **Date**: 2026-06-24 (review-remediation r2)
- **Status**: PROPOSED (review-remediation pass)
- **Context**: In the prior pass the agent ended a turn with an `AskQuestion` asking whether it could **proceed to the
  next milestone**. Julio works asynchronously (often asleep while the agent runs) — a mid-build "may I continue?"
  **stalls the entire pipeline for hours**. This is the single worst failure mode for this project's velocity model.
- **Decision**: The remediation orchestrator's autonomy contract is hardened: (1) **NEVER** pause, stop, or fire an
  `AskQuestion` to ask permission to **start/continue the next fix, milestone, gate, or phase** — chain straight into
  the next unit until the §12 Stop Criteria are all TRUE or context genuinely runs out. The terminal `AskQuestion`
  (per `always-end-with-askquestion`) is **only** allowed at the *real* hand-off (all work done, or a hard
  credential/cost blocker, or context exhausted) — never between units of work. (2) When a genuine ambiguity appears
  that the brain doesn't resolve, the agent **runs the inline council on the spot, takes the result, writes a
  `DEC-NNN` (PROPOSED), and continues** — it does **not** stop to ask Julio. (3) In doubt, the agent **reads the
  brain** (everything is answerable there, or there + a council) rather than guessing or stopping.
- **Why**: asynchronous operation is the whole point of the orchestrator + velocity standard; a blocking question
  defeats it. Council-on-the-spot preserves decision quality without a human round-trip.
- **Also reinforced (ops)**: `nvm use 22` before any wrangler/build; git **pager-safe** always (`--no-pager`, commit
  with `-m`/HEREDOC, never `-i`/interactive); Cloudflare **Pages deploy targets the production branch `master`** (not
  a preview) — see DEC-037.
- **Detail**: orchestrator §1 rules 2–3 + §9 + §12; supersedes the "pick + write DEC + continue" phrasing of the prior
  ambiguity rule with "council-on-the-spot + DEC + continue".

### DEC-057 — The Admin back-office is in V1 scope: build the screens + protected routes, plus new operator areas
- **Date**: 2026-06-24 (review-remediation r2)
- **Status**: PROPOSED (review-remediation pass)
- **Context**: Admin today = undocumented Worker endpoints behind `x-admin-token` (no UI). The design pass already
  produced a desktop admin wireframe (`brain/wireframes/directions/30-amber-admin.html`) with 6 screens: Festivals
  overview, Lineup & timetable dashboard, Map editor (drag pins → generate), Georeference/verify, POI editor,
  Travel-time matrix (DEC-034/039 Q-I). Julio wants the admin actually built, plus areas the wireframe doesn't cover.
- **Decision**: Build a real **admin back-office** (`admin.festpilot.app` or a guarded route group), protected by an
  **admin auth** (token now; proper admin login later), implementing the 6 wireframed screens **and** these new areas:
  (a) **Data-source registry per festival** — for each festival, record *where the data comes from* and how it's
  captured (resolve event+uuid from the official page → CDN JSON, per DEC-009), with a manual-add/edit path for
  festivals without a clean source; future: AI-assisted lineup/timetable reading to pre-fill on create/edit.
  (b) **Festival suggestions inbox** (DEC-055) — list + frequency + status. (c) **Usage metrics** — who's using the
  app (name + optional email + country + last-seen, from DEC-060), plus app-usage metrics. (d) **Quota / cost runway**
  — how many requests/ops consumed vs the free-tier ceiling per service (Workers, D1, DO, R2…), and an **estimated
  runway** ("at the current rate, service X hits the free limit in ~N days") using current averages. (e) **Live test
  command console** (see DEC-057-note below).
- **Live test console (council 4 synthesis)**: an operator panel to **inject synthetic test users at chosen map
  positions in real time** (drag a pin → the test user's coarse/exact presence updates → Julio's client, in the same
  test group, sees it live), reusing `POST /api/presence` + the `GroupRoom` DO fan-out. Guard-rails: gated by
  `x-admin-token`; **operates only on users flagged `is_test=1`, never real users**; scoped to a test festival/group;
  test entities visually marked; a **purge-test-data** action. This is also the sanctioned way to populate the map for
  testing — satisfying "no mock-as-real" (real data, OR clearly-flagged admin-injected test data, OR honest empty).
- **Why**: onboarding new festivals, observing real usage, staying inside free tiers, and live-testing every feature
  are all operator-critical and currently impossible without a UI. The map editor is already designed; the rest reuses
  existing endpoints.
- **Detail**: wireframe `30-amber-admin.html`; orchestrator new gate **R11 (Admin)**; metrics/quotas need light D1
  tables + Cloudflare Observability (GraphQL Analytics) reads.

### DEC-058 — Presence guard-rail revised: coarse by default, exact coordinates allowed where a feature truly needs them
- **Date**: 2026-06-24 (review-remediation r2, inline `/assess` council)
- **Status**: PROPOSED (review-remediation pass; refines DEC-046/047, does not revoke them)
- **Council synthesis**: coarse stays the **default** and the group feed **never carries `lat/lng`**; but exact
  coordinates **may** be used for features that genuinely need them (precise "come to me", point-to-point nav, true
  distance to stage/POI), **always via an explicit, time-boxed (TTL) share** over the existing exact channel — never a
  silent broadening of the coarse feed, and **never continuous background tracking**. **No feature is dropped merely to
  stay coarse.** Weightiest lens = Architect (reuse the one explicit+expiring exact channel; the invariant that matters
  is "coarse DTOs carry no raw coords", not "coords forbidden").
- **Decision**: replace the absolute "exact coords leave a device ONLY via meeting point/safety" with: **"coarse by
  default; exact coordinates are permitted for features that require them, always via explicit + expiring sharing; the
  coarse feed never carries raw coords; no continuous background location; and we don't block a feature just to remain
  coarse."** Keep honest consent copy; keep server-side hard-expiry.
- **Flip**: revert to strict coarse-only if an app-store/GDPR requirement demands it.
- **Detail**: orchestrator §3 non-negotiable (presence) + §6 map rows; refines DEC-007/008/014/015/046/047.

### DEC-059 — Avatar/profile photo storage: R2 (CONFIRMED — card on file); budget alert + app-enforced quota; Cloudinary no-card fallback retired
- **Date**: 2026-06-24 (review-remediation r2, inline `/council`)
- **Status**: PROPOSED → **R2 CONFIRMED 2026-06-24 (Julio added a card on file)**; supersedes DEC-053
- **Council synthesis**: avatars are few and tiny (~50–150 KB after client compression; ~10k users ≈ 1 GB → **$0** on
  R2's permanent free tier, egress always free). The real risk Julio fears ("conta gigante") is a tail risk, since
  **Cloudflare has no hard spend cap** (only budget alerts). The effective limiter is therefore an **app-enforced
  quota**, not the provider. Weightiest lens = Cost + Architect (R2 is the native Cloudflare fit; adding a vendor trades
  a tiny tail risk for permanent architectural debt).
- **Decision**: **Default** — enable **R2** (Julio adds a card) + a **budget alert (~$1)** + an **app-enforced hard
  quota**: client-side compress to ~150 KB, **one avatar per user**, a global object-count ceiling, and the Worker
  **rejects writes above a configured budget**. This delivers the "limiter" Julio wants while staying native
  (egress-free, Worker binding). **Fallback (if Julio refuses any card)** — **Cloudinary free** (no card, natural hard
  cap, built-in resize) behind a thin storage adapter, swappable to R2 later. Either way, the meeting-point photo
  (DEC-047) unblocks via the same store.
- **Why**: makes the avatar (and meeting-point) photo real without a meaningful bill, honoring both "make it work" and
  "cap the risk". The adapter keeps the provider swappable.
- **Detail**: supersedes DEC-053; relates DEC-038/047; orchestrator gate R9.3 + the storage-adapter note.
- **Update (2026-06-24, card added)**: Julio enabled R2 with a **card on file** → **R2 is the confirmed live path**;
  the **Cloudinary "no-card" fallback is retired** (the storage adapter keeps the provider swappable). Provision:
  `wrangler r2 bucket create festpilot-media` + Worker binding `MEDIA` (`[[r2_buckets]]`); the account-scoped operator
  token `festival-disk-05e9` is for the CLI/deploy step only, **never** stored in code. The orchestrator was updated to
  match (§4 baseline, §7 DEC-053/DEC-059, gates R9.3 avatar + R9.5 meeting photo, §11 problem table). Also unblocks the
  meeting-point photo (DEC-047) via the same store.

### DEC-060 — Lightweight identity at onboarding: ask name (required) + email (optional) up front; prefill on real sign-in
- **Date**: 2026-06-24 (review-remediation r2, inline `/council`)
- **Status**: PROPOSED (review-remediation pass; refines DEC-024/041)
- **Council synthesis**: name is light and has immediate product value (real name on squad cards/map); email is PII and
  must stay optional with honest microcopy; never collect a password here; country comes free from `CF-IPCountry`.
  Weightiest lens = User-Advocate.
- **Decision**: at first run, ask **name (required, light)** + **email (optional, with a clear value prop — "to save
  your plan & get alerts")**, stored locally + sent to the server for metrics (device id + name + optional email +
  country). **No password at this step.** When the user later creates a real (non-social) account, **prefill name +
  email and ask only for the password.** Email is one-tap skippable; minimal storage; covered by PRIVACY.md.
- **Flip**: if activation drops, make name optional too.
- **Detail**: refines DEC-024 (anonymous-first) + DEC-041 (local-first); orchestrator gate R5 (onboarding) + R10
  (settings/auth prefill) + the metrics tie-in feeds DEC-057(c).

### DEC-061 — Artist photos are already in the CDN performances JSON (`artists[].image`); re-ingest + render — the ⏳ is resolved
- **Date**: 2026-06-24 (review-remediation r2, verified from the live HAR)
- **Status**: PROPOSED (review-remediation pass; resolves the ⏳ in DEC-052 / orchestrator R1.3)
- **Finding (VERIFIED 2026-06-24)**: the live CDN performances JSON
  (`artist-lineup-cdn.tomorrowland.com/TL26BE-W{1,2}-{uuid}.json`) **already carries the artist photo** inline:
  `{"id":"1536127184","name":"BassBrain","image":"https://artist-lineup-cdn.tomorrowland.com/233262902-Presspic Bassbrain - 4.jpg"}`.
  Artists without a photo simply omit `image` (e.g. "Leenders", "More to be announced"). The local spike fixtures are
  **stale** (captured before the field existed). Our pipeline already maps `a.image` (`normalize.ts` → `store.ts`
  `image_url` → `repo.ts` `imageUrl`).
- **Decision**: the photo source is **not** a separate endpoint — it's the existing performances JSON. The fix is to
  **re-ingest** (live data now carries `image`) and **render `imageUrl`** everywhere with the CDN resizer
  (`?width=` — e.g. 160/320/520 by surface); URL-encode the path (it contains spaces). Update a test fixture to include
  an artist with `image`. No new scraper, consistent with DEC-009.
- **Detail**: supersedes the "resolve a separate photo source" half of DEC-052; orchestrator §6 row 1 + gate R1.3 + R5.4.
