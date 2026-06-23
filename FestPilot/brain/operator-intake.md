# FestPilot — Operator Intake (answer once, build runs end-to-end)

> **Purpose:** the single form the build reads to implement V1 autonomously without stopping to ask.
> **How to use:** for each question, mark an option with `[x]` and/or write after `Answer:`.
> **Leaving a question blank is fine** — the build uses the **Recommended default** noted on each one.
> **Secrets do NOT go in this file** (it's committed). Secrets live in the gitignored
> `FestPilot/server/.dev.vars` and `FestPilot/web/.env`. This file is for *decisions* + *non-secret* values.

---

## Part 0 — Already done (no action needed) ✅
- Cloudflare API token + Account ID → saved in `server/.dev.vars`, **verified active**, scopes OK for D1 + Pages + Workers.
- Node 22 toolchain present (`nvm use 22`). Repo on `git master` with baseline commits.
- Confirmed: Tomorrowland Belgium 2026 official **line-up + timetable are live** (16 stages; W1 Jul 17–19, W2 Jul 24–26; De Schorre, Boom).

---

## Part 1 — Decisions that change the build (please review)

### Q1. R2 object storage (map asset hosting)
R2 isn't enabled on your account yet (`code 10042`). Enabling it is free to use, but Cloudflare historically asks for a **card on file** (the free tier still costs **$0**).
- [ ] **A.** I'll enable R2 now in the dashboard (free; card may be requested, never charged) → keeps the admin "generate map → upload to R2" pipeline live in V1.
- [ ] **B. (Recommended)** Don't enable R2 for V1. Ship the single De Schorre map as a **static asset** (truly card-free). Wire R2 later when multi-festival admin needs it.

Answer:

### Q2. Lineup / timetable data
The official TML 2026 timetable is public and parseable.
- [ ] **A. (Recommended)** Ingest from the official `belgium.tomorrowland.com` timetable (I parse stages, artists, set times), cross-check against Clashfinder.
- [ ] **B.** I'll provide a file (CSV/JSON). (If so, attach it; I'll adapt the importer.)

Weekend(s) to load:
- [ ] **Both (Recommended)**  [ ] Weekend 1 only  [ ] Weekend 2 only

Answer:

### Q3. Firebase — auth & push
Needed for Google/email sign-in (Phase 4) and push (Phase 3). Until you provide it, the build runs on **anonymous/device-local identity** and **in-app alerts only** — nothing blocks.
- **3a. Auth provider** (you chose anon + Google + email earlier). Create the Firebase project and paste the **web config** (NOT secret) into `web/.env`?
  - [ ] **Yes, set it up now** (step-by-step is in Part 4 below)
  - [ ] **Later (Recommended for first live demo)** — build uses anon/local until I add it
- **3b. Push notifications in V1?** (clash alerts, "your set starts in 15 min", friend pinged you)
  - [ ] **Yes** — I'll generate a VAPID key + service-account JSON (Part 4)
  - [ ] **Defer (Recommended)** — in-app alerts only for V1; add push later

Answer:

### Q4. Native app stores (iOS/Android)
You chose "PWA now → wrap with Capacitor before public launch". Heads-up: store **publishing costs money** (Apple **$99/yr**, Google Play **$25 one-time**) — that conflicts with "$0".
- [ ] **A. (Recommended)** V1 ships as an **installable PWA** (Add to Home Screen) — free. Defer paid store publishing.
- [ ] **B.** I want store publishing in V1 (I accept the Apple/Google fees + will provide developer accounts).

Answer:

---

## Part 2 — Branding & naming (safe to leave blank)

### Q5. Public name + tagline
- Recommended default: name **"FestPilot"**, tagline I'll pick to match the UI.

Answer (name / tagline):

### Q6. Domain
- Recommended default: ship on `festpilot.pages.dev` (web) + `festpilot.<account>.workers.dev` (API). Custom domain optional — if you want one, add it to Cloudflare and write it here.

Answer:

### Q7. Logo & icons
- Recommended default: I generate a clean placeholder PWA icon set (192/512/maskable/favicon/apple-touch) + theme from the existing UI palette.
- [ ] Use my generated placeholder (Recommended)
- [ ] I'll provide a logo (attach PNG/SVG)

Answer:

### Q8. Service names
- Recommended default: Worker `festpilot`, Pages project `festpilot`, D1 db `festpilot`, R2 bucket `festpilot-assets`.

Answer (only if you want different names):

---

## Part 3 — Product rules (safe to leave blank)

### Q9. Squad (group) size cap
- Recommended default: **20** members per squad.

Answer:

### Q10. Location sharing & privacy
- Recommended default: presence shows **coarse stage labels** by default; **precise** GPS sharing is **opt-in** and **auto-expires after 60 min**.

Answer (cap minutes / change defaults):

### Q11. Invites
- Recommended default: short **invite code** + shareable **link**; link expires in **24h**; joinable while the festival is active.

Answer:

### Q12. Analytics
- Recommended default: **Cloudflare Web Analytics** (free, privacy-friendly, no cookies). No third-party trackers.
- [ ] OK (Recommended)   [ ] None   [ ] Other:

Answer:

---

## Part 4 — Process & autonomy (safe to leave blank)

### Q13. Git remote
- Recommended default: **local git only** (matches direct-upload Pages, no GitHub).
- [ ] Local only (Recommended)
- [ ] Create a **private GitHub repo** + push for backup (I'll need you to authorize `gh`/provide a repo)

Answer:

### Q14. Autonomy contract (please confirm)
Default behavior the build will follow unless you object here:
> Build, run tests, **commit per phase**, and **deploy to your Cloudflare account** without pausing — **as long as everything stays on free tiers**. If any step would **incur cost** or needs a **credential you haven't supplied**, the build **stops and notes it** in `dev-log.md` (it won't ask one question at a time, and won't spend money).
- [ ] **Confirmed (Recommended)**   [ ] I want to approve each deploy

Answer:

### Q15. Legal / contact (needed for Google OAuth consent + good practice for location data)
- Recommended default: I generate basic `PRIVACY.md` + `TERMS.md`. Provide a **support email** (or I use a placeholder you can swap later).

Support email:
Answer:

---

## Part 5 — Step-by-step for Firebase (only if Q3 = "set it up now")

1. Go to <https://console.firebase.google.com> → **Add project** → name it (e.g. `festpilot`) → you can disable Google Analytics.
2. **Build → Authentication → Get started** → enable **Anonymous**, **Google**, **Email/Password**.
3. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app → copy the config object.
   Put the values (NOT secret) into `FestPilot/web/.env`:
   `VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, VITE_FIREBASE_MESSAGING_SENDER_ID`.
   Also set `FIREBASE_PROJECT_ID` in `FestPilot/server/.dev.vars` (the Worker verifies tokens with just the project id).
4. **(Only if push, Q3b = Yes)** Project settings → **Cloud Messaging** → **Web Push certificates** → *Generate key pair* →
   put the public key in `web/.env` as `VITE_FCM_VAPID_KEY`. Then Project settings → **Service accounts** →
   *Generate new private key* (downloads a JSON) → save the path in `server/.dev.vars` as `FIREBASE_SERVICE_ACCOUNT`
   (the build runs `wrangler secret put FIREBASE_SERVICE_ACCOUNT`). **This JSON is the one true secret — never paste it in chat.**

> Tip: the Firebase **web config is not secret** — you can paste those 5 values in chat if that's easier than editing files.

---

### When you're done
Save this file. Tell me "intake done" (you don't need to answer everything — blanks use the recommended defaults).
I'll mirror your answers into `decision-log.md`, then start executing the orchestrator phases and deploying to your account.
