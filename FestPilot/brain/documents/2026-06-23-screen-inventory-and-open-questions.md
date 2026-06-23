# FestPilot — Screen Inventory & Open Questions (design-completeness audit)

> Created 2026-06-23. Purpose: an honest, complete map of **every screen V1 needs** vs. **what is actually
> designed/approved** (Amber Glass prototypes in `brain/wireframes/directions/`), plus the **real product
> doubts** the brain does not resolve. Trigger: Julio flagged that the app is **not ready to build** —
> whole surfaces (group creation, the group shared-timetable, and more) were never designed, and the
> implementation orchestrator was written before these gaps were mapped.
>
> **Consequence (locked):** the build does **not** start until (1) the missing screens are designed +
> approved and (2) the orchestrator is upgraded to be *screen-complete* (each phase lists its exact screens
>
> - acceptance). The brain stays product-truth; this doc drives the design-completion pass.
>
> Legend: ✅ designed & locked · 🟡 partial / needs its own screen · ❌ missing.

> **✅ RESOLVED (2026-06-23).** This audit did its job. Both gates it set are now met:
> (1) every missing surface was designed & approved across the **8-batch design pass** (prototypes `23`–`30`),
> and (2) the open questions are answered in **DEC-039** (see `2026-06-23-ui-decisions-locked.md` §§9–16).
> The definitive, build-facing reference is now **`2026-06-23-screen-catalog.md`** (all 59 screens → prototype →
> UC/DEC → orchestrator gate). This file is kept as the historical audit; the catalog + the locked decisions supersede it.

---

## 0. What IS solid already (so we don't redo it)

- **Product**: `product-spec.md` (3 pillars), **56 use-cases** (`documents/v1-use-cases.md`), all DEC-001..024.
- **Data**: full **28-table D1 schema** (`documents/v1-data-model-d1-schema.md`) — covers groups, invites, plan,
group_plan_slot, presence, meeting_point, board, notification. **No schema gap found.**
- **Backend**: Phase-1 ingestion + read API + cron **built & tested** (25 green). Lineup capture **validated by spike**
(`__NEXT_DATA_`_ → event+uuid → CDN JSON; 15 stages / 813 sets). Map engine + admin pin editor built (spike).
- **Visual identity**: **Amber Glass** locked (DEC-025) + UI rules (`documents/2026-06-23-ui-decisions-locked.md`).
- **Nav model (DEC-032)**: bottom tabs = **Now · Timetable · My Plan · Map · Squad**; **Lineup** is a sub-view of
Timetable (header icon), not a tab.

---

## 1. Designed & locked screens (9)


| #   | Screen                                                           | Prototype                       | Pillar/UC   |
| --- | ---------------------------------------------------------------- | ------------------------------- | ----------- |
| 1   | Onboarding (festival → weekend → days → swipe-favorite)          | `17-amber-onboarding-flow.html` | UC-13       |
| 2   | Home / "Now & Next"                                              | `18-amber-home.html`            | UC-27       |
| 3   | Timetable (stages × time grid)                                   | `15e-amber-timetable-tml.html`  | UC-10       |
| 4   | Lineup (artist list + filters)                                   | `22-amber-lineup.html`          | UC-10/14    |
| 5   | Lock in (multi-option + add-nearby search)                       | `12c-amber-lockin-search.html`  | UC-16/17    |
| 6   | Lock in celebration                                              | `13-amber-lockin-done.html`     | UC-17       |
| 7   | My Plan (vertical timeline + walk/breaks + share)                | `21-amber-myplan.html`          | UC-18/19    |
| 8   | Map (illustrated SVG + presence + meeting pin + route sheet)     | `19-amber-map.html`             | UC-24/43/49 |
| 9   | Squad (presence by stage + meeting-point compass + pinned board) | `20-amber-squad.html`           | UC-43/49/39 |


---

## 2. Partial — exists conceptually but needs its own designed screen (🟡)


| Screen                                             | Why it's not done                                                                              | UC/DEC            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------- |
| **Favorites view**                                 | only a filter on Timetable today; spec implies a real "my wishlist" surface                    | UC-14             |
| **Lock in — "all clashes" overview**               | DEC-005 says you can see every clash & jump to any; only the sequential flow is designed       | DEC-005           |
| **Partial-set / split editor**                     | "behind split set" in the lock-in spec, but no designed UI (cut point + transition validation) | UC-18             |
| **Map POI layer** ("nearest toilet/water/medical") | Map screen has stages/presence but not the practical POI layer + nearest search                | UC-26/30, DEC-022 |
| **Meeting-point lifecycle / detail**               | nav exists; create + member-status + fade/expiry states not designed                           | UC-50/51          |


---

## 3. Missing screens (❌) — grouped by area

### 3a. Groups — formation (Pillar 3a) — *the gap Julio named*

- Squad **empty state** → Create / Join (when you have no group)
- **Create group** (name, festival) — UC-31
- **Invite** — link **+ QR** — UC-32
- **Join group** (open invite link/QR; triggers the auth upgrade) — UC-33
- **Members list** (roles, leave, owner remove) — UC-34
- **Share my plan with the group** — UC-35

### 3b. Groups — the shared **group timetable** (Pillar 3a) — *the other gap Julio named*

- **Group timetable** screen: per block → auto pick (plurality) + tally, **owner override**, **per-block follow / do-my-own**,
**favorites-fallback** offer, "**group → X, you're locked Y · [Join]/[Keep]**", **split visualization** — UC-36/37/38

### 3c. Presence & consent (Pillar 3b)

- **GPS consent pre-prompt** (value-first copy, DEC-015) — UC-40
- **Sharing-mode controls** per group (off / while-using / live-until) + **"disappear from map"** — UC-46
- **"Where is everyone?"** ask + the **interactive reply** surface (in-app, mirrors the push) — UC-44/45

### 3d. Meeting points & safety (Pillar 3c)

- **Create meeting point** sheet (photo + note + expiry 10/20/30/60 + visibility group/selected) — UC-48
- **Meeting-point detail** + member status (going/arrived/left) — UC-50
- **Safety / "I'm lost"** flow (share exact location + nearest exit/medical) — UC-52

### 3e. Identity, account & settings

- **First-run / splash** + **notification** permission pre-prompt
- **Sign-in / account** (anonymous by default; upgrade to Google + email-link; Apple = iOS later) — UC-07, DEC-024
- **Anonymous → permanent upgrade** flow (the group gate) — DEC-024
- **Profile** (display name + avatar — used by presence/squad)
- **Settings** (notifications, sharing, **language PT/EN**, theme auto/day/night, account, disappear-from-map) — UC-09

### 3f. Notifications & system states

- **In-app notification center / inbox** — UC-53..56 (a `notification` table already exists)
- **Lineup-change alert → re-resolve plan** (an act you locked moved → fix the new clash) — UC-20/UC-54
- **Offline / stale-data** banners ("possibly stale lineup"), and global **loading / empty / error** states

### 3g. Admin (separate **desktop web** app — scope TBD, see Q-I)

- Admin shell + auth
- **Map**: KML import + stage placement (center+radius) + verify — *spike exists, not productized* 🟡
- **Lineup dashboard**: trigger ingest, view import runs / changes / revision
- **Travel-time matrix** editor — UC-24
- **POI management** — UC-26
- **Stage-alias** management — UC-23
- Festival management (create/edit a festival)

> Rough count: **9 designed** vs **~25 missing/partial** app+admin surfaces. The personal core is designed;
> the **entire social layer (Pillar 3), identity/settings, safety, notifications, system states, and admin** are not.

---

## 4. Open product questions (the real doubts — brain doesn't resolve these)

> Each has a **recommended default** so you can confirm fast. Answers feed the design pass + a DEC.

- **Q-A — Group-plan time-block granularity** (explicitly deferred in use-cases). *Rec:* align blocks to **performances/set
boundaries** (not fixed 30/60-min), since clashes are per-set. Confirm.  
confirm  

- **Q-B — Group-plan interaction model.** *Rec:* auto-plan is visible to everyone; **each member follows/does-own per block**;
**owner can override** any block; members don't vote in V1. Confirm.  
confirm  

- **Q-C — Favorites surface.** *Rec:* a dedicated **"My wishlist"** screen **and** the Timetable "only my favs" filter.  
why the screen? we can use the line up table to show all djs and then only the favorites, grid view probably..  

- **Q-D — Lock in structure.** *Rec:* keep the sequential flow **plus** an "**All clashes**" overview screen; the **split
editor** is a **sheet**, not a full screen.  
ok  

- **Q-E — V1 web auth set.** *Rec:* **anonymous + Google + email-link** on web; **Apple added with the iOS build**; upgrade
is triggered **only** when creating/joining a group. Confirm.  
sem apple nativo, depois vamos fazer nativo só para android.  

- **Q-F — Profile/avatar.** *Rec:* ask **display name + avatar** at the **first group join** (and editable in Settings);
avatar = **upload or initials** (no preset gallery in V1).  
yes  

- **Q-G — Notification center.** *Rec:* a **light in-app inbox** in V1 (the table exists) + contextual banners; OS push is primary.  
ok  

- **Q-H — Safety / "I'm lost" placement.** *Rec:* a persistent action in **Squad** (and surfaced on **Map**); confirm.  
ok  

- **Q-I — Admin V1 scope.** *Rec (minimum to operate Tomorrowland):* **map/stage verify + lineup dashboard** in V1;
travel-time matrix + POI mgmt as **simple editors**; alias mgmt only if needed. Bigger admin = post-V1.  
ok  

- **Q-J — Map POI layer in V1.** *Rec:* **yes** (DEC-022) — design "nearest toilet/water/medical" into the Map screen.  
yes, and stage to stage..  

- **Q-K — Default language.** *Rec:* **auto-detect device**, default **PT**, switch in Settings; all copy via i18n.  
ok, default english, but get from  settings.  

- **Q-L — Breaks in My Plan** (food/toilet/drinks). *Rec:* keep as first-class plan items (already in `21`). Confirm.  
ok

---

## 5. Proposed plan to get truly build-ready

1. **Answer §4** (or accept defaults).
2. **Design pass** — build the missing/partial screens as **Amber Glass interactive HTML prototypes** (same as today),
  reviewed in **batches**: (B1) Groups formation → (B2) Group timetable → (B3) Presence & consent →
   (B4) Meeting points & safety → (B5) Identity/account/settings/profile → (B6) Personal gaps + notifications + states →
   (B7) Map POI layer → (B8) Admin (per Q-I).
3. **Update the brain** — extend `ui-decisions-locked.md`, add a **screen catalog** + a `design-system.md`, and map every
  **UC ↔ screen**.
4. **Upgrade the orchestrator** — rewrite phases so each one lists its **exact screens + per-screen acceptance**, grounded
  in this inventory (fixing the original shallow version).
5. **Then build.**

---

*Companion: `v1-use-cases.md` (UCs), `v1-data-model-d1-schema.md` (entities), `2026-06-23-ui-decisions-locked.md`
(visual rules), `2026-06-23-v1-implementation-orchestrator.md` (to be upgraded after the design pass).*