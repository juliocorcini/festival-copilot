import { test as base, expect } from "@playwright/test";

/**
 * Shared E2E fixtures. Two harness-level jobs, both fixing whole-suite races once instead of
 * per-spec boilerplate:
 *
 * 1) Animation-freeze — kill all CSS animations/transitions so screenshots and visibility
 *    assertions are deterministic. Injected via `page.addInitScript` (runs on EVERY document
 *    creation: the initial load AND any reload), not a post-`goto` `page.addStyleTag`. A post-`goto`
 *    `addStyleTag` evaluates in a context that the service worker's `controllerchange →
 *    location.reload()` can destroy mid-call ("Execution context was destroyed…"); init-time
 *    injection is present before first paint and survives that reload.
 *
 * 2) Service-worker settle — after every navigation, wait for the worker to actually control the
 *    page. See `waitForServiceWorkerSettled` below.
 *
 * Specs opt in simply by importing `test`/`expect` from this file instead of `@playwright/test`.
 * Per-test `test.use(...)` options and additional `page.addInitScript(...)` seeds still stack on top.
 */
const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;

/**
 * Wait for the service worker to take control after a navigation.
 *
 * On a first visit the page loads uncontrolled; `registerSW.ts` registers the worker on `load`,
 * `sw.js` calls `clients.claim()` on activate, and the resulting `controllerchange` triggers a
 * one-time `location.reload()`. That reload used to land mid-interaction (between a `fill` and its
 * assertion, or during a multi-step lock-in), silently wiping state — a rare, retry-recovered flake
 * (R8.A).
 *
 * This synchronises the test to the post-claim, post-reload steady state. It does NOT block, skip,
 * or unregister the worker: the SW installs/activates/claims/reloads exactly as shipped, so offline
 * and update fidelity are fully preserved — we only wait for the dust to settle before interacting.
 * `waitForFunction` polls and is navigation-resilient, so it survives the reload (unlike a one-shot
 * `addStyleTag`). Best-effort: a context that never gains a controller (e.g. a non-PROD build with
 * no SW) simply falls through after the timeout — never worse than before.
 */
async function waitForServiceWorkerSettled(page) {
  await page
    .waitForFunction(
      () => {
        const sw = navigator.serviceWorker;
        // No SW support on this context → nothing to settle; let the test proceed.
        if (!sw) return true;
        // Controlled → the claim (and its one-time reload) has already happened.
        return sw.controller != null;
      },
      undefined,
      { timeout: 15_000 }
    )
    .catch(() => {});
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((css) => {
      const inject = () => {
        const style = document.createElement("style");
        style.setAttribute("data-fp-freeze", "");
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inject, { once: true });
      } else {
        inject();
      }
    }, FREEZE);

    // Centralise the SW settle: wrap `page.goto` so every navigation waits for the worker to control
    // the page. This fixes the claim→reload race once, in the harness, rather than per-spec — the
    // same philosophy as the init-time freeze above. Subsequent navigations in the same context
    // return immediately (the controller is already set), so the cost is one settle per context.
    const nativeGoto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await nativeGoto(url, options);
      await waitForServiceWorkerSettled(page);
      return response;
    };

    await use(page);
  },
});

export { expect };
