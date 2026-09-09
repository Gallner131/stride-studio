import { defineConfig, devices } from "@playwright/test";

/**
 * Spec §12.2 / §12.3.
 *
 * Locale and timezone are pinned because the legacy renderer formats dates with
 * `toLocaleDateString(undefined, ...)` (src/render.js:24-26). Without pinning, every
 * golden containing the meta line would differ between machines and across DST.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "test",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "en-GB",
    timezoneId: "UTC",
    colorScheme: "dark",
    trace: process.env.CI ? "retain-on-failure" : "off",
  },

  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/test/golden/harness.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    {
      name: "golden",
      testMatch: /golden\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1, viewport: { width: 1280, height: 900 } },
    },
    {
      name: "e2e-mobile",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false },
    },
    {
      name: "e2e-desktop",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
