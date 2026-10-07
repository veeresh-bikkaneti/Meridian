import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Observability E2E: next-boot suspected_crash emission.
 *
 * Seeds (via init script, exactly once) the state a jetsam kill leaves
 * behind — `meridian.cleanExit = "0"` plus a previous-session breadcrumb
 * for the globe edition — with flags.json stubbed (route interception)
 * to carry an observability endpoint. On boot the app must emit exactly
 * ONE suspected_crash request carrying the previous trail's edition
 * context, and a subsequent reload must emit none (trail rotated +
 * clean-exit re-armed by the first boot).
 *
 * The endpoint host is intercepted, so no real network/service is used.
 */

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const ENDPOINT = "https://obs.example.test/ingest";

test.setTimeout(240_000);

test("unclean previous boot emits exactly one suspected_crash with previous edition context", async ({
  context,
}) => {
  await serveBuiltArtifact(context);

  const ingested: Array<Record<string, unknown>> = [];
  // Registered after serveBuiltArtifact: Playwright matches routes in
  // reverse registration order, so these win for their URLs.
  await context.route("**/flags.json", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        flags: { learningOutcomes: true, pwaUpdateToast: true },
        observabilityEndpoint: ENDPOINT,
      }),
    });
  });
  await context.route(ENDPOINT, async (route) => {
    try {
      ingested.push(route.request().postDataJSON() as Record<string, unknown>);
    } catch {
      ingested.push({});
    }
    return route.fulfill({ status: 204, body: "" });
  });

  // Seed the kill state exactly once (init scripts re-run on reload;
  // the marker keeps the second boot honest — a real kill seeds once).
  await context.addInitScript(() => {
    if (sessionStorage.getItem("meridian.obsSeeded")) return;
    sessionStorage.setItem("meridian.obsSeeded", "1");
    sessionStorage.setItem("meridian.cleanExit", "0");
    sessionStorage.setItem(
      "meridian.breadcrumb",
      JSON.stringify({
        sessionId: "prev-e2e-session",
        buildId: "prev-build",
        startedAt: Date.now() - 60_000,
        lastMilestone: "data_chunk_load_start",
        history: [
          { name: "boot_start", at: Date.now() - 60_000 },
          { name: "run_start", at: Date.now() - 50_000 },
          { name: "data_chunk_load_start", at: Date.now() - 49_000 },
        ],
        edition: "globe",
        regionId: "globe",
        device: { ua: "e2e", dpr: 2, screenW: 414, screenH: 896 },
      }),
    );
  });

  const page: Page = await context.newPage();
  await page.goto(APP_URL);

  await expect
    .poll(() => ingested.filter((e) => e.type === "suspected_crash").length, { timeout: 20_000 })
    .toBe(1);
  const crash = ingested.find((e) => e.type === "suspected_crash") as Record<string, unknown>;
  expect(crash.sessionId).toBe("prev-e2e-session");
  expect(crash.edition).toBe("globe");
  expect(crash.regionId).toBe("globe");
  expect(crash.lastMilestone).toBe("data_chunk_load_start");

  // Reload: the trail was rotated and clean-exit re-armed on first boot,
  // so no second suspected_crash may fire.
  await page.reload();
  await page.waitForTimeout(3_000);
  expect(ingested.filter((e) => e.type === "suspected_crash").length).toBe(1);

  await page.close();
});

test("clean boot emits no suspected_crash", async ({ context }) => {
  await serveBuiltArtifact(context);
  const ingested: Array<Record<string, unknown>> = [];
  await context.route("**/flags.json", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        flags: { learningOutcomes: true, pwaUpdateToast: true },
        observabilityEndpoint: ENDPOINT,
      }),
    });
  });
  await context.route(ENDPOINT, async (route) => {
    try {
      ingested.push(route.request().postDataJSON() as Record<string, unknown>);
    } catch {
      ingested.push({});
    }
    return route.fulfill({ status: 204, body: "" });
  });

  const page = await context.newPage();
  await page.goto(APP_URL);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(ingested.filter((e) => e.type === "suspected_crash").length).toBe(0);
  await page.close();
});

/**
 * D1 REAL-SEQUENCE E2E: a kill DURING the Globe data-chunk load.
 *
 * Unlike the seeded test above, NOTHING here seeds meridian.cleanExit or
 * meridian.breadcrumb (no addInitScript, no evaluate writes): the state
 * is produced by the app itself through the real run-start sequence —
 * load the app, click "Play the globe", and hold the real Globe chunk
 * request (route interception = network control, not state seeding)
 * so the run is still inside `placesFor` when we poll. The poll only
 * READS in-page state to prove openRun armed the flag before the load:
 * sessionStorage meridian.cleanExit === "0" AND the breadcrumb's
 * lastMilestone === "data_chunk_load_start".
 *
 * What this simulates, precisely: the "next boot" is a second tab opened
 * with window.open() from the armed tab. Per the HTML spec, Chromium
 * clones the opener's sessionStorage into the popup at open time, so
 * the popup boots with an equivalent copy of the killed tab's storage
 * state (cleanExit "0" + breadcrumb at data_chunk_load_start) in a
 * DIFFERENT tab, and the armed tab never fires pagehide before the
 * popup reads its copy — the same storage asymmetry a jetsam kill
 * leaves behind. The popup must emit exactly one suspected_crash
 * (edition "globe", lastMilestone "data_chunk_load_start", the armed
 * tab's sessionId) and land on the menu (crash-loop breaker intact).
 *
 * What it does NOT simulate: no real process kill happens (the armed
 * tab stays alive with its chunk request held, and is aborted only
 * during teardown), and this is desktop Chromium, not iOS Safari /
 * WebContent — the on-device kill behavior remains unproven.
 */
test("D1 real-sequence: kill during Globe chunk load (armed through the real run start, no seeding) emits exactly one suspected_crash on next boot", async ({
  context,
}) => {
  await serveBuiltArtifact(context);

  const ingested: Array<Record<string, unknown>> = [];
  // Registered after serveBuiltArtifact: Playwright matches routes in
  // reverse registration order, so these win for their URLs.
  await context.route("**/flags.json", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        flags: { learningOutcomes: true, pwaUpdateToast: true },
        observabilityEndpoint: ENDPOINT,
      }),
    });
  });
  await context.route(ENDPOINT, async (route) => {
    try {
      ingested.push(route.request().postDataJSON() as Record<string, unknown>);
    } catch {
      ingested.push({});
    }
    return route.fulfill({ status: 204, body: "" });
  });

  // Hold the REAL Globe data-chunk request: the built chunk is
  // dist/client/assets/globe-<hash>.js (13,696,487 B — the ~13.7 MB
  // module holding 59,423 places), lazy-imported by placesFor when a
  // Globe run starts. The handler never fulfills until the test
  // releases the gate during teardown, then aborts.
  let releaseGlobeHold: () => void = () => {};
  const globeGate = new Promise<void>((resolve) => {
    releaseGlobeHold = resolve;
  });
  let globeRequests = 0;
  await context.route("**/assets/globe-*.js", async (route) => {
    globeRequests += 1;
    await globeGate;
    await route.abort().catch(() => {});
  });

  const page = await context.newPage();
  try {
    await page.goto(APP_URL);
    await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

    // Real UI run start: click Play the globe and let openRun run. The
    // chunk request is held, so the run stays inside the load.
    await page.getByRole("button", { name: "Play the globe" }).click();

    // Prove the app armed the kill state through the real sequence
    // (assertion-only reads; nothing is written by the test).
    let armedSessionId: string | null = null;
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const raw = sessionStorage.getItem("meridian.breadcrumb");
            const crumb = raw
              ? (JSON.parse(raw) as { lastMilestone?: string; sessionId?: string })
              : null;
            return {
              cleanExit: sessionStorage.getItem("meridian.cleanExit"),
              lastMilestone: crumb?.lastMilestone ?? null,
              sessionId: crumb?.sessionId ?? null,
            };
          }),
        { timeout: 30_000 },
      )
      .toEqual({ cleanExit: "0", lastMilestone: "data_chunk_load_start", sessionId: expect.any(String) });
    const armed = await page.evaluate(() => {
      const raw = sessionStorage.getItem("meridian.breadcrumb");
      return raw ? (JSON.parse(raw) as { sessionId?: string }).sessionId ?? null : null;
    });
    armedSessionId = armed;
    expect(globeRequests).toBeGreaterThanOrEqual(1, "the real Globe chunk request was made (and is held)");

    // The "next boot": window.open clones the armed tab's sessionStorage
    // into the popup (see the header comment for exactly what this does
    // and does not simulate). The armed tab never fires pagehide first.
    const popupPromise = page.waitForEvent("popup", { timeout: 20_000 });
    await page.evaluate((url) => {
      window.open(url, "_blank");
    }, APP_URL);
    const popup = await popupPromise;

    await expect
      .poll(() => ingested.filter((e) => e.type === "suspected_crash").length, { timeout: 20_000 })
      .toBe(1);
    const crash = ingested.find((e) => e.type === "suspected_crash") as Record<string, unknown>;
    expect(crash.sessionId).toBe(armedSessionId);
    expect(crash.edition).toBe("globe");
    expect(crash.regionId).toBe("globe");
    expect(crash.lastMilestone).toBe("data_chunk_load_start");

    // Breaker intact: the next boot lands on the menu, and no second
    // suspected_crash fires.
    await expect(popup.getByRole("button", { name: "Play the globe" })).toBeVisible();
    await popup.waitForTimeout(2_000);
    expect(ingested.filter((e) => e.type === "suspected_crash").length).toBe(1);

    await popup.close();
  } finally {
    // Teardown only: release the held chunk request (aborted) and close
    // the armed tab. This happens after every assertion above.
    releaseGlobeHold();
    await page.close().catch(() => {});
  }
});
