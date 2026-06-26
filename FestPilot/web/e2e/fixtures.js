import { test as base, expect } from "@playwright/test";

/**
 * Shared E2E fixtures.
 *
 * Animation-freeze (the one job here): kill all CSS animations/transitions so screenshots and
 * visibility assertions are deterministic. It is injected via `page.addInitScript` — which runs on
 * EVERY document creation (the initial load AND any reload) — rather than a post-`goto`
 * `page.addStyleTag`.
 *
 * Why this matters: a post-`goto` `addStyleTag` evaluates in the page execution context that the
 * service worker's `controllerchange → location.reload()` can destroy mid-call, surfacing as
 * "Execution context was destroyed, most likely because of a navigation" (~10% per goto under load).
 * Init-time injection is present before first paint and survives that reload, so every spec is
 * stable without repeating freeze boilerplate after each navigation.
 *
 * Specs opt in simply by importing `test`/`expect` from this file instead of `@playwright/test`.
 * Per-test `test.use(...)` options and additional `page.addInitScript(...)` seeds still stack on top.
 */
const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;

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
    await use(page);
  },
});

export { expect };
