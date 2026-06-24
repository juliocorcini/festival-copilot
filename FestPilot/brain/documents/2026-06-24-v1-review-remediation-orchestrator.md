# askFestPilot — V1 Review Remediation Orchestrator (the single execution truth for the post-review hardening pass)

> Last updated: 2026-06-24 — **R2 object storage ENABLED** (Julio added a card on file). The avatar +
> meeting-point photo path is **no longer deferred**: it ships on **Cloudflare R2** per **DEC-059** (which
> **supersedes DEC-053** and unblocks the DEC-038 R2 hold); the "no-card Cloudinary fallback" branch is
> **retired**. Wiring touched: §4 baseline, §7 (DEC-053 → DEC-059), gates **R9.3 (avatar) / R9.5 (meeting
> photo)**, and the §11 problem table. *(Note: "R2" the Cloudflare product ≠ "R2" the Map gate — only the
> storage references changed here.)*
> **Status:** ACTIVE — master execution document for the **review-remediation pass** that turns the
> shipped-but-rough V1 into a *real festival tool*.
> **Sibling of** `2026-06-23-v1-implementation-orchestrator.md` (built V1 Phases 0–6) and
> `implementation-phases.md` (the phase plan). Those two built the app; **this one fixes what the
> 2026-06-23 hands-on review found.** Same autonomy contract, same git/test/deploy discipline.
>
> **Source of this pass:** Julio's recorded walkthrough of the live app (transcript) + a normalized
> requirements brief. Both are distilled here into **prioritized, testable gates with acceptance
> criteria** and, crucially, a **root-cause map (code ↔ problem)** so the implementer goes straight to
> the right file.
>
> **How to read everything else:** the brain is *product* truth (`product-spec.md`, `decision-log.md`,
> `technical-direction.md`). The 2026-06-23 orchestrator is the *original build* truth. **This document is
> the *remediation* execution truth:** the order, the diagnosis, the fixes, the tests, the deploys, the
> commits. When product detail is needed it points to the exact brain section; when "what do I change and
> in what order" is needed, the answer is *here*.

---

## 0. Mission (read this first)

You are a senior full-stack engineer **hardening FestPilot V1 end-to-end, alone, in this session**, against
a concrete product review. **The app already exists and is deployed** (Phases 0–6 live — see §4). Your job is
**not** to rebuild it: it is to **fix the product, logic, data, UX, map and performance defects** Julio found,
**preserving everything that already works and looks good**, in priority order (P0 correctness → P1 UX →
visual polish), **without stopping and without asking the user anything**.

**One-paragraph reminder of what FestPilot is:** a festival companion. You (1) browse the lineup and
**favorite** artists (overlaps allowed); (2) **Lock in** a conflict-free personal **My Plan** (chronological
clash resolution, partial sets, walk-time); (3) create/join **squads** to build a shared timetable, see each
other **coarsely** on a beautiful georeferenced **map**, ask "where is everyone?", and drop temporary exact
**meeting points**. Reference festival: **Tomorrowland Belgium 2026 / De Schorre** (DEC-020); the model
generalizes.

**The prime directive of this pass (Julio's words, normalized):**

> "Don't rebuild the whole app. First understand the existing components, **preserve the visual that's already
> good**, and **fix the product/logic/data/UX/map/performance problems**. Fix logic & data bugs **first**, then
> UX, then visual. Never leave a button or icon with no action; never let copy promise a feature that doesn't
> exist; never let mocked data look real."

**Go to §16 to start.** Everything between here and there is the contract you execute under.

---

## 1. Identity & absolute rules (autonomy contract — identical to the build orchestrator)

You are the **executor**, not a coordinator. You implement, test, deploy, and commit yourself.

**ABSOLUTE RULES — never violate** (mirror `.cursor/rules/inline-council-no-subagents.mdc`,
`tech-lead-delegation.mdc`, `execution-style.mdc`, `phase-delivery-hardening.mdc`, plus this project's autonomous
mandate):

1. **NO subagents / NO Task tool / NO delegation.** Everything inline, in this one session. Multiple
  perspectives = multiple *sections of one response*, never multiple agents.
2. **DO NOT ask for permission to proceed — EVER, between any unit of work. This is the #1 rule of this pass
   (DEC-056).** Never pause, and **never end a turn with an `AskQuestion`, to ask whether you may start or continue
   the next fix, milestone, gate, or phase** — chain straight into the next unit. Julio runs this **asynchronously
   and is often asleep while you work**; a mid-build "can I continue?" stalls the whole pipeline for hours and is the
   single worst thing you can do. The terminal `AskQuestion` required by `always-end-with-askquestion.mdc` is allowed
   **only at the genuine hand-off** — when *all* §12 Stop Criteria are TRUE, **or** you hit a hard credential/cost
   blocker you cannot work around, **or** context genuinely runs out — **never between units of work.**
3. **DO NOT stop because "this is a lot of work", "the chat is long", or "a milestone/gate just finished."**
   Finishing a milestone/gate is the cue to **commit, deploy, update the dev-log, and immediately begin the next
   one** — not to stop. Continue until §12 Stop Criteria are all TRUE, or until context genuinely runs out (then
   finish the current fix cleanly, commit + deploy, write the dev-log handoff, and stop clean).
4. **DO NOT summarize what you are about to do — do it.** Minimize narration.
5. **All code, identifiers, comments, commit messages, file names → English.** UI copy → English default, **PT
  via i18n** (DEC-039 Q-K; this pass makes the switch actually work — R10). This document and the brain are English.
6. **Backend before frontend**, one fix at a time, **test alongside the fix** (§8).
7. **Reuse the existing code and the spikes — never reinvent** what §4 says already works.
8. **Respect WSL pager safety** (§11): always `git --no-pager …`, always `git commit -m`, never open
  `less`/`vim`/interactive flags in the agent terminal. Always `nvm use 22` before any wrangler/build command.
9. **Keep the brain in sync** (§14): update `dev-log.md` every milestone, `decision-log.md` on any new/changed
  decision, `project-status.md` at the end of the pass.

If a genuine ambiguity appears that the brain does not resolve: **run the inline council on the spot** (per
`inline-council-no-subagents.mdc` — one request, no subagents), take its synthesis, **write it as a `DEC-NNN`
(PROPOSED) in `decision-log.md`, and continue (DEC-056).** Do **not** stop to ask Julio. When in doubt about
product intent, **read the relevant brain file first** — almost everything is answerable there, or there + a council.

---

## 2. Reading order (load once, then fix)

At the **start of the pass**, read (in order):

1. **This document** §0–§9, then the gate you're on in §10.
2. `FestPilot/dev-log.md` — the live execution state (what already shipped).
3. `brain/decision-log.md` — only the `DEC-NNN` entries cited by the gate (esp. DEC-017/026/027/028/029/030/032/
  040/043/044/046/047 and the **new DEC-048→DEC-061** in §7 — note DEC-056 autonomy, DEC-057 admin, DEC-058
  presence, DEC-059 storage, DEC-060 identity, DEC-061 photos).
4. `brain/documents/2026-06-23-v1-implementation-orchestrator.md` — §3 non-negotiables, §6 git, §8 tests, §9
  deploy (this pass **reuses them verbatim**; they are not repeated in full here).
5. UI gates additionally: `brain/documents/2026-06-23-screen-catalog.md` for the screen IDs, the matching
  prototype in `brain/wireframes/directions/`, and `2026-06-23-design-system.md` for tokens.

Do **not** re-read the whole brain per fix. Read once, then rely on the dev-log + this doc + §6's root-cause map.
**But the moment a real doubt appears, DO read the relevant brain file** (`product-spec.md` / `decision-log.md` /
`technical-direction.md`) — everything can be answered there, or there + an inline council (DEC-056). Reading the
brain on doubt is *never* "stopping".

---

## 3. Non-negotiables (re-read before EVERY gate)

These invariants hold through the whole pass. Breaking one is a defect even if tests pass.

**Inherited from the build (still absolute):**

- **Lineup is never hardcoded** — resolve `event`+`uuid` from the official page, then fetch CDN JSON (DEC-009).
Removed acts → `active=false`, never hard-deleted. Clients read **our** DB only.
- **A locked My Plan has ZERO overlaps** — the clash resolver stays chronological, one-at-a-time, gated (DEC-017).
- **Money/identity/time/clash/plan math is pure-TS in the domain layer** — no business logic inside React
components. Every fix to logic lands in `web/src/domain/*`* (or `server/src/domain/**`) with unit tests.
- **Presence is coarse by default + honest (DEC-058)** — the **group feed never carries raw `lat/lng`** (server-only;
clients get **stage + confidence + expiry** — DEC-007/008/015/046). **Exact coordinates ARE allowed for features
that genuinely need them** (precise "come to me", point-to-point nav, true distance to stage/POI), but **only via an
explicit, time-boxed (TTL) share** over the existing exact channel — never a silent broadening of the coarse feed,
**never continuous background tracking**, and **no feature is dropped just to stay coarse** (DEC-058 revises
DEC-014/046/047). Keep the consent copy honest.
- **Map live overlay is always a separate vector layer** — labels/pins/friends/meeting/**stage markers** are
**never baked** into the illustration (DEC-030/034). *(This pass enforces it — R2 — because the current raster
bakes stage labels, which is the bug.)*
- **Visual identity = "Amber Glass"** (DEC-025): warm dark base, amber/gold accent, reflective glass, Oswald
titles / Albert Sans body. Must not look "AI-made". **Preserve what already looks good.**

**New, review-derived non-negotiables (this pass):**

- **No dead affordances.** Every button, icon, dot, and card either does something clear or is removed
(review §8/§9/§13/§18). Specifically: the My Plan card "dot", the squad "AI" icon, the "Add to home screen"
row, "Check for updates".
- **No false promises in copy.** Remove "find each other even with no signal / 2% battery" type claims; the app
needs network + location (review §12.1).
- **No mock data presented as real.** The map tab still renders **mock** presence (`web/src/map/presence.ts`) — it
must show **real data**, OR **admin-injected test data clearly flagged as test** (`is_test=1`, via the R11 live test
console — DEC-057), OR an **honest empty state** — never invented friends baked into code (review §11/§14).
- **App-feel, not web-page-feel.** Disable text selection app-wide except inputs; fix dark-on-dark contrast
everywhere (review §12.6, §15, §16, §19).
- **The "festival day" is a contiguous block, not a civil date** — post-midnight sets belong to the night that
started them (DEC-048, review §7).
- **A clash decision shows only sets that truly overlap the moment being resolved** — never a transitive chain
that drags a 21:00 act into a 16:00 decision (review §8; the fix is the core of R1).

---

## 4. Baseline — where the app REALLY is (do NOT rebuild)

> Verified from `dev-log.md` + the source tree, 2026-06-24. Treat this as done; **fix it, don't recreate it.**

**The app is far past the build orchestrator's "Phase 0" framing.** Per the dev-log, **Phases 0,1,2,4,5 are
COMPLETE + LIVE; Phase 3 core is done; Phase 6 G6.1+G6.2 are done + live.** Live URLs: app
**[https://festpilot.pages.dev](https://festpilot.pages.dev)**, API **[https://festpilot.trippilot.workers.dev](https://festpilot.trippilot.workers.dev)**. Live festival id
`01KVVF5VERH4AB28NAM6NM65VD` (TML Belgium 2026, 813 performances, 15 stages, W1/W2). Tests last green:
server ~116, web ~129 vitest, ~21 Playwright.

**Monorepo** — `FestPilot/` npm-workspaces (`server`, `web`), Node 22 (`nvm use 22` first). Root scripts:
`npm run typecheck | test | build`.

`**server/` (`@festpilot/server`, Cloudflare Worker):** Hono read API + ingestion + cron + `GroupRoom` DO
(SQLite, free) + presence/meeting/board/squad-plan/ping repos. Key files for this pass:
`src/lineup/{normalize,resolver,types}.ts`, `src/ingest/{store,ingest,source}.ts`, `src/api/{repo,dto,routes, groups-routes}.ts`, `src/domain/{presence,meeting}.ts`. Migrations `0001`→`0007` applied remote. **R2 object storage is now ENABLED** (Julio added a card on file,
2026-06-24): it hosts **user media (avatars + meeting-point photos)** via a Worker `r2_buckets` binding
(gate **R9.3**) — this **unblocks DEC-038's R2 hold** and is governed by **DEC-059** (supersedes DEC-053).
**Firebase stays out** (DEC-042). The map base remains a pre-rendered raster (DEC-040) — R2 here is for
**user media, not the map**.

`**web/` (`@festpilot/web`, Vite + React + TS PWA):** 5-tab shell (Now/Timetable/My Plan/Map/Squad, DEC-032),
Amber-Glass `styles.css`, service worker, typed API client. **All the screens in the review already exist** —
this pass edits them, it does not author new flows from scratch. Key files appear inline in §6 and §10.

**What is NOT done / is the subject of this pass:** the defects in §6. Plus: POI layer deferred (needs data);
admin desktop track not built; FCM/push deferred (in-app only); permanent auth deferred (anonymous-local).

---

## 5. The review, normalized: priorities

The whole pass is ordered by Julio's priority tiers. **Fix in this order; do not jump to visual polish before
logic is correct** (review §21).

- **P0 — correctness, must fix first** (R1–R4): artist photos; festival-day/midnight logic; Lock-in clash
windows; map (pan limits, resolution, interactive stages); tab-switch performance; the 3 data-states
(no-lineup / lineup-no-timetable / timetable) + dynamic days; Lineup discoverability.
- **P1 — important UX** (R5–R10): grid favoriting + per-day grouping + real swipe; Now/Next logic; timetable
card polish + compact top bar; editable My Plan; squad (multiple squads, avatar photo, custom emoji,
auto-share, real mini-map, richer meeting point, honest copy, AI-icon, J-vs-gear); settings (PT i18n, PWA
install, check-updates, About); global contrast + no-text-select.
- **Visual polish** rides inside each gate (it's cheaper to polish the component you're already in).

---

## 6. Root-cause map (code ↔ problem) — start here for every fix

> This is the heart of the pass. Each row is a review finding, its **confirmed root cause in the real code**
> (file + symbol, not line numbers — they will drift as you edit), and the fix direction. Gates in §10 expand
> these into ACs + tests. **Read the cited file before editing it.**


| #   | Review finding                                                                                                                                                                                     | Root cause (file → symbol)                                                                                                                                                                                                                                                                                                                                                                                                | Fix direction                                                                                                                                                                                                                                                                                                                                                                                                   | Gate                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | **Artist photos never load** (everywhere)                                                                                                                                                          | Pipeline is wired (`normalize.ts` keeps `a.image` → `store.ts` writes `artist.image_url` → `repo.ts` returns `imageUrl`). The local spike fixtures are **stale** (no `image`), which made it look sourceless — **but the LIVE CDN performances JSON already carries it**: `artists[].image` (VERIFIED 2026-06-24 from the HAR: `{"id":"1536127184","name":"BassBrain","image":"https://artist-lineup-cdn.tomorrowland.com/233262902-Presspic Bassbrain - 4.jpg"}`; photoless artists omit `image`). `image_url` is null only because data was ingested before the field existed, **and** no component renders an `<img>`. | (a) **Re-ingest** — live data now carries `image`; **no new scraper, no separate endpoint** (DEC-061, consistent with DEC-009); (b) render `imageUrl` with the CDN resizer `?width=` (URL-encode the path — it has spaces) + a good placeholder in **every** artist surface. | R1 (data) + R5 (UI) |
| 2   | **Post-midnight sets land on the wrong day**                                                                                                                                                       | "Festival day" today = the source's `performance.day` label, grouped in `web/.../lib/festival.ts → daysForWeekends` and `web/.../domain/timetable.ts`. The source labels some after-00:00 sets by **civil date**, so a Friday-night 00:30 set shows under Saturday.                                                                                                                                                       | Introduce a **derived `festivalDayId`** = contiguous block split by a real gap (≥ N h with no set on any stage; default 3 h). Make it the single source of truth for day grouping across onboarding, timetable, My Plan, Now/Next.                                                                                                                                                                              | R1                  |
| 3   | **Lock-in shows distant acts as one clash** ("resolving 16:00 offers a 21:00 act")                                                                                                                 | `web/.../domain/intervals.ts → clusterByOverlap` builds **transitive chains**: it extends a cluster while `set.startMs < runningEnd` and `runningEnd = max(runningEnd, set.endMs)`, so A(16–17)→B(16:30–17:30)→C(17:15–18:15)… chains 16:00 to 22:00 even though 16:00 doesn't overlap 21:00. Consumed by `domain/resolver.ts` and rendered by `routes/lockin/LockInScreen.tsx`.                                          | A clash decision must offer only sets that **truly overlap the anchor** (the earliest unresolved set): `options = {anchor} ∪ {x : overlaps(anchor, x)}`. Keep the gate (chosen end consumes the timeline) so zero-overlap holds; just change what a *decision* surfaces. Apply consistently in `startResolver/advance`, `countRemainingClashes`, `previewRemainingClashes`, and the `LockInScreen` header copy. | R1                  |
| 4   | **Map: drag past the image → black void**                                                                                                                                                          | `web/.../map/usePanZoom.ts` clamps **scale only** (`clamp()` bounds scale to `[fit*0.9, MAX_SCALE]`); pan `x/y` is unbounded.                                                                                                                                                                                                                                                                                             | Add a **pan clamp** that keeps the world covering the viewport (with a small bleed), accounting for the bottom bar's safe area.                                                                                                                                                                                                                                                                                 | R2                  |
| 5   | **Map: stages/labels pixelate, look baked-in, not clickable; star/label scale wrong**                                                                                                              | The base is a **raster** (`<id>.webp`, DEC-040) that **bakes the stage medallions + names + compass into the art**; the SVG overlay in `web/.../map/MapView.tsx` only draws presence (me/friends/meeting) — **no stage layer**. So labels are part of the image → pixelate at `MAX_SCALE=12`, can't be tapped (violates DEC-030/034).                                                                                     | Render **stages as a vector overlay** from `transform.stages` (name + lng/lat via `geoToSvg`): crisp, screen-stable scaling, **tappable → stage info sheet** (now-playing, next, friends here). Regenerate the base **without** baked labels/medallions (engine already separates them). Cap base zoom to its sharp range; evaluate a higher-res/vector base (DEC-050).                                         | R2                  |
| 6   | **Map: bottom bar covers the map; can't see full venue**                                                                                                                                           | `usePanZoom → recenter` fits to raw `clientWidth/Height`, ignoring the bottom nav + in-canvas sheet overlap.                                                                                                                                                                                                                                                                                                              | Fit/clamp against a **safe content rect** (subtract bottom-nav + sheet height); recenter on a sensible default zoom.                                                                                                                                                                                                                                                                                            | R2                  |
| 7   | **Map: outside the venue → black screen**                                                                                                                                                          | A real GPS fix outside the bbox places "me" off-canvas; with unbounded pan + mock presence there's nothing on screen.                                                                                                                                                                                                                                                                                                     | Detect out-of-venue; show an **honest state** ("You're outside the festival — precise location works inside the venue") while still letting the user explore the festival map. Optional: a real OSM basemap behind a translucent venue overlay (DEC-051).                                                                                                                                                       | R2                  |
| 8   | **Map tab shows random people**                                                                                                                                                                    | `MapScreen → MapView` uses **mock** `web/.../map/presence.ts`; the real coarse presence built in Phase 5 lives in `web/.../routes/presence/*` and isn't wired to the map tab.                                                                                                                                                                                                                                             | Wire the map's overlay to **real** group presence (coarse, the Phase-5 data) or an honest empty state; delete/retire the mock. Never show invented friends.                                                                                                                                                                                                                                                     | R2                  |
| 9   | **Tab switch ~3 s**                                                                                                                                                                                | `web/.../data/useLineup.ts` re-runs `listFestivals()` + `getLineup()` (813 perfs) **on every mount**; every tab using it re-fetches, re-parses, re-renders. No shared cache.                                                                                                                                                                                                                                              | A **shared lineup cache/provider** (fetch once, serve from memory, revalidate in background — stale-while-revalidate) at the app root; screens read from context. Target tab switch < 300 ms for already-loaded data.                                                                                                                                                                                           | R3                  |
| 10  | **Lineup is hidden / festival may have no timetable**                                                                                                                                              | DEC-032 put Lineup behind one Timetable-header icon (full-height Timetable). Review wants it obviously reachable, and the app must work when only a lineup (no timetable) exists.                                                                                                                                                                                                                                         | Keep Timetable full-height (DEC-032 stands) **but** add a clear, compact Timetable⇄Lineup switch and **open Lineup by default when there's no timetable**; handle the 3 data-states (DEC-049/052).                                                                                                                                                                                                              | R4                  |
| 11  | **No support for festival without lineup / without timetable; data updates (The Gathering)**                                                                                                       | `SourceConfig.config.withTimetable` exists server-side but isn't surfaced; the client assumes a full timetable; days are fixed. Ingest IS idempotent (handles new days/artists) but the UI doesn't re-prompt or degrade.                                                                                                                                                                                                  | Surface a **data-state** (`hasLineup`/`hasTimetable`) to the client; degrade each screen gracefully; support **dynamic days** (DEC-048) and **re-prompt favorites** when new artists/days appear.                                                                                                                                                                                                               | R4                  |
| 12  | **Swipe has no real gesture / no grid alternative / 387 at once / no per-day**                                                                                                                     | `web/.../routes/onboarding/OnboardingScreen.tsx → StepSwipe` uses Nah/Yes **buttons only** (no drag), shows all acts flat, progress is global.                                                                                                                                                                                                                                                                            | Add a **real swipe gesture + hint animation**, a **grid mode** toggle (2-col, photo+name), **per-day grouping + per-day progress**, and an intent explainer. Both modes share the same favorites store.                                                                                                                                                                                                         | R5                  |
| 13  | **Now/Next shows arbitrary artists**                                                                                                                                                               | `web/.../routes/NowScreen.tsx` + `domain/nowNext.ts` should be favorites/plan-driven; review says it looks arbitrary (and depends on #2 day logic).                                                                                                                                                                                                                                                                       | Drive Now/Next strictly from **My Plan if it exists, else favorites in chronological order**, with an honest empty state. Re-verify after the day-logic fix (#2).                                                                                                                                                                                                                                               | R6                  |
| 14  | **Timetable cards: double colored line (top too thick), no hour gridlines, touching cards glued, heart off-center, no photos, cluttered top bar**                                                  | `web/.../routes/TimetableScreen.tsx` + `domain/timetable.ts` (`hourMarks` exist but may be unstyled) + `styles.css` card recipe.                                                                                                                                                                                                                                                                                          | One **thin** top stage-color line (remove the bottom line); discreet **30-min/1-h gridlines** (toggle later); a tiny margin when `endMs == nextStartMs`; vertically center the heart; render **photos**; compact the top controls (DEC-032 height rule).                                                                                                                                                        | R7                  |
| 15  | **My Plan not editable; right-side "dot" does nothing; "Add set" just dumps to timetable**                                                                                                         | `web/.../routes/MyPlanScreen.tsx` renders a read-only timeline; the dot is decorative; "Add set" navigates away with no context.                                                                                                                                                                                                                                                                                          | Make each item a **context menu** (details / swap / remove / view on map / clash options); give the dot an action or remove it; make **Add set** a filtered-by-day/time picker that recomputes breaks/clashes.                                                                                                                                                                                                  | R8                  |
| 16  | **Squad: false copy, single squad only, no avatar photo, no custom emoji, plan not auto-shared, fake mini-map, thin meeting card, AI icon w/o function, J-vs-gear, text selectable, low contrast** | `web/.../routes/SquadScreen.tsx` (uses only `groups[0]`; promise copy at the hero), `routes/squad/*` (profile = name+color, emoji picker only, share is opt-in per DEC-044), the squad mini-map is a blurred placeholder, `routes/presence/*` contrast.                                                                                                                                                                   | A cluster of fixes (R9): squad switcher (`useMyGroups` already returns the list); avatar **photo on R2** (DEC-059 — R2 enabled, card on file; via the R9.3 adapter); **custom emoji** input; **auto-share on join** + Settings opt-out (DEC-054, refines DEC-044); **real mini-map preview**; richer meeting-point card; honest hero copy; give the AI icon a real function or remove it; J→profile menu (or gear); contrast pass.             | R9                  |
| 17  | **Settings: PT doesn't switch the UI; PWA install does nothing; Check-for-updates unclear; no About**                                                                                              | `web/.../routes/settings/*` + `app/settings.ts`; no i18n layer; no `beforeinstallprompt` capture; `AboutScreen.tsx` exists — verify it's reachable + complete.                                                                                                                                                                                                                                                            | Real **i18n** (EN default, PT switch persisted, DEC-039 Q-K); capture `beforeinstallprompt` + iOS instructions + "Installed" state; make Check-for-updates honest (SW update flow); finish **About** (version/changelog/links).                                                                                                                                                                                 | R10                 |
| 18  | **Whole-app: text selectable; dark-on-dark buttons**                                                                                                                                               | `styles.css` has `user-select:none` on `body` + `.base` but it's not robust (no `-webkit-touch-callout`, inputs not re-enabled); several button styles use dark text on dark glass.                                                                                                                                                                                                                                       | App-wide `user-select:none` + `-webkit-touch-callout:none` with inputs/textareas re-enabled; a **contrast audit** of buttons/labels (review §12.6/§15/§16/§19).                                                                                                                                                                                                                                                 | R10                 |
| 19  | **"Suggest a festival" capture (admin)**                                                                                                                                                           | No suggestion path exists.                                                                                                                                                                                                                                                                                                                                                                                                | A tiny guarded `POST /api/festival-suggestions` + D1 table (name, who, when, count, status) + an admin list; a discreet entry on the festival-pick step.                                                                                                                                                                                                                                                        | R4 (small)          |


---

## 7. Decisions this pass adopts (registered in `decision-log.md` — most APPROVED 2026-06-24)

These resolve genuine tensions the review opened with existing brain decisions. They are **Julio's own review
direction**, adopted as **PROPOSED**, implemented, and recorded in `decision-log.md`; each cites what it
refines/supersedes. **Operator review 2026-06-24: Julio approved DEC-048/049/050/052/054/055 (inline "ok" below);
DEC-051 approved with the added button requirement (see its note); DEC-053 is SUPERSEDED by DEC-059.** Round 2 adds
**DEC-056→061** (autonomy, admin, presence, storage, identity, photos) — summarized at the end of this section.

- **DEC-048 — Festival day = derived contiguous block.** The "festival day" is computed (gap-split), not taken
from the source `day` field nor the civil date. A pure `assignFestivalDays(performances, gapHours=3)` in
`web/src/domain/` is the single source of truth; UI labels stay "Friday, Jul 24" etc. *(Implements review §7;
refines the day handling in `normalize.ts`/`festival.ts`.)*  
*ok*
- **DEC-049 — Lineup access without breaking DEC-032.** Timetable stays full-height (DEC-032 holds: no tall top
toggle). Add a **compact, explicit** Timetable⇄Lineup switch (a single labeled control row of minimal height,
or a thin two-item segment that does not eat grid height) **and open Lineup by default when no timetable
exists.** *(Refines DEC-032 with the review's "Lineup is too hidden" + "festivals often ship lineup before
timetable.")*  
  
*ok*
- **DEC-050 — Map: crisp interactive overlay + base-zoom honesty.** All stages/labels/pins/markers render as a
**vector overlay** (interactive, screen-stable), never baked into the base. Regenerate the base **without**
baked labels. Cap base zoom to its sharp range; evaluate shipping a higher-res raster and/or the vector
deep-zoom SVG. *(Enforces DEC-030/034; refines DEC-040's raster trade-off the review hit.)*  
**ok**  
  
**DEC-051 — Out-of-venue map state.** Outside the bbox, never show a black screen: show an honest message and still allow exploring the festival map; **optional** real OSM basemap behind a translucent venue overlay.
*(New; consistent with DEC-030 offline-first + the review §11/§15.)*  
*ok, better with the real map, but ok if too complicated, but create a btn to take user to the event map if needed for any reason so its not just an black screen*  

- **DEC-052 — Festival data-state model.** A festival may exist with **no lineup / lineup-without-timetable /
full timetable**, and data may update (add days like **The Gathering**, add artists, add times). The API
surfaces `hasLineup`/`hasTimetable`; the client degrades gracefully and **re-prompts favorites** when new
artists/days appear; existing favorites/plans stay valid; an invalidated choice prompts an adjustment. *(New;
implements review §2/§6/§20; ingestion already idempotent.)*  
*ok*  

- **DEC-053 — Avatar photo storage. ⛔ SUPERSEDED by DEC-059 — R2 now ENABLED (card on file, 2026-06-24).** The
"initials-only until R2" deferral is replaced by a real storage-adapter path on **Cloudflare R2** (+ ~$1 budget
alert + app-enforced quota). **Julio added a card, so R2 is the live path and the Cloudinary "no-card" fallback is
retired** (kept only as a swappable adapter option). Initials+color stay as the placeholder. See DEC-059 (Round 2)
and gate R9.3.  
  

- **DEC-054 — Squad auto-share on join.** When a user joins a squad, the app **shares their plan + favorites by
default** (a one-time confirmation sheet on first join), with a Settings opt-out — instead of the hidden
opt-in. *(Refines DEC-044's opt-in to match the review §13 "it should happen naturally when you join.")*  
*ok*  

- **DEC-055 — Festival suggestions.** Capture user-suggested festivals (name, optional identity, timestamp,
count, status) for admin review; no login required. *(New; implements review §1.)*  
*ok*

**Round 2 — DEC-056→061 (2026-06-24 follow-up + 4 inline councils; full text in `decision-log.md`):**

- **DEC-056 — Autonomy hardening:** never stop / never ask to advance between units; ambiguity →
**council-on-the-spot** + DEC + continue; read brain on doubt. *(Drives §1, §9, §12.)*
- **DEC-057 — Admin back-office is V1 scope:** the 6 wireframed screens (`30-amber-admin.html`) + protected routes +
new areas (data-source registry, suggestions inbox, usage metrics, free-tier runway, **live test console**).
*(Gate R11.)*
- **DEC-058 — Presence guard-rail revised:** coarse default; **exact coords allowed where a feature needs them** via
explicit+expiring share; the coarse feed never carries raw coords; no background tracking; never block a feature.
*(§3; revises DEC-046/047.)*
- **DEC-059 — Avatar/photo storage → R2 ENABLED (card on file, 2026-06-24):** ship on **Cloudflare R2** + **~$1 budget
alert** + **app-enforced quota** (client-compress ~150 KB, one avatar/user, Worker rejects over-budget writes), behind a
storage adapter; **the Cloudinary "no-card" fallback is retired** (adapter keeps it swappable). Also unblocks the
meeting-point photo (DEC-047). *(Supersedes DEC-053; gates R9.3 + R9.5.)*
- **DEC-060 — Lightweight identity at onboarding:** ask **name (required) + email (optional)** up front (metrics +
prefill on real sign-in); no password there. *(Refines DEC-024/041; gates R5.0/R10; feeds R11 metrics.)*
- **DEC-061 — Artist photos already in CDN `artists[].image`:** re-ingest + render with `?width=`; resolves the R1.3
⏳. *(Supersedes the "separate source" half of DEC-052.)*

> Confidence: HIGH for the review-direct decisions (DEC-048/049/052/054/055/056/057/060/061) **and now DEC-059**
> (R2 enabled — card on file; the storage path is settled, Cloudinary fallback retired). MEDIUM for DEC-050/051/058
> (touch infra/privacy trade-offs set by DEC-040/046/047 — implement the resolved default, flag the upgrade).

---

## 8. Testing strategy (test alongside the fix — this is the gate)

Reuse the build orchestrator §8 verbatim (Vitest + Testing Library + Playwright + the `sql.js` real-migration
shim). For **this pass** specifically:

- **Every logic fix is a domain unit test with concrete numbers** (the cluster fix, the festival-day split, the
pan clamp math, the photo-source mapping). Pure functions in `web/src/domain/`** / `server/src/domain/**`.
- **Regression guards for the invariants:** the zero-overlap property test must still pass after the clash-window
change; a new test asserts a 16:00 decision never contains a non-overlapping 21:00 act; a festival-day test
asserts a 00:30 set groups with the prior night.
- **Golden-path smoke (must pass at every gate):** (1) load festival + lineup (with the shared cache) → (2)
favorite (grid or swipe) + **Lock in** a conflict-free plan → (3) open the **map** with stages tappable and no
black void → (4) squad: join → auto-share → see the plan. Extend per gate.
- **Commands (from `FestPilot/`, `nvm use 22` first):** `npm run typecheck && npm run test && npm run build`;
E2E `npm --workspace @festpilot/web run test:e2e`.
- **Coverage targets:** > 90 % on changed domain logic, > 70 % on changed critical UI.

---

## 9. Execution protocol (the loop, checkpoints, recovery — condensed from the build orchestrator §12)

**Per fix (milestone):** read the §6 row + the cited file → fix backend slice → fix frontend slice → write/extend
the test for the invariant → `typecheck && test && build` green → **one commit** → `dev-log.md` entry → next.

**Per-milestone self-check (before each commit):** 1) name the review item(s) + DEC(s) satisfied; 2) name 3
earlier behaviors at regression risk and verify them (esp. zero-overlap plan, coarse-presence privacy, offline
read); 3) tests green, **no NEW failures**; 4) flag files changed outside scope; 5) dev-log entry.

**Gate checkpoint (between R-gates):** tests + cumulative review items green; golden-path smoke passes; **deploy**
the user-visible change (Worker `wrangler deploy` + Pages direct upload, §9 build-orchestrator) and capture the
URL; scoped commit + version bump if user-visible; brain sync (§14); re-read this doc's next gate + §3.

**Anchor (restate every ~3 fixes):** *No subagents. No asking to advance — ever, between any unit. Don't stop at a
milestone/gate; commit + deploy + dev-log and continue. Ambiguity → council-on-the-spot + DEC. English code, EN/PT
UI. Backend before frontend. Fix logic before visual. Test the invariant. Coarse feed carries no raw coords; exact
only via explicit+expiring share. Zero-overlap plan. Preserve what works. Commit per fix; deploy + dev-log per gate.
`nvm use 22`, `git --no-pager`, `git commit -m`, Cloudflare Pages deploy `--branch=master` (never preview).*

**Recovery:** read `dev-log.md` Current State → `npm run test` to find the real failure → re-read only the
failing area + its §6 row → fix forward with a new commit (never `--amend` pushed work) → if a shell hangs, §11.

---

## 10. THE BUILD — remediation phases & gates

> Status legend: 🔨 do now · ✅ done · ⏳ needs a credential/data the operator must supply.
> Each gate lists **Why** (review ref), **Root cause** (§6 row #), **Change**, **Screens/Proto**, **AC**,
> **Tests**, **Commit**. Build top-to-bottom: **P0 (R1–R4) before P1 (R5–R10), then R11 (Admin)** — pull a piece of
> R11 earlier only if a fix needs it (e.g. the test console to verify the map, the data-source registry to onboard).

### R0 — Setup (decisions + safety rails) 🔨

- Read §0–§9 + `dev-log.md`. `nvm use 22`. Confirm `npm run typecheck && npm run test && npm run build` green on
the current tree **before touching anything** (so every later failure is yours).
- Confirm **DEC-048→DEC-061** (§7) are in `decision-log.md` (already registered: DEC-048/049/050/051/052/054/055
  APPROVED, DEC-053 SUPERSEDED by DEC-059, DEC-056→061 PROPOSED). No re-registration needed — just verify.
- Seed a `dev-log.md` section "Review-remediation pass (2026-06-24)" with the R0…R11 checklist.
- **Commit:** `chore(review): baseline green + confirm DEC-048..061 for the remediation pass`.

---

### R1 — P0 Data & Logic Correctness 🔨 (the most important gate)

**Why:** review §3.1 (photos), §7 (festival day), §8 (Lock-in clashes). Fix logic/data **before** any UX/visual.

**R1.1 — Festival-day blocks (DEC-048).** *(§6 #2)*

- **Change:** add pure `web/src/domain/festivalDay.ts → assignFestivalDays(performances, gapHours=3)`: sort by
start; start a new block when the gap from the running max-end to the next start ≥ `gapHours` **on all stages**;
return a stable `festivalDayId` + the night's label (from the block's first set, festival tz). Route
`lib/festival.ts → daysForWeekends`, `domain/timetable.ts`, `domain/nowNext.ts`, onboarding day-grouping
through it. Keep user-facing labels ("Friday, Jul 24").
- **AC:** a 00:30 set on a Friday night groups under **Friday**; the timetable day window runs first-set→last-set
of the block, crossing midnight; no Friday-night set leaks into Saturday. Existing favorites/plans unaffected.
- **Tests:** unit on `assignFestivalDays` (midnight cross, 3-h gap boundary, multi-stage tail); timetable window
test for a midnight-crossing day.
- **Commit:** `fix(timetable): derive festival day as a contiguous block (DEC-048)`.

**R1.2 — Lock-in clash window = anchor-overlap, not transitive chain.** *(§6 #3 — the headline bug)*

- **Change:** in `web/src/domain/intervals.ts`, add `clashAt(sets, fromEnd)` returning the earliest unresolved
**anchor** plus only sets that **overlap the anchor** (`overlaps(anchor, x)`). Use it in
`domain/resolver.ts → advance` for the surfaced `decision.options`, and in `countRemainingClashes` /
`previewRemainingClashes` so the count matches. **Keep the gate** (a pick consumes the timeline to its end), so
the zero-overlap invariant is untouched. In `routes/lockin/LockInScreen.tsx`, the clash header reads the
anchor's start ("16:00 — what do you want to see?") and the per-step list shows only the anchor-overlapping
options.
- **AC:** resolving the 16:00 window offers **only** acts overlapping 16:00 (e.g. 16:00–17:00 + 16:30–17:30),
never a 21:00 act; after a pick, the next decision is the next real overlap in chronological order;
non-clashing favorites auto-lock; the locked plan still has **zero overlaps**.
- **Tests:** the existing zero-overlap property test stays green; a new test reproduces Julio's scenario
(favorites at 12/13/14:30 then a 16–22 spread) and asserts each decision's options are anchor-overlapping only;
`previewRemainingClashes` count matches the walk.
- **Commit:** `fix(my-plan): clash decisions show only true overlaps of the anchor, not transitive chains`.

**R1.3 — Artist photos: re-ingest (the CDN already carries them) — DEC-061.** *(§6 #1; the ⏳ is RESOLVED)*

- **Change:** the live performances JSON already includes `artists[].image` (VERIFIED from the HAR). Confirm
`normalize.ts` keeps `a.image` → `store.ts` writes `artist.image_url` → `repo.ts` returns `imageUrl`, then
**re-ingest** the live festival so existing rows get photos (data was ingested before the field existed). **No new
scraper, no separate endpoint** (consistent with DEC-009). Update a test fixture to include an artist with `image`
(the spike fixtures are stale). `?width=` resizing + placeholder rendering is the UI half (R5.4).
- **AC:** after re-ingest, artists with a photo have a non-null `imageUrl` in `GET /…/lineup`; photoless artists stay
null (no fabrication); re-running ingest is idempotent.
- **Tests:** `sql.js` ingest test: a fixture artist carrying `image` → `image_url` stored + served; absent → null.
- **Commit:** `fix(lineup): re-ingest artist photos from CDN artists[].image (DEC-061)`.

**Gate close R1:** tests green; deploy Worker (ingest) + Pages; `dev-log` + `decision-log` updated;
`chore(release)` patch bump.

---

### R2 — P0 Map 🔨

**Why:** review §11, §15, §16 (map quality, limits, interactivity, out-of-venue, meeting-point zoom).

**R2.1 — Pan clamp + safe-area fit.** *(§6 #4, #6)* In `web/src/map/usePanZoom.ts`, clamp `x/y` so the scaled
world always covers the viewport (small bleed allowed), and make `recenter`/clamp use a **safe content rect**
(subtract bottom-nav + in-canvas sheet). **AC:** you can't drag into a black void; initial view frames the venue;
the bottom bar never hides key areas. **Tests:** unit on the clamp math (over-pan is bounded for several
scales/sizes). **Commit:** `fix(map): clamp pan to the venue + fit to the safe content rect`.

**R2.2 — Interactive vector stage overlay (DEC-050).** *(§6 #5)* In `MapView.tsx`, draw stages from
`transform.stages` via `geoToSvg`: bespoke marker + label, **screen-stable scaling** (reuse the `inv = 1/scale`
pattern, with min/max so labels never go huge/tiny), and **tap → a stage info sheet** (now-playing from lineup +
next + squad members at that stage). Regenerate the base **without** baked stage labels/medallions (the
`spikes/map-art` engine already keeps the overlay separate — emit a label-free base). Cap `MAX_SCALE` to the
base's sharp range. **AC:** zooming keeps stage names/icons crisp; stages are tappable; the meeting-point pin no
longer collapses to a pixel; nothing is baked. **Tests:** a render test that stage markers exist as overlay
nodes (not the base) and that tapping opens the sheet. **Commit:**
`feat(map): interactive vector stage overlay; de-bake labels from the base (DEC-050)`.

**R2.3 — Real presence on the map + out-of-venue state (DEC-051).** *(§6 #7, #8)* Replace the **mock**
`web/src/map/presence.ts` consumption with the real coarse group presence from Phase 5 (`routes/presence`
data/hooks), or an honest empty state when no squad/sharing. Detect a fix outside the bbox → show "You're outside
the festival…" **with a clear button that takes the user to the festival (event) map** (Julio's requirement —
**never just a black screen**), while still letting the user pan/zoom the venue; **optional/better** (do if not too
complex): a real OSM basemap behind a translucent overlay. **AC:** the map tab never shows invented friends; outside
the venue it never goes black and always offers the "go to festival map" button. **Tests:** unit for the
out-of-venue predicate; the map smoke shows empty-state with no squad. **Commit:**
`fix(map): wire real coarse presence; honest out-of-venue state + festival-map button (DEC-051)`.

**R2.4 — Meeting-point picker zoom + "use my location."** *(review §16; §6 #16 map half)* Ensure the
meeting-point map (`routes/meet/MeetSpotScreen.tsx`) reuses the fixed pan/zoom (R2.1) so the user can zoom to
place precisely, and the "use my current location" quick-pick works inside the venue. **AC:** the user can zoom
while choosing a spot and drop on their exact GPS. **Tests:** the existing meeting Playwright flow still passes
with zoom enabled. **Commit:** `fix(meeting): zoomable spot picker + use-my-location`.

**Gate close R2:** deploy; `chore(release)` minor bump; dev-log.

---

### R3 — P0 Performance 🔨

**Why:** review §18.1 (~3 s tab switch).

**R3.1 — Shared lineup cache.** *(§6 #9)* Add a root `**LineupProvider`** (or a module-level
stale-while-revalidate cache) so the festival + lineup are fetched **once**, served from memory across
Now/Timetable/My Plan/Onboarding, and revalidated in the background; keep the service-worker network-first /api
cache as the offline layer. Refactor `useLineup` consumers to read context. **AC:** switching between already-
loaded tabs is **< 300 ms** (no refetch/reparse); first load still shows a light skeleton; data already loaded
is cached. **Tests:** a test that two consumers mounting share one fetch (the API client is called once);
a basic render-timing assertion or a "no second network call on tab switch" test. **Commit:**
`perf(shell): shared lineup cache — instant tab switches`.

> While here, check for other per-mount heavy work (map re-fetch of transform on every Map mount, large list
> re-renders). Memoize/cache where it's a clear win; don't over-engineer.

**Gate close R3:** deploy; dev-log.

---

### R4 — P0 Navigation, data-states & dynamic data 🔨

**Why:** review §2, §6, §20 (Lineup discoverability; no-lineup / lineup-no-timetable / timetable; dynamic days;
The Gathering) + §1 (suggest a festival).

**R4.1 — Data-state surfaced (DEC-052).** Surface `hasLineup` / `hasTimetable` from the API (derive from
`withTimetable` + performance presence) to the client. **AC:** the client knows which of the 3 states it's in.
**Tests:** repo test for the flags. **Commit:** `feat(lineup): expose hasLineup/hasTimetable data-state (DEC-052)`.

**R4.2 — Lineup discoverable + default (DEC-049).** Add the compact Timetable⇄Lineup switch (keeping Timetable
full-height per DEC-032); **open Lineup by default when there's no timetable**; show clear empty states for
"no lineup yet" and "timetable not released yet." **Screens:** `15e` (Timetable), `22` (Lineup). **AC:** a user
finds the Lineup without hunting; the app is usable with lineup-only and with nothing-yet. **Tests:** Playwright:
lineup reachable in ≤1 tap; timetable-absent → Lineup shown. **Commit:**
`feat(nav): discoverable Lineup + default to it when no timetable (DEC-049)`.

**R4.3 — Dynamic days + re-prompt (DEC-048/052).** Days come from `assignFestivalDays` (R1.1), so added
days/events (e.g. The Gathering) appear automatically; when new artists/days arrive after onboarding, prompt the
user to revisit favorites; invalidated choices prompt an adjustment, never silently drop. **AC:** adding a day
doesn't break existing data; new artists trigger a re-prompt affordance. **Tests:** unit on the "new acts since
last onboarding" diff. **Commit:** `feat(onboarding): dynamic days + revisit-favorites on data updates`.

**R4.4 — Suggest a festival (DEC-055).** Guarded `POST /api/festival-suggestions` + a D1 table (name, suggested_by
nullable, created_at, count, status enum) + an admin list route; a discreet "Suggest a festival" affordance on the
festival-pick step (`OnboardingScreen` StepFestival). **AC:** a user suggests a festival without login or breaking
the flow; admin can read suggestions + frequency. **Tests:** `sql.js` test for insert + dedupe-count + list.
**Commit:** `feat(festival): suggestion capture + admin list (DEC-055)`.

**Gate close R4:** deploy; `chore(release)` minor bump; dev-log; this closes **all P0**.

---

### R5 — P1 Favorites flow 🔨

**Why:** review §3 (photos in UI, real swipe, grid alternative, intent copy, per-day grouping/progress).

- **R5.0 — Lightweight identity (DEC-060).** At first run, ask **name (required, light)** + **email (optional, clear
value prop, one-tap skip)** — **no password here**. Persist locally + send to the server for metrics (device id +
name + optional email + country via `CF-IPCountry`) feeding the admin metrics (R11.4 / DEC-057). On a later real
(non-social) sign-in, **prefill name + email and ask only for the password** (R10). **AC:** name captured; email
truly optional; reopening keeps it; sign-in is prefilled. **Tests:** unit on the identity store; Playwright: skip
email still proceeds. **Commit:** `feat(onboarding): lightweight name+email identity + sign-in prefill (DEC-060)`.
- **R5.1 — Real swipe + hint.** `OnboardingScreen → StepSwipe`: add a real drag gesture (right = keep, left =
skip) with a first-use hint animation; keep the buttons. **Commit:** `feat(onboarding): real swipe gesture + hint`.
- **R5.2 — Grid mode.** A "How do you want to pick?" choice → **grid** (2-col, photo + name, optional stage/day)
that writes the same favorites store as swipe. **Screens:** `15`/`15b` (grid). **Commit:**
`feat(onboarding): grid favoriting mode alongside swipe`.
- **R5.3 — Per-day grouping + per-day progress + intent copy.** Group acts by `festivalDayId` (R1.1); show "Day 1
of 3 · 70%"; add the explainer ("you're building favorites, not the final plan; we use these later"). **Commit:**
`feat(onboarding): per-day grouping + progress + intent copy`.
- **R5.4 — Photos in every artist surface (UI half of #1, DEC-061).** Render `imageUrl` in: swipe, grid, timetable
cards, Lineup, My Plan, Now/Next, stage sheet. A shared `<ArtistPhoto>` component that **appends the CDN resizer
`?width=`** per surface (≈160 list/grid, ≈320 cards, ≈520 detail) and **URL-encodes** the path (CDN URLs contain
spaces), with a branded placeholder when `imageUrl` is null. **AC:** no artist with a photo shows blank; missing →
placeholder; images are right-sized (no 5000px download for a 40px avatar). **Commit:**
`feat(ui): artist photos everywhere (CDN ?width=, placeholder)`.
- **Tests:** Playwright onboarding flow (swipe + grid both favorite; per-day progress; photo or placeholder
present); the dedup-once-across-days behavior still holds.

**Gate close R5:** deploy; dev-log.

---

### R6 — P1 Now & Next logic 🔨

**Why:** review §4 (Now/Next must reflect favorites/plan, not arbitrary artists).

- **Change:** `domain/nowNext.ts` + `NowScreen.tsx`: if a locked **My Plan** exists for the active festival day →
show the plan's current/next item (+ walk/break, reusing Phase-3 travel); else show **favorites in chronological
order** (now / next / later); else an honest empty state ("Pick artists to build your plan"). Re-verify after
R1.1 day logic.
- **AC:** Now/Next never looks random; it prioritizes plan, then favorites; empty state explains itself.
- **Tests:** unit covering the 3 branches with concrete sets; the `now` Playwright spec asserts a favorited act
appears.
- **Commit:** `fix(now): drive Now & Next from plan then favorites, never arbitrary`.

---

### R7 — P1 Timetable & Lineup polish 🔨

**Why:** review §5, §10 (card lines, hour gridlines, touching cards, heart centering, photos, compact top bar,
Lock-in placement).

- **R7.1 — Card recipe.** One **thin** top stage-color line; remove the bottom colored line; vertically center the
heart; render the artist photo. (`TimetableScreen.tsx` + `styles.css`.) **Commit:**
`style(timetable): single thin stage line, centered heart, photos`.
- **R7.2 — Hour/30-min gridlines.** Render discreet background lines from `domain/timetable.ts → hourMarks` (add
half-hour marks); a setting to toggle (default on, subtle). **Commit:** `feat(timetable): discreet time gridlines`.
- **R7.3 — Touching-card margin.** When `endMs == nextStartMs`, add a minimal visual gap; keep real gaps
proportional. **Commit:** `style(timetable): tiny separation for back-to-back sets`.
- **R7.4 — Compact top bar (DEC-032/049).** Consolidate the chips (day selector, All/My-favs, zoom, Lock-in,
Lineup switch) into a compact row that doesn't steal grid height. **Commit:** `style(timetable): compact controls`.
- **Tests:** the timetable grid Playwright spec still passes (favorite→gold, only-favs, zoom); a unit asserts
half-hour marks exist.

**Gate close R7:** deploy; dev-log.

---

### R8 — P1 My Plan editable 🔨

**Why:** review §9 (editable plan, the dead dot, "Add set" flow).

- **Change:** `MyPlanScreen.tsx`: each item → a **context menu** (View details / Swap set / Remove from plan /
View on map / Resolve this slot's clashes). Give the right-side dot a real action (open the menu) or remove it.
Make **Add set** open a picker filtered by day + time window (reuse `domain/lineup.ts → nearbySets`) that
re-runs the resolver gate so breaks/clashes recompute. Edits persist to the local plan store (DEC-041).
- **AC:** the user can swap/remove/add without re-walking the whole Lock-in; the timeline is interactive; no dead
control; the plan stays zero-overlap after edits.
- **Tests:** unit that swap/remove/add keep zero overlaps; Playwright: edit a plan item end-to-end.
- **Commit:** `feat(my-plan): editable timeline — swap/remove/add-set with recompute`.

---

### R9 — P1 Squad 🔨

**Why:** review §12–§17 (the squad cluster).

- **R9.1 — Multiple squads.** `SquadScreen` reads the full `useMyGroups()` list (already returned) and adds a
**squad switcher** (active squad clearly shown); data stays isolated per squad. **Screens:** `23`. **Commit:**
`feat(squad): multiple squads + switcher`.
- **R9.2 — Honest hero copy.** Remove "even when the signal dies / 2% battery"; use truthful value copy (review
§12.1). **Commit:** `copy(squad): honest hero copy`.
- **R9.3 — Avatar photo on R2 (DEC-059 — R2 ENABLED, card on file) + custom emoji.** **Julio added a card and
enabled R2**, so the avatar photo ships on **Cloudflare R2** through a thin **storage adapter**
(`server/src/media/store.ts` — `putImage`/`getImage`/`deleteImage`, content-type allowlist jpeg/png/webp, max-byte
guard, keys `avatars/<memberId>.<ext>`). **Provision once:** `wrangler r2 bucket create festpilot-media`, then bind
it in `server/wrangler.*` as **`MEDIA`** (`[[r2_buckets]]`) — the binding is the in-Worker access path; the
account-scoped operator token `festival-disk-05e9` is only for the CLI create/deploy step, **never** stored in code.
Upload route `POST /api/media/avatar` enforces the DEC-059 **app quota** (client-compress to ~150 KB, **one
avatar/user**, a global object-count ceiling, **reject writes above a configured byte budget**); serve via
`GET /media/:key` (immutable long-cache). Set a **~$1 budget alert** in the dashboard (free tier: 10 GB, 1M Class-A,
10M Class-B ops/mo, egress free). Render with **initials+color as the placeholder/fallback**. The **Cloudinary
"no-card" fallback is retired** now the card is in (the adapter keeps the provider swappable, no ⏳). Add a **custom
emoji** input alongside the picker (`CreateSquadScreen`/profile). **The same adapter unblocks the meeting-point photo
(DEC-047) — see R9.5.** **AC:** a user sets a real avatar within quota; oversize/wrong-type/over-budget is rejected
honestly; photoless profiles still show initials+color. **Tests:** adapter unit (allowlist + max-byte + quota math,
R2 binding mocked) + route accept/reject. **Commit:** `feat(squad): avatar photo on R2 + custom emoji (DEC-059)`.
- **R9.4 — Auto-share on join (DEC-054).** On first join, a one-time "Share your plan with the squad?" confirm
that **defaults to on** (plan + favorites), with a Settings opt-out; wire into `ShareMyPlanScreen` + join flow.
**Commit:** `feat(squad): auto-share plan+favorites on join (DEC-054)`.
- **R9.5 — Real mini-map + richer meeting card (+ photo) + main-screen density.** Replace the blurred mini-map
placeholder with a real preview (squad pins on the venue, reusing the map overlay); enrich the meeting-point card
(creator, distance/ETA, going count, actions — most already in `MeetingPointDto`) **and add the meeting-point photo
(DEC-047, now unblocked) via the R9.3 R2 adapter** (`POST /api/media/meeting/:id/photo`, same compress + quota +
serve; render with a graceful no-photo state); surface key squad state on the main screen (review §17 — **compare
the older squad wireframes `16`/`20` with the current `SquadScreen`** and bring the best of the old design without
losing current functions). **Commit:**
`feat(squad): real mini-map preview + richer meeting card + meeting photo on R2 (DEC-047)`.
- **R9.6 — AI icon + J-vs-gear.** Give the "Build squad plan" AI icon a real function (generate a squad-plan
suggestion from members' favorites/clashes) **or** remove it / add a tooltip — never a dead icon. Make the
Now/Next "J" open a **profile menu** (Profile / Settings / Squad profile) rather than jumping straight to
Settings (or use a gear if it must go straight there). **Commit:**
`fix(squad): give the AI icon a real action; J → profile menu`.
- **Tests:** the squad Playwright flows still pass (create/join/members); a new test for the switcher + auto-share
confirm; meeting card shows ETA/going.

**Gate close R9:** deploy; `chore(release)` minor bump; dev-log.

---

### R10 — P1 Settings, global polish & app-feel 🔨

**Why:** review §18 (perf done in R3; i18n, PWA install, check-updates, About), §19 (contrast), §12.6 (no select).

- **R10.1 — i18n (DEC-039 Q-K).** A real i18n layer (EN default, PT switch persisted across reloads); route UI
copy through it; the language selector in Settings actually changes the app. **Commit:**
`feat(i18n): working EN/PT switch, persisted`.
- **R10.2 — PWA install + check-for-updates.** Capture `beforeinstallprompt`; the "Add to home screen" row fires
the prompt (Android/Chrome), shows iOS instructions, and an "Installed" state; make Check-for-updates honest via
the SW update flow (new version → reload prompt; none → clear message). **Commit:**
`feat(pwa): real install prompt + honest update check`.
- **R10.3 — About.** Finish/route `AboutScreen` (name, version, build/date, changelog/"what's new", support +
legal links). **Commit:** `feat(settings): About page (version + changelog + links)`.
- **R10.4 — Global contrast + no-text-select.** App-wide `user-select:none` + `-webkit-touch-callout:none` with
inputs/textareas re-enabled; a contrast pass on dark-on-dark buttons/labels (how-you-appear, meeting-point,
location buttons — review §12.6/§15/§16/§19). **Commit:** `style(a11y): app-feel no-select + contrast pass`.
- **Tests:** unit that PT switch flips a sample string + persists; a Playwright check that body text isn't
selectable but an input is; contrast spot-checks.

**Gate close R10:** deploy; `chore(release)` minor/patch bump; dev-log; **this closes P1.**

---

### R11 — Admin back-office 🔨 (operator-critical; DEC-057)

**Why:** Julio's follow-up — admin today is undocumented endpoints with no UI; onboarding new festivals, real-usage
visibility, free-tier safety, and live testing all need it. A desktop wireframe already exists
(`brain/wireframes/directions/30-amber-admin.html`, 6 screens). Build with **our standard** (Amber-Glass, English
code, tests). **This gate does not block P0/P1 user fixes** — do it after R10, but you MAY pull a piece earlier if a
fix needs it (e.g. R11.5 to verify the map, R11.2 to onboard data).

- **R11.0 — Admin auth + shell.** A guarded admin route group (`x-admin-token` now; a proper admin login is a later
add) + the Amber-Glass desktop shell/nav from the wireframe. **AC:** non-admins can't reach it. **Tests:** a request
without the token is rejected. **Commit:** `feat(admin): guarded admin shell + nav`.
- **R11.1 — Festivals + lineup/map/POI/travel (wireframe screens 1–6).** Festivals overview (KPIs, add festival),
Lineup & timetable dashboard (source shown, per-stage counts, verify flags, alias merge, re-import), Map editor
(drag pins → `generateMap`, DEC-034), Georeference/verify (affine control points), POI editor, Travel-time matrix —
reusing the productized map engine + existing ingestion. **Commit(s):** one per screen, `feat(admin): <screen>`.
- **R11.2 — Data-source registry per festival (DEC-057).** For each festival, store **where its data comes from + how
it's captured** (official page → resolve `event`+`uuid` → CDN JSON, per DEC-009), with a **manual add/edit** path for
festivals without a clean source. Leave a field for a future **AI-assisted lineup/timetable reader** that pre-fills
on create/edit (build the reader later). **AC:** every festival shows its data origin + capture method. **Commit:**
`feat(admin): per-festival data-source registry`.
- **R11.3 — Festival suggestions inbox (DEC-055).** List suggestions + frequency + status transitions. **Commit:**
`feat(admin): festival-suggestions inbox`.
- **R11.4 — Usage metrics + free-tier runway (DEC-057).** **Usage:** users (name + optional email + country +
last-seen — from DEC-060) + app-usage counters (light D1 tables + an event ping). **Quota/runway:** per-service
consumed-vs-free-ceiling (Workers / D1 / DO / R2 …) from **Cloudflare Observability (GraphQL Analytics)**, plus an
**estimated runway** ("at the current rate, service X hits the free limit in ~N days") from current averages.
**AC:** Julio sees who's using the app + how close each free tier is. **Tests:** runway math unit test (rate →
days-left). **Commit:** `feat(admin): usage metrics + free-tier runway`.
- **R11.5 — Live test command console (DEC-057 / council 4).** Inject **synthetic test users at chosen map positions
in real time** (drag a pin → presence updates → Julio's client in the same test group sees it live), reusing
`POST /api/presence` + the `GroupRoom` DO. **Guard-rails:** `x-admin-token`; **only `is_test=1` users, never real
ones**; scoped to a test festival/group; test entities visually marked in the client; a **purge-test-data** action.
Optionally script a walk (interpolate fixes over time). **AC:** Julio drives fake members live to test
presence/meeting/map/squad; no test data leaks into real metrics. **Tests:** the inject endpoint refuses
non-`is_test` targets; purge clears them. **Commit:** `feat(admin): live test command console (is_test only)`.
- **Schema:** new light D1 migrations — `festival_suggestion`, `app_user` metrics fields
(name/email/country/last_seen/`is_test`), `usage_event`, `festival_data_source`. Add migrations; never edit applied
ones.

**Gate close R11:** tests green; deploy Worker + admin (Pages **master**); dev-log + decision-log; `chore(release)`
minor bump. **This closes the admin scope.**

---

## 11. Problem table (situation → action) + WSL pager safety


| Situation                                       | Action                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Any git read** (`log`/`diff`/`show`/`branch`) | Always `git --no-pager …`; commit only with `-m`/HEREDOC. Never `-i`/interactive, never `less`/`vim`.                                          |
| A shell command hangs >30s with no output       | Don't re-run/wait. Read the terminal file metadata for the bash pid; `ps` for a stuck `less`/editor; kill it.                                  |
| `wrangler`/`vite` fails on Node 20/18           | `nvm use 22` first (system default is 18).                                                                                                     |
| Artist photos                                   | The CDN performances JSON already carries `artists[].image` (DEC-061) — just **re-ingest** + render with `?width=` (URL-encode the path). No separate source/scraper.                                            |
| Avatar / meeting-point photo                    | **R2 is ENABLED (card on file, DEC-059).** Ship on **R2** via the adapter (bucket `festpilot-media`, binding `MEDIA`): client-compress ~150 KB, app quota (1 avatar/user, object ceiling, reject-over-budget), **~$1 budget alert**; initials/color = placeholder. Cloudinary "no-card" fallback **retired** (kept swappable). |
| Live deploy needs a credential you don't have   | Run the `--local` / `wrangler dev` equivalent, mark ⏳, keep building.                                                                          |
| Browser/screenshot daemon times out (WSL)       | Don't block on visual verification; verify via tests + build; leave a "run it locally" note.                                                   |
| A change would contradict a brain decision      | If it's Julio's review direction, adopt as `DEC-NNN` PROPOSED (§7) and proceed; otherwise pick the brain-consistent default and write the DEC. |
| Tests fail after a change                       | Recovery §9; fix forward with a new commit; never `--amend` pushed work.                                                                       |
| Cloudflare Pages deploy shows as **Preview**    | Deploy with `wrangler pages deploy web/dist --project-name=festpilot --branch=master`; verify it landed on **Production** (master), not a preview (DEC-037).                                                   |
| Need fake people/positions to test a feature    | Use the **R11.5 admin test console** (`is_test=1` users via `POST /api/presence` + DO), never mock code in the client.                          |
| Genuine ambiguity, brain silent                 | Run the inline council **now** (1 request, no subagents), record a `DEC-NNN` PROPOSED, **continue** — never stop to ask (DEC-056).             |


---

## 12. Definition of Done / Stop Criteria

**A gate is done when:** its tests + cumulative review items pass; `typecheck`/`test`/`build` clean; the
golden-path smoke passes; deployed (or ⏳ with local proof); committed; dev-log updated.

**Reaching a gate is NEVER a reason to stop or ask permission** — commit, deploy, dev-log, and continue to the next
gate (DEC-056). Stop only at the terminal hand-off. **The pass is done — STOP only when ALL are TRUE:**

- [ ] **P0 fixed:** festival-day blocks (00:30 groups with the night); Lock-in decisions are anchor-overlap only
  (no 21:00 in a 16:00 clash) with the plan still zero-overlap; artist photos ingested + rendered (or ⏳ with
  placeholders shipped); map has pan limits + crisp interactive vector stages + no black void + real/empty
  presence; tab switches < 300 ms; the 3 data-states + dynamic days + suggest-a-festival work.
- [ ] **P1 fixed:** real swipe + grid + per-day progress + photos; Now/Next plan-then-favorites; timetable card
  polish + gridlines + touching-card margin + compact top bar; My Plan editable (swap/remove/add); squad
  (multiple, honest copy, custom emoji, **avatar + meeting-point photos on R2 — compressed + quota-capped**,
  auto-share, real mini-map, richer meeting card, AI-icon, J-menu);
  settings (PT i18n, PWA install, check-updates, About); global contrast + no-select.
- [ ] No dead affordances; no false copy; no mock-as-real anywhere.
- [ ] Full test suite green (unit + integration + E2E) in CI; coverage targets met on changed code.
- [ ] **Admin (R11):** the 6 wireframed screens + data-source registry + suggestions inbox + usage metrics +
  free-tier runway + live test console (`is_test`-only) are built & deployed (or the not-yet-pulled parts are noted
  in dev-log).
- [ ] `dev-log.md`, `decision-log.md` (DEC-048→061), `project-status.md` current; deployed to Pages **(master, not preview)** + Worker.
- [ ] The manual-test matrix (review §22) passes on a phone, or is documented with what's ⏳.

---

## 13. Anti-patterns (do NOT do these)

- Rebuilding screens/flows that already work instead of fixing them. (§0)
- Jumping to visual polish before the logic/data bug is fixed. (§5)
- Leaving a button/icon/dot with no action, or copy promising a missing feature. (§3)
- Showing mock presence as real friends. (§3, §6 #8)
- Baking stage labels/pins into the map raster; sending raw presence coords to clients. (§3)
- Putting raw coordinates in the coarse group feed, or doing continuous background tracking. (Exact coords ARE
  allowed for features that need them, via an explicit + expiring share — DEC-058 — but never silently or in the
  background.) (§3)
- Changing the resolver so a locked plan can overlap; or "fixing" the clash UI without the anchor-overlap math. (R1.2)
- Inventing artist photos / a scraper instead of the documented source. (§6 #1, DEC-009)
- Editing an applied migration instead of adding a new one; committing with red tests; `--amend` on pushed work.
- Asking the user to confirm, or to advance to the next fix/milestone/gate (DEC-056); spawning subagents; stopping
  because the chat is long or a milestone just finished. (§1)
- `git log` without `--no-pager`; bare `git commit`; any interactive `-i`; forgetting `nvm use 22`. (§11)

---

## 14. Brain sync rules

- **Every milestone:** update `FestPilot/dev-log.md` (a "Review-remediation pass" section, most-recent-first).
- **Every new/changed decision:** the DEC-048→061 entries (and any new one) in `brain/decision-log.md`; mark what
each refines/supersedes (DEC-024/032/040/041/044/046/047/053); bump the file's `Last updated`.
- **End of pass:** update `brain/project-status.md` (what the remediation shipped, what's ⏳).
- **Any doc edit:** update its `> Last updated:`.
- Keep `README.md` build/run/deploy accurate if commands change.

---

## 15. The manual-test matrix (review §22 — run on a phone at gate closes)

**Identity:** first run asks name (required) + email (optional, skippable); reopening keeps it; a later sign-in is
prefilled. **Favorites:** festival → weekend → days → favorites; photos load; swipe L/R; switch to grid; grid
selects; favorites saved; per-day progress. **Timetable:** open a day with sets before & after 00:00 → midnight shows under the
correct night; All/My-favs; Lineup ⇄ Timetable; gridlines; single thin line; centered heart. **Lock-in/My Plan:**
favorite non-clashing + clashing + distant acts → Lock-in shows only the true window's options; final plan is
chronological + zero-overlap; edit/remove/add a set. **Map:** open; zoom (stays crisp); drag to the edges (no
black); tap a stage; meeting point with zoom; outside the venue (no black screen + a "go to festival map" button). **Squad:** create; preset +
custom emoji; avatar; share invite (WhatsApp); join a 2nd squad; switch squads; mini-map shows members; create a
meeting point; see it on the home; approximate + precise location. **Settings/PWA:** theme; PT switch (UI
changes) + persists on reopen; Add-to-home-screen prompt; Check-for-updates; About; fast tab switches. **Admin (R11, desktop):** reachable only with
the token; add/onboard a festival with its data-source recorded; suggestions inbox; usage metrics show real users +
country + last-seen; free-tier runway shows days-left per service; **test console injects a fake member at a map spot
and your client sees it live**, then purge clears it.

---

## 16. GO

1. Read §0–§9 + `dev-log.md`. `nvm use 22`; confirm the tree is green.
2. **Start R0**, then go gate-by-gate **R1 → R10 → R11** (P0 before P1, then Admin), committing per fix and
  deploying per gate (Pages **master**, never preview), until §12 Stop Criteria are all TRUE. Keep the brain in
  sync (§14). **Never ask to advance** — ambiguity → council-on-the-spot + DEC + continue (DEC-056). Don't stop. Fix.

> *This remediation orchestrator is the execution truth for the post-review pass; the brain is the product
> truth; the 2026-06-23 orchestrator is the original-build truth. If they ever conflict, fix it explicitly
> (update the brain + add a `DEC-NNN`), then continue.*

