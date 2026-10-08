import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";
import { installSfxStub, oscRecords } from "./sfx-stub";

/**
 * Offline-content E2E (built Pages artifact, base path /Meridian/).
 *
 * The sprint's entry-gate fixes make the app survive offline: the service
 * worker serves the shell from cache, loop edition data cached during an
 * online visit replays offline (runtime cache-first in public/sw.js), and
 * uncached loop content shows the designed offline notice — never a blank
 * screen, never a console error.
 *
 * Offline simulation: the suite's `serveBuiltArtifact` fulfills every app
 * URL from disk, which masks real offline behavior (Playwright routes still
 * fulfill while the context is offline). So each offline phase UNROUTES the
 * catch-all and flips `context.setOffline(true)`: from that point the
 * network is genuinely dead and every byte must come from the service
 * worker's caches — exactly the production offline condition. The SW's own
 * registration route (byte-exact built worker) stays in place.
 *
 * Tests:
 * 1. Offline shell boots from the SW cache — the app heading renders,
 *    no dead browser error page.
 * 2. Loop screen with UNCACHED content offline shows the designed notice:
 *    the exact headline `This mystery can't open right now 🔍` in the
 *    loop screen's existing error-card slot (role="alert"), with the
 *    GeoDetective heading still on screen (not blank), and a Try again
 *    button.
 * 3. Loop screen with CACHED content (played online first) replays offline
 *    with zero notices — no role="alert", no offline copy.
 * 4. Online loop entry renders no offline-notice elements at all (the
 *    notice slot stays empty online — the online path is unchanged).
 * 5. Audio offline: SFX is 100% synthesized Web Audio (zero assets), so
 *    toggling sound on offline still fires the confirm blip (observed via
 *    the shared AudioContext stub) with zero console errors.
 *
 * Every test asserts zero console errors and zero uncaught page errors
 * (excluding the pre-existing flaky React #418 hydration warning, filtered
 * exactly as in tests/e2e/pwa.spec.ts and feature-flags.spec.ts).
 */

const DIST = path.resolve("dist/client");
const APP_URL = "http://127.0.0.1:4123/Meridian/";

// Authoritative UX copy for the offline-uncached loop notice
// (LoopScreen.tsx — "UX-finalized copy — do not reword").
const OFFLINE_HEADLINE = "This mystery can't open right now 🔍";
const OFFLINE_SUBCOPY =
  "The clues need the internet the first time. Once a mystery opens, you can play it offline too.";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Serve the built worker byte-exact (same pattern as pwa.spec.ts) so the
  // SW lifecycle under test matches the shipped file.
  const base = await readFile(path.join(DIST, "sw.js"), "utf8");
  await context.route("**/sw.js", async (route) => {
    await route.fulfill({
      status: 200,
      body: base,
      contentType: "text/javascript; charset=utf-8",
    });
  });
});

type ErrorSink = { errors: string[] };

function collectErrors(
  page: import("playwright/test").Page,
  sink: ErrorSink,
): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") sink.errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    sink.errors.push(`pageerror: ${String(err)}`);
  });
}

function expectNoErrors(sink: ErrorSink): void {
  // React #418 is a pre-existing flaky hydration warning in this build,
  // unrelated to offline wiring — it comes and goes on unmodified loads,
  // so it is excluded here exactly as in pwa.spec.ts / feature-flags.spec.ts.
  const relevant = sink.errors.filter(
    (e) => !e.includes("Minified React error #418"),
  );
  expect(
    relevant,
    `expected zero console/page errors, got:\n${relevant.join("\n")}`,
  ).toEqual([]);
}

/**
 * Genuine offline: drop the disk-fulfill catch-all (it would mask offline
 * even with the context offline) and kill the network. Everything from here
 * must be served by the service worker's caches.
 */
async function goOffline(
  context: import("playwright/test").BrowserContext,
): Promise<void> {
  await context.unroute("**/*");
  await context.setOffline(true);
}

async function goOnline(
  context: import("playwright/test").BrowserContext,
): Promise<void> {
  await context.setOffline(false);
  await serveBuiltArtifact(context);
}

/** Wait until the built service worker is activated and controlling. */
async function waitForSwActive(
  page: import("playwright/test").Page,
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return (
            !!reg &&
            !!navigator.serviceWorker.controller &&
            reg.active?.state === "activated"
          );
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

/** Open the GeoDetective loop screen deterministically. */
async function openLoop(
  page: import("playwright/test").Page,
  puzzle: string,
): Promise<void> {
  await page.goto(`${APP_URL}?loop-puzzle=${puzzle}`);
  await page
    .getByRole("button", { name: /Solve a mystery|Resume your case/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "GeoDetective" }),
  ).toBeVisible({ timeout: 30_000 });
}

test("offline: app shell boots from cache, no dead error page", async ({
  context,
}) => {
  const sink: ErrorSink = { errors: [] };
  const page = await context.newPage();
  collectErrors(page, sink);

  // ONLINE: install the SW and let it precache the shell.
  await page.goto(APP_URL);
  await expect(page.getByRole("heading", { name: "Meridian" })).toBeVisible({
    timeout: 30_000,
  });
  await waitForSwActive(page);

  // OFFLINE: the shell + its chunks must come from the SW cache.
  await goOffline(context);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Meridian" })).toBeVisible({
      timeout: 15_000,
    });
    // The shell booted the React app — the page is interactive, not a
    // browser error document.
    await expect(page.getByTestId("sound-toggle")).toBeVisible();
  } finally {
    await goOnline(context);
  }

  expectNoErrors(sink);
});

test("offline loop, uncached: exact offline headline in the error-card slot", async ({
  context,
}) => {
  const sink: ErrorSink = { errors: [] };
  const page = await context.newPage();
  collectErrors(page, sink);

  // ONLINE: install the SW (it precaches loop/manifest.json at install),
  // then go offline with a fresh loop store and a never-played puzzle so
  // the clue file is NOT in the SW cache (the uncached case).
  await page.goto(APP_URL);
  await expect(page.getByRole("heading", { name: "Meridian" })).toBeVisible({
    timeout: 30_000,
  });
  await waitForSwActive(page);
  await page.evaluate(() => {
    localStorage.removeItem("meridian.loop.v2");
    localStorage.removeItem("meridian.loop.open");
  });

  await goOffline(context);
  try {
    await openLoop(page, "218");

    // Not a blank screen: the loop chrome renders around the notice.
    await expect(
      page.getByRole("heading", { name: "GeoDetective" }),
    ).toBeVisible({ timeout: 30_000 });

    // The designed offline notice: exact UX-finalized headline in the
    // existing error-card slot (role="alert"), plus the finalized subcopy.
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText(OFFLINE_HEADLINE);
    await expect(alert).toContainText(OFFLINE_SUBCOPY);
    // The retry affordance stays available for when the player reconnects.
    await expect(
      alert.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  } finally {
    await goOnline(context);
  }

  expectNoErrors(sink);
});

test("offline loop, cached: a mystery played online replays with zero notices", async ({
  context,
}) => {
  const sink: ErrorSink = { errors: [] };
  const page = await context.newPage();
  collectErrors(page, sink);

  // ONLINE: play a mystery so its clue file populates the SW runtime cache.
  await openLoop(page, "218");
  await waitForSwActive(page);
  await expect(
    page.getByRole("article", { name: /Clue 1: Geography/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });

  // OFFLINE: reload — the cached mystery must play with no notices.
  await goOffline(context);
  try {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "GeoDetective" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("article", { name: /Clue 1: Geography/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Zero notices: no error card, no offline copy anywhere.
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(OFFLINE_HEADLINE)).toHaveCount(0);
  } finally {
    await goOnline(context);
  }

  expectNoErrors(sink);
});

test("online loop: no offline-notice elements render (online path unchanged)", async ({
  context,
}) => {
  const sink: ErrorSink = { errors: [] };
  const page = await context.newPage();
  collectErrors(page, sink);

  await openLoop(page, "218");
  await expect(
    page.getByRole("article", { name: /Clue 1: Geography/ }),
  ).toBeVisible({ timeout: 30_000 });

  // The offline notice slot stays empty online — the notice is strictly
  // an offline affordance; the online render is unchanged.
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(OFFLINE_HEADLINE)).toHaveCount(0);

  expectNoErrors(sink);
});

test("offline audio: synthesized SFX still fires via the sound toggle", async ({
  context,
}) => {
  const sink: ErrorSink = { errors: [] };
  // Stub AudioContext before any page script runs (shared sfx-stub).
  await installSfxStub(context);
  const page = await context.newPage();
  collectErrors(page, sink);

  await page.goto(APP_URL);
  await expect(page.getByRole("heading", { name: "Meridian" })).toBeVisible({
    timeout: 30_000,
  });
  await waitForSwActive(page);

  const toggle = page.getByTestId("sound-toggle");
  await expect(toggle).toBeVisible();

  await goOffline(context);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Meridian" })).toBeVisible({
      timeout: 15_000,
    });

    // SFX is 100% synthesized — zero audio assets — so the confirm blip
    // needs no network. Toggle off (silent), then on (plays playCardTap).
    const before = (await oscRecords(page)).length;
    await toggle.click(); // sound off — no blip
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click(); // sound on — fires the blip
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await expect
      .poll(() => oscRecords(page).then((r) => r.length), { timeout: 10_000 })
      .toBeGreaterThan(before);
  } finally {
    await goOnline(context);
  }

  expectNoErrors(sink);
});
