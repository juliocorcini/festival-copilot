# FestPilot — Product Specification

> Last updated: 2026-06-23 (Initial definition + **2026-06-23 discovery-council update**: added the festival-context essentials §8.1/§14 (DEC-022), the map seed (DEC-021), and resolved stack/backend/group-mechanics/privacy — see `documents/2026-06-23-discovery-councils-and-decisions.md`. This is the first and primary source-of-truth document; it synthesizes intent, not a transcript. Anything marked **OPEN** is not yet decided — see `decision-log.md`.)

---

## 1. What is FestPilot?

FestPilot is a **festival companion app** for festival-goers. It does three things, in order:

1. **Pick everyone you want to see.** You browse the full festival lineup and favorite every artist you'd like to catch — overlaps allowed. Favoriting is a *wish* ("I want to see this one"), not a commitment.
2. **Turn wishes into a real plan.** You "close" your timetable: the app walks you through every clash (two or more favorited acts at the same time on different stages) and you choose, one at a time, until you have a **conflict-free personal lineup** — what you will *actually* do at the festival, respecting partial sets and the time it takes to walk between stages.
3. **Stay together with your group.** You create or join a group with your friends. Everyone shares their plan, the group builds a **shared group timetable**, and during the festival you can see each other's location on a **stage map**, ask "where is everyone?", and drop temporary **meeting points** (with a photo) to actually find each other in the crowd.

One line: **FestPilot helps you decide who to see, resolve the impossible clashes, and never lose your friends.**

---

## 2. The Core Problem

A big festival is overwhelming in a very specific way:

- **The lineup is huge and clashes are brutal.** Tomorrowland 2026 has ~16 stages and hundreds of artists across two weekends. The acts you love are constantly scheduled at the same time on different stages. You physically cannot be in two places at once, but nothing helps you make those trade-offs deliberately — you end up improvising, drunk, running between stages, missing the sets you cared about most.
- **Raw schedules don't match real behavior.** Real festival-going isn't "watch this whole set, then that whole set." It's "watch the first half here, then walk over to catch the end of that one." It involves leaving early, arriving late, and the walking time between far-apart stages.
- **You lose your friends.** Everyone wants different acts, but the group wants to be together most of the time. Phones die, signal is bad, the app is in the background, and "I'm at the main stage" is useless when the main stage holds tens of thousands of people.

Existing tools (printed grids, the official app's flat timetable, generic clash-finders) show the schedule but don't (a) turn *your* wishes into a deliberate, conflict-free plan that respects partial sets and walking time, or (b) connect that plan to your group and your real-time location.

---

## 3. Vision & North Star

**North star:** *"Help me see the artists I care about most, and keep me with my people."*

Two promises:

- **The plan promise** — "By the time the festival starts, you already know your trade-offs. No clash will surprise you; you chose, on purpose, who wins each moment."
- **The togetherness promise** — "You can always find your friends — by stage when that's enough, by exact point when it isn't — without anyone having to type much."

A guiding humility about location (see §9): the best product here is **not** the one that tracks everyone perfectly. It's the one that **asks the right question at the right time** when it doesn't know, and is **honest about confidence** when it does.

---

## 4. Target Users

- **Group festival-goers** — people who go to multi-day, multi-stage festivals (EDM-first like Tomorrowland, but the model generalizes) with a circle of friends and want to coordinate without endless group-chat chaos.
- **Maximizers** — people with strong taste who hate missing a set and want to plan their clashes deliberately.
- **The "where are you?" person** — the one always trying to herd the group, who needs a fast way to locate everyone and set a rally point.
- **Casual taggers-along** — people who don't want to plan much but want to know where the group is and what they're watching right now.

Reference festival for V1: **Tomorrowland Belgium 2026** (two weekends: 17–19 Jul and 24–26 Jul; ~16 stages). The data model and ingestion are designed to generalize to other festivals later.

---

## 5. The End-to-End Story

> A narrative of the intended experience, start to finish.

1. **Before the festival.** Julio opens FestPilot, picks Tomorrowland 2026, and scrolls the lineup. He swipes through artists/stages/days and taps "want to see" on everyone he likes — he favorites 4 acts that all happen Saturday at 16:00 on different stages. He doesn't worry about conflicts yet; this is just his wishlist.
2. **Closing the timetable.** When he's ready, he taps **"Close my timetable."** The app organizes his favorites by day and walks the Saturday timeline. At 16:00 it shows the clash: 4 acts, side by side, with genre and a bit of context. "You can only be in one place — who wins this slot?" He picks one. That choice locks into his fixed timetable, and the app advances to the next clash *after* that slot ends.
3. **A partial set.** Later, a stage-1 act runs to 20:00, but a stage-2 act he loves starts at 19:40 and runs to 22:00. He tells FestPilot: "watch stage 1 until 19:30, then go." The app knows it's an 8-minute walk, confirms he'll catch the stage-2 act from the start, and records the split.
4. **The group.** Andy creates a group "Squad TML" and everyone joins. Each person already has favorites and (maybe) a closed timetable. The app proposes a **group timetable**: for each slot it sees what everyone wants and suggests where the group should be. Julio's locked pick for one slot doesn't match the group — but one of the other 3 acts he favorited (and excluded) *does* match the group, so the app offers that as his "be with the group" option.
5. **At the festival.** It's 23:40 Saturday. Julio opens the group view: "MAINSTAGE — Thales, Andy, Vitor — watching Martin Garrix" and "FREEDOM — Julio, Bruno — watching ARTBAT." He taps **"where is everyone?"**; the two people whose GPS is asleep get a notification — "Are you at FREEDOM watching ARTBAT? [Yes] [Change]." Andy wants the group to regroup, so he taps **"I'm here, come to me,"** drops an exact point with a photo of the blue beer sign, set to expire in 20 minutes. Everyone walks to it. After it expires and empties, the pin fades but the record stays.

---

## 6. The Three Pillars

> The heart of the product. Pillars 1 and 2 are **personal**; pillar 3 is **social**. They are distinct features that build on each other.

### Pillar 1 — Favorites ("everyone I want to see")

**Goal:** capture, generously and with zero friction, every artist the user would like to see.

- The user browses the **full lineup** — all artists, all stages, all days — and marks **"want to see"** on each one they like.
- **Overlaps are allowed and expected.** Favoriting is a *wish*, not a plan. You can favorite 4 acts in the same time slot. The mental model the user stated: *"It's not the artist I'm going to see — it's the artist I want to see,"* because later it will collide with others.
- Browsing modes: **by artist** (swipe through the list), **by stage**, and **by day**. Selection is **one tap**.
- The favorites set is the **raw material** for both downstream pillars: it feeds the personal closed timetable (Pillar 2) *and* the group fallback logic (Pillar 3).
- Output: a personal collection of "wanted" performances, conflicts included.

### Pillar 2 — "My Plan" / "Lock in" ("what I'll actually do") — internally the closed timetable

> Working name only. Julio: "the name is terrible, but the idea is: you can only pick one artist per moment." Candidate names: *Fixed Timetable, My Lineup, Locked Plan, Final Set, My Schedule.* **Name is OPEN (DEC-005).**

**Goal:** turn the wishlist into a **conflict-free** personal lineup — at most **one act per moment** — because you cannot be in two places at once.

**It is a separate, explicit action** from favoriting. The app makes the intent clear: *"Do you want to close your timetable? In the closed timetable you can only have one artist per moment, and you'll choose which one."*

**How clash resolution works:**

- The closed timetable is built **per festival day**. For each day, the engine walks the user's favorites along the timeline.
- Wherever **2+ favorited acts overlap** in time (on different stages), it presents a **clash** to resolve.
- **Gamified, one decision at a time.** The conflicting acts are shown side by side with helpful context — **genre, what they tend to play, a bit about the artist** — so the choice is informed and fun, not a spreadsheet. The user must pick **one** (overlaps are not allowed in the closed timetable).
- The chosen act becomes a **slot** in the closed timetable.
- **Chronological, gated progression (important):** resolution proceeds in time order. After the user locks a slot, the **next choice only opens after that slot's end time**. You resolve "now," then move to "next." This sequential gate is what guarantees no overlaps slip through. (Julio: *"when he makes the choice, that artist ends, and we can only make the next choice after that time is over."*)

**Partial sets & transitions (a defining nuance):**

- Real plans aren't whole-set blocks. The user may want **part of one act and part of another**.
- Example (Julio's): stage-1 act runs to 20:00, but a stage-2 act he loves starts 19:40 and runs to 22:00. He wants stage-1 **until 19:30**, then walk over to catch stage-2 from the start.
- So a closed-timetable slot can have a **custom cut point** ("leave this one early to make the next"), and the engine must account for **walking time between stages** (see §8) to tell the user whether the transition actually works ("it's an 8-minute walk; you'll make it" / "you'd miss the first 5 minutes").
- The point: **do not use raw time slots blindly.** Support the human reality of leaving early/arriving late to stitch two acts together.

**Output:** the user's **real personal lineup** — what they will actually do, hour by hour, including transitions.

### Pillar 3 — Groups ("stay together")

**Goal:** let a circle of friends coordinate and stay together for most of the festival, while still respecting each person's taste.

- **Creation & membership.** One user creates a **group**; friends **join**. The group is the shared space for coordination.
- Each member has their own **favorites** (Pillar 1) and possibly their own **closed timetable** (Pillar 2).
- **The group timetable.** The goal is a shared timetable so the group is together most of the time. The group creator (**owner**) can see members' timetables and help define the group plan: for each time slot, see what everyone chose and pick the group's act (e.g., by majority — "X people chose this, Y chose that").
- **Two-layer matching (the key idea):**
  1. **Match on closed timetables first** — what each person *most* wants. But closed timetables are very personal and often **won't align** across people.
  2. **Fall back to favorites.** When a person's locked choice doesn't match the group's pick, look at that person's **other favorited acts** (the broader wishlist) for that slot. Because to lock one act, the person had to **exclude** other favorites — and maybe one of those excluded favorites **does** match the group. Offer that as the person's "be with the group" option, so they're with friends *and* still seeing someone they like.
  - Example (Julio's): "I had 4 acts at the same time. For my closed timetable I excluded 3 and kept 1. But I liked all 4. If my 1 locked pick doesn't match the group, maybe one of the other 3 I excluded *does* — use that as the second option."
- The group timetable is therefore assembled **per slot** from the aggregate of members' closed timetables, with favorites as the fallback pool.

**RESOLVED — group coordination & communication (DEC-013).** The group plan is an **auto-generated suggestion, owner-adjustable, member-optional**: per time block the **plurality** of members' locked picks wins (tie → most-favorited → owner picks); a member whose lock ≠ the winner is offered their best favorite at that block; **per-block follow / do-my-own** with **split visualization** (never prevented); the owner can **override** any slot; a locked must-see is **never silently overridden** ("group → X, you're locked Y · [Join]/[Keep]"). Comms are light: the group plan + reactions + where-is-everyone / meeting-point flows **plus a lightweight pinned group board** (short notes/announcements the whole group sees — e.g. "meet at gate 3 at 18h"). **No full real-time chat in V1.** Invites via **link + QR**.

---

## 7. Lineup Data Source (how the app gets accurate data)

> Full technical detail in `technical-direction.md` and `research/2026-06-23-festival-lineup-data-source.md`. Summary of the product-level rules:

- The app needs accurate, structured data per festival: **day + stage + start time + end time + artist**. Everything (clashes, the closed timetable, "who's playing now") depends on this being right.
- **Rejected approaches:** copy-pasting the page (Ctrl+A), OCR of screenshots, or reading the visual grid by eye — all unreliable, because the schedule is a grid and flattened text loses which act belongs to which stage.
- **Chosen approach (Tomorrowland reference):** the official site embeds an `event` id and a `uuid` in its page data (`__NEXT_DATA__`); a CDN then serves clean JSON for config (weekends), stages, and performances. Each performance already carries artist(s), stage, date, day, and start/end times. **The data is born structured — we use it directly.**
- **Never hardcode the `uuid`.** Resolve `event` + `uuid` from the official page on every run. The uuid can change, and the same uuid can also receive updated data — so the app must re-resolve and re-check.
- **Normalization rules:** store times with the festival's timezone (e.g., Europe/Brussels); strip the known "+1 second" end-time quirk; handle sets that **cross midnight** (end time rolls to the next day) so clash math is correct.
- **Users never hit the festival site directly.** A backend ingests, normalizes, and stores the lineup; the app reads from **our** database.
- **Auto-update (DEC-009).** A scheduled worker periodically re-resolves the source and re-fetches, detects changes (ETag / Last-Modified / content hash), and on change: computes a diff (added / removed / time-changed / stage-changed), updates the DB, bumps a **lineup revision**, and **alerts affected users** (people who favorited or locked an act that moved). Removed acts are **marked inactive, never hard-deleted** (keep history).
- **Generalization:** Tomorrowland is the first/reference festival; other festivals get their own ingestion adapter behind the same normalized model (festival → editions/weekends → days → stages → performances).

---

## 8. Festival Map, Stages & Travel Time

**Goal:** know where each stage is, how long it takes to walk between them, and which stage a GPS coordinate corresponds to.

- **Stage mapping (admin/setup mode).** Load the festival's stages from the lineup. For each stage, open a **real map** and:
  1. **Tap the exact stage location** ("Where is MAINSTAGE?" → tap the spot).
  2. **Define the stage's area.** V1 = **center + radius** (a circle; the user expands the circle to cover the stage area). V2 = **polygon** (tap points to draw the real shape) for messy, non-circular areas. (DEC-010.)
- **Why the map matters:**
  - **Travel time** between stages (used by Pillar 2 partial-set transitions and by group logic).
  - **Coordinate → stage resolution** for presence (see §9): given a GPS fix, find which stage area contains it.
- **Travel time between stages (DEC-011).** V1 = a **manual matrix per festival** (from-stage → to-stage: typical minutes, plus a "crowded" multiplier) and/or a distance-based estimate with a **festival-friction factor** (crowds, terrain, bottlenecks make it slower than a straight line). V2 = **learn** real transition times from aggregated, consented user movements.
- **Map seed (DEC-021).** A festival's stages and POIs can be **seeded by importing a map** (e.g. a community Google My Maps exported to KML/KMZ). Stages auto-match by name + coordinate; old/renamed names route through a stage-alias table; an **admin verifies** each location + radius before the app trusts it. For Tomorrowland we already have a seed with **10 stages matched** + DreamVille areas/entrances. See `research/2026-06-23-festival-map-seed-kml.md`.

### 8.1 Practical map layer (POIs) — DEC-022

The map isn't only stages. A **practical layer** answers the most common on-site question ("where's the nearest…?"): **toilets, water, food, medical, exits, ATMs, charging, lockers, entrances, landmarks**. Seeded from the imported map (DreamVille areas/entrances) + admin, it powers "nearest toilet/water/medical" and the safety / "I'm lost" flow (§11). POIs are cached for **offline** use.

---

## 9. Live Presence & Location

> Two distinct layers: **coarse presence** (continuous, by stage) and **exact point** (temporary, opt-in — see §10). This separation is a core privacy and UX decision.

**GPS posture (DEC-006).** GPS is the **primary mode** of the app as a product stance — the experience assumes location is on. But the OS requires explicit permission, so:

- Permission is requested **at the moment** the user first taps a location feature, behind a friendly in-app pre-prompt that explains the value and the privacy model.
- After granting, location features stay on. **Anyone can turn it off**; that's their choice and the app keeps working with manual/push fallbacks.

**Coarse presence (the default, DEC-007).**

- From a GPS fix, the app computes the **stage area** and shows presence **coarsely**, never raw coordinates:
  - "**at MAINSTAGE**" (high confidence)
  - "**near MAINSTAGE**" (medium confidence)
  - "**between MAINSTAGE and CORE**" (low confidence — inside no single area)
  - "no recent location"
- **Confidence** is derived from GPS accuracy + distance to the area. The UI is **honest about it** (probably/near/between), never pretends to be exact.
- **Presence expires** so stale data never looks current: GPS-derived ~15 min; manual / push-reply ~45 min. (DEC-008.)
- **Current-artist auto-detection.** Because the app knows the lineup, if a friend is at stage X now, it shows "**watching {the act playing at X now}**" without them telling it.

**Group presence view.**

- Friends are **grouped by stage**, visually clustered so you see who's together:
  - "**MAINSTAGE** — Thales, Andy, Vitor — watching Martin Garrix"
  - "**FREEDOM** — Julio, Bruno — watching ARTBAT"
- Plus everyone on the **map** with coarse markers.

**"Where is everyone?" (DEC-012).**

- A button anyone in the group can press. It sends a **push** to the group. Recipients get an **interactive notification pre-filled with their nearest stage**: "Are you at FREEDOM watching ARTBAT? **[Yes]** **[Change stage]**." One tap answers.
- This exists precisely because background GPS is unreliable (app closed, OS throttling, dead battery). **Manual** status and **push-reply** are first-class fallbacks to GPS.

**Sharing modes.** Manual-only · while-using-the-app · live-during-festival (time-boxed background sharing, e.g., "share with this group until 03:00"). Sharing is **per group**, not global.

---

## 10. Meeting Points ("come to me")

> The second location layer: **exact, explicit, temporary.** This is how you actually find someone in a crowd.

- Button **"I'm here, come to me"** drops an **exact point** (precise coordinates) on the group map, with:
  - an optional **photo** (e.g., "under the blue beer sign" — the thing that actually helps in a crowd),
  - an optional **note**,
  - an **expiration** (10 / 20 / 30 / 60 min),
  - **visibility** (whole group or selected members).
- **Group meeting point / rally point** — similar, but meant to outlive the creator physically standing there (a "meet here" spot).
- **Lifecycle states (DEC-014):** `active` → `expiring_soon` (<5 min) → `expired` → `empty` (everyone left the radius) → `archived`. The pin **fades** as it ages (strong → faded → gray); the info stays (who went) but leaves the foreground so it doesn't mislead.
- **Smart prompts.** If the creator walks more than X meters from the point, ask "Did you leave the point? [Keep] [End]." If no one is within the radius for ~10 min, auto-mark it `empty`.
- **The key distinction:** presence (§9) is **continuous & coarse** ("at stage X"); a meeting point is **temporary & precise** ("come find me exactly here"). Exact coordinates are **only** ever shared through this explicit action — never automatically.

---

## 11. Notifications

Cross-platform push (FCM is the candidate — see `technical-direction.md`). Types:

- "**{name} wants to know where everyone is**" → interactive, pre-filled stage reply (§9).
- "**{name} created a meeting point**" → [I'm coming] [Open map].
- "**Are you still at the meeting point?**" → [Yes] [End].
- "**The group is heading to FREEDOM.**"
- "**Leave now to catch {act}**" — a **walk-time-aware** reminder before a locked act, accounting for travel time from your current/previous stage (DEC-022).
- "**{name} is lost / needs the group**" — the safety / "I'm lost" action shares an exact location with the group and surfaces the nearest exit + medical (DEC-022).
- **Lineup-change alerts** affecting your favorites/locked acts: an act you favorited moved stage or time, was added/removed, or a **new clash** was created in your plan.

---

## 12. Product Rules & Principles

1. **Favorites are wishes; the closed timetable is the commitment.** Favorites allow overlaps; the closed timetable allows at most one act per moment.
2. **Clash resolution is chronological and one-at-a-time.** The next choice unlocks only after the current slot ends.
3. **Respect partial sets and walking time.** Support custom cut points ("leave early") and validate transitions against stage-to-stage travel time. Never assume whole-set blocks.
4. **Group matching: closed timetables first, favorites as fallback.** If a locked pick doesn't fit the group, offer one of the user's other favorited acts for that slot.
5. **Exact location is never shared by default.** Presence is coarse (stage/near/between); precise coordinates only via the explicit "come to me" meeting point.
6. **GPS is the default posture, but consent is asked at the point of use.** Honesty over precision — "probably at X," never a promise of perfect tracking. The right move when unsure is to **ask** (push-reply), not to guess.
7. **Lineup data is never hardcoded.** Always resolve the source; keep it fresh with the auto-updater; never hard-delete (mark inactive); alert affected users on change.
8. **Users read our database, never the festival site directly.**
9. **All code in English** (variables, functions, comments). UI copy is localizable; language not yet locked.
10. **Privacy is per-group and time-boxed.** Sharing defaults to coarse, scoped to a group, and expires.

---

## 13. User Stories

**Favorites**
- As a festival-goer, I can browse all artists/stages/days and one-tap "want to see" so I capture everyone I like, overlaps included.
- As a user, I can browse favorites by artist, by stage, or by day.

**Closed timetable**
- As a user, I can start "close my timetable" and understand it will be one act per moment.
- As a user, for each time clash I see the conflicting acts side by side with genre/context and pick one; the next clash appears only after the chosen slot ends.
- As a user, I can split a slot ("watch A until 19:30, then go to B") and the app tells me whether the walk makes the transition work.
- As a user, I end with a conflict-free personal lineup for each day.

**Groups**
- As a user, I can create a group and invite friends; friends can join.
- As an owner, I can see members' plans and build a group timetable per slot (e.g., majority).
- As a member, when my locked pick doesn't match the group, the app offers one of my other favorited acts for that slot so I can stay with the group.

**Map / presence / meeting points**
- As an admin, I can place each stage on the map and set its area (center + radius).
- As a user, I can see friends grouped by stage with the act each stage is playing now.
- As a user, I can tap "where is everyone?" and friends get a one-tap, pre-filled reply.
- As a user, I can drop an exact "come to me" point with a photo and expiry; as a friend, I can navigate to it; the pin fades and archives over time.

---

## 14. V1 Scope

### In scope (V1)
- Lineup ingestion for **Tomorrowland 2026** (reference), via the structured source; auto-updater with change detection and affected-user alerts.
- Browse lineup + favorite (Pillar 1).
- Close timetable: chronological, one-at-a-time clash resolution → conflict-free personal lineup, **with partial-set transitions and travel-time validation** (Pillar 2).
- Groups + group timetable with closed-first / favorites-fallback matching, owner override, per-block follow/split, link/QR invites, and a **lightweight pinned group board** (Pillar 3, DEC-013).
- Stage map with **center + radius** areas; manual stage-to-stage travel-time matrix.
- Coarse presence by stage (at / near / between + confidence + expiry); current-artist auto-detection; group-by-stage view.
- "Where is everyone?" interactive push.
- Meeting points: exact point + photo + note + expiry + visibility + lifecycle states.
- Notifications (where-is-everyone, meeting points, lineup changes).

**Festival-context essentials (V1 — DEC-022), so the pillars are usable on-site:**
- **Offline-first** — lineup, my closed timetable, last-synced group plan, and cached map/POIs work with no signal.
- **"Now & Next" home** — glanceable: on now / my next pick / where it is / **when to leave** (walk-time countdown).
- **Walk-time-aware reminders** — push before a locked act, accounting for travel from the current/previous stage.
- **Battery-aware location** — adaptive GPS sampling + low-power mode + graceful "last known."
- **Practical POI map layer** (§8.1) — toilets, water, food, medical, exits, ATM, charging, lockers.
- **Meeting-point navigation** — compass arrow + distance (no turn-by-turn).
- **Fast favoriting onboarding** — swipe through the lineup to build Pillar 1 quickly.
- **Safety / "I'm lost"** — one tap shares exact location with the group + shows nearest exit/medical.

### Decided since definition (2026-06-23 council)
- **Stack** = web-first React/TS (PWA) + **Capacitor** for mobile (DEC-003); Pillars 1–2 can ship as a PWA first.
- **Backend** = **Cloudflare** (Workers+Cron, D1, Durable Objects, KV, R2) + **FCM** push (DEC-004).
- **Group mechanics** = auto-plan + owner override + per-block follow/split; **no in-app chat in V1** (DEC-013).
- **Privacy** = per-group, coarse, time-boxed; exact only via meeting points; purge windows (DEC-015).
- **Auth** = Firebase Auth, **anonymous-first**; upgrade to Google/Apple (email-link fallback) **required to use groups** (DEC-024).

### V1.x (soon after V1)
- Discovery / fill-empty-slots ("you have a gap; here's a no-clash gem").
- Group **split visualization** ("22:00: 4→MAINSTAGE, 2→CORE").
- **Undo / "what did I give up"** on clash decisions.
- Share my timetable as image/link.

### Later / V2 (not V1)
- **Polygon** stage areas (V1 is circles).
- **Learned** stage-to-stage travel times from aggregated movement.
- **Multiple festivals** at launch (design generic, but ship Tomorrowland first).
- Advanced group algorithms (weighting, smart proposals beyond majority + fallback); per-block voting.
- **Post-festival recap & set ratings/journal**; weather/sunset; crowd/heat levels; richer in-app comms.
- Monetization / accounts model beyond what groups require.

### Scope resolved (2026-06-23)
- **V1 = all 6 phases MUST SHIP** (DEC-023): live presence and meeting points are **non-negotiable** — the togetherness promise is core. All DEC-022 essentials ship in V1 (distributed across phases). See `implementation-phases.md`.
- **Group board = YES in V1** (DEC-013): a lightweight pinned board, no full real-time chat.
- App name = **FestPilot** (DEC-002); Pillar 2 = **"My Plan"** / verb **"Lock in"** (DEC-005).

---

## 15. Open Questions (not yet decided)

| # | Question | Why it matters | Decision ref |
|---|----------|----------------|--------------|
| ✓ | ~~Final V1 cut line~~ | RESOLVED — **all 6 phases MUST SHIP** in V1 | DEC-023 |
| ✓ | ~~Group note/board in V1?~~ | RESOLVED — **YES**, lightweight pinned board (no real-time chat) | DEC-013 |
| ✓ | ~~App name~~ | RESOLVED | DEC-002 — **FestPilot** |
| ✓ | ~~Name for the "closed timetable"~~ | RESOLVED | DEC-005 — **"My Plan"** (verb "Lock in") |
| ✓ | ~~Platform/stack~~ | RESOLVED | DEC-003 — web-first + Capacitor |
| ✓ | ~~Backend platform~~ | RESOLVED | DEC-004 — Cloudflare |
| ✓ | ~~Group coordination + algorithm~~ | RESOLVED | DEC-013 — auto-plan + override + per-block split |
| ✓ | ~~Privacy defaults~~ | RESOLVED | DEC-015 — per-group, coarse, time-boxed, purge |

---

## 16. Glossary

- **Lineup** — the full set of performances for a festival (artist + stage + day + times).
- **Favorite ("want to see")** — a wished act; overlaps allowed; not a commitment (Pillar 1).
- **My Plan** *(UI name; verb "Lock in")* — the conflict-free personal plan, one act per moment (Pillar 2). Internally also called the "closed timetable."
- **Clash** — two or more favorited acts overlapping in time on different stages.
- **Slot** — a resolved block in the closed timetable; may have a custom cut point for a partial set.
- **Group timetable** — the shared plan a group builds to stay together (Pillar 3).
- **Presence** — coarse, continuous location by stage (at / near / between + confidence).
- **Meeting point** — a temporary, exact, opt-in location with photo + expiry ("come to me").
- **Stage area** — the map region (circle in V1) that defines "you are at this stage."
- **Travel time** — minutes to walk between two stages, used for transitions and grouping.
- **event / uuid** — identifiers resolved from the official festival page that locate the structured lineup JSON; never hardcoded.

---

*See [decision-log.md](decision-log.md) for decisions and status. See [technical-direction.md](technical-direction.md) for stack and ingestion architecture. See [research/2026-06-23-festival-lineup-data-source.md](research/2026-06-23-festival-lineup-data-source.md) for the data-source study.*
