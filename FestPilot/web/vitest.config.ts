import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// jsdom for component/hook tests; pure domain + asset tests still run (Node fs is
// available under jsdom). Per-file override with `// @vitest-environment node`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/tests/setup.ts"],
  },
});
