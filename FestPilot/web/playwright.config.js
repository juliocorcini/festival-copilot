import { defineConfig, devices } from "@playwright/test";

/**
 * E2E + visual smoke tests. Runs against a local preview of the built `dist` so a milestone
 * is verified exactly as shipped. Mobile viewport by default — FestPilot is a phone-first PWA.
 * Run: `npm run build && npx playwright test` (the webServer builds+serves automatically).
 *
 * NOTE: authored as ESM `.js` (not `.ts`) because the local Node runtime (18.17) predates native
 * TypeScript config loading; spec files are still `.ts` and load via Playwright's own transform.
 */
const PORT = 4174;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  outputDir: "./e2e/.output",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    ...devices["Pixel 7"],
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
