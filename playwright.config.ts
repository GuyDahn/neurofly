import { defineConfig } from "@playwright/test";

/**
 * Browser checks that need a real layout engine, which the node:test suite
 * (tests/*.test.ts) can't give them. Kept separate: `pnpm test:e2e`, not
 * wired into `pnpm test` or CI, since it needs a built or dev server and a
 * downloaded browser.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  webServer: {
    command: "pnpm --filter @wiredmind/web dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
