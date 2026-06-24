# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-23-v1-implementation-orchestrator.md` and its §3 non-negotiables.
> Seeded 2026-06-23.

---

## Review-Remediation Pass (2026-06-24) — ACTIVE

> Execution truth: `brain/documents/2026-06-24-v1-review-remediation-orchestrator.md`. Order: R0→R11 (P0 first,
> then P1, then Admin). Commit per fix; deploy + dev-log per gate. Autonomy: never stop to ask to advance (DEC-056).

### Current State (this pass)
- **Gate:** **R2 (P0 map) in progress** — R2.1 ✅ pan-clamp · R2.2 ✅ vector stage overlay + de-baked base. Next: R2.3 real presence + out-of-venue.
- **Tests now:** typecheck clean · **server 122 + web 178 unit** pass · build OK · **app v0.8.1**.
- **Baseline (2026-06-24, pre-change):** server 121 + web 147 unit (worker 158.55 KiB / gzip 36.73; web 401 KB / gzip 121).
  Live D1 `e6753623-2b4e-41ce-9725-4bd417966cfa`.
- Live URLs unchanged: app https://festpilot.pages.dev · API https://festpilot.trippilot.workers.dev.

### Gate checklist
- [x] **R0** — Setup: nvm22, baseline green, DEC-048..061 verified in decision-log, dev-log seeded, commit.
- [x] **R1** (P0 data/logic) — festival-day blocks (DEC-048) · clash anchor-overlap (headline) · artist photo re-ingest (DEC-061). **CLOSED 2026-06-24.**
- [ ] **R2** (P0 map) — pan clamp + safe-area · interactive vector stage overlay (DEC-050) · real presence + out-of-venue (DEC-051) · meeting picker zoom.
- [ ] **R3** (P0 perf) — shared lineup cache (<300 ms tab switch).
- [ ] **R4** (P0 nav/data-states) — hasLineup/hasTimetable (DEC-052) · discoverable Lineup (DEC-049) · dynamic days · suggest-a-festival (DEC-055).
- [ ] **R5** (P1 favorites) — identity name+email (DEC-060) · real swipe · grid mode · per-day grouping · artist photos everywhere.
- [ ] **R6** (P1 now/next) — plan-then-favorites, never arbitrary.
- [ ] **R7** (P1 timetable polish) — card recipe · gridlines · touching-card margin · compact top bar.
- [ ] **R8** (P1 my-plan) — editable timeline (swap/remove/add) keeping zero-overlap.
- [ ] **R9** (P1 squad) — multiple squads · honest copy · avatar on R2 + custom emoji (DEC-059) · auto-share (DEC-054) · real mini-map · meeting photo · AI-icon/J-menu.
- [ ] **R10** (P1 settings/polish) — i18n EN/PT · PWA install · check-updates · About · contrast + no-select.
- [ ] **R11** (Admin, DEC-057) — auth+shell · festivals/map/POI · data-source registry · suggestions inbox · usage metrics + runway · live test console.

### Pass log (most recent first)
- **R2.2 ✅ (2026-06-24) — interactive vector stage overlay + de-baked base (DEC-050, §6 #5).** The base raster
  baked the 10 stage medallions + names → they pixelated at zoom and weren't tappable. Added a `stageMarkers`
  toggle through the map-art engine (`draw.ts` ArtOptions → `generate.ts` GenerateOptions → `run.ts`
  `NO_STAGE_MARKERS`), regenerated De Schorre **offline** (cached OSM, no Overpass) into a **label-free** SVG, and
  re-rasterized to WebP (resvg+sharp, Node 22) → shipped `web/public/maps/*.webp` (night 420 KB / day 388 KB).
  Verified 0 `<text class="stage-label">` baked. `MapView` now draws stages as a crisp vector overlay from
  `transform.stages` via `geoToSvg`: amber medallion (per-stage `stageColor`), star, screen-stable label
  (`pinScale = min(1/scale, 1.6)` so it never balloons zoomed-out), a live-dot when a set is on, and **tap → a
  stage info sheet** with now-playing + next (pure `domain/stageProgramme.ts` over `useLineup`'s sets, formatted
  with `timeInZone`). Tap-vs-pan guarded by comparing the click point to the pointer-down point. Tests +10:
  `stageProgramme` (7 — live/next/gap/exclusive-end/per-stage), `MapView` render (3 — pins are overlay nodes not
  the base, tap opens the sheet with now-playing, drag doesn't). **web 178 unit · typecheck · build · spike
  typecheck OK.** Next: R2.3 real coarse presence on the map + out-of-venue state (DEC-051).
- **R2.1 ✅ (2026-06-24) — pan clamp + safe-area fit (§6 #4/#6).** New pure `map/panClamp.ts`
  (`fitScale`/`fitView`/`clampPan`): the scaled world must always cover the viewport's **safe rect**
  (viewport minus the in-canvas chrome insets), with a 40px cosmetic bleed; under-sized worlds centre
  instead of pinning. `usePanZoom` now takes `insets`, clamps every pan/zoom through `clampPan`, fits via
  `fitView`, and re-clamps (not re-fits) on geometry/viewport changes once the user has moved (ResizeObserver)
  so a growing sheet never strands the art nor yanks zoom. `MapView` measures the topbar + friends-sheet
  heights (callback refs + ResizeObserver) and feeds them as insets, so the initial view frames the venue in
  the visible area and the bottom sheet never hides it. **AC:** can't drag into the void; venue framed; bottom
  bar clear. Tests +7 (`panClamp`: fit + cover invariant across 3 sizes × 4 scales, centre, insets, bleed).
  **web 168 unit pass · typecheck OK.** Next: R2.2 interactive vector stage overlay (DEC-050).
- **R1 GATE CLOSED ✅ (2026-06-24) — deployed + photos live.** Cumulative **server 122 + web 161 unit** green,
  typecheck + build clean. Golden-path smoke (onboarding day-select → favorites → lock-in → My Plan) holds.
  Bumped app **v0.8.0 → v0.8.1** (`changelog.ts`, single source) with a user-facing "Sharper days & honest
  clashes" note + how-to-test. **Deployed:** Pages → Production `master` (web 0.8.1) and confirmed live;
  **Worker had no R1 changes** (festival-day, clash and photo *pipeline* logic are all web/already-deployed —
  R1.3 needed only a re-ingest, which the live cron already ran: the API serves W1 artist photos). Brain sync:
  DEC-048 + DEC-061 marked IMPLEMENTED with the plurality-id note; dev-log + project-status updated. → R2 map.
- **R1.3 ✅ code (2026-06-24) — artist photos pipeline verified + regression test (DEC-061).** Confirmed the
  full path already carries the CDN photo end to end — `normalize.ts` keeps `a.image` → `store.ts` upserts
  `artist.image_url` with `ON CONFLICT(source_artist_id) DO UPDATE SET image_url = excluded.image_url` (so a
  re-ingest **backfills** photos onto rows imported before the field existed, idempotently) → `repo.ts`
  selects `a.image_url` and serves it as `imageUrl`. **No production code change, no new scraper/endpoint
  (DEC-009).** The spike HAR fixtures predate the field, so added a `sql.js` integration test that injects a
  photo onto one real W1 artist (every occurrence, so first-seen dedup keeps it) and asserts `image_url`
  stored + served as `imageUrl`, with photoless artists staying **null** (no fabrication). **server 122 + web
  161 unit pass · typecheck · build OK.** Live re-ingest happens at gate-close R1 (deploy + verify on the API).
- **R1.2 ✅ (2026-06-24) — Lock-in clash = anchor-overlap, not transitive chain (headline bug).** New
  `intervals.ts → clashAt(sets, fromEnd)`: anchors on the earliest unresolved set and returns it plus
  **only its true overlaps** (`overlaps(anchor, x)`), sorted by start — no transitive chaining. Used in
  `resolver.advance` (the surfaced `decision.options`), `countRemainingClashes` and
  `previewRemainingClashes` so the progress count matches the actual walk. **The gate is untouched** (a
  pick still consumes the timeline to its end), so the zero-overlap property test (300 seeds × 3
  strategies) stays green. `LockInScreen` needed **no change** — it already reads `decision.startMs`
  (now the anchor's start, "16:00") and `decision.options` (now anchor-overlap only). `clusterByOverlap`
  is kept (still unit-tested) but no longer used by the resolver. Tests +5: `clashAt` (3, incl. the
  A∩B,B∩C,A∌C non-chain case), Julio's 12/13/14:30 + 16–22 spread (each decision anchor-overlap only;
  16:00 never offers 21:00; next decision is the next real overlap), preview count == decisionsTotal.
  Updated the gate test's transitive expectation (`["short","long","t1","t2"]` → `["short","long"]`).
  **161 web unit pass · typecheck · build OK.** Next: R1.3 artist photo re-ingest (DEC-061).
- **R1.1 ✅ (2026-06-24) — festival-day blocks (DEC-048), commit `24142e7`.** New pure `domain/festivalDay.ts`:
  `assignFestivalDays(perfs, gapHours=3)` sorts by start and splits into contiguous blocks on a ≥3h all-stage gap
  (running **max-end**, so a long set's tail holds the night together); window = first-start..max-end so it crosses
  midnight; block `id` = **plurality** of the block's source `day` labels. Plurality (not the first set's label) was
  the key call: live W1 has 2 mis-tagged strays out of 408 ("Not My Type" tagged FRIDAY but plays Sat 15:30; "Poleen"
  FRIDAY but plays Sun 12:00) — plurality outvotes them and the gap-split re-homes them by time, while the id stays
  `FRIDAY`/`SATURDAY`/`SUNDAY` so persisted `planKey`/onboarding `dayKeys` are untouched (verified: favorites are
  festival-scoped, plans are `${festivalId}:${dayKey}`). Routed `daysForWeekends` (chips, same-id merge for W1+W2),
  `buildTimetable` (block **membership**, not raw label), and onboarding act day-grouping (`uniqueActs` gained an
  optional `dayOf`) through it; Now & Next needs no change (per-day slots keyed by the same stable id). Tests +7
  (midnight cross, 3h boundary, multi-stage tail, plurality re-homes stray, timetable midnight window). **156 web
  unit pass · typecheck · build OK.** Next: R1.2 clash anchor-overlap.
- **R0 ✅ (2026-06-24):** confirmed baseline green on the untouched tree (server 121 + web 147; typecheck/build clean);
  verified DEC-048→DEC-061 present in `decision-log.md`; seeded this section. Next: R1.1 festival-day blocks.

---

## Current State
- 🔨 **BUILD IN PROGRESS (2026-06-24).** Executing the orchestrator autonomously. **PHASE 0 + 1 + 2 + 4 + 5 COMPLETE + LIVE; PHASE 3 core done; PHASE 6 G6.1 ✅ + G6.2 ✅ + G6.3 ✅ → PHASE 6 COMPLETE.** **V1.x follow-ups (undo / split / share) ✅ + LIVE.**
  Design pass + brain are done (59 screens locked, prototypes `23`–`30`). About screen + changelog shipped (single-source `APP_VERSION`, now `0.8.0`).
- Active Phase / Gate: **PHASE 6 COMPLETE + V1.x polish COMPLETE.** G6.1 "come to me" ✅ + G6.2 lifecycle ✅ + **G6.3 compass nav + "I'm lost" safety ✅** (live).
  **V1.x follow-ups requested by Julio — ALL DONE & LIVE this session:** ✅ **undo / "what did I give up"** (clash resolver + onboarding swipe), ✅ **rich group split view** (#24.5), ✅ **share my plan as branded image/link** (canvas poster, Web Share files / save / copy).
  P5 ✅ (presence pipeline + G5.1 consent + G5.2 roster/coarse map + G5.3 ping/sharing-picker/privacy; precise exact-dot rides this Phase-6 channel per DEC-046).
  P3 core ✅ (travel matrix + coord→stage, Now & Next, stage routing/walking nav, offline contract); POI layer deferred (needs data).
  Phase 0: G0.1–G0.4 ✅ (live). Phase 1: **G1.1 ✅ · G1.2 ✅**. Phase 2: **G2.1 ✅ · G2.2 ✅ · G2.3 ✅**. Phase 3: **G3.2 ✅ · G3.3 ✅**.
- **P4 G4.1 identity ✅ (this session):** auth **seam** `server/src/auth.ts` (`parseAuthIdentity`/`getUserFromRequest`) — V1
  ships **anonymous-local** (`anon.<ulid>` bearer → `app_user` is_anonymous, DEC-042); Firebase JWT verification slots in
  later unchanged. `api/users.ts` (`ensureUser` upsert by firebase_uid, idempotent, COALESCE profile edits) + `api/me.ts`
  (`GET/PUT /api/me`) + migration `0003_app_user_profile.sql` (avatar_color) applied remote. Web: `data/authToken.ts`
  (token mint + Authorization header + cached user), `data/identity.ts` (`useIdentity`, `initialsOf`, dot palette),
  `api.getMe/updateMe`. Screens: **Sign-in** (#23.2 guest primary, Google/email-link "Soon", no Apple) + **Profile**
  (#23.3 name + initials avatar + dot color) + **Squad** rebuilt (empty hero #23.1 → ready state). 7 server + 5 web unit
  tests + a `squad` Playwright flow (empty→guest→profile→ready, 3 screenshots). Worker redeployed; Pages
  https://218bfb60.festpilot.pages.dev.
- **P4 G4.2 groups ✅ (this session):** first **Durable Object** — `GroupRoom` (SQLite backend, `new_sqlite_classes` in
  `wrangler.toml`; $0 on Free per DEC-037) for realtime **fan-out**: writes POST the DO `/notify` → broadcasts
  `{changed,rev,topic}` to hibernatable WS clients → they re-fetch (+ focus-refetch fallback). **D1 source of truth.**
  Server: `api/groups.ts` (create / join-by-token idempotent + **cap 50** / members owner-first / invite preview / leave
  with **owner-transfer**), `api/groups-routes.ts` (`POST /api/groups`, `GET /mine`, `GET /invite/:token`, `POST /join`,
  `GET /:id`, `GET /:id/socket` [WS `?t=`], `POST /:id/leave`), migration `0004_app_group_emoji.sql` applied remote.
  Web: `data/groups.ts` (`useMyGroups`/`useGroup` + WS+focus live), `api` group methods + `qrcode` for a real scannable
  QR. Screens: **Create** (#23.4 emoji+name, festival locked), **Invite** (#23.5 QR + link + share, no-expiry),
  **Join** (#23.6 paste-code + invite preview, guest gated through sign-in/profile via `?next`), **Squad** rebuilt to
  group-home (#23.7 plan CTA + member list + invite + leave). **10 server + 0 new web unit** (covered by repo tests) +
  `squad` Playwright rewritten: 2 flows (owner empty→create→invite→home; joiner link→guest→join→**members 2**) with 6
  screenshots. DEC-043. Worker + Pages deployed (https://cd81a5da.festpilot.pages.dev).
- **P4 G4.3 shared timetable ✅ (this session):** the squad timetable is **server-raw + client-aggregated** (DEC-044).
  Server stays a thin store: migration `0005_group_shared_plan.sql` (`group_member_plan` raw locked picks w/ partial-set
  cuts; `group_member_favorite` **act-keyed**, opt-in only; `plan_shared_at_utc`/`share_favorites` flags on
  `group_member`; owner overrides reuse `group_plan_slot`), `api/squadPlan.ts` (`shareMyPlan`/`unshareMyPlan`/
  `getSquadPlanData`/`set+clearOverride`) + 5 routes (`GET/PUT/DELETE /:id/plan`, `POST/DELETE /:id/plan/override`,
  all member-gated, override owner-gated), `notifyGroup(...,"plan")`. **Aggregation is the pure `domain/squadPlan.ts`
  `buildSquadPlan`** (plurality → favorited → owner; split; "who's going"; YOUR status following/own/**conflict**;
  favorites-fallback DEC-019) — **11 domain tests**. `data/squadPlan.ts` (`useSquadPlan` joins raw + lineup + local favs,
  reusing the G4.2 WS+focus refresh). Screens (4): **Share my plan** (#23.8 toggles + locked preview), **Squad plan
  overview** (#24.1 blocks + day seg + NOW + needs-input #24.6 + share CTA), **Block detail** (#24.2/3/5 squad pick +
  avatars + split + **never-silent** Join/Keep + fallback — DEC-013), **Owner override** (#24.4 candidate list + pin/
  revert). Shared `squadUi.tsx` (avatar stack, status pill, method label). **55 server + 95 web unit + 12 e2e green**
  (new `squad-plan` spec: share→overview→block→override, 4 screenshots). Worker live (migration 0005 remote + routes);
  Pages https://282aabd7.festpilot.pages.dev. Web `0.2.0`→`0.3.0`.
- **P4 G4.4 group board ✅ (this session):** lightweight **pinned notes — NOT chat** (UC-39, DEC-013, DEC-045). Reused the
  pre-existing `group_board_note` table (**no new migration**). Server `api/board.ts`: `listNotes` (pinned-first then
  newest-first), `postNote`, `editNote` (**author-only**, stamps `updated_at_utc`), `setPinned` (**owner-only**),
  `removeNote` (**author or owner**); body cap 500. 4 member-gated routes (`GET/POST /:id/board`,
  `PUT/DELETE /:id/board/:noteId`), each `notifyGroup(...,"board")` → DO fan-out (reuses G4.2 WS+focus). Web:
  `data/board.ts` (`useBoard` reusing `useGroupLive`), `api` board methods, `types.ts BoardNoteDto`. Screen
  **SquadBoardScreen** (`/squad/:id/board`, entered from a new group-home card #23.7): glass note cards (avatar + author +
  relative time + body), amber **PINNED** flag, inline edit box, bottom composer (no wireframe existed → designed to the
  squad DNA). `d1-shim` upgraded to return `meta.changes` (`getRowsModified()`). **61 server + 95 web unit + 13 e2e green**
  (new `squad-board` spec: post→edit→pin→remove, 2 screenshots; per-test 120s budget for the live-API round-trips). Worker
  live (board routes deployed + smoke-validated last session); Pages https://25c7fe2e.festpilot.pages.dev.
- **P5 presence pipeline ✅ (backend, committed `224a434` + LIVE):** coarse-only, **server-only raw coords** (DEC-007/008/
  015/046). Pure `domain/presence.ts` (`coarsenPresence`: raw fix → `at`/`near`/`between`/`none` + confidence by distance
  & GPS accuracy; `presenceExpiry`: gps 15 min, manual/push 45 min) + `metersBetween`. Repo `api/presence.ts`: `recordFix`
  (resolves stage coords from the **`festival_map` transform** — `stage_location` is never populated — coarsens, writes
  `presence` for groups where the member shares), `getGroupPresence` (coarse roster — **never lat/lng**), `setGroupShareMode`
  (stage/precise[60-min hard expiry]/ghost), `setSharingForAllGroups` (master pause), `purgeExpiredPresence` (cron). Routes:
  `POST /api/presence` (raw intake, all my groups), `POST /api/presence/pause`, `GET /api/groups/:id/presence`,
  `PUT /api/groups/:id/share` — DO fan-out `notifyGroup(...,"presence")`; cron purge wired in `index.ts`. **14 tests** (incl.
  the privacy "no coordinate leaks" contract). Live smoke validated (coarse "at FREEDOM BY BUD/high", precise→live 3600s,
  ghost→hidden). **DEC-046:** Phase 5 ships coarse-only; the *exact moving dot* for "precise" defers to Phase 6 (rides the
  meeting-point exact-coords channel) — precise UI here honestly shows a high-confidence coarse position + countdown.
- **P5 G5.1 + G5.2 presence frontend ✅ (this session):** mirrored DTOs + `api` methods (`getGroupPresence`/`reportFix`/
  `setShareMode`/`pauseSharing`). `data/presence.ts`: `useGroupPresence` (WS+focus+15s tick for live countdowns) and
  `useLocationSharing` — the device engine: geolocation consent, **battery-aware** sampling (coarse accuracy, cached fixes,
  significant-move ≥25 m + 75 s keepalive), posts raw fixes; **foreground-only** (runs while a presence screen is open).
  `data/shareOptIn.ts` reactive opt-in flag. Screens (3): **Consent** (#25.1/2 pre-prompt → real OS prompt → set stage +
  open roster), **Where's the squad** (#25.4 coarse map peek with pins **placed on resolved stages, never raw coords** +
  roster: at/near/between/last-seen/not-sharing, live ring, **current-artist auto-detect** "watching …", invisible-banner
  when not opted in), **Precise control** (#25.5 countdown ring to the 60-min hard auto-off, who-can-see-you stack, +60 /
  Coarse / Stop). Shared `presenceUi.tsx` (`presenceLine`/`ago`/`mmss` + live-ring avatar) — **12 unit tests**. Entry: a
  "Where's the squad" group-home card. **75 server + 107 web unit + 16 e2e green** (new `presence` spec: consent/roster/
  precise, 3 screenshots faithful to #25). Web `0.3.0`→`0.4.0`. Pages https://3fce6f1a.festpilot.pages.dev.
- **P5 G5.3 ping round-trip + sharing-mode picker + privacy ✅ (this session) → PHASE 5 COMPLETE:** the interactive
  "where is everyone?" loop **without FCM** (push is Phase 3+; shipped the **in-app channel** over the existing DO fan-out).
  Server: migration `0006_presence_ping.sql` (`presence_ping` — `locate`/`nudge`, `answered_at_utc` closes a ping; inbox
  index), `api/pings.ts` (`sendPing` w/ **5-min dedupe** + 30-min TTL, `listInbox`, `answerPing`, `dismissPing`),
  `recordStageReply` in `api/presence.ts` (**answer with GPS off** — un-ghosts a `nudge` target to stage, resolves the
  picked stage's coords from the map transform, records a `push_reply` fix → honest "at <stage>"). 3 member-gated routes
  (`POST /:id/ping`, `POST /:id/ping/:pingId/{answer,dismiss}`), each `notifyGroup(...,"presence")`; the inbox is **merged
  into the roster DTO** (`GroupPresenceDto.inbox`). Web: `data/shareOptIn.ts` extended (reactive **default mode** +
  **precise-expiry minutes**, 15–180 step 15); `api` ping methods. Screens: **Visibility picker** (#25.3 Stage/Precise/
  Ghost, per-squad scope DEC-015), **Location & privacy** (#25.6 master switch + default-mode segment + precise-expiry
  stepper + squad-only audience + **pause-all** → server ghost, privacy promise), and the **roster** now drives the loop —
  incoming-ping prompt ("Ana asked where you are" → one-tap **stage-pick sheet**, no GPS), **Ping** a stale member / **Nudge**
  a ghost. New pure helpers `rosterRank`/`sortRoster`/`pingKindFor` in `presenceUi.tsx`. **78 server + 112 web unit + 19 e2e
  green** (3 new presence specs: picker #25.3, privacy #25.6, ping round-trip #25.4; 4 screenshots faithful to #25).
  Migration 0006 applied remote, Worker redeployed. Pages https://8d596d1c.festpilot.pages.dev.
- **P6 G6.1 "come to me" meeting point ✅ (this session):** the squad drops an **exact spot to regroup** (UC-32/33, #26).
  **Photo deferred → DEC-047** (R2 isn't enabled on the account, error 10042; same R2 deferral as the deep-zoom map per
  DEC-038 Q1 — the create UI ships without the optional photo). Schema was pre-built upfront (`meeting_point` +
  `meeting_point_member` in `0001_init`); only added migration **`0007_meeting_point_meet_at.sql`** (`meet_at_utc` + an
  active-listing index). **Expiry is derived, not picked** (wireframe #26.4 "auto-closes 30 min after the time"): pure
  `domain/meeting.ts` — `meetingExpiry(meetAtMs, now, grace)` (meet-time-or-now + grace), `clampGraceMinutes` (10–240,
  default 30), and **`landmarkLabel`** (reuses the presence coarsen: at/near/between the nearest resolved stages → human
  label like "between FREEDOM BY BUD & CORE"). Repo `api/meetingPoints.ts`: `createMeetingPoint` (writes point + creator's
  `going` member row, derives `expires_at_utc`, labels via the `festival_map` transform stage coords), `listMeetingPoints`
  (active only, member statuses, `isMine`/`myStatus`). 2 member-gated routes (`GET/POST /:id/meeting-points`), each
  `notifyGroup(...,"meeting")` → DO fan-out. Web: client DTOs mirrored, `api.listMeetingPoints/createMeetingPoint`,
  `data/meetingPoints.ts` (`useMeetingPoints` reusing the WS+focus+30s-tick refresh), and **`map/transform.ts svgToGeo`**
  (inverse affine for drop-pin → geo). Screens (2, #26.1/#26.2): **Pick a spot** (`/squad/:id/meet` — georeferenced map,
  **Drop pin / My spot (GPS) / A stage** quick-picks reusing `StagePickSheet`, live coarse label, "Use this spot") +
  **Details** (`/squad/:id/meet/new` — name, WHEN now/15/30/60→`meetAtUtc`, WHO "Whole squad", optional note, "Send to
  squad"). Squad home (#23.7) gains a **"Set a meeting point"** CTA + **active-point cards** (title · landmark · "N going ·
  closes in Xm" · Active badge). **91 server + 115 web unit + 20 e2e green** (13 new server [`meetingPoints` + `meeting`
  domain], `transform` round-trip test, new `meeting-points` spec: home→pick→details→active-card, 4 screenshots faithful to
  #26; SW blocked in that spec so multi-nav stays on stubs). Migration 0007 applied remote, Worker redeployed. Pages
  https://f262f5a4.festpilot.pages.dev.
- **P6 G6.2 meeting lifecycle ✅ (this session):** the going/here/can't loop + live ETAs + the "everyone's here"
  reunion + auto-fade/purge (UC-28, #26.3/#26.4). **Lifecycle is DERIVED at read time — no schema change, NO
  migration** (the persisted `status` stays coarse active/archived/cancelled; the rich state is computed from the
  responders + expiry + now, so it stays honest as people respond and the clock moves). Pure `domain/meeting.ts`:
  `meetingLifecycle` (active→on_the_way→everyone_here→expiring_soon→expired/cancelled; order = terminal first, then
  reunion needs **≥2 committed all-here** so a solo creator never triggers it), `isLiveLifecycle`, `walkEtaMinutes`
  (the shared ~67 m/min ×1.3 walk model), `creatorDrifted` (>250 m from the spot), `EXPIRING_SOON_MS`/`DRIFT_RADIUS_M`
  — **20 domain tests**. Repo `api/meetingPoints.ts`: `getMeetingPoint` (the WHOLE squad roster — responders +
  non-responders synthesized as `no_response`; **per-member walk ETA + distance DERIVED server-side from the raw
  presence fix, NEVER a coordinate** — DEC-007/015/046; `creatorDrifted`), `setMyMeetingStatus` (going/arrived/
  not_going; refuses a non-active point → **409**), `endMeetingPoint` (**creator-only** cancel/close), and the cron
  `purgeExpiredMeetingPoints` (archive past-expiry active points, then delete archived/cancelled after a grace —
  DEC-015). `assembleDto` derives lifecycle + everyoneHere; new `getGroupRawFixes` in `api/presence.ts` is the
  **server-only** raw-fix source for ETAs (lat/lng never leave the Worker). 3 member-gated routes (`GET
  /:id/meeting-points/:mpId`, `POST .../status`, `POST .../end`), cron wired in `index.ts`. Web: DTOs mirrored
  (`no_response`, `MeetingLifecycle`, eta/distance/lifecycle/everyoneHere/creatorDrifted), `api.getMeetingPoint/
  setMeetingStatus/endMeetingPoint`, `useMeetingPoint` (reuses the WS+focus+30s-tick refresh). Pure **`meetUi.tsx`**
  (`lifecycleBadge`/`memberStatusLine`/`etaLabel`/`formatMeters`/`convergenceSummary`/`closesInLabel`/`whenLabel`)
  — **14 unit tests**. **`MeetConvergenceMap`** (exact-spot flag + coarse converging member pins on resolved stages,
  reuses `geoToSvg`, degrades to just the flag). **`MeetDetailScreen`** (#26.3 active convergence detail — map +
  roster sorted here→ETA→no-response→can't + the going/here/can't picker + drift/closing prompts + creator cancel;
  #26.4 **reunion** "the squad's back together" + close / keep-open; terminal cancelled/expired states). Route
  `squad/:id/meet/:mpId`; the squad-home active card now opens the detail. **116 server + 129 web unit + 21 e2e green**
  (new `meeting-lifecycle` spec: active detail → "I'm here" → reunion, 2 screenshots faithful to #26.3/#26.4; the 6.1
  spec is unchanged). **No migration.** Worker redeployed + **live smoke validated** (create→drop[active]→join→
  `[going,no_response]`→member arrived[on_the_way]→owner arrived[**everyone_here**]→cancel[cancelled]→dropped from the
  active list→status-on-cancelled **409**). Pages https://8879f4ba.festpilot.pages.dev. Web `0.5.0`→`0.6.0`.
- **About screen + changelog ✅ (this session):** new `data/changelog.ts` = the **single source of `APP_VERSION`** (fixes
  the stale `0.4.0` hardcoded in Settings) + a retroactive, dual-audience changelog (each release has `whatsNew` for
  users + a collapsible `howToTest` for the maker). `routes/settings/AboutScreen.tsx` (identity: what the app is +
  **creator Julio Corcini** + version, then the What's-new timeline; native `<details>` for the dev notes), wired at
  `settings/about` + a Settings row. `about` e2e (identity + creator + changelog + expand, 2 screenshots).
- **P6 G6.3 navigation + "I'm lost" safety ✅ (this session):** the regroup-and-reassure half of Pillar 2 (UC-28,
  #26.5/#26.6, DEC-022/046). **Safety is a meeting point flagged `is_safety`** (the column already existed → **NO
  migration**): the lost member shares their **exact** spot (the one deliberate exact-coordinate share) so the squad
  converges to help. Server `api/meetingPoints.ts`: `createMeetingPoint` now takes `isSafety` (long **240-min** grace —
  it ends on "I'm okay", not a timer), `is_safety` in the SELECT + DTO, new `listActiveSafetyPoints` (own lane,
  reuses `getMeetingPoint` for the converging roster + live ETAs); the list + cron purge already excluded `is_safety`.
  Routes: `POST /:id/meeting-points` accepts `isSafety` (notify topic `safety`), new `GET /:id/safety`. **5 new server
  tests** (flagged + exact spot + 4 h life; own lane in/out; converging ETAs; "I'm okay"=close clears the lane; purge
  never fades safety). Web: pure `domain/travel.ts` `bearingDegrees` + `compassPoint` (**+7 unit tests**); `useSafety`
  hook (15 s tick); `api.listSafetyPoints` (defensive `?? []`) + `createMeetingPoint(isSafety)`. **`MeetNavScreen`**
  (`/squad/:id/meet/:mpId/nav`) — compass dial + arrow (device heading − bearing; **north-up fallback** when no
  compass, iOS permission button), live distance/ETA from `watchPosition`, "you're here" inside 15 m, every layer
  degrades on its own. **`SafetyScreen`** (`/squad/:id/safety`) — calm menu (#26.5: share+alert primary · nearest
  landmark from the local map coarsener · medical/info/exit **degrades honestly** — no POI data, no fake safety info)
  and the active broadcast (#26.6: steady banner · squad converging w/ ETAs · "I'm okay — stop sharing"). Squad home
  gets a live **SOS banner** + a calm "I'm lost" entry; meeting-detail "Navigate" now opens the compass. **No phone
  calling** (anon V1 has no numbers) — the squad broadcast is the channel; **nearest help degrades** until POIs are
  mapped. **121 server + 136 web unit + e2e green** (new `safety` spec: menu→share+alert[`isSafety:true`]→active→I'm
  okay, + compass distance/ETA; 3 screenshots). **No migration.** Web `0.6.0`→`0.7.0`.
- **V1.x follow-ups ✅ (this session) — undo / split / share (web-only, no server/migration):** the three SHOULD
  items from product-spec §"V1.x". **(1) Undo / "what did I give up"** — `LockInScreen` keeps a snapshot stack: every
  pick pushes the prior `ResolverSnapshot` + the dropped clash options, surfacing a `GiveUpBanner` ("Locked X · you
  gave up Y, Z +N · Undo") on the resolving screen, an always-reachable `Undo` in the bar, and an undo affordance on
  the celebration (resets the save-guard so re-completion re-saves). `OnboardingScreen` swipe now records
  `{index, favoritedActKey}` and an **Undo** steps back, un-favoriting **only** the act that swipe created.
  **(2) Rich split view (#24.5)** — pure `domain/squadPlan.ts` `stageEntriesForBlock` (winner first, then each
  non-winner pick by headcount, the entry with YOU flagged; **+3 unit tests**); new **`SquadSplitScreen`**
  (`/squad/:id/plan/:perfId/split`) renders per-stage cards (color bar, count, act, avatar stack, "· you" highlight),
  "the squad splits here" framing, an undecided footnote, and a **"Set a meet-up after"** CTA → `/squad/:id/meet`;
  entry is a "See who's where" link in the block detail's split section. **(3) Share my plan as branded image/link** —
  dependency-free **canvas poster** `lib/planPoster.ts` (`buildPosterRows` pure **+5 tests**; `drawPlanPoster` Amber-Glass
  poster in **Story 9:16 / Square 1:1**: FESTPILOT wordmark, auto-shrink festival headline, day, "N sets · 0 clashes",
  per-set rows w/ stage dots, "Make yours" pill + url) + `lib/stageColorHex` (canvas can't resolve CSS vars).
  `lib/share.ts` gains `sharePlanImage` (Web Share **files** → Stories/WhatsApp), `downloadBlob`, `copyPlanText`,
  link-footer in `formatPlanText` (**+3 tests**). **`SharePlanSheet`** (live preview + format toggle + Share / Save /
  Copy) wired into **My Plan** header + the **Lock-in celebration** (replacing the old text-only share). **147 web unit
  + e2e green**: onboarding-undo + lockin give-up-undo + share-poster (Story→Square→Save) assertions, new `squad-split`
  spec (two overlapping picks → block → "See who's where" → 2 stage cards, live Worker), `about` spec made
  changelog-content-agnostic. Web `0.7.0`→`0.8.0`; new `0.8.0` changelog entry. **Pages-only deploy.**
- **P3 G3.2/G3.3 ✅ (this session):** pure `domain/travel.ts` — `metersBetween` (haversine), `buildTravelMatrix`
  (auto-estimate walk minutes from georeferenced stage coords: detour ×1.3, ~67 m/min, min 2 min, fallback flat),
  `coordToStage` (in-radius hit + nearest fallback + HIGH/MED/LOW confidence). `data/useTravelMatrix.ts` joins the
  lineup stages with the map transform's georeferenced stages → a real `TravelMatrix` (flat fallback when map absent).
  Wired into `MyPlanScreen`, `LockInScreen` (real partial-set cut feasibility). `domain/nowNext.ts` — `buildNowNext`
  (live set + next + **leave-in countdown** accounting for walk time + progress + later list). `NowScreen` rebuilt:
  plan-driven **LEAVE IN** hero when a plan exists for the active day; lineup-driven **DOORS IN** fallback pre-festival.
  11 new domain tests (travel + nowNext) + a `now` Playwright spec (hero + up-next + screenshot `phase3-now.png`).
- **P3 B7.4/B7.5 ✅ (this session):** stage-to-stage **routing + walking nav** (#29 screens 4/5). Pure `domain/route.ts`
  (`buildRouteLeg`: matrix minutes + straight-line metres + leaveBy = set start − walk) + 6 tests. `RouteScreen`
  (`/route`, full-screen under StackLayout): from→to picker (defaults to current→next set from the plan via
  `buildNowNext`, or first-two-stages ad-hoc) over the georeferenced map (real WebP base + affine line/pins),
  walk-time sheet + "Leave by HH:MM" nudge, GPS-free "Start walking" guidance (live position deferred to Phase 5).
  Entry points wired from Now&Next walk line + My Plan now-card/walk-chips. `route` Playwright spec + 2 screenshots
  (`phase3-route`, `phase3-route-walking`). **74 web unit + 7 e2e green**; Playwright capped to 2 workers + retry:1
  (specs hit the live API → was flaking under parallel load). Deployed to Pages (https://a2911147.festpilot.pages.dev).
- **P3 offline contract ✅ (this session):** `data/offline.ts` — `getOfflineStatus` (checks the Cache Storage API
  for the festivals list + lineup + map doc + map art) + `primeOffline` (fetches them through the SW so its
  network-first handlers cache them). `OfflineScreen` rebuilt (#28 B6.5): real Lineup/Venue-map/Map-artwork status
  rows + a "Make available offline" / "Saved for offline" action + unsupported-context fallback. 5 unit tests
  (mocked Cache API) + an `offline` Playwright spec (rows + prime → all Ready, screenshot `phase3-offline.png`).
  **79 web unit + 8 e2e green.** Deployed to Pages (https://d1e6c432.festpilot.pages.dev).
- **POI layer deferred (honest-data):** festival POIs (toilets/water/medical/exits) are temporary infra not in OSM;
  the brain's valid sources are KML import / the admin POI editor (not built yet). Building it now = inventing data
  (violates fact-verification). Sequenced after the admin POI editor (G3.4 B8.5) or a real KML/capture.
- **P2 G2.3 ✅ (this session):** A5 **Lock in** (#12c) — gated one-at-a-time clash picker (`LockInScreen`) over the day's
  favorites: progress bar, **all-clashes** overview (`resolver.previewRemainingClashes`), **add-nearby** sheet
  (`lineup.nearbySets`), **partial-set scissors** (`resolver.pickSet`/`pickOption(cut)` + `partialSet.latestFeasibleDeparture`).
  A6 **Celebration** (#13) → persists the plan locally (DEC-041), View My Plan / Share (`lib/share.ts`, Web Share + clipboard).
  A7 **My Plan** (#21) — pure `domain/plan.ts` timeline (done/now/upcoming + walk/break gap chips); empty-state CTA; a
  **Lock in** entry added to the Timetable controls. 8 new domain tests + a full Playwright flow (favorite→resolve→celebrate→plan)
  with 3 screenshots. commit **cbdbc9b**, deployed to Pages (**5b294f17**, alias festpilot.pages.dev).
- **P2 G2.2 ✅ (this session):** A3 Timetable (#15e) — pure numeric layout (`domain/timetable.ts`: window snapped to
  local hours, sets as time-percentages, stage ordering, per-stage/​per-set fav flags) + `stageColorRgb` for the
  card recipe. `TimetableScreen` renders the TML grid: sticky time header + stage pills, dark-glass cards w/ gold
  favorites + per-card heart, live NOW line, **only-my-favs** filter and **1h/2h zoom**. Day pills from the onboarding
  weekend. 5 domain tests + Playwright grid spec (favorite→gold, filter hides non-favs, zoom widens). commit pending.
- **P2 G2.1 ✅ (this session):** pure clash-resolution **domain** (`web/src/domain/`: intervals, gated chronological
  resolver, partial-set feasibility, lineup act-mapping) — framework-free, **property-tested for the zero-overlap invariant**;
  **local-first store** (DEC-041) — versioned localStorage for onboarding/favorites/plan + React hooks (no server identity
  until Phase 4 auth); **Onboarding #17** (festival→weekend→days→swipe) gated by `RequireOnboarding`; **Lineup #22**
  (search, favorites/day filters, heart toggles). `festival.ts` weekend-date parsing hardened for the API's
  `"YYYY-MM-DD HH:MM"` shape (rolls early-morning ends back a night; never throws). commit **c89b81b**, deployed to Pages.
- **P1 ✅ (this session):** Amber-Glass app shell — 5-tab bottom nav (Now/Timetable/My Plan/Map/Squad, DEC-032),
  design-system §1–§4 tokens + glass recipe in `styles.css`, PWA manifest + branded icons (192/512/maskable +
  apple-touch), hand-written **service worker** (network-first nav, cache-first assets, network-first /api with
  offline fallback; precaches shell + map + lineup), SPA `_redirects`, typed API client (`data/api.ts`, `VITE_API_URL`),
  `react-router-dom` routing (tabs + settings stack). Screens: **Now** (A2, renders the LIVE 813-set lineup), Timetable/
  My Plan/Squad shells, **Map** (wraps the working MapView), Settings hub (B5.5), Appearance+language (B5.6),
  Offline/sync shell (B6.5), system states (B6.6). Appearance/lang are a persisted single source of truth (map palette reads it).
- **🌎 LIVE URLs (test on phone):** App → **https://festpilot.pages.dev** · API → **https://festpilot.trippilot.workers.dev**
  (`/api/festivals`, `/api/festivals/:id/lineup`, `/api/festivals/:id/stages`, `/api/festivals/:id/map`).
- **Live festival id:** `01KVVF5VERH4AB28NAM6NM65VD` (Tomorrowland Belgium 2026) — **813 performances**, 15 stages,
  2 weekends (W1/W2), all UTC instants correct. `festival_map` row published (affine + 10 georeferenced stages).
- **G0.4 ✅ (live bring-up):** D1 `festpilot` created + migrated (remote); Worker deployed (cron `0 */6 * * *`);
  live lineup ingest **status=updated, 813 changes**; Pages project `festpilot` created + `dist` deployed.
  Fixed two live issues: WAF **403** on the page (→ added `BROWSER_HEADERS`) and Workers **Illegal invocation**
  (→ call `fetch` via a local ref). Added a documented **saved-ref fallback** (`LINEUP_EVENT`/`UUID`, page tried first).
- **G0.2 ✅**: map base **444 KB / 415 KB WebP** (was 19.8 MB SVG ×2). **G0.3 ✅**: `festival_map` + map API.
- **DEC-040:** V1 map ships as a pre-rendered raster base (WebP) + live vector overlay; the ~20 MB inline-relief SVG
  is dropped from shipped assets. R2 stays out (DEC-038).
- Last green test run: 2026-06-23 — **server 49 pass** (+ auth seam + ensureUser + **10 groups: create/join/cap-50/
  preview/members/leave-owner-transfer**), **web 84 vitest**, **10 Playwright** e2e (phase0-map + phase1 shell + phase2
  onboarding/timetable/lock-in + phase3 now/route/offline + **phase4 squad: owner create→invite→home + joiner→members-2**;
  1 pre-existing shell flake passed on retry). Screenshots in `web/e2e/screenshots/` (… + phase4-create / phase4-invite /
  phase4-group-home / phase4-join / phase4-group-home-2).
- typecheck: clean (server + web). build: server deploy OK; **web build OK + deployed to Pages**.
- Live: D1 **created+migrated** · Worker **deployed+ingesting** · Pages **deployed** · R2 **NOT used** (DEC-038 Q1).
- Credentials: Cloudflare token **saved + verified**. Firebase: deferred (DEC-038/042) — V1 squad identity is
  **anonymous-local** (`anon.<ulid>` behind `getUserFromRequest`); Google/email-link + token verification are ⏳ Firebase.
- Confidence: 90% (Phase 0 verified end-to-end in production).

## Completed (most recent first)
- [x] **P2 G2.3** — Lock-in resolver + Celebration + My Plan (DEC-017/018/029): `LockInScreen` (#12c) gated multi-option
  picker w/ progress, all-clashes overview, add-nearby sheet, partial-set scissors; Celebration (#13) persists plan
  (DEC-041) + Share (`lib/share.ts`); `MyPlanScreen` (#21) pure `domain/plan.ts` timeline (done/now/upcoming + walk/break
  chips) + empty-state CTA; Timetable "Lock in" entry. 8 new domain tests + full Playwright flow + 3 screenshots
  (57 web unit + 5 e2e green). commit **cbdbc9b**, deployed to Pages (**5b294f17**).
- [x] **P2 G2.2** — A3 Timetable (#15e, DEC-027): pure `domain/timetable.ts` (local-hour window snap, time-% set
  positions, stage ordering, fav flags) + `stageColorRgb`; `TimetableScreen` TML grid (sticky time header + stage
  pills, dark-glass cards + gold favorites + per-card heart, live NOW line, only-favs filter, 1h/2h zoom). 5 domain
  tests + Playwright grid spec. commit **b4dfc8c**, deployed to Pages.
- [x] **P2 G2.1** — onboarding + Lineup favorites + local-first domain: pure `web/src/domain/` (intervals, gated
  resolver w/ zero-overlap property tests, partial-set feasibility, lineup mapping); `localStore.ts` (DEC-041);
  `OnboardingScreen` (#17) + `RequireOnboarding` gate; `LineupScreen` (#22). Hardened `festival.ts` date parsing
  (fixed `RangeError: Invalid time value` from the API's `"YYYY-MM-DD HH:MM"` weekend dates). 44 web unit + 3 e2e green.
  Playwright config + specs ported to ESM `.js` (Node 18). commit **c89b81b**, deployed to Pages (preview 98a3beea).
- [x] **P1 (G1.1 + G1.2)** — Amber-Glass PWA shell: 5-tab nav, tokens+glass in `styles.css`, manifest + icons,
  hand-written service worker, SPA `_redirects`, typed API client (`VITE_API_URL`), react-router (tabs + settings stack);
  **Now screen reads the LIVE lineup**; Timetable/Plan/Squad shells; Map wraps MapView; Settings/Appearance/Offline/states.
  10 web unit tests + 2 Playwright e2e. Deployed to Pages, **v0.2.0**. commit pending.
- [x] **P0 G0.4** — LIVE bring-up: D1 created+migrated (remote), Worker deployed (cron), **live ingest 813 perfs**
  (fixed WAF 403 via browser headers + Workers illegal-invocation via local `fetch` ref + saved-ref fallback),
  `festival_map` published, **Pages deployed** (festpilot.pages.dev). Playwright mobile visual smoke green (+screenshot).
  Server **32 tests**, web **3 vitest + 1 e2e**. commit pending.
- [x] **P0 G0.3** — map data API: `festival_map` table (migration 0002) + `GET /api/festivals/:id/map` +
  guarded admin upsert; static asset keys → URLs (no R2, DEC-038); 4 sql.js tests (29 total).
- [x] **P0 G0.2** — slim the map (DEC-040): `rasterize-base.ts` (resvg+sharp) → WebP base; dropped the 20 MB SVGs;
  MapView reads `.webp`; web Vitest+Testing-Library+jsdom stack added; 3 asset tests. typecheck+build green.
- [x] **P0 G0.1** — toolchain baseline: Node 22 confirmed, server 25 tests green, brain synced (DEC-040). commit 053a35c.
- [x] Authored the master orchestrator `brain/documents/2026-06-23-v1-implementation-orchestrator.md`.
- [x] Initialized git on `master` (baseline commit pending in P0 G0.1).
- [x] Phase 1 backend — Worker ingestion + full V1 D1 schema (28 tables) + read API + cron. 25 tests green.
- [x] Map generator productized (`generateMap`) + admin map editor (`spikes/map-art`).
- [x] PWA shell started (`web/`): georeferenced map view (SVG + affine, live overlay, day/night, coarse labels).

## Decisions made this session (mirror into decision-log if structural)
- **DEC-039** — design-pass answers (group blocks per-set; no Favorites screen; auth Google+email-link, **no Apple/iOS,
  native Android-only**; profile at first join; in-app inbox; safety in Squad; admin = map-verify+lineup-dash; map POI +
  stage routing; default language English). Apple Sign-In dropped (supersedes the DEC-035 iOS blocker).
- Adopted the V1 implementation orchestrator as the execution source of truth (DEC-036).
- V1 is **$0 infra** (DEC-037): Durable Objects are FREE on the Workers Free plan (SQLite backend), so the
  WS-via-DO presence (DEC-035) costs nothing; Pages via direct upload; deploy with a Cloudflare API token.
- **Intake answered → DEC-038** (locked): no R2 (static-asset map); lineup = both weekends via the brain's
  documented capture process (`research/2026-06-23-festival-lineup-data-source.md`, don't invent); Firebase + push
  deferred (anon/local); PWA only; domain `festpilot.pages.dev`; squad cap 50; invite link no-expiry-until-event-ends;
  Cloudflare Web Analytics; **private GitHub repo wanted (gh blocker)**; autonomy confirmed; generate PRIVACY/TERMS.
- **Process:** every operator hand-off turn ends with an `AskQuestion` (workspace rule
  `.cursor/rules/always-end-with-askquestion.mdc`, alwaysApply; orchestrator §1 rule 2 clarified).

## What the operator must supply
- **Cloudflare token:** ✅ DONE — in `server/.dev.vars`, verified.
- **Operator intake (`brain/operator-intake.md`):** ⏳ created 2026-06-23, awaiting answers. Blanks default to recommendations,
  so the build can start the moment the user says "intake done". Key forks: R2 enable vs static-asset map (Q1);
  lineup ingest from official site vs file (Q2); Firebase now vs later (Q3).
- **Firebase (Spark/free):** optional until Phase 4 (auth) / Phase 3 (push) — see intake Q3 + Part 5.

## Known issues / ⏳ blocked-on-credentials
- **R2 decided OUT for V1** (DEC-038 Q1) — map ships as a static asset; no R2 bucket, no card. (`code 10042` moot.)
- **GitHub repo (DEC-038 Q13) ✅ done:** remote `origin` = `git@github.com:juliocorcini/festival-copilot.git`
  (SSH auth works for `juliocorcini`); `master` pushed + tracking. Push per phase from now on.
- Shipped map SVG currently inlines the relief raster (~19MB) — slimmed in P0 G0.2.
- System default node is v18; **must `nvm use 22`** before any wrangler/build command (`.node-version` = 22 is set).

## Next (resume point — P3 in progress)
- **Shipped this session (P3 core):** travel matrix + coord→stage (`domain/travel.ts`, `data/useTravelMatrix.ts`),
  Now & Next home (`domain/nowNext.ts`, `NowScreen` rebuilt). 68 web unit + 6 e2e green · typecheck/build clean ·
  committed **cb6517b** · **deployed to Pages** (https://555bcdff.festpilot.pages.dev → alias festpilot.pages.dev).
- **Remaining P3 (forks — pick by priority):**
  1. **Admin desktop map-verify (G3.1, B8.*):** persist pins to `stage_location` via a guarded Worker route →
     unlocks the **POI editor (B8.5)** → real POI data → then the POI layer (#29 1-3/6). Separate desktop track.
  2. **Phase 4 groups + GroupRoom DO (mock/anonymous-local auth per DEC-038):** buildable on the Cloudflare token; large multi-gate.
  - ✅ **Done this session:** travel matrix + coord→stage (G3.2), Now & Next (G3.3), stage routing + walking nav (B7.4/B7.5), offline contract (B6.5).
  - ⏳ **Credential-gated:** FCM/push (G3.4) + permanent auth (P4) need Firebase — run mock/local, mark ⏳ (orchestrator §5/§19).
- **Older design-pass backlog (already RESOLVED — kept for history):**
- **Review Batch 1** (`brain/wireframes/directions/23-amber-groups-flow.html`, 8 screens) + **Batch 2**
  (`24-amber-group-timetable.html`, 6 screens: plan overview · block detail · locked-conflict+fallback · owner override ·
  split view · needs-input) → apply Julio's edits.
- **Batch 3** delivered (`25-amber-presence-consent.html`, 6 screens: pre-prompt · OS dialog · sharing mode
  (stage/precise-60min/ghost) · where's-the-squad · precise-active control · privacy settings).
- **Batch 4** delivered (`26-amber-meeting-safety.html`, 6 screens: pick spot · details · active detail w/ ETAs ·
  lifecycle (here/on-the-way/expired/cancelled) · "I'm lost" menu · safety-active broadcast + nearest help).
- **Batch 5** delivered (`27-amber-identity-settings.html`, 6 screens: sign-in (Google/email-link/guest, no Apple) ·
  magic-link sent · edit profile (upload/initials) · account (guest→save, sign out, delete) · settings hub ·
  language (EN default/PT) & appearance (auto/day/night)).
- **Batch 6** delivered (`28-amber-states-notifications.html`, 6 screens: personal gap (+ first-class breaks, Q-L) ·
  notification inbox (Q-G) · alert prefs (reminders+lead time, walk alerts, clashes, pings, squad) · OS push lock-screen ·
  offline/sync · empty/loading/error states).
- **Batch 7** delivered (`29-amber-map-poi-routing.html`, 6 screens: map+POI layer (filter chips) · nearest essentials ·
  POI detail · stage-to-stage routing ("leave by" nudge) · walking nav · layers/legend — DEC-039 Q-J).
- **Batch 8** delivered (`30-amber-admin.html`, 6 desktop screens: overview/festivals · lineup dashboard (source =
  documented capture) · **map editor drag-pins→generate** · georeference/verify (affine, fix off-position stages) ·
  POI editor · travel-time matrix — DEC-039 Q-I).
- ✅ **DESIGN PASS COMPLETE (8/8)** + ✅ **brain UI docs updated** (ui-decisions-locked §§9–16, screen-catalog,
  design-system; screen-inventory marked RESOLVED) + ✅ **orchestrator upgraded to screen-complete** (every §13
  gate lists its screens; DEC-039 Apple/iOS fixes applied throughout).
- **NEXT = START THE BUILD at P0 G0.1** (`brain/documents/2026-06-23-v1-implementation-orchestrator.md` §13):
  git baseline + node-22 pin → P0 G0.2 slim SVG → P0 G0.3 D1 create+migrate + map row → P0 G0.4 deploy
  Worker + Pages (`festpilot.pages.dev`) → live lineup API + in-app map. Then P1 shell → P2 favorites/My Plan → …
- Remember: `nvm use 22` before any wrangler/build; push per phase; end each operator hand-off with an `AskQuestion`.
