# FestPilot — Implementation Phases

> Last updated: 2026-06-23 (first phase plan, from `/phases`). Generated with `.cursor/skills/phase-planner`.
> Grounded on `product-spec.md` (3 pillars + §14 V1 scope + DEC-022 essentials), `decision-log.md`,
> `technical-direction.md` (stack DEC-003/004), and the two completed spikes (`FestPilot/spikes/`).
> Scope confirmed by Julio 2026-06-23: **all 6 phases MUST SHIP in V1** (DEC-023); the **group board** is in V1 (DEC-013).

---

## How to read this

Work is ordered into **6 phases**. Each phase is independently testable — after it, the product
is usable (even if incomplete). The **V1/V2 cut line** sits between tiers T2 and T3; cut from the
bottom of T3 first. Schema is designed **fully in Phase 1**; behavior is added incrementally.

**Tiers:** **T1 MUST SHIP** · **T2 SHOULD SHIP** · **T3 V2 BUFFER**.

---

## Feature scoring (5-dimension methodology)

`Score = Dep×0.30 + Biz×0.25 + Diff×0.20 + Risk⁻¹×0.15 + Sep×0.10` (Risk⁻¹: high score = low risk = build earlier).

| # | Feature cluster | Dep | Biz | Diff | Risk⁻¹ | Sep | **Score** | Phase | Tier |
|---|-----------------|----|----|----|----|----|----------|-------|------|
| A | Foundation + lineup spine (scaffold, full schema, ingestion, auto-updater) | 5 | 4 | 3 | 4 | 5 | **4.25** | 1 | T1 |
| B | Favorites / Pillar 1 (browse + swipe favoriting) | 4 | 4 | 3 | 5 | 4 | **4.05** | 2 | T1 |
| C | My Plan / Pillar 2 (gated clash resolver + partial sets) | 3 | 5 | 5 | 3 | 4 | **4.00** | 2 | T1 |
| E | On-site essentials (offline, Now&Next, walk-time reminders) | 3 | 4 | 4 | 3 | 3 | **3.45** | 3 | T1 |
| D | Map + travel time (admin place, KML import, matrix, coord→stage) | 3 | 3 | 3 | 3 | 3 | **3.00** | 3 | T1 |
| J | Practical POI layer (toilets/water/medical/exits…) | 1 | 3 | 3 | 4 | 2 | **2.50** | 3 | T2 |
| F | Groups + shared timetable (create/join, auto-plan, override, split) | 2 | 4 | 4 | 2 | 3 | **3.10** | 4 | T1 |
| G | Live presence + "where is everyone?" (coarse, honest, push-reply) | 2 | 4 | 5 | 1 | 3 | **3.00** | 5 | T1 |
| H | Meeting points + nav + safety ("come to me", lifecycle, compass, I'm-lost) | 1 | 4 | 5 | 2 | 2 | **2.90** | 6 | T1 |
| I | Push infra (FCM) — cross-cutting | 3 | 3 | 2 | 2 | 3 | **2.80** | 3→5 | T1/T2 |

> Push (I) is cross-cutting: stood up in Phase 3 (lineup-change alerts + walk-time reminders) and
> expanded in Phase 5 (interactive where-is-everyone) / Phase 6 (meeting points + safety).

---

## Ordering rationale

1. **Foundation first** — schema + lineup data spine; nothing works without trustworthy lineup data. (Spikes already de-risked ingestion + map import.)
2. **Personal value before social** — Pillars 1–2 are the unique core ("decide who to see, resolve the clashes") and, per **DEC-003**, can ship as a **PWA first**. They're lower-risk than realtime location.
3. **Map before the location magic** — travel time enables Pillar 2 transitions; stage areas enable presence. The on-site essentials (offline, Now&Next) ride here because they make Pillars 1–2 actually usable in the field.
4. **Groups plan before live location** — the shared timetable (Pillar 3a) is lower-risk than realtime presence (Pillar 3b/c).
5. **Riskiest last** — live GPS presence + meeting points (realtime, battery, privacy, push round-trips) are the highest-risk; they ship last and are the first cut candidates.
6. **Cut from the bottom** — if time runs out, drop Phase 6 then Phase 5 items; the app still delivers the full personal experience + a group plan.

---

## V1 / V2 cut line (APPROVED 2026-06-23)

- **All 6 phases are MUST SHIP in V1** (DEC-023). Julio confirmed the live-location togetherness layer (presence + meeting points) is **non-negotiable** — it's core to "never lose your friends."
- The **phase order** still front-loads lower-risk value (Pillars 1–2 can be validated as a PWA) and isolates the riskiest realtime work (Phases 5–6) last so it's built carefully. "Cut from the bottom" is an **emergency lever only**, not a planned reduction.
- **All DEC-022 essentials ship in V1**, distributed by phase: offline + Now&Next + walk-time reminders (Phase 3), POI layer (Phase 3), battery-aware sampling (Phase 5), nav + safety (Phase 6).
- **Group board = YES in V1** (Phase 4). **V2 buffer (T3):** see §V2.

---

## Phase 1 — Foundation & Lineup Spine

**Tier:** MUST SHIP · **Risk:** ON TRACK (ingestion de-risked by spike) · **Objective:** the backend reliably ingests, normalizes, stores, and auto-updates the Tomorrowland 2026 lineup, and a client app shell can read it.

### Use cases
| UC | Title | Priority |
|----|-------|----------|
| UC-01 | Ingest a festival lineup from the structured source | MUST |
| UC-02 | Auto-update the lineup on a schedule, alert on change | MUST |
| UC-03 | App shell loads festival + lineup from our API | MUST |

### Key entities (full schema designed here)
`Festival`, `Edition/Weekend`, `Day`, `Stage`, `Artist`, `Performance`, `LineupRevision`,
`User`, `Device/PushToken`, `Favorite`, `PlanSlot`, `Group`, `GroupMember`, `GroupPlanSlot`,
`StageLocation`, `TravelTime`, `Poi`, `ImportedMapFeature`, `StageAlias`, `Presence`, `MeetingPoint`.
*(Design all now; populate behavior in later phases — ordering rule 7.)*

### Backend (Cloudflare)
- Worker + **Cron Trigger** scheduled job: resolve `event`+`uuid` from `__NEXT_DATA__` → fetch CDN `config`/`stages`/weekend JSON → normalize (port `spikes/lineup-ingestion/src/resolver.ts` + `normalize.ts`).
- Change detection (ETag / Last-Modified / SHA-256) → diff (added/removed/time-/stage-changed) → upsert into **D1** → bump `LineupRevision` → enqueue affected-user alerts (alerts delivered once push exists in Phase 3).
- Removed acts → `inactive`, never hard-deleted.
- Read API: `GET /api/festivals`, `GET /api/festivals/:id/lineup?revision=`, `GET /api/festivals/:id/stages`.

### Frontend
- PWA scaffold: **Vite + React + TS**, routing, data layer (typed client + cache), service-worker registration (offline groundwork), app shell.

### Acceptance criteria
- [ ] TML2026 lineup (W1+W2, 15 stages, ~813 performances) ingested into D1 with correct instants, +1s fixed, midnight-crossing handled.
- [ ] Cron re-runs, detects a synthetic change, produces a correct diff, bumps the revision.
- [ ] App shell fetches and renders the raw lineup from our API (no festival-site calls from the client).
- [ ] `tsc` clean; ingestion unit tests on the spike fixtures pass in CI.

### Technical notes & risks
- Reuse spike fixtures as ingestion test fixtures. Watch D1 write limits on bulk upsert (batch).
- Keep `resolver`/`normalize` runtime-agnostic so they stay unit-testable off-Worker.

### V2 fallback
- Multi-festival adapters deferred; ship the Tomorrowland adapter only (model stays generic).

### AI execution brief
> Build the Cloudflare Worker ingestion from the validated spike (`spikes/lineup-ingestion`). Port `resolver.ts`/`normalize.ts` verbatim where possible. Define the **full D1 schema** (all entities above) up front. Implement the cron job (resolve→fetch→detect→diff→upsert→revision), mark-inactive on removal, and the read API. Scaffold the React/TS PWA shell that reads the lineup. Backend before frontend. Add tests against `fixtures/`.

---

## Phase 2 — Favorites & "My Plan" (Pillars 1–2, shippable PWA)

**Tier:** MUST SHIP · **Risk:** TIGHT (Pillar 2 UX is the hard, unique part) · **Objective:** a user browses the lineup, favorites generously, then locks a conflict-free personal plan with partial-set transitions — the product's core value, runnable as a standalone PWA.

### Use cases
| UC | Title | Priority |
|----|-------|----------|
| UC-04 | Browse lineup by artist / stage / day | MUST |
| UC-05 | One-tap "want to see" (overlaps allowed) + fast swipe onboarding | MUST |
| UC-06 | "Lock in" my plan: chronological, one-at-a-time clash resolution | MUST |
| UC-07 | Split a slot (partial set) with travel-time validation | MUST |
| UC-08 | View my conflict-free plan per day | MUST |

### Key entities (behavior)
`Favorite` (user × performance), `PlanSlot` (user, performance, day, cut points, transition).

### Backend
- `POST/DELETE /api/favorites`, `GET /api/me/favorites`.
- `GET /api/me/clashes?day=` (overlap detection — port `overlaps()` from the spike).
- `POST /api/me/plan/slots`, `GET /api/me/plan?day=`.

### Frontend
- **Lineup browser** — tabs by artist / stage / day; one-tap favorite; **swipe** onboarding mode.
- **Lock-in flow** — gamified, side-by-side clash cards (genre/context), one pick per moment, **chronological gate** (next clash unlocks only after the chosen slot ends).
- **Partial-set editor** — custom cut point ("leave at 19:30 → walk to B"); transition valid(uses a **stubbed/manual travel matrix** until Phase 3).
- **My Plan view** — per-day conflict-free timeline.

### Acceptance criteria
- [ ] User favorites overlapping acts freely; favorites persist.
- [ ] Lock-in resolves every clash one-at-a-time in time order; result has **zero overlaps**.
- [ ] Partial-set split records a cut point and flags whether the transition is feasible.
- [ ] Works as an installable PWA; offline read of lineup + my plan (basic).

### Technical notes & risks
- The gated resolver state machine is the crux — model it explicitly (queue of clashes ordered by start; unlock pointer = last locked slot's end).
- Travel-time is stubbed here; wire the real matrix in Phase 3 without reworking the resolver API.

### V2 fallback
- Undo / "what did I give up" and discovery/fill-gaps move to V1.x (not blocking).

### AI execution brief
> Implement Pillars 1–2 against the Phase-1 API. Reuse the spike's `overlaps()` for clash detection. Build the **gated clash resolver** as an explicit state machine (chronological unlock). Build the partial-set editor with a travel-time interface that is stubbed now and swapped for the real matrix in Phase 3. Ship as a working PWA. One screen at a time; test the resolver invariant "no overlaps in the locked plan".

---

## Phase 3 — Map, Travel Time & On-Site Essentials

**Tier:** MUST SHIP (POI layer = T2) · **Risk:** TIGHT · **Objective:** the app knows where stages are and how long it takes to walk between them, validates real transitions, and is genuinely usable in the field (offline, glanceable, timely reminders).

### Use cases
| UC | Title | Priority |
|----|-------|----------|
| UC-09 | Admin: import map seed (KML) + auto-match stages | MUST |
| UC-10 | Admin: place each stage (center + radius) + travel-time matrix | MUST |
| UC-11 | Resolve a GPS coordinate → stage area | MUST |
| UC-12 | "Now & Next" home with walk-time countdown | MUST |
| UC-13 | Offline-first (lineup, my plan, map/POIs, last group plan) | MUST |
| UC-14 | Walk-time-aware reminder push ("leave now to catch X") | MUST |
| UC-15 | Practical POI map layer (toilets/water/medical/exits/ATM/charging/lockers) | SHOULD |

### Key entities (behavior)
`StageLocation` (center+radius), `TravelTime` (from→to minutes + crowded factor), `Poi`,
`ImportedMapFeature`, `StageAlias`, `Device/PushToken` (registration).

### Backend
- Admin import: port `spikes/map-import` (`kml.ts`+`match.ts`) → `ImportedMapFeature` → auto-match → verify endpoint → promote to `StageLocation`/`Poi`.
- `GET /api/festivals/:id/map` (stages, areas, POIs), `GET /api/festivals/:id/travel-times`.
- **FCM** registration + send; schedule walk-time reminders from `PlanSlot` + travel matrix.

### Frontend
- **Admin verify map** (productionize the spike's `admin-verify.html`): confirm location, drag pin, set radius, fix aliases, place the 5 unmatched stages.
- **Now & Next** home: on-now / my next pick / where / **when to leave** countdown.
- **Offline-first**: cache lineup, my plan, map/POIs, last group plan via service worker + local store.
- **POI map layer** with "nearest …" search.
- Swap Pillar-2's stubbed travel-time for the real matrix.

### Acceptance criteria
- [ ] Admin imports the KML, confirms 10 auto-matched stages, places the 5 sponsor-named stages, sets radii.
- [ ] Coordinate→stage resolution returns at/near/between correctly for sample points.
- [ ] Now & Next renders fully **offline**; "when to leave" uses the real travel matrix.
- [ ] A walk-time reminder fires ahead of a locked act, accounting for travel from the previous stage.

### Technical notes & risks
- Circle areas only (polygon = V2, DEC-010). Manual matrix (learned = V2, DEC-011).
- Offline correctness is subtle — define the cache/sync contract explicitly.

### V2 fallback
- POI layer (T2) can slip to V1.x if tight; offline + Now&Next + reminders must ship.

### AI execution brief
> Productionize `spikes/map-import` into the admin import/verify path and stand up the map data API. Build the Now&Next home and the offline cache/sync contract. Introduce **FCM** (registration + the first push type: lineup-change alerts from Phase 1 + walk-time reminders). Replace the Phase-2 travel-time stub. Then the POI layer.

---

## Phase 4 — Groups & Shared Timetable (Pillar 3a)

**Tier:** MUST SHIP · **Risk:** TIGHT · **Objective:** friends form a group and build a shared timetable using closed-plans-first / favorites-fallback, with owner override, per-block follow-or-split, and a **pinned group board** — no real-time chat.

### Use cases
| UC | Title | Priority |
|----|-------|----------|
| UC-16 | Create group; join via link / QR | MUST |
| UC-17 | Share my plan with the group | MUST |
| UC-18 | Auto-build group timetable (plurality of locked picks) | MUST |
| UC-19 | Owner override per slot; never silently override a member's lock | MUST |
| UC-20 | Per-block follow-the-group or do-my-own; favorites-fallback option | MUST |
| UC-20b | Pinned group board — post / edit / remove short notes & announcements | MUST |

### Key entities (behavior)
`Group`, `GroupMember` (role owner/member), `GroupPlanSlot` (chosen act per slot + rationale), `GroupBoardNote` (pinned short notes).

### Backend
- `POST /api/groups`, `POST /api/groups/:id/join` (link/QR token), membership.
- `GET /api/groups/:id/plan` — aggregate members' `PlanSlot` (plurality) with **favorites-fallback** pool; owner override; `PUT /api/groups/:id/plan/slots/:slot`.
- Per-group realtime via **Durable Object** (plan updates fan-out).

### Frontend
- Group create/join (link + QR), member list.
- **Group timetable** view: per slot — what everyone picked, the group's pick, and each member's status (follow / own / fallback-suggestion). Visualize splits ("22:00: 4→MAINSTAGE, 2→CORE" — basic; rich split viz is V1.x).
- **Group board** — a simple pinned list of short notes/announcements the whole group sees (post / edit / remove).

### Acceptance criteria
- [ ] Create + join via link/QR; members share plans.
- [ ] Group plan auto-fills by plurality; owner can override any slot.
- [ ] A member whose locked pick ≠ group gets offered one of their **other favorited** acts for that slot.
- [ ] A member's locked pick is **never silently overridden**.
- [ ] Members can post / edit / remove short notes on a pinned **group board**.

### Technical notes & risks
- Durable Object per group for consistent realtime fan-out (plan + board updates). No real-time chat (DEC-013).
- **Group board (DEC-013):** a lightweight **pinned board** is in V1 (short notes/announcements) — distinct from chat.

### V2 fallback
- Advanced algorithms / per-block voting → V2; ship plurality + override + fallback.

### AI execution brief
> Build groups + the shared timetable. Implement the **closed-first, favorites-fallback** aggregation exactly per spec §6/§12. Use a Durable Object per group for realtime plan updates. Link + QR invites. No chat. Surface a basic split visualization.

---

## Phase 5 — Live Presence & "Where Is Everyone?" (Pillar 3b)

**Tier:** MUST SHIP · **Risk:** AT RISK (realtime + GPS + battery + privacy) · **Objective:** during the festival, the group sees each other coarsely and honestly by stage, and anyone can ask "where is everyone?" with a one-tap push reply.

### Use cases
| UC | Title | Priority |
|----|-------|----------|
| UC-21 | Consent-at-point-of-use GPS enablement | MUST |
| UC-22 | Coarse presence by stage (at/near/between + confidence + expiry) | MUST |
| UC-23 | Current-artist auto-detection from presence + lineup | MUST |
| UC-24 | Group-by-stage view + map markers | MUST |
| UC-25 | "Where is everyone?" interactive push (pre-filled stage reply) | MUST |
| UC-26 | Sharing modes (manual / while-using / live time-boxed), per-group | MUST |

### Key entities (behavior)
`Presence` (server-side raw fix → coarse stage + confidence + expiry; raw lat/lng never sent to clients).

### Backend
- `POST /api/presence` (raw fix in; coarse out), `GET /api/groups/:id/presence`.
- Coordinate→stage (Phase 3) + confidence model + expiry (GPS ~15m, manual/push ~45m, DEC-008).
- Interactive FCM "where is everyone?" round-trip; Durable Object fan-out.

### Frontend
- GPS pre-prompt + consent; battery-aware adaptive sampling + low-power + last-known.
- Group-by-stage clusters ("MAINSTAGE — Thales, Andy — watching Martin Garrix") + coarse map markers.
- Sharing-mode controls (per group, time-boxed).

### Acceptance criteria
- [ ] Presence shows at/near/between with honest confidence and expires correctly.
- [ ] Clients **never** receive raw coordinates for presence.
- [ ] "Where is everyone?" delivers an interactive push pre-filled with the nearest stage; one tap answers.
- [ ] Sharing is per-group and time-boxed; turning GPS off keeps the app working via manual/push.

### Technical notes & risks
- Background GPS is unreliable by design — **push-reply + manual are first-class**, not afterthoughts.
- Privacy: raw fixes server-side only; purge windows (DEC-015). Battery is a real constraint.

### V2 fallback
- If cut: keep **manual** presence + "where is everyone?" push (no continuous GPS) as a minimal slice.

### AI execution brief
> Build coarse, **honest** presence (server keeps raw lat/lng; clients get stage+confidence). Implement consent-at-point-of-use, battery-aware sampling, the group-by-stage view, and the interactive "where is everyone?" push round-trip over the group's Durable Object. Enforce the privacy model (no raw coords to clients; per-group time-boxed sharing; purge).

---

## Phase 6 — Meeting Points, Navigation & Safety (Pillar 3c)

**Tier:** MUST SHIP · **Risk:** TIGHT · **Objective:** people actually find each other in the crowd via exact, temporary, opt-in meeting points (with a photo), simple arrow navigation, and a safety / "I'm lost" action.

### Use cases
| UC | Title | Priority |
|----|-------|----------|
| UC-27 | "I'm here, come to me" exact point + photo + note + expiry + visibility | MUST |
| UC-28 | Meeting-point lifecycle (active→expiring→expired→empty→archived) + fade | MUST |
| UC-29 | Navigate to a point (compass arrow + distance, no turn-by-turn) | MUST |
| UC-30 | Safety / "I'm lost": share exact location + nearest exit/medical | MUST |

### Key entities (behavior)
`MeetingPoint` (exact coords, photo in **R2**, note, expiry, visibility, lifecycle state).

### Backend
- `POST /api/groups/:id/meeting-points`, photo upload to **R2**, lifecycle transitions (smart prompts: creator drifted? empty for ~10m? → state change), push notifications.
- Safety action: explicit exact-location share + nearest exit/medical from POIs.

### Frontend
- Drop-point UI (photo capture, note, expiry, visibility); fading pin (strong→faded→gray) with retained "who went" record.
- Compass arrow + distance navigation.
- Safety button → confirm → share exact + show nearest exit/medical.

### Acceptance criteria
- [ ] Drop a point with a photo; group is notified; navigate via arrow + distance.
- [ ] Lifecycle transitions fire (expiring_soon <5m, empty after ~10m, archived); pin fades, record stays.
- [ ] Exact coordinates are shared **only** via meeting points or the safety action — never automatically.
- [ ] Safety action shares exact location and surfaces nearest exit + medical.

### Technical notes & risks
- This is the one place exact coordinates leave the device — gate every path behind explicit intent.
- R2 photo lifecycle + purge on archive (DEC-015).

### V2 fallback
- If cut: ship "come to me" point + photo + expiry only; defer arrow-nav and safety to V1.x.

### AI execution brief
> Build meeting points end-to-end: exact point + R2 photo + note + expiry + visibility, the full lifecycle with smart prompts and the fade UI, compass-arrow navigation, and the safety/"I'm lost" action. Reuse Phase-3 POIs for nearest exit/medical. Exact coords only ever leave via explicit intent.

---

## V1.x (fast-follow, not blocking V1)
- Discovery / fill-empty-slots ("you have a gap; here's a no-clash gem").
- Rich group **split visualization**.
- **Undo / "what did I give up"** on clash decisions.
- Share my plan as image / link.

## V2 buffer (T3 — cut from here first)
- **Polygon** stage areas (V1 = circles, DEC-010).
- **Learned** travel times from aggregated movement (DEC-011).
- **Multiple festivals** at launch (model is generic; ship Tomorrowland first).
- Advanced group algorithms (weighting, smart proposals) + per-block voting.
- Post-festival recap, set ratings/journal, weather/sunset, crowd/heat, richer in-app comms.
- Monetization / accounts beyond what groups require.

---

## Decisions confirmed (2026-06-23)
- **DEC-023 — V1 cut line & phase order:** APPROVED — **all 6 phases MUST SHIP in V1**; order follows risk; "cut from the bottom" is emergency-only.
- **DEC-022 essentials:** all ship in V1, distributed by phase (offline/Now&Next/reminders Phase 3; POI Phase 3; battery Phase 5; nav+safety Phase 6).
- **DEC-013 group board:** YES — lightweight pinned board in V1 (Phase 4); no real-time chat.

---

*See `ai-execution-guide.md` for per-phase prompt templates. Phase tracking in `project-status.md`. Scope decisions in `decision-log.md`.*
