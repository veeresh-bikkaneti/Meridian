import { existsSync } from "node:fs";
import { defineConfig } from "playwright/test";

/**
 * Which Chromium to launch (review follow-up, 2026-10-21):
 * 1. PLAYWRIGHT_CHROMIUM_EXECUTABLE, when set (any machine).
 * 2. /opt/meta-chromium/chrome, when it exists (this dev VM; see below).
 * 3. Otherwise undefined → Playwright's bundled Chromium. GitHub Actions
 *    uses this path, after `npx playwright install --with-deps chromium`.
 */
const VM_CHROME = "/opt/meta-chromium/chrome";
const chromiumExecutable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim() ||
  (existsSync(VM_CHROME) ? VM_CHROME : undefined);

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
 * Browser: /opt/meta-chromium (Chromium 152.0.7977.82) via executablePath
 * on this VM. Playwright's bundled-Chromium download stalled on its
 * throttled egress (cdn.playwright.dev ~18 B/s). Elsewhere, such as CI, the
 * bundled Chromium is used (see chromiumExecutable above).
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
      executablePath: chromiumExecutable,
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
      // Matches *.mobile.spec.ts and mobile-*.spec.ts (e.g.
      // mobile-home-overlap.spec.ts).
      testMatch: /mobile[^/]*\.spec\.ts/,
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
      name: "grandpa-tour",
      // Grandpa's Tasting Tour (mobile-only screenplay): the filename is
      // fixed by the feature brief, so it gets its own project with the
      // mobile viewport instead of matching the "mobile" project's pattern.
      testMatch: /grandpa-tasting-tour\.spec\.ts/,
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
      name: "observability",
      testMatch: /observability\.spec\.ts/,
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
      name: "geodetective",
      testMatch: /geodetective\.spec\.ts/,
    },
    {
      // Owner directive 2026-10-12: every map tap registers a guess —
      // unlabeled taps open the confirm sheet instead of being rejected.
      name: "geodetective-unlabeled-tap",
      testMatch: /geodetective-unlabeled-tap\.spec\.ts/,
    },
    {
      name: "coldtrail",
      testMatch: /coldtrail\.spec\.ts/,
    },
    {
      name: "review-deck",
      testMatch: /review-deck\.desktop\.spec\.ts/,
    },
    {
      name: "tutorial",
      testMatch: /tutorial\.spec\.ts/,
      // Reduced motion: the map's intro dive becomes an instant jump-to,
      // so the France framing is settled deterministically before the
      // tour's practice tap is sampled. The tutorial UI itself has no
      // motion-dependent behavior.
      use: {
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      },
    },
    {
      name: "game-sfx",
      testMatch: /game-sfx\.spec\.ts/,
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "celebration",
      testMatch: /celebration\.spec\.ts/,
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "crash-watchdog",
      testMatch: /crash-watchdog\.spec\.ts/,
    },
    {
      name: "offline-content",
      testMatch: /offline-content\.spec\.ts/,
    },
    {
      name: "facts-ladder-pilot",
      testMatch: /facts-ladder-pilot\.spec\.ts/,
      // 390px viewport for the mobile layout check (frontend review P1).
      // NOTE: isMobile/hasTouch are intentionally NOT set: mobile UA
      // emulation prevents the satellite map from mounting in headless
      // Chromium, which would break the play-to-result flow. The 390px
      // width is what the overflow assertion needs.
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "storyteller",
      testMatch: /storyteller\.spec\.ts/,
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "clean-round-badge",
      // #113 BLOCK 1 + BLOCK 2: Clean Round badge award rules.
      testMatch: /clean-round-badge\.spec\.ts/,
      use: {
        // 390px viewport for the mobile layout spot-check. NOTE:
        // isMobile/hasTouch are intentionally NOT set: mobile UA emulation
        // prevents the satellite map from mounting in headless Chromium
        // (see facts-ladder-pilot project note).
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "hint-button",
      // #113 follow-up Item A: hint button UI per band policy.
      testMatch: /hint-button\.spec\.ts/,
      use: {
        // 390px viewport for the mobile layout spot-check (same note as
        // clean-round-badge: no mobile UA emulation).
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "geodetective-hint",
      // #113 follow-up Item B: GeoDetective hint UI (8-10 one per mystery,
      // 11-13 none). Same viewport note as hint-button.
      testMatch: /geodetective-hint\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "read-aloud-always",
      // #113 follow-up: "Always" honored on every card in every band;
      // the sound toggle is the only off switch. Desktop viewport: the
      // hit flow (commitHit → phase "story") is only proven at 1440x900;
      // the autoplay/mute behavior under test is viewport-independent.
      testMatch: /read-aloud-always\.spec\.ts/,
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "home-badges-readaloud",
      // #113 follow-ups: earned badges on the home page card (no Passport
      // page) + kid-reachable read-aloud preference settings surface.
      // 390px viewport, no mobile UA emulation (same note as hint-button).
      testMatch: /home-badges-readaloud\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "badge-journey",
      // PR #126 regression cell: black-box badge journeys at both target
      // viewports. 390px viewport, no mobile UA emulation (isMobile/hasTouch
      // breaks loop-map mounting in headless Chromium — same note as
      // hint-button); each test sets its own viewport (390px or 1280px).
      testMatch: /badge-journey\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "motionmaxxing",
      // Motion-language integration (owner order 2026-10-11, M0–M7).
      // Default viewport 390×844 (no mobile UA emulation — same note as
      // badge-journey: isMobile/hasTouch breaks loop-map mounting in
      // headless Chromium); tests that need 1280px set it via test.use.
      testMatch: /motionmaxxing\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "journal",
      // Journal ("What the land remembers", docs/journal-spec.md §8):
      // inline section on the home page, mocked-clock rotation. Desktop viewport.
      testMatch: /journal\.spec\.ts/,
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "search-hidden",
      // Wave 1 P0 Item 4H/4I: home has no Search control. Each test sets
      // its own viewport (360x740 / 390x844); no mobile UA emulation
      // (same note as badge-journey: isMobile/hasTouch breaks map mounting).
      testMatch: /search-hidden\.spec\.ts/,
    },
    {
      name: "motionmaxxing-reduced",
      // Motionmaxxing reduced-motion gate (project reducedMotion fixture —
      // matches the repo's `reduced` project convention).
      testMatch: /motionmaxxing\.reduced\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      },
    },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
});
