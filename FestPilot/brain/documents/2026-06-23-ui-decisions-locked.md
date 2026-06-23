# FestPilot — UI Decisions (Locked)

> Created 2026-06-23 from the prototype-review sessions with Julio.
> Source of truth for **concrete UI/UX decisions**. Visual identity lives in
> `2026-06-23-ui-dna-and-directions.md`; prototypes in `brain/wireframes/directions/`.
> These feed `2026-06-23-design-system.md` (tokens/components) + `2026-06-23-screen-catalog.md` (every screen) + the build phases.
> **§§9–16 below were added 2026-06-23 after the 8-batch design pass** (the social layer, identity, notifications, map POI, admin) — answers locked in **DEC-039**.

---

## 1. Visual identity — **Amber Glass** (CHOSEN)

- **Direction:** "Amber Glass" — warm dark base (`#0F0D09`), amber/gold accent (`#F5A623 → #FFD060`), heavy frosted glass.
- Rejected (kept as alternates): "Reef Glass" (teal/coral), "Magma Glass" (orange/red).
- **Glass must look polished/reflective** — diagonal sheen + top rim highlight + soft depth, NOT flat opaque tint. (Julio: the first flat-tinted cards looked "anos 90".)
- **Hard rule:** never look "AI-made". No cliché neon pink/purple/green. Original, creative, on-brand.
- Typography: **Oswald** (condensed poster) for titles; **Albert Sans** for body. No cliché AI fonts (Inter/DM Sans).
- Corners: softly rounded (12–16px). Density: balanced, airy on-site.
- Theme: auto (dark night / high-contrast light for harsh sun). Dark is the identity + battery saver.
- Lives across all screens (Home, Lock in, Map, My Plan, Squad, Timetable, Onboarding).

---

## 2. Nomenclature — **Lineup ≠ Timetable** (IMPORTANT)

- **Lineup** = the *people* (all artists playing the festival). A list of artists, no schedule.
- **Timetable** = *when/where* each artist plays (stages × time grid). The scheduling view.
- **My Plan** = the locked, conflict-free personal schedule (DEC-005). One single line/day.
- These are distinct surfaces and must be named/treated separately in nav and copy.
- **Navigation model (DEC-032):** the **Timetable is the bottom-nav pillar** and stays **full height** — *no top menu / segmented "Lineup | Timetable" bar is ever placed on it* (it would steal the vertical space the grid needs). The **Lineup is a separate full-height screen** reached by a **single icon** in the Timetable header (`groups`); the Lineup header has a single icon back to the Timetable (`calendar_month`). One small icon in the existing header row costs zero vertical space; a menu/segmented bar on the Timetable is rejected.

---

## 3. Timetable spec (validated in prototype #15e)

Layout (Tomorrowland-style, confirmed by Julio):
- **Rows = stages**, **columns = time**. Horizontal scroll = advance time; vertical scroll = more stages.
- **~6 stages visible** at once filling the full height (no dead black bar). 10+ stages → scroll vertically.
- **Stage name is sticky-left**, sitting in the gap **above** each stage's row (a glass pill). No dedicated left "name column/bar". It stays pinned while scrolling time horizontally.
- **Time header sticky-top** (hours 21:00→09:00). Day selector (Sáb/Dom) fixed in the header.
- **Cards positioned by real time** — a set starting 23:15 begins at the 23:15 mark; time gaps become visual gaps. Cards are NOT glued together.
- **Continuous NOW line** — a single amber vertical line top→bottom (no per-row segments), labeled "NOW".
- **No visible scrollbars anywhere in the app** (hidden globally).

Cards (TML model + FestPilot identity):
- **All cards look the same by default** = dark frosted glass with a subtle white border (TML uses black + white outline; we use dark glass).
- **Favorited cards stand out in GOLD** (amber-filled glass, dark text). TML uses white; we use gold to stay on-brand.
- **Stage color is NOT the card background** (that caused the dated "rainbow" look). Stage color appears only as: the colored dot in the sticky stage-name pill + a **thin colored line on the TOP edge** of the card. **A left-only colored strip is rejected — it reads as "AI-made".** The base card (dark bg + gray border) is the look Julio liked; the stage tint is just a subtle top reminder (the row itself already identifies the stage).
- **Every card has a heart button** to favorite/unfavorite in place; favoriting flips the card to gold. (TML: all artists shown, each with a heart; favorites change color.)
- **Every card shows the DJ photo** (left), then name + time.
- **Sticky card content:** while scrolling horizontally, the DJ **photo + name + time stay pinned to the left** of the card while there's room. The **heart stays anchored at the card's RIGHT end** (not in the left cluster); as you scroll the card off to the left, the heart approaches and **pushes the photo+name+time out** of view, then the next card repeats the behavior (exact TML behavior).
- **Top accent line**: thin (~2px), **full width**, painted as the top background layer so it's **clipped by the rounded corners** (the line runs straight edge-to-edge and simply disappears into the corners — it must NOT curve, NOT stop short before the corners). Subtle, not attention-grabbing.
- **Heart barrier**: the card reserves the heart's width (right padding) so the sticky photo+name+time stop when they meet the heart, never sliding under it.

Controls:
- **"Only my favs" toggle** — shows only favorited artists; stages with zero favorites disappear entirely; a favorited artist still appears only at its real time slot (the stage's line is empty until then).
- **Zoom toggle 1h / 2h** — user chooses how much time fits on screen (TML ≈ 1h, more zoomed; 2h shows more at once). Default 2h.

---

## 4. Onboarding — ask context BEFORE favoriting (IMPORTANT)

Order is mandatory; without it the artist list is wrong:
1. **Which festival?** (now: only Tomorrowland; future: a list.)
2. **Which week?** Tomorrowland runs **2 weekends** with *different* artists per week. (Week 1 / Week 2 / both.)
3. **Which days?** (Fri/Sat/Sun — can be all.)
4. **Then** favoriting starts, filtered to only the artists playing the chosen week(s)/day(s).

Favoriting flow:
- Swipe-style "Would you see this set?" (one artist at a time) — but **NOT a Tinder look** (no heart/X buttons). Use text actions ("Nah" / "I'd see this!") + swipe; keep a clear "Skip" and a progress counter ("14 of 87") so the end is visible.
- Make explicit it's **not final** — it builds the favorites list; conflicts are resolved later in **Lock in**.
- An artist that plays multiple days appears **once** in the swipe (dedup), not per day.

---

## 5. Lock in spec (the signature feature)

- A time slot can have **2 to 6+ clashing favorites** (16 stages exist; realistically up to ~4-6). The UI must support **multi-option**, NOT only 1-vs-1. (Earlier 1v1 "VS" was wrong.)
  - Prototype #12b = multi-option card list with single-select + confirm. Good base.
- **"All clashes" entry** — let the user see every conflict and jump to any, not just walk them in fixed order. Resolving one slot doesn't force the immediate next chronological one.
- **"Add another artist" / search** — besides the clashing favorites, allow picking any artist playing **around that time window** (nearby slots), in case the one they want wasn't auto-surfaced or isn't a favorite yet. **No "smart AI" picking** — just surface artists near that time; user chooses.
- Gamified but skippable: progress + a final **celebration** ("LOCKED IN!", prototype #13 — approved). Heavy users can skip; the visible end-counter reassures.
- Show on decision: genre + time (base) + a one-line context; "who from your group is going" **only if a group exists** (Phase 4).
- Partial set / leave-early: suggested chips + draggable handles, hidden behind "split set".

---

## 6. My Plan spec

- **Vertical timeline** (scroll the day) — approved.
- Includes **walking time** between stages and optional **breaks** (food / toilet / drinks) the user can add.
- Single line per day (it's the resolved plan, so simpler than the multi-stage Timetable grid).

---

## 7. Map / presence / meeting points

- **Illustrated/stylized SVG map** generated (via AI/Groq) from the real festival map, with real positions underneath; zoomable, themed.
- **Presence** only shows for friends **who share location**; coarse/honest (by stage), with avatars on map + list by stage + opt-in precise "radar".
- **Meeting point** = pin + photo + note (card) + full-screen **compass/arrow** (distance + direction) to navigate in a crowd. (Highly valued by Julio.)
- **Pinned group board** = short pinned notes for coordination ("leaving for the festival", "grab my thing from the tent", "blue shirts today"). Lightweight, not a chat (DEC-013).

---

## 8. Hard constraints (carry into every screen)

- **Sun legibility** (high contrast, critical) · **one-hand use** (reach with thumb; actions in lower half) · **battery** (dark, smart location — update on open / on movement, cheap location before GPS, occasional background; never constant GPS) · **WCAG AA** · **own brand** (same look iOS/Android) · **bilingual PT/EN**.

---

## 9. Groups — formation (Pillar 3a) — prototype `23`

- **Squad is one tab** ("Squad"); empty state offers **Create** or **Join** (no group yet).
- **Auth gate at create/join only** (DEC-024): anonymous use everywhere; creating/joining triggers the sign-in upgrade.
- **Profile asked at first join** (DEC-039 Q-F): display name + avatar (**upload or initials**, no preset gallery); editable in Settings.
- **Invite = short link + QR**; **link does not expire while the festival is active** (DEC-038). Squad cap **50** (DEC-038).
- Members list: roles (owner/member), leave, owner-remove. "Share my plan" pushes the personal plan into the group aggregation.

## 10. Group shared timetable (Pillar 3a) — prototype `24`

- **Blocks = per performance/set boundaries**, not fixed 30/60-min (DEC-039 Q-A).
- **Auto-plan = plurality of locked picks** + tally; **owner override** per block; **per-block follow / do-my-own**; **no member voting** in V1 (DEC-039 Q-B, DEC-013/019).
- **Never silently change a locked must-see** — show "**group → X, you locked Y · [Join]/[Keep]**" + a **favorites-fallback** offer (a favorite of yours near the group).
- **Splitting is shown, not fought** — a split view of who's at each stage + CTA to a post-set meeting point.
- "Needs input" state when too few members have locked plans → nudge members.

## 11. Presence & consent (Pillar 3b) — prototype `25`

- **Consent pre-prompt before the OS dialog** (DEC-015) with plain-language value + privacy promises; request **foreground-only** (no background tracking, DEC-012).
- **Sharing modes:** **Stage labels = default** (coarse "at MAINSTAGE"), **Precise live pin = opt-in, auto-expires in 60 min**, **Ghost** (you see them, they don't see you). Per-squad scope; **squad-only**, never public (DEC-007/008/015).
- **Where's the squad:** map peek + roster (coarse label, freshness, live ring for precise sharers, offline/ghost) with Ping/Nudge.
- **Precise-active control** always reachable: countdown, who-can-see, +60 min / downgrade to coarse / stop now.
- Privacy settings: master switch, default mode, expiry stepper, audience, **pause-all**. (Clients never receive raw coordinates — server-coarsened, §3 non-negotiable.)

## 12. Meeting points & safety (Pillar 3c) — prototype `26`

- **Create** = pick a spot (drag pin / my-spot / a stage / a bar; auto-label by nearest landmark) + details (name, when = now/after-this-set/custom, who = whole squad or selected, optional note) → notifies the squad.
- **Active detail** = convergence map + roster with **live ETA/distance** + here / no-response; **Navigate** (compass-arrow + distance, no turn-by-turn) · **I'm here**.
- **Lifecycle:** active → on-the-way → everyone-here (reunion moment) → expired (auto-close ~30 min after) → cancelled.
- **Safety / "I'm lost"** (DEC-039 Q-H): calm, non-alarmist menu reachable from **Squad** and **Map** — share live location + alert squad · nearest landmark · medical/info/exit · call a member. Safety-active = broadcast + nearest help + one-tap "I'm okay". **Exact coords leave the device only via meeting point or this action** (DEC-014/015).

## 13. Identity, account & settings — prototype `27`

- **Anonymous-first**; **Google + email-link** to save the account; **no Apple, no iOS** — the future native build is **Android-only** (DEC-039 Q-E; supersedes the old "Apple before native iOS").
- **Guest → save** upsell (don't lose squads/plans across devices); **sign out**; **delete account & data** (GDPR-friendly).
- **Settings hub:** account · notifications · location & privacy (→ §11) · **language** · **appearance** · legal (Privacy/Terms) · support · version.
- **Language: default English**, switchable per-user in Settings (i18n; not auto-forced by location — DEC-039 Q-K).
- **Appearance:** Auto (follows festival day/night) / Day / Night — drives the **map's light/dark art**.

## 14. Notifications & system states — prototype `28`

- **Personal-gap filler**: empty plan slots suggest a ❤ favorite nearby / a popular pick / a **first-class break** (food/toilet/drinks, DEC-039 Q-L).
- **Light in-app notification inbox** (DEC-039 Q-G) — reminders, clashes, pings, meeting points, squad-pick changes; **OS push is primary**; in-app banners mirror it.
- **Alert preferences:** set reminders + lead time, "leave now" walk alerts (travel-time aware), clash alerts, friend pings, squad/meeting. Push optional; inbox always works.
- **System states** are first-class: **offline/sync** (cached plan stays usable, live presence pauses, edits auto-sync), **empty** (with a way out), **loading skeletons**, **error + retry**.

## 15. Map — POI layer & stage routing — prototype `29` (extends §7)

- **POI layer** in V1 (DEC-022/039 Q-J): filterable pins (toilets · water · food · medical · bars · ATM) + a one-tap **"nearest essentials"** + POI detail (crowd/accessibility → navigate / make meeting point / share).
- **Stage-to-stage routing** (DEC-039 Q-J): from→to, route + walk time + a **"leave by" nudge** tied to the set start; POIs on the way; lightweight **walking navigation** (next move, distance, landmark cue, friends on the same route).
- **Layers/legend** panel: toggle friends · stages · meeting points · route + each POI category; day/night map style. Live overlay stays a **separate vector layer** over the SVG (DEC-030/034).

## 16. Admin (desktop web) — prototype `30`

- Separate **desktop** back-office to onboard any festival (DEC-039 Q-I). Sidebar: Festivals · Lineup & timetable · Map editor · POIs · Travel times · Settings.
- **Map editor = the productized engine** (DEC-034): **drag stage pins → "Generate SVG"** (illustrated, georeferenced) → preview in app; then **georeference/verify** with a **3-point affine** (SVG↔GPS) and **drag-fix off-position stages** (the "Google pin is off" problem the user raised).
- **Lineup dashboard:** source is the **documented capture** (`__NEXT_DATA__` route → CDN JSON, **never invented** — intake Q2); per-stage counts, verify flags, alias merge, re-import.
- **POI editor** (click-to-place) feeds §15; **travel-time matrix** (auto-estimate from positions + manual overrides) powers the "leave by" nudge + clash math.

---

## Prototype index (brain/wireframes/directions/)

- `15e-amber-timetable-tml.html` — **current Timetable** (this spec). Header carries a single `groups` icon → Lineup (no segmented bar).
- `22-amber-lineup.html` — **Lineup** (artist list; filters: favorites / days / genres). Reached via the Timetable header icon; back via the `calendar_month` icon / Timetable tab. No top segmented bar (DEC-032).
- `17-amber-onboarding-flow.html` — **full onboarding flow** (festival → weekend → days → favorite swipe), 4 steps with nav + progress; multi-day artist shown once.
- `12c-amber-lockin-search.html` — **Lock in multi-option + "add nearby artist"** sheet (search any artist; list limited to acts playing around the slot's window; no AI auto-pick).
- `12b-amber-lockin-multi.html` — Lock in multi-option (superseded by 12c).
- `13-amber-lockin-done.html` — Lock in celebration (approved).
- `14b-amber-onboarding-v2.html` — onboarding swipe only, non-Tinder (folded into 17).
- `18-amber-home.html` — **refined Home / Now & Next** (polished glass, compact inline walk line).
- `19-amber-map.html` — **refined Map** (illustrated SVG base: paths/lake/greens, stage bubbles, presence avatars, "me" radar, meeting-point pin, route sheet).
- `20-amber-squad.html` — **refined Squad** (presence by stage, meeting point with compass + distance/bearing, pinned board with add-note).
- `21-amber-myplan.html` — **refined My Plan** (polished vertical timeline, done/now/upcoming states, walk + break chips, add break/set, share).
- **Design pass (2026-06-23) — the social layer + the rest (DEC-039):**
  - `23-amber-groups-flow.html` — **Squad formation** (8): empty · sign-in · profile · create · invite(link+QR) · join · members · share plan (§9).
  - `24-amber-group-timetable.html` — **Group shared timetable** (6): plan · block detail · locked-conflict+fallback · owner override · split · needs-input (§10).
  - `25-amber-presence-consent.html` — **Presence & consent** (6): pre-prompt · OS dialog · sharing mode · where's-the-squad · precise-active · privacy (§11).
  - `26-amber-meeting-safety.html` — **Meeting points & safety** (6): pick spot · details · active detail · lifecycle · "I'm lost" · safety-active (§12).
  - `27-amber-identity-settings.html` — **Identity/account/settings** (6): sign-in · magic-link · edit profile · account · settings hub · language&appearance (§13).
  - `28-amber-states-notifications.html` — **Gaps/notifications/system states** (6): gap filler · inbox · alert prefs · push · offline/sync · empty/loading/error (§14).
  - `29-amber-map-poi-routing.html` — **Map POI & routing** (6): map+POI · nearest essentials · POI detail · stage routing · walking nav · layers (§15).
  - `30-amber-admin.html` — **Admin desktop** (6): overview · lineup dashboard · map editor(drag→generate) · georeference · POI editor · travel-time matrix (§16).
- Full catalog (all 59 screens → UC/DEC → phase): `2026-06-23-screen-catalog.md`. Tokens/components: `2026-06-23-design-system.md`.
- Superseded: `16-amber-squad.html`, `11-amber-home-v2.html`, `07-amber-map.html`, `09-amber-myplan.html`, `01/04` originals.
- Nav standardized across all screens: **Now · Timetable · My Plan · Map · Squad**. **Lineup is NOT a bottom tab** — it's a sub-view reached from the Timetable header icon, so the Timetable keeps its full height (DEC-032).
