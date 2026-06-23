# FestPilot — Screen Catalog (V1, screen-complete)

> Created 2026-06-23 after the 8-batch design pass. **Purpose:** the definitive list of **every V1 screen**, each
> mapped to its **prototype**, the **use-cases/decisions** it serves, and the **phase/gate** that builds it. This is
> what the orchestrator's §13 references so each gate is *screen-complete*.
> Supersedes the audit in `2026-06-23-screen-inventory-and-open-questions.md` (now historical).
> Prototypes: `brain/wireframes/directions/` (open `index.html`). Tokens/components: `2026-06-23-design-system.md`.
> Visual rules: `2026-06-23-ui-decisions-locked.md`. Answers driving the new screens: **DEC-039**.

**Totals:** **59 screens** = 9 pre-existing + 50 new (B1–B8). Mobile = 53; Admin desktop = 6.
Status: ✅ designed & locked (all). Build status tracked in `dev-log.md`.

---

## Legend
`Proto` = prototype file (`NN-amber-*.html`) · `Gate` = orchestrator §13 phase.gate that implements it.

---

## A. Personal core (Pillars 1–2) — pre-existing + gaps now closed

| # | Screen | Proto | UC / DEC | Gate |
|---|--------|-------|----------|------|
| A1 | Onboarding (festival → weekend → days → swipe-favorite) | `17` | UC-04/05, DEC-028 | P2 G2.1 |
| A2 | Home / "Now & Next" (countdown, when-to-leave) | `18` | UC-12/27, DEC-022 | P1 G1.1 shell · P3 G3.3 |
| A3 | Timetable (stages × time grid) | `15e` | UC-10, DEC-026/027/032 | P2 G2.2 |
| A4 | Lineup (artist list + filters; favorites grid) | `22` | UC-10/14, DEC-032 | P2 G2.2 |
| A5 | Lock in (multi-option + add-nearby search + "all clashes") | `12c` | UC-16/17, DEC-005/017 | P2 G2.3 |
| A6 | Lock in celebration | `13` | UC-17 | P2 G2.3 |
| A7 | My Plan (vertical timeline + walk + breaks + share) | `21` | UC-18/19, DEC-039 Q-L | P2 G2.3 |
| A8 | Personal gap filler (favorite/popular/break) | `28`#1 | gaps, DEC-039 Q-L | P3 G3.3 |

---

## B1. Squad formation (Pillar 3a) — `23`

| # | Screen | Proto | UC / DEC | Gate |
|---|--------|-------|----------|------|
| B1.1 | Squad empty state → Create / Join | `23`#1 | UC-31 | P4 G4.2 |
| B1.2 | Sign-in gate (anon → Google/email-link) | `23`#2 | UC-07, DEC-024/039 Q-E | P4 G4.1 |
| B1.3 | Profile setup (name + avatar at first join) | `23`#3 | DEC-039 Q-F | P4 G4.1 |
| B1.4 | Create squad (name, festival, cap 50) | `23`#4 | UC-31, DEC-038 | P4 G4.2 |
| B1.5 | Invite (link + QR; link no-expiry until event ends) | `23`#5 | UC-32, DEC-038 | P4 G4.2 |
| B1.6 | Join squad (open link/QR → auth upgrade) | `23`#6 | UC-33, DEC-024 | P4 G4.2 |
| B1.7 | Members list (roles, leave, owner remove) | `23`#7 | UC-34 | P4 G4.2 |
| B1.8 | Share my plan with the squad | `23`#8 | UC-35 | P4 G4.3 |

---

## B2. Group shared timetable (Pillar 3a) — `24`

> All: UC-36/37/38, DEC-013/019/039 Q-A/Q-B. **Gate P4 G4.3.** Blocks = per-set boundaries; auto = plurality;
> per-block follow/own; owner override; **never silently change a locked must-see**; favorites-fallback; split shown.

| # | Screen | Proto |
|---|--------|-------|
| B2.1 | Squad plan overview (per-set blocks, tally, follow/own/locked status, NOW line) | `24`#1 |
| B2.2 | Block detail (the split + Join / Keep / owner Override) | `24`#2 |
| B2.3 | Locked conflict + favorites-fallback ("group→X, you locked Y · Join/Keep") | `24`#3 |
| B2.4 | Owner override (set squad pick; revertible to auto) | `24`#4 |
| B2.5 | Split view (who's at each stage; CTA → meeting point) | `24`#5 |
| B2.6 | Needs-input / nudge (auto-plan needs locked plans) | `24`#6 |

---

## B3. Presence & consent (Pillar 3b) — `25`

> UC-40/44/45/46, DEC-007/008/012/015/039 Q-H/Q-K. Coarse by default; precise opt-in **60-min auto-expiry**;
> squad-only; foreground only. **Gate P5.**

| # | Screen | Proto | Gate |
|---|--------|-------|------|
| B3.1 | Consent pre-prompt (value + privacy promises) | `25`#1 | P5 G5.1 |
| B3.2 | OS permission dialog moment (coaching hint) | `25`#2 | P5 G5.1 |
| B3.3 | Sharing mode (Stage default / Precise 60m / Ghost) | `25`#3 | P5 G5.3 |
| B3.4 | Where's the squad (map peek + roster, live/coarse/offline, Ping/Nudge) | `25`#4 | P5 G5.2 |
| B3.5 | Precise-sharing-active control (countdown, audience, extend/downgrade/stop) | `25`#5 | P5 G5.1/5.3 |
| B3.6 | Location & privacy settings (master switch, default mode, expiry, pause-all) | `25`#6 | P5 G5.3 |

---

## B4. Meeting points & safety (Pillar 3c) — `26`

> UC-48/50/52, DEC-014/015/039 Q-H. Exact coords leave the device **only** via meeting point or safety action.
> **Gate P6.**

| # | Screen | Proto | Gate |
|---|--------|-------|------|
| B4.1 | Create — pick spot (drag pin / quick-pick) | `26`#1 | P6 G6.1 |
| B4.2 | Create — details (name / when / who / note) | `26`#2 | P6 G6.1 |
| B4.3 | Meeting detail — active (convergence map + live ETAs + here/no-response) | `26`#3 | P6 G6.2 |
| B4.4 | Lifecycle (everyone-here / on-the-way / expired / cancelled) | `26`#4 | P6 G6.2 |
| B4.5 | "I'm lost" menu (share+alert / nearest landmark / medical-info-exit / call) | `26`#5 | P6 G6.3 |
| B4.6 | Safety active broadcast (squad converging + nearest help + I'm-okay) | `26`#6 | P6 G6.3 |

---

## B5. Identity, account & settings — `27`

> UC-07/09, DEC-024/039 Q-E/Q-F/Q-K. Anonymous-first; Google + email-link; **no Apple/iOS — native is Android-only**.

| # | Screen | Proto | Gate |
|---|--------|-------|------|
| B5.1 | Sign-in (Google / email-link / guest) | `27`#1 | P4 G4.1 |
| B5.2 | Magic-link sent (passwordless email) | `27`#2 | P4 G4.1 |
| B5.3 | Edit profile (avatar upload/initials + name) | `27`#3 | P4 G4.1 |
| B5.4 | Account (guest→save, sign out, delete account & data) | `27`#4 | P4 G4.1 |
| B5.5 | Settings hub (account · notifications · location&privacy · language · appearance · legal · version) | `27`#5 | P1 G1.1 (grows per phase) |
| B5.6 | Language (EN default / PT) & appearance (Auto/Day/Night) | `27`#6 | P1 G1.1 · P3 |

---

## B6. Notifications & system states — `28`

| # | Screen | Proto | UC / DEC | Gate |
|---|--------|-------|----------|------|
| B6.1 | Personal gap filler (also listed A8) | `28`#1 | gaps, DEC-039 Q-L | P3 G3.3 |
| B6.2 | Notification inbox (reminders/clash/pings/meeting/squad) | `28`#2 | UC-53..56, DEC-039 Q-G | P3 G3.4 |
| B6.3 | Alert preferences (reminders+lead, walk alerts, clash, pings, squad) | `28`#3 | UC-14, DEC-039 Q-G | P3 G3.4 |
| B6.4 | OS push (lock screen — push primary) | `28`#4 | UC-14/54, DEC-039 Q-G | P3 G3.4 |
| B6.5 | Offline / sync (cached plan usable; edits auto-sync) | `28`#5 | DEC-022 | P1 G1.1 · P3 G3.3 |
| B6.6 | System states (empty / loading skeleton / error+retry) | `28`#6 | global | P1 G1.1 (reused all phases) |

---

## B7. Map POI layer & stage routing — `29`

> UC-26/30, DEC-022/030/034/039 Q-J. Built on the georeferenced SVG + affine overlay (same as `19`). **Gate P3.**

| # | Screen | Proto | Gate |
|---|--------|-------|------|
| B7.1 | Map + POI layer (filter chips, layers FAB) | `29`#1 | P3 G3.4 |
| B7.2 | Nearest essentials (toilet/water/medical/ATM) | `29`#2 | P3 G3.4 |
| B7.3 | POI detail (crowd/accessibility → navigate/meeting/share) | `29`#3 | P3 G3.4 |
| B7.4 | Stage-to-stage routing (walk time + "leave by" nudge) | `29`#4 | P3 G3.2/3.3 |
| B7.5 | Walking navigation (next move, distance, landmark, friends) | `29`#5 | P3 G3.3 |
| B7.6 | Map layers / legend (toggles + day/night) | `29`#6 | P3 G3.4 |
| (—) | Map base (illustrated SVG + presence + meeting pin + route sheet) | `19` | UC-24/43/49 | P3 G3.2 |

---

## B8. Admin (desktop web) — `30`

> UC-23/24/26, DEC-034/035/039 Q-I. Separate desktop app to onboard any festival. **Map verify = source of truth.**

| # | Screen | Proto | Gate |
|---|--------|-------|------|
| B8.1 | Festivals overview (health + KPIs + add festival) | `30`#1 | Admin track (P3+) |
| B8.2 | Lineup dashboard (source = documented capture, counts, verify, alias, re-import) | `30`#2 | P1/P3 ingest ops |
| B8.3 | **Map editor — drag stage pins → Generate SVG** (productized `generateMap`) | `30`#3 | P3 G3.1 |
| B8.4 | Georeference / verify (3-point affine SVG↔GPS; fix off-position stages) | `30`#4 | P3 G3.1 |
| B8.5 | POI editor (click-to-place) | `30`#5 | P3 G3.4 |
| B8.6 | Travel-time matrix (auto-estimate + manual overrides) | `30`#6 | P3 G3.3 |

---

## Coverage notes
- **Nav (DEC-032):** 5 tabs (Now · Timetable · My Plan · Map · Squad). Lineup = Timetable header icon. Settings/
  account/profile = stack screens from a header avatar (no 6th tab).
- **Every open question is answered** (DEC-039): no separate Favorites screen (reuse Lineup grid filter, Q-C);
  split editor = sheet (Q-D); language EN default (Q-K); breaks first-class (Q-L); admin = verify + dashboard (Q-I).
- **Map**: POI + stage routing are in V1 (Q-J). Admin map editor "drag→generate" is the productized engine (DEC-034).
