import { defineConfig } from "vitest/config";

// Core ingestion logic (resolver, normalize, diff, plan, orchestration) is
// runtime-agnostic and unit-tested in a plain Node environment against the
// validated spike fixtures. The Worker/D1 layer is exercised separately via
// `wrangler dev` + `d1 migrations apply --local`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
  },
});
