# FestPilot — V1 Use Cases

> Last updated: 2026-06-23 (from `/diagrams`). The canonical V1 use-case list, grouped by domain,
> traceable to `product-spec.md` + `decision-log.md`. Companion: `v1-data-model-d1-schema.md`.
> Scope = **all 6 phases MUST SHIP** (DEC-023). The brain overrides this doc if they disagree.

## Actors
| Actor | Definition |
|-------|-----------|
| **User** | A festival-goer with a (lightweight) account — favorites, plan, groups, presence, meeting points. |
| **Group Owner** | A User who created a group; *extends* User with owner-only actions. |
| **Admin** | Festival setup/curation: map import, stage placement, travel times, POIs. |
| **System** | Automated/scheduled processes: ingestion, reminders, lifecycle, push fan-out. |

## Use-case overview (actors ↔ domains)

```mermaid
graph LR
  ADMIN([Admin]):::a
  USER([User]):::a
  OWNER([Group Owner]):::a
  SYSTEM([System]):::a
  OWNER -. extends .-> USER

  subgraph D_LIN[A. Lineup & Data]
    direction TB
    A1[UC-01 Resolve source]:::u
    A2[UC-02 Fetch+normalize]:::u
    A3[UC-03 Detect+diff]:::u
    A4[UC-04 Apply+bump revision]:::u
    A5[UC-05 Alert affected]:::u
    A6[UC-06 Serve lineup API]:::u
  end
  subgraph D_ID[B. Identity & Devices]
    direction TB
    B7[UC-07 Create/sign-in]:::u
    B8[UC-08 Register device]:::u
    B9[UC-09 Update prefs]:::u
  end
  subgraph D_FAV[C. Favorites]
    direction TB
    C10[UC-10 Browse lineup]:::u
    C11[UC-11 Favorite]:::u
    C12[UC-12 Unfavorite]:::u
    C13[UC-13 Swipe onboarding]:::u
    C14[UC-14 View favorites]:::u
  end
  subgraph D_PLAN[D. My Plan / Lock in]
    direction TB
    P15[UC-15 Start Lock in]:::u
    P16[UC-16 Get next clash]:::u
    P17[UC-17 Resolve clash]:::u
    P18[UC-18 Split + validate transition]:::u
    P19[UC-19 View plan]:::u
    P20[UC-20 Re-resolve after change]:::u
  end
  subgraph D_MAP[E. Map & Travel]
    direction TB
    M21[UC-21 Import KML]:::u
    M22[UC-22 Auto-match stages]:::u
    M23[UC-23 Verify location + radius/alias]:::u
    M24[UC-24 Define travel time]:::u
    M25[UC-25 Coordinate to stage]:::u
    M26[UC-26 Manage POIs]:::u
  end
  subgraph D_ONS[F. On-site]
    direction TB
    O27[UC-27 Now and Next]:::u
    O28[UC-28 Offline use]:::u
    O29[UC-29 Walk-time reminder]:::u
    O30[UC-30 Nearest POI]:::u
  end
  subgraph D_GRP[G. Groups]
    direction TB
    G31[UC-31 Create group]:::u
    G32[UC-32 Invite link/QR]:::u
    G33[UC-33 Join]:::u
    G34[UC-34 Leave]:::u
    G35[UC-35 Share my plan]:::u
    G36[UC-36 Auto-build group plan]:::u
    G37[UC-37 Owner override slot]:::u
    G38[UC-38 Follow/own per block]:::u
    G39[UC-39 Board post/edit/remove]:::u
  end
  subgraph D_PRES[H. Presence]
    direction TB
    H40[UC-40 Enable GPS consent]:::u
    H41[UC-41 Update presence coarse]:::u
    H42[UC-42 Auto current artist]:::u
    H43[UC-43 View group presence]:::u
    H44[UC-44 Ask where-is-everyone]:::u
    H45[UC-45 Reply one-tap]:::u
    H46[UC-46 Set sharing mode]:::u
    H47[UC-47 Expire presence]:::u
  end
  subgraph D_MEET[I. Meeting points & safety]
    direction TB
    I48[UC-48 Create meeting point]:::u
    I49[UC-49 Navigate arrow+distance]:::u
    I50[UC-50 Update my status]:::u
    I51[UC-51 Lifecycle transitions]:::u
    I52[UC-52 Safety / I'm lost]:::u
  end
  subgraph D_NOT[J. Notifications]
    direction TB
    N53[UC-53 Send push fan-out]:::u
    N54[UC-54 Lineup-change alert]:::u
    N55[UC-55 Meeting-point notices]:::u
    N56[UC-56 Group-heading/plan update]:::u
  end

  SYSTEM --> D_LIN
  SYSTEM --> D_ONS
  SYSTEM --> D_PRES
  SYSTEM --> D_MEET
  SYSTEM --> D_NOT
  ADMIN --> D_MAP
  USER --> D_ID
  USER --> D_FAV
  USER --> D_PLAN
  USER --> D_ONS
  USER --> D_GRP
  USER --> D_PRES
  USER --> D_MEET
  OWNER --> D_GRP

  classDef a fill:#111,color:#fff,stroke:#000;
  classDef u fill:#eef2ff,stroke:#7c83db,color:#111;
```

---

## A. Lineup & Data (System)
| # | Use Case | Actor |
|---|----------|-------|
| UC-01 | Resolve lineup source (`event`+`uuid`) from the official `__NEXT_DATA__` page | System |
| UC-02 | Fetch + normalize lineup (config/stages/performances): timezone, +1s, midnight | System |
| UC-03 | Detect changes (ETag/Last-Modified/SHA-256) and diff against the DB | System |
| UC-04 | Apply update in a transaction, mark removed acts inactive, bump `lineup_revision` | System |
| UC-05 | Alert users whose favorited/locked acts changed | System |
| UC-06 | Serve festival/lineup/stages to the app (read API; clients never hit the festival site) | System |

**Rules:** Never hardcode `uuid` (re-resolve every run). Removed acts → `active=0`, never hard-deleted. Fallback chain: saved event/uuid → re-resolve on 404 → render page → last snapshot flagged stale. Cadence scales from daily → ~5–10 min during the festival.

## B. Identity & Devices (User)
| # | Use Case | Actor |
|---|----------|-------|
| UC-07 | Sign in — **anonymous by default**; **upgrade to Google/Apple (email-link fallback)** to create/join a group (DEC-024) | User |
| UC-08 | Register a device for push (FCM token) | User |
| UC-09 | Update notification/sharing preferences | User |

**Rules (DEC-024):** Anonymous from the first launch (no auth wall for Pillars 1–2). A **permanent account is required to create/join a group** (Pillar 3); anonymous→permanent linking preserves the `uid` so favorites/plan carry over. Workers verify the Firebase ID token behind `getUserFromRequest()`. Ship Apple + Google together (App Store).

## C. Favorites — Pillar 1 (User)
| # | Use Case | Actor |
|---|----------|-------|
| UC-10 | Browse the full lineup by artist / stage / day | User |
| UC-11 | Favorite an act ("want to see") | User |
| UC-12 | Unfavorite an act | User |
| UC-13 | Fast swipe-favoriting onboarding | User |
| UC-14 | View my favorites (overlaps included) | User |

**Rules:** Favoriting is a wish — **overlaps allowed**. Favorites are the raw material for Pillar 2 and the group fallback (Pillar 3).

## D. My Plan / "Lock in" — Pillar 2 (User)
| # | Use Case | Actor |
|---|----------|-------|
| UC-15 | Start "Lock in" for a festival day | User |
| UC-16 | Get the next clash (chronological, gated) | User |
| UC-17 | Resolve a clash — pick one act → lock a slot | User |
| UC-18 | Split a slot (partial set): set a cut point + validate the transition vs travel time | User |
| UC-19 | View my conflict-free plan per day | User |
| UC-20 | Re-resolve the plan after a lineup change created a new clash | User |

**Rules:** At most **one act per moment**. Resolution is **chronological**; the next clash unlocks only after the locked slot ends. Support cut points + `canMakeTransition()` (never raw-time-only). The locked plan must have **zero overlaps** (invariant).

```mermaid
flowchart TD
  A[Start Lock in for a day] --> B[Build favorites timeline for the day]
  B --> C{Any unresolved clash?}
  C -- no --> Z[Plan complete: conflict-free]
  C -- yes --> D[Show earliest clash: acts side-by-side + genre/context]
  D --> E[User picks one act]
  E --> F[Lock slot]
  F --> G{Split / leave early?}
  G -- yes --> H[Set cut point + next stage]
  H --> I[Validate transition vs travel time]
  I --> J[Advance pointer past slot end]
  G -- no --> J
  J --> C
```

## E. Map & Travel (Admin / System)
| # | Use Case | Actor |
|---|----------|-------|
| UC-21 | Import a map seed (KML/KMZ) → `imported_map_feature` | Admin |
| UC-22 | Auto-match imported features to official stages (normalized name + alias) | System |
| UC-23 | Verify/place a stage location (center + radius); edit aliases; place unmatched stages | Admin |
| UC-24 | Define stage-to-stage travel time (typical + crowded) | Admin |
| UC-25 | Resolve a coordinate → stage area (at/near/between + confidence) | System |
| UC-26 | Manage practical POIs (toilets/water/medical/exits/ATM/charging/lockers) | Admin |

**Rules:** KML coords are `lng,lat`. Seed is **unverified** until an admin confirms (DEC-021). V1 areas = **circles** (polygon V2). Travel times **manual** (learned V2).

## F. On-site essentials (User / System)
| # | Use Case | Actor |
|---|----------|-------|
| UC-27 | View "Now & Next" (on now / next pick / where / when-to-leave countdown) | User |
| UC-28 | Use the app offline (cached lineup, my plan, map/POIs, last group plan) | User |
| UC-29 | Send a walk-time-aware "leave now" reminder | System |
| UC-30 | Find the nearest POI of a type | User |

**Rules (DEC-022):** Offline-first is mandatory. Reminders account for travel time from the current/previous stage.

## G. Groups — Pillar 3a (User / Owner)
| # | Use Case | Actor |
|---|----------|-------|
| UC-31 | Create a group | User |
| UC-32 | Invite via link / QR | Owner |
| UC-33 | Join a group (via invite token) | User |
| UC-34 | Leave a group | User |
| UC-35 | Share my plan with the group | User |
| UC-36 | Auto-build the group timetable (plurality → favorites-fallback → owner) | System |
| UC-37 | Override a group slot (owner) | Owner |
| UC-38 | Per block: follow the group or do-my-own (with favorites-fallback offer) | User |
| UC-39 | Post / edit / remove a pinned group board note | User |

**Rules (DEC-013):** Plurality wins per block; tie → most-favorited → owner. A non-matching lock is offered the member's best favorite at that block. **Never silently override a locked must-see.** Splits are shown, never prevented. **Group board** is in V1; **no real-time chat**.

## H. Live Presence — Pillar 3b (User / System)
| # | Use Case | Actor |
|---|----------|-------|
| UC-40 | Enable GPS (consent at the point of use) | User |
| UC-41 | Update presence (raw fix → coarse stage + confidence) | User |
| UC-42 | Auto-detect current artist from presence + lineup | System |
| UC-43 | View group presence (grouped by stage + coarse map markers) | User |
| UC-44 | Ask "where is everyone?" | User |
| UC-45 | Reply to "where is everyone?" (one-tap, pre-filled nearest stage) | User |
| UC-46 | Set sharing mode (off / while-using / live time-boxed), per group | User |
| UC-47 | Expire stale presence | System |

**Rules (DEC-006/007/008/012/015):** Clients get **stage + confidence**, never raw coordinates. Presence expires (gps ~15m, manual/push ~45m). Push-reply + manual are first-class fallbacks. Sharing is per-group + time-boxed.

## I. Meeting Points & Safety — Pillar 3c (User / System)
| # | Use Case | Actor |
|---|----------|-------|
| UC-48 | Create a meeting point ("come to me") + photo + note + expiry + visibility | User |
| UC-49 | Navigate to a meeting point (compass arrow + distance) | User |
| UC-50 | Update my meeting-point status (going/arrived/left) | User |
| UC-51 | Advance meeting-point lifecycle (expiring_soon → expired → empty → archived) + smart prompts | System |
| UC-52 | Trigger Safety / "I'm lost" — share exact location + show nearest exit/medical | User |

**Rules (DEC-014/015/022):** Exact coordinates leave the server **only** via a meeting point or the safety share. The pin fades as it ages; the record (who went) stays. Photos in R2 archive/purge with the point.

## J. Notifications (System)
| # | Use Case | Actor |
|---|----------|-------|
| UC-53 | Send a push (fan-out via FCM) | System |
| UC-54 | Lineup-change alert to affected users | System |
| UC-55 | Meeting-point notifications ("created", "still there?") | System |
| UC-56 | Group-heading / plan-update notification | System |

**Rules:** Interactive actions (Yes / Change stage / I'm coming) require native notification actions → delivered via the Capacitor shell (DEC-003).

---

## Coverage check (spec → UC)
| Spec feature | UC(s) |
|--------------|-------|
| Lineup ingestion + auto-updater (§7, DEC-009) | UC-01…06 |
| Favorites, 3 browse modes, swipe (§6 P1) | UC-10…14 |
| Lock-in, gated clashes, partial sets + travel validation (§6 P2) | UC-15…20 |
| Map seed import + admin verify, travel matrix, coord→stage (§8, DEC-021/010/011) | UC-21…25 |
| Practical POI layer (§8.1, DEC-022) | UC-26, UC-30 |
| Now&Next, offline, walk-time reminders (§14, DEC-022) | UC-27…29 |
| Groups, group timetable, override, follow/split, invites, board (§6 P3, DEC-013) | UC-31…39 |
| Coarse presence, current artist, group view, where-is-everyone, sharing (§9, DEC-006/007/008/012) | UC-40…47 |
| Meeting points + lifecycle + nav + safety (§10/§11, DEC-014/022) | UC-48…52 |
| Notifications (§11) | UC-53…56 |

**Out of scope (no UC, correctly):** polygon areas, learned travel times, multi-festival, per-block voting, recap/ratings, real-time chat, monetization (all V2 / V1.x).

## Assumptions & gaps (surface before the relevant phase)
- ✅ **Auth mechanism — RESOLVED (DEC-024):** Firebase Auth, anonymous-first; upgrade to Google/Apple (email-link fallback) required to use groups. Workers verify the Firebase ID token behind `getUserFromRequest()`.
- **Offline sync contract (Phase 3):** what's cached, conflict handling on reconnect, and how the client learns of a new `lineup_revision`. Define explicitly.
- **POI completeness:** the KML seeds areas/entrances; toilets/water/medical density will need admin additions (UC-26) — acceptable for V1.
- **"Time block" granularity** for the group plan (UC-36): align with how performances slice the day (per-set vs fixed blocks). Decide in Phase 4.
