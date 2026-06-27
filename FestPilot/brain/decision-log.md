# FestPilot — Decision Log

> Last updated: 2026-06-25 (**DEC-066** — unified-shell design pass: bottom-floating Timetable⇆Lineup switch + parallel header skeleton, Lock-in icon `playlist_add_check`, fixed-controls/scrolling-days top behavior; see `brain/wireframes/unified-shell-v2/`. Earlier: Initial set DEC-001→DEC-020 from the product-definition session; **2026-06-23 discovery-council session** advanced DEC-003/004/013/015 to APPROVED and added DEC-021/DEC-022 — see `documents/2026-06-23-discovery-councils-and-decisions.md`; the **/phases session** added DEC-023 (V1 cut line) and the **/council** added DEC-024 (auth) — see `implementation-phases.md`; the **2026-06-23 UI prototype-review** added DEC-025→DEC-029 (visual identity + Timetable/Onboarding/Lock in specs) — see `documents/2026-06-23-ui-decisions-locked.md` — and **DEC-030** (map rendering), **DEC-031** (map asset pipeline: OSM + AI art, not satellite tracing), **DEC-032** (Lineup/Timetable nav), and **DEC-033** (map *beauty* pipeline: stylized cartography + LiDAR relief now, AI-paint & 3D as upgrades), and **DEC-034** (map *generator* productized into a one-call engine + admin map-editor workflow) — see `documents/2026-06-23-realtime-map-technical-plan.md` §8/§10/§11; and **DEC-035** (V1 path-to-launch decisions: PWA→Capacitor, all-6 phases, WebSocket presence, auth providers, TML-only) — see `documents/2026-06-23-path-to-launch.md`; and **DEC-036** (adopt the V1 implementation orchestrator as the execution source of truth + git on `master`) — see `documents/2026-06-23-v1-implementation-orchestrator.md`; and **DEC-037** (V1 runs entirely on free tiers — Durable Objects are free on the Workers Free plan, direct Pages upload, token-based deploy); **DEC-038** (operator intake — no R2, both weekends, Firebase deferred, PWA-only, squad cap 50); **DEC-039** (design-pass answers + Android-only native, no Apple/iOS); **DEC-040** (V1 map = pre-rendered raster base + live overlay, drop the 20 MB inline-relief SVG); the **2026-06-23 build** added **DEC-041→DEC-047** (Phases 3–6 executor decisions); and the **2026-06-24 review-remediation pass** added **DEC-048→DEC-055** (Julio reviewed 2026-06-24: DEC-048/049/050/051/052/054/055 APPROVED, DEC-053 SUPERSEDED by DEC-059; see `documents/2026-06-24-v1-review-remediation-orchestrator.md` §7), and its **round-2 follow-up + 4 inline councils** added **DEC-056→DEC-061** (autonomy hardening, admin back-office, presence guard-rail revision, avatar storage, onboarding identity, artist-photo source). APPROVED = decided direction. PROPOSED/PENDING = not yet confirmed. The **2026-06-26 native-polish roadmap** shipped DEC-073/074 (personal plan blocks + per-transition travel choice) — back-filled here on 2026-06-27. The **2026-06-27 "Review & Polish" leva** (Julio's usage review → `documents/2026-06-27-review-polish-orchestrator.md`) added **DEC-075→DEC-088 (PROPOSED)** across map quality, i18n, stuck sheets, walk UX, share poster, plan editing, timetable/lineup polish, system bars and squad parity. Next new id = DEC-089.)

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
- **Refined**: DEC-049 (discoverable Timetable⇆Lineup switch) and **DEC-066** (the switch becomes a **bottom-floating** control in the same position on both views + a mirrored header skeleton — honoring this height rule even more strongly while removing cross-screen friction).

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
- **Status**: APPROVED → **flip condition MET; photo SHIPPED 2026-06-24 in R9.5** (R2 enabled per DEC-059). The deferral
  below is history; the meeting-point photo is now live via the shared R2 media adapter (`POST /api/media/meeting/:id/photo`,
  creator-only, app-quota-checked) + `MeetingPointDto.photoUrl`, surfaced on the meeting detail + squad-home card.
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
- **Status**: APPROVED (Julio 2026-06-24) · **IMPLEMENTED 2026-06-24 (R1.1 blocks `24142e7`; dynamic days R4.3 `8663aeb`)**
- **Implementation note (R1.1)**: the block's stable `festivalDayId` is the **plurality of the block's source
  `day` labels** (not the first set's label) so it stays equal to the persisted day key — `planKey` =
  `${festivalId}:${dayKey}` and onboarding `dayKeys` therefore survive the regrouping untouched (favorites are
  festival-scoped, unaffected). Display labels come from the block's first-set start time in festival tz. This was
  necessary because live W1 carries 2 mis-tagged strays (an artist tagged FRIDAY playing Sat 15:30; another
  FRIDAY playing Sun 12:00) — the gap-split re-homes them by time and plurality outvotes the bad label. Routed
  `daysForWeekends`, `buildTimetable` (block membership) and onboarding act day-grouping through it; Now & Next
  is unchanged (per-day slots keyed by the same stable id).
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
- **Status**: APPROVED (Julio confirmed 2026-06-24) · **IMPLEMENTED 2026-06-24 (R4.2, commit `86246d4`)** — `ViewSwitch` Timetable⇆Lineup segmented control on both screens; Timetable redirects to Lineup when no timetable; honest empty/lineup-only states.
- **Decision**: Keep DEC-032 (no tall top toggle stealing Timetable grid height). Add a **compact, explicit**
  Timetable⇄Lineup switch (a single minimal-height labeled control, not a tall segmented bar) **and open Lineup
  by default when there is no timetable yet.** Clear empty states for "no lineup yet" and "timetable not released".
- **Why**: the review found Lineup "too hidden" (behind one header icon) and that festivals often publish a
  **lineup before a timetable** — the app must be useful in that phase.
- **Refines**: DEC-032 (Lineup/Timetable nav) — keeps its height rule, adds discoverability + a default.
- **Detail**: review §6 → orchestrator §6 row 10 + gate R4.2; screens `15e` (Timetable), `22`/`LineupScreen`.

### DEC-050 — Map renders all stages/labels/pins as a crisp interactive vector overlay; base zoom is capped honestly
- **Date**: 2026-06-24 (review-remediation)
- **Status**: APPROVED (Julio confirmed 2026-06-24, inline "ok" on the orchestrator §7) · **IMPLEMENTED 2026-06-24 (R2.2, commit `9e983de`)**
- **Implementation note (R2.2)**: added a `stageMarkers` toggle through the `spikes/map-art` engine
  (`draw.ts`→`generate.ts`→`run.ts` `NO_STAGE_MARKERS`), regenerated De Schorre **offline** into a **label-free**
  base (re-rasterized to WebP; verified zero baked `stage-label` text). `MapView` draws stages from
  `transform.stages` via `geoToSvg`: per-stage medallion + star + **screen-stable** label
  (`pinScale = min(1/scale, 1.6)`), a live-dot when a set is on, and **tap → a stage info sheet** (now-playing +
  next from pure `domain/stageProgramme.ts` over `useLineup`). `MAX_SCALE` stays 12 but markers no longer pixelate
  because they're vector; the higher-res/vector deep-zoom base remains a future upgrade.
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
- **Status**: APPROVED (Julio confirmed 2026-06-24 with an added requirement — see Decision) · **IMPLEMENTED 2026-06-24 (R2.3, commit `d941ad5`)**
- **Implementation note (R2.3)**: pure `map/presencePins.ts#isOutsideVenue(bbox, …, 150 m margin)` decides
  out-of-venue from a **display-only** device fix (`useDeviceLocation`, permission-gated, never prompts on map
  open, never POSTs). Outside → an honest banner **+ a "Show festival map" button** (recenters; the R2.1 pan-clamp
  already removes the black void) and the off-canvas me-dot is dropped. Same gate replaced the **mock** map
  presence with the real coarse roster (`useMyGroups`→`useGroupPresence`), placed as stage-anchored pins that
  carry **only screen x/y, never lng/lat** (DEC-058) — honest empty states when there's no squad. The optional OSM
  basemap was **not** done (kept simple per the decision's "ok if too complicated"); the button requirement is met.
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
- **Status**: APPROVED (Julio confirmed 2026-06-24) · **IMPLEMENTED 2026-06-24 (R4.1 backend `18b5cb9` + R4.3 dynamic `8663aeb`)** — `festival.with_timetable` persisted through ingest; `getLineup` exposes `hasLineup`/`hasTimetable` over the whole festival; client `domain/dataState.ts` maps the 3 states; lineup-change banner re-prompts favorites.
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
- **Status**: APPROVED (Julio confirmed 2026-06-24) · **IMPLEMENTED 2026-06-24 (R4.4, commit `10f55a6`)** — onboarding "Suggest a festival" → public POST `/api/festival-suggestions` (deduped + counted, migration 0009); guarded admin inbox `GET /admin/festival-suggestions` ranked by demand (R11.3 UI later).
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
- **Status**: PROPOSED → **R2 CONFIRMED 2026-06-24 (Julio added a card on file)** → **SHIPPED 2026-06-24** (R9.3 avatar +
  R9.5 meeting photo, one R2 media adapter + D1 `media_object` app-quota ledger); supersedes DEC-053
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
- **Status**: **IMPLEMENTED 2026-06-24 (R5.0, commit `a3dc4f2`; deployed v0.10.0, migration 0010)** — refines DEC-024/041
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
- **Status**: VERIFIED · **IMPLEMENTED 2026-06-24** — ingestion R1.3 (commit `7218378`); UI render on every surface via shared `<ArtistPhoto>` (CDN `?width=`, placeholder) R5.4 (commit `09ad8d4`, deployed v0.10.0). Resolves the ⏳ in DEC-052
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

### DEC-062 — Defer the admin Map editor / georeference / POI / travel-matrix (R11.1c) to V1.1; ship the rest of R11 now
- **Date**: 2026-06-24 (review-remediation R11, inline quick `/council` — Architect + Critic)
- **Status**: **SUPERSEDED by DEC-063 (2026-06-24)** — the documented flip condition fired (a browser-capable verification path now exists: Playwright headless + screenshots) and Julio directed building R11.1c in full. Originally **PROPOSED** — refined DEC-057; pre-sanctioned by the orchestrator (R11.1c "heaviest; defer w/ dev-log note if needed") + §12 ("not-yet-pulled parts noted in dev-log")
- **Council synthesis**: the `festival_map` publish pipeline already exists (local `generateMap` + `POST /admin/festivals/:id/map`, DEC-034/040), so onboarding maps is **not blocked**; the four screens are heavily visual drag/affine UIs that **can't be visually verified** in this WSL/no-browser environment, so building them blind is high-risk for low confidence; the operationally critical back-office (auth, festivals, lineup, data-source, suggestions, metrics+runway, test console) is shipped and verifiable. Weightiest lens = **Architect** (reuse the existing pipeline; don't ship an unverifiable surface), guarded by **Critic** (no dead nav affordance for unbuilt screens).
- **Decision**: ship **R11** with **R11.0 / R11.1a / R11.1b / R11.2 / R11.3 / R11.4 / R11.5**; **defer R11.1c** (map editor, georeference/verify, POI editor, travel-time matrix) to a **V1.1 admin enhancement**. **No dead affordances** are added (no nav entries for the unbuilt screens). Maps continue to be published via the existing local pipeline.
- **Flip**: pull R11.1c forward as soon as a browser-capable verification path exists, or if onboarding a map-less festival becomes a real blocker (minority-wins scenario).
- **Detail**: refines DEC-057; orchestrator §10 R11.1c + §12 stop-criteria allowance + §11 "credential/verification you don't have → mark ⏳, keep building".

### DEC-063 — Build the full admin festival management + map/POI/travel editor (R11.1c) now; onboarding reuses the parametric ingest; verify via Playwright headless screenshots
- **Date**: 2026-06-24 (review-remediation R11→R12; Julio's explicit directive; inline `/council` — Architect + Critic + Advocate)
- **Status**: **ACCEPTED + IMPLEMENTED** (2026-06-24, v0.14.0, commits 260ebf7 + e7a41c0; verified live on `festpilot.pages.dev` via headless Playwright) — supersedes DEC-062; refines DEC-057 + DEC-034/040 + DEC-059
- **Trigger**: Julio — "fazer a tela de admin completa e bem funcional, hoje ainda não dá para adicionar e gerenciar festivais novos" + "usar o Playwright para verificar, ou algum MCP / o próprio Cursor". DEC-062's flip condition ("as soon as a browser-capable verification path exists") is now TRUE: Playwright runs headless in this env (e2e 30/30) and produces screenshots the agent can read; the `plugin-browse-browser` daemon won't start in WSL, so **Playwright is the verification path**.
- **Findings that de-risk it** (verified by reading the code 2026-06-24): the D1 schema is **already multi-festival** and **already has every geo table** — `stage_location` (lat/lng/radius_meters/color/source/verified), `poi` (type/name/lat/lng/source/verified), `stage_travel_time` (from/to/minutes_typical/minutes_crowded/source), `festival_map` (asset keys + 6-coeff affine `transform_json`), `imported_map_feature`, `stage_alias`; they simply have **no admin UI**. The ingestion `ingest()` is **already parametric per festival** (`festival: {name,slug,timezone}` + `pageUrl`, calls `store.ensureFestival` + `store.upsertSource`); only the thin `runScheduledIngest` wrapper is hard-bound to the single env-var festival.
- **Decision**:
  1. **Onboarding architecture** — add a festival by its **official page URL** (+ optional `event`/`uuid` override): persist a per-festival source record, then run the **existing** `ingest()` against that page. Reuses the whole resolve→fetch→normalize→diff→upsert pipeline; **no new scraper, no hardcoded lineup** (consistent with DEC-009/061). The scheduled cron **iterates all registered festivals** (each source page), with the env-var festival as the seed/default.
  2. **R11.1c editor** — Map editor (base raster on **R2** via the DEC-059 adapter + the 6-coeff affine), Georeference/verify (≥3 control points → least-squares affine solve), POI editor, Travel-time matrix — all writing the **existing** geo tables; reachable per-festival from the Festivals overview. **No dead affordances** (a nav/action appears only once wired).
  3. **Verification** — Playwright headless drives the built `dist` preview (admin API stubbed for UI specs; live worker for the create-festival integration smoke), capturing screenshots the agent reads; backend logic covered by vitest against the D1 shim.
- **Council synthesis**: **Architect** — reuse the parametric ingest + the existing geo tables; the only genuinely new surface is per-festival source registration, the affine solve, and the editor UI. **Critic** — the Tomorrowland resolver/CDN is platform-specific, so V1 "add festival" means **same-platform** events (other Tomorrowland editions, or a manually supplied event/uuid); guard with an honest "couldn't resolve a lineup from that page" error and never fabricate. **Advocate** — the headline win is that the operator can onboard + manage a festival end-to-end and see it; keep it one-screen-simple. Weightiest lens = **Architect** (maximal reuse), bounded by **Critic** (honest same-platform scope + resolve-failure UX).
- **Flip**: a target festival not on a resolvable lineup platform needs a new fetch adapter (out of V1 scope) — onboarding then surfaces an honest failure rather than inventing data.
- **Detail**: supersedes DEC-062; orchestrator §10 R11.1 (screens 1–6: overview+add festival, lineup dashboard, map editor, georeference/verify, POI editor, travel-time matrix) + DEC-034 (one-call map engine + admin editor workflow) + DEC-040 (map asset registry) + DEC-059 (R2 for base rasters).

### DEC-064 — R11.1c map editor builds what the app actually consumes (base + affine + stage coords); map ART stays the local Node spike; POI + travel-matrix editors deferred (no client consumer)
- **Date**: 2026-06-24 (review-remediation R11.1c; inline `/council` — Architect + Critic, after reading the live map data flow)
- **Status**: **ACCEPTED + IMPLEMENTED** (2026-06-24, v0.14.0, commit e7a41c0) — refines DEC-063 + DEC-034/040
- **Findings (verified by reading the code 2026-06-24)**:
  1. The client map is driven **entirely by the `festival_map.transform_json` doc** (`MapTransformDoc`: `canvas{w,h}`, `bbox`, `affine{a..f}`, **`stages[{name,lng,lat,matched}]`**, `source`) + the two base WebP keys. Stage pins are `geoToSvg(affine, lng, lat)` over the base raster (`web/src/map/transform.ts`, `MapView`, `getFestivalMap`/`upsertFestivalMap`).
  2. The schema tables **`stage_location`, `poi`, `stage_travel_time`, `imported_map_feature`, `stage_alias` are NOT read or written by ANY server/client code** — they are vestigial/planned. Stage coords live in the transform doc, not `stage_location`; walking time is computed live from coords (`metersBetween`/`route.ts`), not `stage_travel_time`.
  3. The map **art generator** (`spikes/map-art`: resvg + node-canvas + OSM/LiDAR) is **Node-only** and cannot run in a Cloudflare Worker (DEC-034 §11.7 already says so). The proven least-squares solver `fitAffine` lives there.
- **Decision**:
  1. **Build the in-product map editor** = base image (night/day) on **R2** (upload via the DEC-059 adapter, or a pasted URL) + **georeference** (≥3 control points → port `fitAffine`/`residual` into `web/src/map/transform.ts` → 6-coeff affine + residual quality) + **stage coordinate placement** (numeric lng/lat or click-the-map via `svgToGeo`), with a **live preview** using the exact runtime `geoToSvg`. Save through the existing `POST /admin/festivals/:id/map`. This is the only map data the app consumes, so it is the high-value, verifiable deliverable; reachable per-festival from the Festivals overview (a contextual "Map" action — no global dead nav).
  2. **Map ART generation stays the local Node spike** (`spikes/map-art/admin`); the in-product editor georeferences/places over a *provided* base raster. A Worker cannot render the cartography.
  3. **Defer the POI editor + travel-time matrix** to V1.1: their tables have **no client consumer** today, so an editor for them would be a dead surface (violates "no feature without a consumer"). They return when the user map gains a POI layer + the router reads stored travel times (the `29-amber-map-poi-routing` wireframe scope).
- **Council synthesis**: Architect — port the proven affine solver + reuse the transform-doc contract + the existing save endpoint; minimal new surface (an R2 upload route + the editor UI). Critic — building POI/travel editors now ships an admin surface whose output nothing displays; that is exactly the "no dead affordance / no mock-as-real" invariant in reverse — defer until there is a consumer. Map-asset R2 bytes are not folded into the user-media runway ledger (it is labelled "avatars + meeting photos"); map bases are few/small vs the 10 GB tier — acceptable, noted. Weightiest lens = Critic on scope (don't build unconsumed surfaces), Architect on the build (maximal reuse).
- **Flip**: when V1.1 adds the user-facing POI map layer + travel-aware routing, build those two editors and wire `poi`/`stage_travel_time` end-to-end.

### DEC-065 — Build the POI editor + travel-time matrix NOW, with their client consumers, reversing DEC-064's deferral (Julio's directive)
- **Date**: 2026-06-24 (review-remediation R11.1c; Julio's explicit directive: "construir a parte do admin e também construir a parte do cliente")
- **Status**: **ACCEPTED** — reverses DEC-064 §3 (the deferral); the DEC-064 flip condition is satisfied by building the consumers in the same slice
- **Context**: DEC-064 deferred the POI + travel-matrix editors *only* because nothing consumed their tables (the "no dead affordance" invariant). Julio directed building **both the admin editors AND the client consumers** in one slice, which removes that objection: the surfaces are no longer dead.
- **Decision**:
  1. **POI** — `poi` table (type/name/lng/lat/source/verified) gets `listPois` + `replacePois` repos; **public** `GET /api/festivals/:id/pois` + **admin** `GET`/`PUT /admin/festivals/:id/pois`. **Consumer**: a **POI layer on `MapView`** — markers per type (toilet/water/food/medical/exit/atm/charging/locker/entrance/landmark) placed through the affine `MapView` already holds (`geoToSvg`), with a legend/filter toggle + a tap label. **Editor**: a POI panel inside `AdminMapEditorScreen` (reuses the canvas + affine; place-by-click via `svgToGeo` or numeric), its own "Save POIs".
  2. **Travel-time** — `stage_travel_time` (from/to/minutes_typical/minutes_crowded) gets `listTravelTimes` + `replaceTravelTimes` repos; **public** `GET /api/festivals/:id/travel-times` + **admin** `GET`/`PUT /admin/festivals/:id/travel-times`. **Consumer**: `useTravelMatrix` fetches the stored times and **prefers them over the coord estimate** via a new `TravelMatrixOptions.overrides` (keyed `from|to`, symmetric-expanded) — so My Plan, Now&Next, Lock-in and Route all use operator-curated minutes when present, falling back to the live `metersBetween` estimate otherwise. **Editor**: a new `AdminTravelMatrixScreen` (a stage×stage grid **auto-seeded** from the published coords so the operator edits real numbers, not blanks), reachable via a per-festival "Travel" action.
  3. **Replace-set semantics** for both editors (delete-all + insert within a festival) — mirrors the map editor's save-the-whole-doc simplicity; idempotent.
- **Known limitation (tracked, not in this slice)**: `MapView` still loads its base raster + transform from the **static `/maps/{slug}-*` files**, while the editor writes the **D1 `festival_map`**. POIs render correctly on the **seed** festival (its static affine ≈ the D1 affine, same venue/base). A **newly-onboarded** festival's map art won't display in-app until `MapView` is migrated to read base+transform from `GET /api/festivals/:id/map` (the orchestrator's planned "app reads from the API, not /public/maps"). That migration is a separate follow-up; POI coords are fetched by the real festival ULID (from `useLineup`), so they're ready for it.
- **Tests**: domain `buildTravelMatrix` override precedence + symmetric fallback; server `poiRepo`/`travelTimeRepo` round-trips (list/replace, festival isolation) on the D1 shim; admin route validation. Browser-verify both editors + the POI map layer via headless Playwright.

### DEC-066 — Unified shell: bottom-floating Timetable⇆Lineup switch + parallel header skeleton; Lock in icon = `playlist_add_check`; top behavior = fixed controls / scrolling days
- **Date**: 2026-06-25 (design pass with Julio; inline councils — unified-shell strategy + Lock-in icon)
- **Status**: **APPROVED + IMPLEMENTED & DEPLOYED (2026-06-26)** — (2) the Lock-in icon and (3) the day-selector-as-dropdown were **APPROVED** (Julio's explicit selections); (1) the unified-shell direction was **APPROVED in direction** ("Switch inferior") and the header layout **converged on V9**. All `design-sync.md` gates — **ICON / TT / LU / DAY / SH** (+ the pre-existing TT/LU skin) — are now applied to the live app on **Cloudflare Pages (`festpilot.pages.dev`, v0.16.0)**, verified via mobile (390×844) headless screenshots against **N6 / L5 / V8 / V9**; web **285** unit tests + `tsc` + `vite build` green. **Final pixel sign-off by Julio pending** (the only remaining step).
- **Decision**:
  1. **Unified shell ("one screen, two views")** — Timetable and Lineup must read as a **single screen** whose surrounding elements swap, not as two different screens. Achieved by: (a) a **Timetable⇆Lineup switch that floats at the bottom in the SAME position on both views** (it leaves the header entirely, so it never moves and never costs Timetable grade); (b) a **parallel header skeleton** on both views — identical eyebrow (`TOMORROWLAND <VIEW>`), then a first bar in the pattern **"flexible primary slot + fixed controls cluster on the right"**. Switching only morphs content: **days ↔ search** in the primary slot, **time controls (zoom/grid/favorites/Lock in) ↔ Lineup controls (density) + filters**, and the body cross-fades **time-grid ↔ card grid**. This keeps DEC-032's intent (protect Timetable vertical grade) while removing the cross-screen friction DEC-049 flagged.
  2. **Lock in icon** — replace the padlock (`lock`) with **`playlist_add_check`** (Material Symbols). Rationale: the action turns favorites into a closed, conflict-free set (DEC-005/029); a padlock reads as "security/locked-out" and a ▶ play reads as "play audio" (media collision in a music app) — `playlist_add_check` maps the real function ("build/close my set") and survives even icon-only. The **label "Lock in" stays** (DEC-005, unchanged); the glyph is the only change.
  3. **Day selection = a dropdown (final), replacing the earlier scrolling-pills idea** — the day is a **compact dropdown trigger** in the header (e.g. `📅 Sáb 25 ▾`); tapping opens a panel listing **every day in full** ("Dia 1 · 24 de julho · Sexta", "Dia 2 · 25 de julho · Sábado", …), with an optional per-day **★ favorite count**. **No horizontal day scrolling** — many days simply scroll **vertically inside the dropdown**. Because the trigger is compact and fixed, the control cluster (zoom/grid/favorites/Lock in) always fits and **Lock in keeps its text label** (the icon-only collapse explored in V6 is no longer needed in normal cases). Julio: "no lugar das bolinhas com números que ficavam meio escondidas, faz um dropdown bonito mostrando o dia por extenso… aí escolhe sem ficar rodando de um pro outro." *(This supersedes the V6 fixed-controls/scrolling-days/day→number rule for day selection; the "controls never disappear" principle is preserved and now trivially satisfied.)*
- **Why**: Julio — the two screens "should be one; the button shouldn't be in different places." The bottom-fixed switch + mirrored header skeleton remove the visual disconnect; the fixed-controls/scrolling-days rule keeps every control reachable on any device while letting the variable-length day list flex.
- **Refines**: DEC-032 (Timetable full-height pillar) + DEC-049 (discoverable switch). The switch now lives at the bottom (not in the header), which honors DEC-032's "no header height stolen" rule even more strongly. DEC-005 (Lock in / My Plan naming) is untouched — only the icon changes.
- **Detail**: prototypes in `brain/wireframes/unified-shell-v2/` — `V1`–`V5` (top-organization explorations + council), `V6-days-scroll` (an earlier scrolling-days behavior, **superseded by the dropdown**), `V7-unified-twin` (the converged Timetable+Lineup parallel shell), `V8-day-dropdown` (**the final day selector — closed + open states**), **`V9-final-shell` (the CANONICAL interactive prototype — V7 twin + V8 dropdown in one: tap the day → dropdown, tap the bottom switch → Timetable↔Lineup)**, `lockin-icons` (icon comparator). Timetable card model from `brain/wireframes/timetable-design-v2/06-capsule-color-gradient` (N6); Lineup grid from `brain/wireframes/lineup-design/05-photo-immersive` (L5). Gallery: `unified-shell-v2/index.html`.
- **Application orchestrator**: `brain/design-sync.md` — the living delta-orchestrator that ports these wireframes to the real app, **only changing what changed**. This decision is encoded there as gates **ICON** (Lock-in glyph), **DAY** (`DayDropdown`), and **SH** (unified shell: bottom `ViewSwitch` dock + mirrored header), alongside the pre-existing **TT**/**LU** skin gates. The doc is built to grow (a "Como estender" template adds future gates).
- **Open / next**: ~~run the gates~~ **DONE** — ICON/TT/LU/DAY/SH shipped to prod (2026-06-26, v0.16.0), screenshots verified vs N6/L5/V8/V9 (see `dev-log.md` → "Lote de Skin 26/06"). Header converged on **V9** (eyebrow `{festival} <VIEW>` + bottom `ViewSwitch` dock); day-dropdown row = `Day N` · weekday · date · ★count · check. Remaining: **Julio's pixel sign-off on device**; two deliberate convergence choices to confirm — (a) Lineup density control kept on the first `.sec` (per LU-2), not in the header; (b) Lineup header "X favorites" badge removed to mirror the Timetable eyebrow (count still on the Favorites filter + My Plan).

### DEC-067 — Artist photos: race-proof `<ArtistPhoto>` + preload buffer + dedicated SW cache + offline favorites (kills the "wrong photo under the name")
- **Date**: 2026-06-25 (field batch 25/06, gate IMG in `brain/design-sync.md`)
- **Status**: **ACCEPTED + IMPLEMENTED** (code-level; **not yet deployed**) — verified by web unit tests + headless-Playwright golden path. Refines DEC-061 (photos already in the CDN JSON).
- **Trigger**: 25/06 field feedback — on slow links the photo sometimes "swapped" under the wrong name, and some artists showed no photo at all.
- **Decision**:
  1. **`<ArtistPhoto>` race-proof (IMG-1/6)** — reset the `loaded`/`failed` state whenever `src`/`name` change (keyed), so a late image can never paint under a newer name; add retry/backoff + a diagnostic path for the "zero photo" case. **Public API unchanged** (`{ src, name, width, className }`) and the initials fallback is preserved (hard invariant).
  2. **Preload buffer (IMG-2/3)** — a **pure** `photoBuffer.ts` queue (unit-tested) drives `usePhotoPrefetch` to keep ~5 photos ahead during onboarding swipe, so the next cards are warm.
  3. **Dedicated SW photo cache (IMG-4)** — `public/sw.js` gets a separate photo cache with an **LRU cap**; the network-first `/api` cache is untouched.
  4. **Offline favorites (IMG-5)** — `useKeepFavoritePhotos` (mounted in `AppLayout`) pins each favorite's photo, **exempt from the LRU**, so Lineup/My Plan/Now show favorites without hitting the network.
- **Detail**: gate IMG (IMG-1..6) in `design-sync.md`; no lineup/domain math changed.

### DEC-068 — Onboarding on Safari/iPhone: the artist name is always visible (height-driven card; CSS-only)
- **Date**: 2026-06-25 (field batch 25/06, gate OBV in `brain/design-sync.md`)
- **Status**: **ACCEPTED + IMPLEMENTED** (code-level; not yet deployed) — verified on a short iPhone/Safari viewport via headless Playwright (prior segment screenshots).
- **Trigger**: 25/06 field feedback — on short Safari/iPhone viewports the artist name was pushed off the swipe card.
- **Decision** (CSS + `OnboardingScreen.tsx` only): the swipe card **scales by available height, not width** (OBV-1); the swipe **header compacts on low viewports** (OBV-2); the swipe step is **`overflow: hidden`** so it never scrolls (the grid still scrolls) (OBV-3); the name is **clamped and guaranteed visible**, and the favorite toggle behaviour is **preserved** (OBV-4).
- **Detail**: gate OBV (OBV-1..4) in `design-sync.md`. No JS logic change beyond layout; swipe/grid/toggle semantics intact.

### DEC-069 — Artist Detail Sheet: tap any artist → where/when they play + social links (socials sourced from the CDN JSON)
- **Date**: 2026-06-25 (field batch 25/06, gate ART in `brain/design-sync.md` + the TML CDN HAR)
- **Status**: **ACCEPTED + IMPLEMENTED** (code-level; **not yet deployed** — the live worker DB has not been re-ingested, so `socials` is empty in prod until the next ingest). Verified by server + web unit tests and a headless-Playwright golden path (Afrojack opens with 2 slots across both weekends).
- **Finding**: the CDN performances JSON carries optional artist social links (`soundcloud`, `instagram`, `facebook`, `twitter`/x, `youtube`, `spotify`, `appleMusic`, `website`); it does **not** carry genre/biography/country (→ DEC-070).
- **Decision**:
  1. **Source → DTO pipeline (ART-1..3)** — `SourceArtist` gains the socials; `normalize` preserves them via a **pure `pickSocials`** (omits empty/undefined, data-driven over `ARTIST_SOCIAL_KEYS`); an **additive D1 migration `0014_artist_socials.sql`** (`socials TEXT`, default NULL — idempotent ingest) persists them as JSON; `ArtistDto.socials?` exposes them, parsed safely on read.
  2. **Web domain (ART-4)** — `ArtistSocials` mirrored client-side; `Act.socials` propagated by `uniqueActs` (same first-non-empty rule as `imageUrl`); a **pure `buildArtistDetail`** turns an `Act` into the sheet model — every performance = stage-colour dot + day/date + start–end in the festival tz, with a **weekend tag (W1/W2) only when the artist spans both weekends**.
  3. **UI (ART-5/6)** — an `ArtistSheet` bottom sheet (`role="dialog"`, focus management, Esc-to-close) shows the hero photo, name, present socials (inline SVG glyphs), and the slot list. It opens by tapping the **photo/name** from **Timetable, Lineup, Now & Next, and My Plan**, via a light `ArtistSheetProvider` mounted once in `AppLayout`. **Favoriting/editing is always a separate target** — opening the sheet can never favorite (Timetable/Lineup heart) or edit (My Plan `⋮` menu) by accident (hard invariant, verified).
- **Detail**: gate ART (ART-1..6) in `design-sync.md`; timetable/lineup math (`actKey`, `uniqueActs`, `imageByActKey`, windows) and the `<ArtistPhoto>` API are unchanged.

### DEC-070 — Artist genre / biography / history — PROPOSED / PENDING (out of V1; NOT implemented)
- **Date**: 2026-06-25 (field batch 25/06, gate ART-7 — decision only, no code)
- **Status**: **PROPOSED / PENDING** — explicitly **not built** this batch.
- **Finding**: the lineup CDN source exposes **no** `genre`, `biography`/`description` or `country` field; only name, photo and the socials of DEC-069. There is therefore no first-party data to render.
- **Decision**: keep genre/bio/history **out of V1**. Building it would require a **secondary enrichment source** (e.g. an external music API) — out of scope and unverified (per `fact-verification.mdc`, we will not fabricate artist bios). Revisit if/when a reliable enrichment source is chosen.
- **Detail**: ART-7 in `design-sync.md` is a decision marker, not a change set; the Artist Detail Sheet (DEC-069) is designed to absorb a bio block later without restructuring.

### DEC-073 — Personal plan blocks (on-device-only day activities) — APPROVED + IMPLEMENTED (back-filled)
- **Date**: 2026-06-26 (native-polish roadmap, Phase 6; back-filled into this log 2026-06-27)
- **Status**: **APPROVED + IMPLEMENTED** (shipped in v0.x of the native-polish wave; referenced across `domain/planEdit.ts`, `domain/types.ts`, `localStore.ts`, `MyPlanScreen.tsx`).
- **Decision**: the user can slot **personal activities** (eat / rest / water / meet / explore / custom) into a day's plan via a `BlockSheet` editor with steppers. Blocks are **on-device only** — `localStore` persists them next to the locked sets without touching the sets or the lock time. A **hard guardrail** (`slotToShareInput`, `api.ts`) strips blocks from any squad-share payload: the group plan is sets-only.
- **Rationale**: festival days have gaps (food, rest, meeting friends) the lineup can't model; users want them in the timeline without polluting the shared/group plan.
- **Detail**: blocks render in the My Plan timeline + can be promoted to the Now hero (`nowNext.ts`, `liveBlock`); the clash resolver and zero-overlap invariant are unchanged. See `documents/2026-06-26-native-polish-and-features-roadmap.md` (Phase 6).

### DEC-074 — Travel choice between consecutive sets (leave-early / arrive-late, per-transition) — APPROVED + IMPLEMENTED (back-filled)
- **Date**: 2026-06-26 (native-polish roadmap, Phase 6; back-filled 2026-06-27)
- **Status**: **APPROVED + IMPLEMENTED** (referenced across `domain/plan.ts`, `planEdit.ts`, `planSlot.ts`, `settings.ts`, `MyPlanScreen.tsx`).
- **Decision**: when the walking time between two consecutive sets would overlap them, the user resolves it per transition — **leave early** (shrink the end of the current set) or **arrive late** (`lateStartMs`, shrink the start of the next). Both **only shrink an effective interval**, so the plan stays **zero-overlap**. A global default (Q8 = leave early) is overridable per transition.
- **Rationale**: walking between stages is a real, recurring decision; the plan must reflect "you'll miss the last 10 min of X to reach Y in time" honestly, without ever creating an overlap.
- **Detail**: `effectiveStart`/`effectiveEnd` are pure (`planSlot.ts`, tested); `buildPlanTimeline` resolves travel chips. This wave (DEC-079) extends it with a **split** option + tap-to-adjust outside Edit. See roadmap Phase 6.

---

## Leva "Review & Polish" (2026-06-27) — DEC-075 → DEC-088 (PROPOSED)

> Authored by the implementation-orchestrator (`documents/2026-06-27-review-polish-orchestrator.md` §7). PROPOSED at G0;
> each promotes to APPROVED when the gate that ships it closes. Five came from inline councils (C1–C5); the rest are
> direct directives from Julio's 2026-06-27 usage review.

### DEC-075 — Map: crisp progressive high-fidelity base (kill zoom pixelation) — PROPOSED (council C1)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G3). Refines DEC-030/040/050 (map = raster base + separate vector overlay).
- **Decision**: the raster WebP base pixelates past ~MAX_SCALE; ship a **progressive high-fidelity base** — a light raster placeholder on first paint, then swap to a high-fidelity base when ready. Preference: a **vector SVG** base (the `spikes/map-art` generator already projects the geometry; emit SVG without labels) with a **measured fallback** to a 2–4× raster + an honest MAX_SCALE cap if SVG fails the mobile-performance budget. The **vector overlay (stages/people/pins) and the affine transform are untouched** — labels are never baked (ÂNCORA).
- **Rationale**: the map is "the main alert"; a pixelated base breaks trust. The overlay is already crisp, so the fix is the background asset + an honest zoom cap.
- **Alternatives**: full SVG now (risk: parse/paint jank on weak phones — hence the fallback); leave raster (rejected — the complaint).

### DEC-076 — Map: redesigned glass stage markers + legible labels — PROPOSED (council C1)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G2).
- **Decision**: replace the circle+star+black-text markers with clean icons + a **translucent glass label** (Amber-Glass), legible type (no pure black over the map), clear icon↔name hierarchy, and screen-stable scale (reuse `pinScale`). Stays a separate vector overlay (DEC-030/050).
- **Rationale**: current markers "look like they were made in another app"; glass labels match the app's aesthetic and stay readable at every zoom.

### DEC-077 — Map: cover-fit framing, never a black border — PROPOSED (direct + council C1)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G2). Refines `panClamp.fitScale`.
- **Decision**: default the map framing to **cover-fit** (fill the safe rect, crop edges with bleed) instead of *contain* (which letterboxes); any remaining letterbox is **tinted with the app colour**, never `#000`; the clamp guarantees the user never drags into a void; better initial zoom.
- **Rationale**: the big black border "looks like a badly fitted image". Cover-fit + tinted background removes it. Pure, unit-testable (`fitScale` cover).

### DEC-078 — Floating sheets/menus are portaled to body + position:fixed — APPROVED (direct)
- **Date**: 2026-06-27 · **Status**: **APPROVED** — shipped G1 (v0.32.0, deploy `f85f34e1`).
- **Decision**: the base `Sheet` renders its scrim + sheet via `createPortal(document.body)` and `.scrim`/`.sheet` use **`position: fixed`** (not `absolute`). This kills the whole class of "menu stuck to the scrolled page / transformed ancestor" (the `more_vert` plan menu, the share sheet, artist sheet, pickers). Drag-to-dismiss, Esc, focus-trap and scroll-lock are preserved.
- **Rationale**: `position: absolute` inside a transformed ancestor (`.world{will-change:transform}`, screen transitions) anchors to that ancestor, so the menu scrolls with the content. A portal + fixed positions to the viewport.

### DEC-079 — Walk: open the exact tapped transition, single source, tap-to-adjust + split — APPROVED partial (council C2)
- **Date**: 2026-06-27 · **Status**: **APPROVED (partial)** — G1 shipped (1) the exact-leg route via `from/to/at` + `chooseRouteStages` hardening (v0.32.0). The single-source notice (2), tap-to-adjust outside Edit + split (3) land in **G6**. Extends DEC-074.
- **Decision**: (1) the walk chip/gap navigates to `/route?from=&to=&at=` of the **exact tapped transition** (fixes "Mainstage → Mainstage"); `RouteScreen`'s default is hardened so `to ≠ from`. (2) **One source per transition**: the "Leave early for {n} min walk to {stage}" notice lives in the previous set's card; the gap shows only free time (kills the duplicate). (3) the travel chip is **tappable always** (not only in Edit) → opens the `TravelSheet` with **three** options — leave early / arrive late / **split** (`applySplitTravel`, pure) — labelled in minutes of music lost, reversible with a confirm toast.
- **Rationale**: walking decisions are common and made in the moment; they must be one tap, honest, and never duplicated or wrongly addressed.

### DEC-080 — Share poster v2: all sets, DJ photos, real clashes, story/square, final URL — PROPOSED (council C3)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G5). Subsumes D26 (final URL).
- **Decision**: rewrite `buildPosterRows` → **`buildPosterPages`** (pure): adaptive density that fits **all sets** down to a legibility floor, then **paginates** (multi-image) or 2-columns (square) instead of hiding the majority behind "+N". Draw **DJ photos** on the canvas (`Image()` + `crossOrigin`) with a **mandatory initials fallback** if the CDN blocks CORS (the photo must never break the export). Compute **real clashes** (not the hardcoded "0"). Story = full vertical list; Square = a **"Summary / Full plan"** toggle. Fix text wrapping/tracking, enlarge names, use the horizontal space. Use the **final public URL** (LOCK §16: with/without www).
- **Rationale**: people share to show the sets they'll see; hiding most of them defeats the purpose. Photos make it post-worthy.
- **Alternatives**: keep "+N" (rejected); a generic layout engine (rejected — extend the pure builder).

### DEC-081 — My Plan: insert blocks/sets between any two cards with a time-source choice — PROPOSED (direct)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G6). Reuses DEC-073/074.
- **Decision**: a **"+" affordance between any two adjacent cards** opens a sheet that asks **where the time comes from** — leave the previous set earlier / arrive at the next later / split / set the time manually — for either a **block** (water/toilet/food/meet/break/note) or **another set**. Reuses `applyLeaveEarly`/`applyArriveLate` + `addBlock`/`addToPlan`. Personal, zero-overlap, stripped from the group plan.
- **Rationale**: editing realistically (a quick break between Alok and Avicii) without recreating the whole plan.

### DEC-082 — i18n covers every main screen; "Squad" stays "Squad" — PROPOSED (council C5)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G4). Extends DEC-039 (i18n layer).
- **Decision**: wire Now, Line-up, Timetable, My Plan, Map and Squad through `t()` with EN+PT keys (incl. "Your Favorites" → "Seus favoritos", "All artists", "Favorites", "All days", "Next up" → "A seguir", weekday names Friday → Sexta / Fri → Sex, etc.). When the app is in PT, **no English remains** on the main screens; review button overflow (PT is longer). **"Squad" remains "Squad"** in PT (brand/nav label).
- **Rationale**: the user set PT but core screens stayed English. "Squad" is the feature/nav brand and reads fine in PT.

### DEC-083 — Timetable: order stages by favorite count when the user has favorites — PROPOSED (direct)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G7).
- **Decision**: when `favorites.size > 0`, `buildTimetable` orders stages by **favorite count descending** (tiebreak: source `sortOrder`, then name); with no favorites, keep the festival's source order. Adds `favCount` to `TimetableStage`. Pure + unit-tested.
- **Rationale**: with favorites set, the user's important stages should come first.

### DEC-084 — Lock-in button reflects the planned state of the day — PROPOSED (direct)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G7).
- **Decision**: when the day already has a locked plan, the Timetable "Lock in" button changes to a **planned** state ("Dia planejado" / "Editar plano" + icon) whose action goes to My Plan; otherwise it stays "Lock in". Reads `usePlan(festivalId, dayKey)`.
- **Rationale**: today the button never changes, so the user can't tell the day was saved.

### DEC-085 — Pinch zoom: one step per gesture + larger threshold + animated transition — PROPOSED (direct)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G7). Refines `lib/usePinch.ts`.
- **Decision**: `usePinch` fires **one density/zoom step per pinch gesture** (locked until `touchend`) with a larger threshold, and the grid/zoom change is **animated** (CSS transition). No more jumping multiple levels on a small pinch.
- **Rationale**: the gesture is too sensitive (re-baselines each threshold) and the transition is abrupt; the user should feel in control.

### DEC-086 — Squad parity: Next up, plan = My Plan timeline, agenda interleaved (render-only) — PROPOSED (council C4)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G9). Refines the Squad/Group-events model. Hard ÂNCORA: `buildSquadPlan` stays sets-only.
- **Decision**: (1) a **Squad "Next up"** at the top of Squad (+ "My plan / Squad" tabs on Now, gated to having a squad; squad selector if >1) reusing `useGroupEvents`/`useGroupPresence`/`useMeetingPoints`; (2) **reorganize** Squad: Next up → Group plan → Where everyone is → Pinned board → Agenda; (3) the **group plan reuses the My Plan timeline** (a shared visual component) with group extras (who's following/confirmed/creator); (4) the **agenda interleaves** into the plan timeline via `mergeSquadTimeline(setBlocks, events)` — **render-only**; events never enter `buildSquadPlan` (a regression test asserts it). Event×set conflict is a label only.
- **Rationale**: Squad is "loose information"; users need "what's the group doing now" and a plan that looks like their own, with the agenda mixed into the sets — without ever polluting the sets-only aggregation.

### DEC-087 — Festival name on the home: no ellipsis (responsive / two lines) — PROPOSED (council C5)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G10, LOCK §16).
- **Decision**: stop truncating the festival name with "…" on the home. Use a responsive font that shrinks to fit, and break to **two lines** (name + "Belgium 2026" as a subtitle) when it still doesn't fit. (LOCK: Julio may prefer "Tomorrowland" only.)
- **Rationale**: "Tomorrowland Belgium…" looks unfinished; the name is identity and should read cleanly without breaking the layout.

### DEC-088 — System chrome: dynamic theme-color + safe-area audit + documented native status-bar — PROPOSED (direct)
- **Date**: 2026-06-27 · **Status**: **PROPOSED** (Gate G8). The app is a PWA (DEC-035 — Capacitor deferred).
- **Decision**: make `theme-color` **dynamic** (follow the day/night palette via JS), audit `--safe-top`/`--safe-bottom` end-to-end so content sits under a transparent top bar correctly, and **document** the `@capacitor/status-bar` (overlaysWebView) + NavigationBar config for the future native shell — **not built now**.
- **Rationale**: the static dark `theme-color` makes the system bars clash with day mode; the app should feel native without yet shipping the Capacitor wrapper.
