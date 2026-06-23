# FestPilot — Technical Direction

> Last updated: 2026-06-23 (Initial + **2026-06-23 council**: stack and backend now **DECIDED** — DEC-003 = web-first React/TS + Capacitor; DEC-004 = Cloudflare. Added map-seed import (DEC-021) and the festival-context essentials (DEC-022). See `documents/2026-06-23-discovery-councils-and-decisions.md`.)

> Code is always in English. Nothing here is implementation-locked; it records the intended architecture and the open choices.

---

## 1. Stack (DECIDED — DEC-003)

**Decision: web-first React + TypeScript (PWA), wrapped with Capacitor for the mobile build.** Pillars 1–2 (favorites + closed timetable) can ship as a pure PWA first; the Capacitor shell is added when Pillar-3/location/push work begins — same codebase, no rewrite.

FestPilot's location and notification features stress what a pure PWA can do:

- **Background geolocation** — the browser Geolocation API is foreground/permission-gated; reliable background location needs native (Android `ACCESS_BACKGROUND_LOCATION`, restricted on the Play Store to apps where it's core). **We design presence around foreground GPS + push-reply fallback (DEC-012), never *requiring* background location** — this keeps us store-compliant.
- **Interactive push with the app closed** — needs native push (FCM) and platform notification actions → provided by the Capacitor shell.

| Option | Verdict |
|--------|---------|
| **PWA (Vite + React)** | ✅ base for Pillars 1–2; ❌ can't reliably deliver Pillar 3 alone |
| **Capacitor + web** | ✅ **chosen** — reuse web UI + native geo/push plugins, one codebase |
| **React Native / Expo** | ❌ rejected — discards web reuse for no net benefit here |

> Flip condition: if Julio wants Pillars 1–2 validated as a zero-install pure web app, start PWA-only and defer the Capacitor step (backend choice unaffected).

---

## 2. Architecture overview

```
Official festival site ──(resolve event+uuid)──▶ Lineup Resolver
                                                      │
                                   CDN JSON (config, stages, performances)
                                                      ▼
                            Ingestion + Normalizer (timezone, +1s, midnight)
                                                      ▼
                                            FestPilot Database  ◀── Auto-Updater (cron + change detection)
                                                      ▲
                          App (read-only on lineup) ──┘   Groups · Presence · Meeting points · Push
```

- **Users always read FestPilot's DB**, never the festival site directly.
- A **backend** is required (groups, presence fan-out, push, scheduled ingestion). This is the big difference from a local-first app like TripPilot.

---

## 3. Lineup ingestion (DEC-009)

> Reference festival: Tomorrowland Belgium 2026. Full study: `research/2026-06-23-festival-lineup-data-source.md`.

**Resolve the source (never hardcode):**
1. Fetch the official lineup page (e.g. `.../en/line-up/?page=timetable`).
2. Parse `__NEXT_DATA__`, find the `type: "line-up"` block → read `event` (e.g. `TL26BE`) and `uuid`.

**Fetch the structured JSON from the CDN:**
- `config-{event}-{uuid}.json` → weekends (start/end dates), `withTimetable`.
- `stages-{event}-{uuid}.json` → stage list.
- `{event}-{weekendName}-{uuid}.json` (one per weekend in config) → performances.

**Each performance carries:** id, name, artists[] (id, name, image), stage (id, name), date, day, startTime, endTime (ISO with `+02:00`).

**Normalization:**
- Store times in the festival timezone (Tomorrowland: `Europe/Brussels`).
- Strip the known **+1 second** end-time quirk (e.g. `17:00:01` → `17:00:00`).
- Handle **midnight-crossing** sets (e.g. `23:30 → 01:00` ⇒ `endAt` rolls to the next day) so clash math is correct.
- Be tolerant of new stages/weekends appearing (don't assume a fixed set).

**Auto-updater (scheduled):**
1. Re-resolve `event`+`uuid` (it can change).
2. Re-fetch config/stages/weekends; compare via **ETag / Last-Modified / SHA-256** of raw JSON.
3. If unchanged → `no_changes`. If changed → normalize, **diff** against DB (added / removed / time_changed / stage_changed / artist_changed), apply in a transaction, **bump a lineup revision**, write a change log, and **alert affected users** (favorited/locked acts).
4. Removed acts → `active = false`, **never hard-deleted**.

**Cadence:** CDN `cache-control: max-age=300` (5 min) is the floor. Far out: daily. Days before: every few hours. Festival week: ~30 min. During: ~5–10 min.

**Fallback chain:** saved event/uuid → on 404 re-resolve from page → if `__NEXT_DATA__` is gone, render the page (Playwright) and extract → else keep last snapshot, flagged "possibly stale."

---

## 4. Proposed data model (sketch)

> **The concrete, column-level Cloudflare D1 schema now lives in `documents/v1-data-model-d1-schema.md`** (ER diagram + every table). This section is the higher-level sketch; the documents file is the build source of truth.
> Names/shapes here are a starting point. Times stored as instants (UTC) plus the festival timezone; keep the raw source strings too.

**Lineup (read-mostly, server-owned)**
- `Festival` — id, name, slug, timezone.
- `FestivalEdition` / `Weekend` — id, festivalId, name (e.g. W1/W2), startDate, endDate.
- `Stage` — id, festivalId, sourceStageId, name, sortOrder.
- `Performance` — id, festivalId, weekendId, sourcePerformanceId, name, stageId, date, day, startAt, endAt, rawStartTime, rawEndTime, active, sourceHash, lastImportedAt.
- `Artist` — id, sourceArtistId, name, imageUrl (performances ↔ artists many-to-many).
- `LineupSource` — festivalId, event, uuid, sourcePageUrl, firstSeenAt, lastSeenAt, active.
- `LineupImportRun` — sourceId, status, startedAt, finishedAt, hashes, changesCount, error.
- `LineupChange` — performanceId, changeType, before, after, detectedAt.
- `LineupRevision` — festivalId, revision, updatedAt (the app polls this to know when to refresh).

**Map / geo**
- `StageLocation` — stageId, lat, lng, radiusMeters, polygonGeoJson (nullable), color, sortOrder, source (manual/imported_map/official/mixed), verified, verifiedAt.
- `StageTravelTime` — festivalId, fromStageId, toStageId, minutesTypical, minutesCrowded, source (estimated/manual/learned).
- `Poi` — festivalId, type (toilet/water/food/medical/exit/atm/charging/locker/entrance/landmark), name, lat, lng, source, verified (the practical map layer, DEC-022).
- `ImportedMapFeature` — festivalId, source ("google-my-maps-kml"), sourceMapId, name, layerName, geometryType, geometryGeoJson (`[lng,lat]`), category, matchedStageId, status (imported/matched/verified/ignored), confidence. Raw rows from a KML/KMZ import (DEC-021), promoted to `StageLocation`/`Poi` once an admin verifies.
- `StageAlias` — festivalId, officialStageId, officialStageName, alias (old/variant name), confidence — maps old map names to current stages.

> **Map seed (DEC-021):** import the community KML → normalize to `ImportedMapFeature` → auto-match the 10 high-confidence stages, flag old venues via `StageAlias` → admin verifies location + radius → promote to `StageLocation`/`Poi`. KML coordinates are `lng,lat`. Full study + data + shapes: `research/2026-06-23-festival-map-seed-kml.md`.

**Personal**
- `User` — id, displayName, deviceName, locale.
- `Favorite` — userId, performanceId (Pillar 1; overlaps allowed).
- `ClosedTimetableSlot` — userId, festivalId, day, performanceId, startOverrideAt (cut point), endOverrideAt, transitionToStageId, note (Pillar 2).

**Social**
- `Group` — id, festivalId, name, createdByUserId.
- `GroupMember` — groupId, userId, nickname, avatarUrl, shareLocation, sharePreciseLocation, lastSeenAt.
- `GroupTimetableSlot` — groupId, day, timeBlock, chosenPerformanceId, method (majority/owner), tally.
- `Presence` — groupId, userId, stageId (nullable), currentArtistId (nullable), lat/lng (server-only), accuracyMeters, confidence (high/medium/low), source (gps/manual/push_reply), updatedAt, expiresAt.
- `MeetingPoint` — id, groupId, createdByUserId, title, note, lat, lng, accuracyMeters, photoUrl, createdAt, expiresAt, status (active/expiring_soon/expired/empty/archived), visibility (group/selected).
- `MeetingPointMember` — meetingPointId, userId, status (going/arrived/left/not_going), updatedAt.

**Privacy rule in the model:** raw `lat/lng` for *presence* live server-side only and are used to compute the coarse stage; the app exposes the **stage + confidence**, not coordinates. Exact coordinates are exposed only for **meeting points** (opt-in).

---

## 5. Core algorithms

- **Clash detection:** `overlaps(a, b) = a.startAt < b.endAt && b.startAt < a.endAt` over a user's favorites, grouped by day, walked chronologically (DEC-017).
- **Closed-timetable build:** chronological resolution; lock a slot, advance past its end; support cut points + `canMakeTransition(fromSlot, toSlot, travelTime)` (DEC-018).
- **Coordinate → stage:** point-in-area (circle now, polygon later) with a nearest-stage fallback + confidence from accuracy/distance (DEC-007/008).
- **Group timetable:** per time block, aggregate members' closed picks (e.g. majority); for a member whose locked pick ≠ group pick, search their favorites at that block for a match (DEC-019).
- **Geo math:** Haversine / Turf.js in V1 (few stages); PostGIS only if needed later.

---

## 6. Backend platform (DECIDED — DEC-004)

**Decision: Cloudflare.** Needs: scheduled ingestion (cron), change detection, REST/realtime for groups & presence, push fan-out, small KV/relational store, image upload (meeting-point photos).

- **Cloudflare (chosen)** — Workers + **Cron Triggers** (lineup updater), **D1** (relational), **Durable Objects** (per-group presence/realtime + group-plan state), **KV** (source hashes/snapshots), **R2** (meeting-point photos). Julio already has Cloudflare tooling/skills. Best cost/fit.
- **Node (rejected for V1)** — Express/Fastify + Postgres + queue (BullMQ) + cron. Familiar but more ops, no clear win.

> The backend is required regardless of the stack decision — lineup ingestion alone needs a server.

### 6.1 Authentication (DECIDED — DEC-024)

**Firebase Auth, anonymous-first with social upgrade:**
- **Anonymous by default** — no auth wall; Pillars 1–2 work immediately on an anonymous account (matches "PWA first").
- **Upgrade required for groups (Pillar 3)** — create/join a group needs a **permanent account**: **Google + Apple** (ship both — Apple is mandatory on iOS if Google is offered) + **email magic-link** fallback. Firebase anonymous→permanent **linking preserves the `uid`**, so favorites/plan carry over.
- **Workers verify the Firebase ID token** (JWT via JWKS) behind a thin **`getUserFromRequest()`** seam, so the provider can be swapped (Clerk/Supabase/multi-festival SSO) without touching app code.
- **Why Firebase:** FCM (DEC-004) already pulls in a Firebase project; native anonymous-upgrade; zero custom session/password handling. `app_user` carries `firebase_uid` + `auth_provider` + `is_anonymous`.

---

## 7. Notifications

- **FCM** (cross-platform) for push to iOS/Android/web, supporting notification + data messages and topic/group fan-out. (Chosen — DEC-004.)
- Interactive actions ("Yes" / "Change stage" / "I'm coming") need native notification action support → **delivered via the Capacitor shell** (DEC-003).
- Walk-time-aware "leave now" reminders and lineup-change alerts are scheduled server-side (Workers + Durable Object alarms) and pushed via FCM (DEC-022).

---

## 8. Security & privacy

- Presence coordinates are server-only; clients receive coarse stage + confidence (DEC-007).
- Sharing is per-group and time-boxed (DEC-006/015); a "disappear from map" control.
- Meeting-point photos: stored with the point, expire/archive with it.
- All code in English; UI copy localizable.

---

*See [product-spec.md](product-spec.md) for the product. See [decision-log.md](decision-log.md) for status. See [research/2026-06-23-festival-lineup-data-source.md](research/2026-06-23-festival-lineup-data-source.md) for the ingestion study.*
