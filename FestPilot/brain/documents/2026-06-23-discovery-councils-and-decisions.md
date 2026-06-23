# Discovery Councils & Decisions — 2026-06-23

> Last updated: 2026-06-23
> Ran **inline in one request, no subagents** (per `inline-council-no-subagents.mdc`). This document captures a festival-goer **brainstorm** plus the **decision councils** that advance the open decisions (DEC-002/003/004/005/013/015) and adds the map seed (DEC-021) and the V1 "festival-context essentials" (DEC-022). Role reasoning was drafted blind; the Chair synthesis is the only pass that weighs all roles together.

---

## Part A — Brainstorm: what festival-goers actually need

**Mode:** `/brainstorm` · Visionary · Analyst · Connector · Simplifier.

### Decision Brief (neutral)
FestPilot already specs three pillars: Favorites → Closed Timetable (chronological clash resolution + partial sets + walking time) → Groups (shared timetable, coarse presence, "where is everyone?", meeting points). Reference festival: Tomorrowland; we now have a map seed (10 stages + DreamVille areas/entrances). Question: **beyond the three pillars, which functions are genuinely important/necessary for festival-goers and would help a lot?** Bias to resist: feature-greed; the festival context is hostile (no signal, dying battery, sunlight, one free hand, intoxicated users), so "cool" features that aren't usable on-site are liabilities.

### Perspectives (written blind)

**Visionary** — Imagine the app as a co-pilot whispering the right move at the right second. The 10x ideas: a **"Now & Next" cockpit** that always answers "what's on, what's mine next, when do I leave, which way"; **smart discovery** ("ARTBAT-like act playing now 4 min away, and you have a gap"); a **post-festival recap** ("your weekend in sets") that drives next-year retention; and a **safety net** ("I'm lost / get me to my group / nearest medical+exit"). Rec: lead with the cockpit + discovery. Confidence: MED. Others miss: the app's emotional peak is *finding your friends in chaos* — invest there, not in more lists.

**Analyst** — Evidence from festival apps (Tomorrowland's own, Clashfinder, Coachella, Glastonbury): the most-used features on-site are **personal schedule + set reminders + offline + map**, not social feeds. Reminders must be **walk-time-aware** ("leave in 6 min to make ARTBAT") or they're noise. Offline is non-negotiable: cell networks collapse at peak. Battery is the silent killer → location must be adaptive/low-power. Rec (ranked): offline-first, now/next + leave-now reminders, cached map w/ POIs, battery-aware GPS. Confidence: HIGH. Others miss: a feature that needs live network at 22:00 Saturday effectively **doesn't exist**.

**Connector** — Borrow from other domains: **Google Maps' "leave now" + arrow-to-destination** (no turn-by-turn needed, just a compass arrow + meters to a meeting point); **Tinder's swipe** for fast favoriting a 300-artist lineup; **Strava/Spotify Wrapped** for the recap; **airport apps** for the practical layer (toilets/water/medical/exits/ATM/charging) and **"gate closes"** urgency framing for set start. Rec: swipe-to-favorite onboarding + arrow-nav to meeting points + practical POI layer. Confidence: MED-HIGH. Others miss: the POI map ("nearest toilet/water") is a top real-world need and we already have seed data for it.

**Simplifier** — The 20% that delivers 80%: one **glanceable home** (now/next/where/when-to-leave), **reminders**, **offline**, and **find-my-group**. Everything else is optional. Cut: in-app chat (people have WhatsApp), heavy voting, social feeds, gamified badges. A festival user looks at the phone for 5 seconds in the sun — if the answer isn't immediate, the feature failed. Rec: ship a tiny, fast, offline cockpit; defer the rest. Confidence: HIGH. Others miss: every added screen is a tax paid in sunlight + 10% battery.

### Red Team (kill the leading idea = "add many features")
The seductive failure is treating the brainstorm as a feature shopping list and bloating V1. At a festival, scope creep is *actively harmful*: more code paths that break offline, more battery drain, more taps. In particular **in-app group chat** is a trap — half a WhatsApp, used by no one, but expensive to build and moderate. The real output of this brainstorm is **not "more"** — it's a short set of *survival* features that make the three pillars usable on-site.

### Synthesis (Chair)
- **Consensus:** the highest-value additions are **context-survival** features, not social ones — offline, glanceable now/next, walk-time reminders, battery-aware location, a practical POI map, and frictionless find-your-group.
- **Tensions:** Visionary wants discovery + recap (delight/retention); Simplifier wants to cut almost everything; Analyst sides with "boring but essential first." For a **one-weekend, hostile-context** app, Analyst+Simplifier carry the most weight → essentials in V1, delight in V1.x.
- **Recommendation — prioritized:**
  - **MUST (V1, makes the pillars usable on-site):**
    1. **Offline-first** — lineup, my closed timetable, last-synced group plan, and cached map all work with no signal.
    2. **"Now & Next" home** — glanceable: on now / my next pick / where it is / **when to leave** (walk-time countdown).
    3. **Walk-time-aware reminders** — push before a locked act, accounting for travel time from the previous/ current stage.
    4. **Battery-aware location** — adaptive GPS sampling + low-power mode + graceful "last known."
    5. **Practical POI map layer** — toilets, water, food, medical, exits, ATM, charging, lockers — seeded from the KML (DEC-021), admin-verified.
    6. **Meeting-point navigation** — compass **arrow + distance** to the point (no turn-by-turn).
    7. **Fast favoriting onboarding** — swipe through the lineup to build Pillar 1 quickly.
    8. **Safety / "I'm lost"** — one tap shares exact location with the group + shows nearest exit/medical.
  - **SHOULD (V1.x):** discovery / fill-empty-slots ("you have a gap; here's a no-clash gem"); group **split visualization** ("22:00: 4→MAINSTAGE, 2→CORE"); **undo / "what did I give up"** on clash decisions; share my timetable as image/link.
  - **LATER (V2):** post-festival recap & set ratings/journal; weather/sunset; crowd/heat levels; richer comms; learned travel times.
- **Conditions:** every MUST item must be designed offline-first and battery-cheap, or it drops to SHOULD.
- **What would flip it:** if V1 deliberately ships **only Pillars 1–2** (validate the clash-resolution magic with zero on-site features), then items 1–8 mostly defer and the MUST list shrinks to offline + reminders. Minority-wins scenario: Visionary's recap/discovery becomes the priority if the goal is *retention/marketing* over *on-site utility*.
- **Confidence:** HIGH that the MUST set is the right on-site essentials; MEDIUM on exact V1 cut line (depends on Julio's V1 ambition).

> Captured as **DEC-022** (festival-context essentials are V1-critical) + SHOULD/LATER recorded in product-spec §14.

---

## Part B — Council: Platform/stack (DEC-003) + Backend (DEC-004)

**Mode:** `/assess` + `/council` (combined — the two are coupled). Architect · Critic · Advocate · Cost/Timeline.

### Decision Brief (neutral)
FestPilot needs: foreground (and ideally light background) GPS, **interactive push with the app closed** (the "where is everyone?" ping must arrive), **offline-first**, a map, photo upload (meeting points), and a backend for groups/presence/scheduled lineup ingestion + change detection + push fan-out. Julio is strong in JS/TS and already has Cloudflare tooling/skills. Bias to resist: "just a PWA because it's fastest" — that would gut Pillar 3, which is the differentiator.

### Perspectives (written blind)

**Architect** — The hard requirements land exactly where PWAs are weakest, especially on iOS (background location, notification *actions*, reliable push when closed). A **web UI (React+TS) wrapped in Capacitor** keeps one codebase Julio moves fast in while exposing native geolocation + push plugins. React Native is "more native" but discards web reuse and adds a new surface. Rec: **web-first + Capacitor**. Confidence: HIGH. Others miss: Pillars 1–2 can ship as a **pure PWA first**, then the same code gets a Capacitor shell when Pillar 3/location starts — no rewrite.

**Critic** — The real trap is betting on *background* tracking. Android Play Store gates background location to apps where it's core (review risk); iOS restricts it hard. Over-promise "always tracking" → rejection, battery rage, broken trust. The architecture that actually works is **foreground GPS + push-reply fallback** (already DEC-012). So the stack must nail *foreground* location + interactive push — Capacitor does, without RN's cost. Confidence: MED-HIGH. Others miss: store **policy/review** risk is a bigger threat than framework choice; design presence so it never *depends* on background GPS.

**Advocate (user)** — It's a one-weekend app; install friction exists but people will install a festival app from the store. The dealbreaker is the **ping not arriving** when the app is closed → a pure PWA kills Pillar 3. A store-installed Capacitor app delivers push reliably and can cache for offline. Rec: native shell. Confidence: MED. Others miss: onboarding must be instant (link/QR group join) or the social loop never starts, regardless of stack.

**Cost/Timeline** — Capacitor reuses ~all web code → cheapest route to native capability; RN = rebuild UI; pure PWA = cheap but can't deliver Pillar 3 (false economy). Backend: **Cloudflare** fits the exact workload — Workers + **Cron Triggers** (the lineup updater), **D1** (relational), **Durable Objects** (per-group presence/realtime), **KV** (hashes/snapshots), **R2** (meeting-point photos) — and Julio already has the skills/tooling → lowest ops + cost. Node+Postgres is familiar but more to run. Rec: **Capacitor + Cloudflare**. Confidence: HIGH.

### Red Team (kill "Capacitor + Cloudflare")
If V1 ships only Pillars 1–2 to validate clash-resolution, a **pure PWA + minimal backend** is enough and faster — committing to Capacitor now is premature. Counter: the **lineup model + auto-updater need a server regardless**, and choosing Capacitor doesn't slow the web build of Pillars 1–2. So the hedge costs nothing: build web-first, stand up the Cloudflare backend now (you need ingestion anyway), add the Capacitor shell at Pillar 3.

### Synthesis (Chair)
- **Consensus:** don't bet on background GPS; do guarantee interactive push + offline; reuse the web stack.
- **Tensions:** Critic/Cost would happily start PWA-only; Advocate/Architect insist Pillar 3 needs the native shell. Resolved by **sequencing**, not picking one.
- **Recommendation:**
  - **Stack (DEC-003): Web-first React + TypeScript (PWA), wrapped with Capacitor for the mobile build.** Pillars 1–2 run as a PWA immediately; add the Capacitor shell when location/push (Pillar 3) begin. Rejects RN (rewrite) and pure-PWA-forever (kills Pillar 3). Weightiest lens = Architect + Cost (capability per unit effort).
  - **Backend (DEC-004): Cloudflare** — Workers + Cron Triggers, D1, Durable Objects, KV, R2. Fits scheduled ingestion + per-group realtime + push + photos; Julio has the tooling.
  - **Push: FCM** via the Capacitor plugin (cross-platform, interactive actions).
- **Conditions:** presence must work on **foreground GPS + push-reply**, never *require* background location (keeps us store-compliant).
- **What would flip it:** if Julio wants Pillars 1–2 validated as a **zero-install pure web app**, start PWA-only and defer the Capacitor decision — **the Cloudflare backend choice stands either way.**
- **Confidence:** HIGH (backend = Cloudflare; web-first + Capacitor over RN). These are reversible-early, so marked APPROVED with an explicit "confirm/can change" door.

---

## Part C — Council: Group coordination mechanics (DEC-013)

**Mode:** `/council`. Strategist · Architect · Critic · Advocate.

### Decision Brief (neutral)
How does a group build & broadcast its shared timetable, and how do members confirm/vote? Existing direction (DEC-019): match on members' closed timetables first, favorites as fallback; majority is one candidate for each block. Julio is explicitly unsure and worried about top-down ("owner decides all") vs chaos ("everyone votes everything"). Typical group = 4–8 friends. Bias to resist: building heavy governance/voting for a handful of friends.

### Perspectives (written blind)

**Strategist** — The group plan's job is **social glue**, not democratic perfection; success = more time together, less arguing. So default to a **transparent computed suggestion** the group can nudge, not a blank-slate vote. Crucially, the plan is **per-block opt-in to follow** — members keep their own closed timetable and "follow group" only where they want. Confidence: MED-HIGH. Others miss: framing splitting as normal (not failure) is what keeps groups using it.

**Architect** — Compute per time block: tally members' locked picks → **plurality act wins** the block; for members whose lock ≠ winner, surface their best **favorite** at that block matching the winner / same-or-adjacent stage (DEC-019). Persist `GroupTimetableSlot{ chosenPerformanceId, method: auto|owner, tally }`; **recompute + revision-bump** when members change plans. A **Durable Object per group** holds state — no heavy realtime voting infra. Handle ties / no-majority (small groups) → most-favorited across the group, else owner pick. Confidence: HIGH. Others miss: define the tie/empty-majority rule explicitly or small groups produce nonsense.

**Critic** — **Majority tyranny:** 4 house fans outvote 2 techno fans every slot → the 2 feel dragged → they ignore the plan → Pillar 3 dies. "Owner builds it" makes the owner a bottleneck and others passive. Mitigations: (1) **never silently override a member's locked must-see** — show "group → X, you're locked on Y · [Join group] / [Keep mine]"; (2) make **per-block follow/leave first-class** and **show the split** ("22:00 split: 4→MAINSTAGE, 2→CORE") instead of forcing consensus. Confidence: HIGH. Others miss: splitting up for a slot is the *normal* festival behavior — surface it, don't fight it.

**Advocate (user)** — Real groups coordinate via chat + a leader nudging. The minimum that helps: an **auto group plan** they can see, a one-tap **"I'm in / I'll do my own"** per block, and a clear **split view**. Heavy voting = friction nobody uses mid-festival. Also: **invites must be dead simple** (link/QR) or the group never forms. Confidence: HIGH. Others miss: without frictionless invite + a visible "what's the group doing right now," the whole pillar stalls.

### Red Team (kill "auto-plan, the app decides")
A purely auto-generated plan can feel robotic/wrong, and the owner will want final say. Counter: keep an **owner override per slot** (`method: owner`) layered on top of the auto suggestion — auto by default, human when needed. Best of both, low complexity.

### Synthesis (Chair) — DEC-013 decided for V1
- **Consensus:** auto-generate a transparent group plan; make following it optional per block; show splits; keep comms light.
- **Tensions:** Critic's "protect the minority / show splits" vs a naive majority. Resolved by per-block follow + never overriding locked picks + owner override.
- **Recommendation — V1 group mechanics:**
  1. **Auto plan:** per block, **plurality of members' locked picks** → block winner; **tie / no-majority → most-favorited across the group**, else **owner picks**.
  2. **Member fallback (DEC-019):** if your lock ≠ winner, offer your best favorite at that block (same/adjacent stage) so you stay together and still like it.
  3. **Per-block follow / do-my-own**, with **split visualization** — splitting is shown, never prevented.
  4. **Owner override** per slot (`method: owner`) on top of the auto suggestion.
  5. **Never silently override a locked must-see:** always "group → X, you're locked Y · [Join] / [Keep]."
  6. **Comms light in V1:** group plan + reactions + the where-is-everyone / meeting-point flows. **No full in-app chat in V1** (defer; people use WhatsApp) — *confirm with Julio* (he may want a pinned note/board).
  7. **Invites:** share **link + QR**.
- **Conditions:** group state lives in a per-group Durable Object (DEC-004); recompute is revision-bumped so clients refresh.
- **What would flip it:** if Julio wants the group to feel *democratic*, add lightweight per-block voting in V1.x; if he wants it *curated*, lean the default to owner-built with auto as a suggestion.
- **Confidence:** HIGH on auto + override + per-block split + no-chat-V1; the chat scope is the one item to confirm.

---

## Part D — Naming (DEC-002 app, DEC-005 closed-timetable) — recommendations

These are **taste calls** (Julio's to make), so this is a recommendation + options, not a forced decision. Both are cheap to change (a few files).

- **App name (DEC-002):** recommend **keep "FestPilot"** — clean parallel to TripPilot (a brand family), memorable, not category-limited (it does favorites/groups/map, not only clashes). Alternatives if a fresh identity is wanted: *Clashless, Lineup, Setlist, Headliner, MyFest, SquadUp, Reunite*. Confidence: MED (preference).
- **"Closed timetable" name (DEC-005):** the concept = your **final, conflict-free, one-act-per-moment plan**. Recommend the noun **"My Plan"** built by the verb **"Lock in"** ("Lock in your Saturday") — the gamified clash flow already feels like locking choices. Keep Pillar 1 as **"Want to see" / Favorites** to avoid confusion. Alternatives: *My Lineup, My Schedule, Setlist, Game Plan, My Route, Final Cut*. Confidence: MED (preference).

> Both remain **PENDING** pending Julio's pick (offered in the closing question).

---

## Part E — Privacy defaults (DEC-015) — resolved

General posture was set by DEC-006/007/008/014 and Julio's GPS message. Finalized V1 defaults:

- **Scope:** sharing is **per active group only** (never global); presence is **coarse** (stage / near / between + confidence + expiry).
- **Modes:** manual-only · while-using-the-app · opt-in **live-during-festival** (time-boxed, e.g. "share with this group until 03:00").
- **Exact coordinates:** only ever via **meeting points** (opt-in, expiring) and the **safety/"I'm lost"** action.
- **Retention:** raw `lat/lng` server-only, used to compute the coarse stage, then **not exposed and aggressively purged** (keep only the last fix to compute presence); presence rows expire per DEC-008 (GPS ~15 min, manual/push-reply ~45 min) and purge after the festival day; meeting points archive (who-went record kept) and purge after the weekend.
- **"Disappear from map":** one toggle that immediately stops sharing to all groups and hides your marker.
- **Consent pre-prompt copy (value-first):** *"See where your group is and let them find you. Your exact spot is never shared unless you tap 'come to me.' You only share with your group, and you can stop anytime."*
- **Status:** APPROVED.

---

## Part F — Map seed (DEC-021)

Use the community **Google My Maps KML** ("TML 22 + Dreamland") as an **unverified seed**: import → auto-match the **10 high-confidence stages** → flag **5 old venues** (Harbour House, Mesa Garden, Youphoria, LEAF, Kara Savi) for review via a **StageAlias** table → admin verifies location + radius → DreamVille areas/entrances seed the **practical POI layer**. Coordinates are `lng,lat`. Full study + data + shapes: `../research/2026-06-23-festival-map-seed-kml.md`. **Status:** APPROVED.

---

## Decisions summary (this session)

| DEC | Topic | Before | After | Notes |
|-----|-------|--------|-------|-------|
| DEC-002 | App name | PENDING | PENDING | Recommend keep "FestPilot"; Julio to confirm |
| DEC-003 | Platform/stack | PENDING | **APPROVED** | Web-first React/TS (PWA) + **Capacitor**; PWA-first for Pillars 1–2 |
| DEC-004 | Backend | PENDING | **APPROVED** | **Cloudflare** (Workers+Cron, D1, Durable Objects, KV, R2); FCM push |
| DEC-005 | "Closed timetable" name | PENDING | PENDING | Recommend **"My Plan" + "Lock in"**; Julio to confirm |
| DEC-013 | Group mechanics | PENDING | **APPROVED** | Auto-plan + owner override + per-block follow/split; no chat in V1 (confirm) |
| DEC-015 | Privacy defaults | PENDING | **APPROVED** | Per-group, coarse, time-boxed; exact only via meeting points; purge windows |
| DEC-021 | Map seed (KML) | — (new) | **APPROVED** | Unverified seed; alias table; admin verifies; seeds POI layer |
| DEC-022 | Festival-context essentials | — (new) | **APPROVED** | Offline-first, Now&Next + leave-now, battery-aware GPS, POI map, mp-nav, swipe-favorite, safety |

Remaining PENDING after this session: **DEC-002** and **DEC-005** (both naming, Julio's pick).
