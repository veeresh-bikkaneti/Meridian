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
    // INFRA (2026-10-05): the VM has 7.7 GB RAM, zero swap, 794 MB /dev/shm.
    // Concurrent E2E suites OOM-kill Chromium, and /dev/shm exhaustion alone
    // crashes the renderer — so /tmp-backed shm is used instead (disk is
    // plentiful). E2E runs are also serialized VM-wide via
    // `flock ~/workspace/.e2e.lock` with --workers=1; never run two suites
    // concurrently.
    launchOptions: {
      executablePath: "/opt/meta-chromium/chrome",
      args: ["--disable-dev-shm-usage"],
    },
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
      name: "tap-verify",
      testMatch: /tap-verify\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "endless-game",
      testMatch: /endless-game\.spec\.ts/,
    },
    {
      name: "scoring-v3",
      testMatch: /scoring-v3\.spec\.ts/,
    },
    {
      name: "question-randomization",
      testMatch: /question-randomization\.spec\.ts/,
    },
    {
      name: "pinch-zoom",
      testMatch: /pinch-zoom\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "drilldown",
      testMatch: /edition-drilldown\.spec\.ts/,
    },
    {
      name: "desktop-gestures",
      testMatch: /desktop-gestures\.spec\.ts/,
    },
    {
      name: "highlight",
      testMatch: /highlight\.spec\.ts/,
    },
    {
      name: "session-score",
      testMatch: /session-score\.spec\.ts/,
    },
    {
      name: "pwa",
      testMatch: /pwa\.spec\.ts/,
    },
    {
      name: "feature-flags",
      testMatch: /feature-flags\.spec\.ts/,
    },
    {
      name: "question-labels",
      testMatch: /question-labels\.spec\.ts/,
    },
    {
      name: "question-wrap",
      testMatch: /question-wrap\.spec\.ts/,
    },
    {
      name: "endgame-share",
      testMatch: /endgame-share\.spec\.ts/,
    },
    {
      name: "subdivision-labels",
      testMatch: /subdivision-labels\.spec\.ts/,
    },
    {
      name: "difficulty-picker",
      testMatch: /difficulty-picker\.spec\.ts/,
    },
    {
      name: "cleared-mode",
      testMatch: /cleared-mode\.spec\.ts/,
    },
    {
      name: "crash-loop-breaker",
      testMatch: /crash-loop-breaker\.spec\.ts/,
    },
    {
      name: "safari-launch",
      testMatch: /safari-launch\.spec\.ts/,
    },
    {
      name: "question-card-header",
      testMatch: /question-card-header\.spec\.ts/,
    },
    {
      name: "review-deck",
      testMatch: /review-deck\.desktop\.spec\.ts/,
    },
  ],
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
});
