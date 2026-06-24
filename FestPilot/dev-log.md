# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-23-v1-implementation-orchestrator.md` and its §3 non-negotiables.
> Seeded 2026-06-23.

## Current State
- 🔨 **BUILD IN PROGRESS (2026-06-23).** Executing the orchestrator autonomously. **PHASE 0 + PHASE 1 + PHASE 2 + PHASE 4 + PHASE 5 COMPLETE + LIVE; PHASE 3 core done; PHASE 6 G6.1 ✅ + LIVE.**
  Design pass + brain are done (59 screens locked, prototypes `23`–`30`).
- Active Phase / Gate: **P6 IN PROGRESS** — **G6.1 "come to me" meeting point (B4.1 pick-spot + B4.2 details + POST + list + DO fan-out; photo deferred DEC-047) ✅** —
  next: **G6.2** (meeting lifecycle: going/here/can't + ETA + everyone's-here + auto-fade/expiry purge), then **G6.3** (compass nav + "I'm lost" safety).
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
