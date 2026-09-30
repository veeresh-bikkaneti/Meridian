import { defineConfig } from "playwright/test";

/**
 * E2E suite for PBI P0-02 (gesture model) / P0-03 (game chrome rework).
 *
 * Target: the BUILT Pages artifact (dist/client, base path /Meridian/).
 * The preview server is started with `npm run preview`, but Chromium 152's
 * Local Network Access enforcement blocks navigation from about:blank to the
 * loopback preview server in this VM
 * (net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS). As the documented
 * equivalent, every app URL is fulfilled from the built files on disk while
 * keeping the production base URL http://127.0.0.1:4123/Meridian/
 * (see tests/e2e/helpers.ts `serveBuiltArtifact`). External hosts (imagery
 * tiles) are passed through untouched.
 *
 * Browser: /opt/meta-chromium (Chromium 152.0.7977.82) via executablePath.
 * Playwright's bundled-Chromium download stalled on this VM's throttled
 * egress (cdn.playwright.dev ~18 B/s), so no new package was installed.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4123",
    launchOptions: { executablePath: "/opt/meta-chromium/chrome" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testMatch: /desktop\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "reduced",
      testMatch: /reduced\.spec\.ts/,
      use: {
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      },
    },
    {
      name: "tap-precision",
      testMatch: /tap-precision\.spec\.ts/,
    },
    {
      name: "p0-gaps",
      testMatch: /p0-gestures-chrome\.spec\.ts/,
    },
    {
      name: "zoom-space",
      testMatch: /zoom-space\.spec\.ts/,
    },
    {
      name: "endless-game",
      testMatch: /endless-game\.spec\.ts/,
    },
  ],
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
});
