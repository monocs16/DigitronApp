import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a LOCAL Supabase stack (Docker) — never production.
 *
 * `e2e/global-setup.ts` starts/resets Supabase, applies migrations, seeds test users,
 * and writes `e2e/.supabase-status.json`. The app boots via `vite --mode e2e`, which
 * loads committed `.env.e2e` pointing at 127.0.0.1:55321.
 *
 * Local and CI use the same command: `pnpm test:e2e`
 */
const PORT = 5183;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "./e2e/results",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  forbidOnly: isCI,
  timeout: isCI ? 60_000 : 30_000,
  retries: isCI ? 2 : 1,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  webServer: {
    command: `CF_WORKERS=0 pnpm exec vite --mode e2e --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
  use: {
    baseURL: BASE_URL,
    locale: "es",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup-admin",
      testMatch: /auth\.admin\.setup\.ts/,
    },
    {
      name: "setup-tech",
      testMatch: /auth\.tech\.setup\.ts/,
    },
    {
      name: "admin",
      testMatch: /order-flow\.spec\.ts/,
      dependencies: ["setup-admin"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/fixtures/admin-state.json",
      },
    },
    {
      name: "technician",
      testMatch: /technician-access\.spec\.ts/,
      dependencies: ["setup-tech"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/fixtures/technician-state.json",
      },
    },
    {
      name: "no-auth",
      testMatch: /auth\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
