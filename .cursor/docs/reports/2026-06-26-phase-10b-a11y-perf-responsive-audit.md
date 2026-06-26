# Phase 10b — Accessibility / Performance / Responsive audit

- **Date:** 2026-06-26
- **Scope:** FestPilot PWA (`FestPilot/web`) — the festival-goer app + admin back-office.
- **Method:** Static review of the design tokens, `index.html`, `manifest.webmanifest`, the full
  `styles.css` animation/transition surface, every `<img>` / `<input>` / `<textarea>` / `<select>`,
  icon-only buttons, and the production build output (`vite build`). No subagents (cost rule).
- **Severity scale:** P0 blocker · P1 should-fix · P2 nice-to-fix · P3 minor/polish.

## Result

The app was already in strong shape: every image carries `alt` (decorative ones use `alt=""`),
inputs are labelled (`<label htmlFor>` / `aria-label` / wrapping `<label>`), interactive surfaces
have `aria-label` + `:focus-visible`, safe-areas use `env(safe-area-inset-*)` throughout, and the
PWA chrome (`theme-color`, manifest, apple metas, `viewport-fit=cover`, `display:standalone`) is
complete. **No P0 found.** The audit surfaced one P1, two P2, and two P3 items; the actionable ones
were fixed in this pass.

## Findings & actions

| ID | Sev | Area | Finding | Action |
|----|-----|------|---------|--------|
| A11Y-1 | **P1** | a11y / motion | Newer animations are gated behind `prefers-reduced-motion: no-preference`, but several **infinite/continuous** ones predated that and ran always: loading `shimmer`, onboarding `swipeCue`, live-presence `presence-pulse` (avatar + map pin), map `.pulse`, `safetyPulse`, and the spinners (`ptr-spin` is gated; `adminSpin` was not). Motion-sensitive users still saw perpetual motion. | **FIXED** — added a global `@media (prefers-reduced-motion: reduce)` safeguard that neutralises all animation/transition durations + iteration counts. Complements (does not replace) the existing `no-preference` gates. |
| A11Y-2 | **P2** | a11y / forms | The **Lock-in** artist search `<input>` had only a `placeholder` (not an accessible name) — inconsistent with the Lineup/My Plan searches, which carry `aria-label`. | **FIXED** — added `aria-label="Search any artist"`. |
| PERF-1 | **P2** | perf / bundle | Single initial JS chunk ~**593 kB** (179 kB gzip). The admin back-office (festival-goers never load it) shipped in that chunk. | **PARTIALLY FIXED** — code-split the 7 admin screens via `React.lazy` with one `Suspense` boundary in `AdminLayout`. Main chunk → **555 kB (170 kB gzip)**; admin now loads on demand (~43 kB raw, split per screen). _Remaining:_ main chunk is still >500 kB — see Deferred. |
| CHROME-1 | **P3** | chrome | `html` had no background colour (only `body`); a brief flash is possible before first paint / on overscroll on some engines. | **FIXED** — set `background: var(--bg)` on `html, body, #root`. |
| A11Y-3 | **P3** | a11y / target | The toast dismiss `×` is a 26 px target (< the 44 px AAA / 24 px AA guidance). | **ACCEPTED** — it is a secondary affordance; auto-dismiss is the primary path and toasts never trap focus. Noted, not changed. |
| RESP-1 | — | responsive | Reviewed 320–480 px + the centered desktop frame: layout is fluid (`max-width:480`, flex), text truncates with ellipsis, controls wrap, safe-areas honoured. | **No P0–P2.** No overflow/clipping found. |

## Verified-compliant (no change needed)

- **PWA chrome:** `theme-color` + `background_color` `#0F0D09` in both `index.html` and the manifest;
  `viewport-fit=cover`; `apple-mobile-web-app-capable` + `status-bar-style black-translucent` +
  `apple-touch-icon`; `display:standalone`, `orientation:portrait`; icons 192/512/maskable.
- **Safe-areas:** `--safe-top` / `--safe-bottom` (`env(safe-area-inset-*)`) on every header, the
  bottom nav, sheets, docks, and the new toaster.
- **Images:** all `<img>` have `alt` (meaningful or empty-decorative).
- **Forms:** inputs/selects/textareas are labelled (the two prior gaps are A11Y-2 + already-fixed).
- **Contrast (spot-check):** `--ink #f5f0e6` on `--bg #0f0d09` ≈ 16:1; `--muted #9c9080` on `--bg`
  ≈ 6:1 — both pass WCAG AA for body text.

## Deferred (recommend for a later improvement round — not done to avoid regressions)

- **PERF-2 (P2):** main chunk still >500 kB. Next safe step is route-level lazy-loading of the heaviest
  stack screens (map, squad sub-stack) behind `Suspense`, and/or lazy-loading the QR (`qrcode`) only on
  the invite screen. Deferred because it touches the hot path and warrants its own verification pass.
- **A11Y-4 (P3):** consider a visible "skip to content" affordance for keyboard users on the tab shell.

## Verification

- `tsc --noEmit` clean · **web 396 tests pass** · `vite build` green with the admin chunks split out.
- Changes are presentation/loading only — no domain, no backend, no change to `buildSquadPlan` or any
  lock. Guardrail intact.
