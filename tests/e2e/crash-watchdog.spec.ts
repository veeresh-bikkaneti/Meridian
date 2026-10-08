import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Crash-watchdog E2E (crash-reporter feature, WS4).
 *
 * The inline ES5 watchdog (meridian-crash-watchdog marker, injected into
 * _shell.html before </body> by scripts/crash-watchdog-plugin.mjs) arms one
 * 28 s timer at parse time. When it fires, and only when the app never
 * signalled readiness (window.__meridian_ready), it inserts an accessible
 * fallback overlay with a "Try again" button. The boot_failure report is
 * auto-sent when the overlay shows (no tap): the endpoint comes from
 * flags.json `observabilityEndpoint`, prefetched at watchdog init.
 *
 * (a) blocked JS chunks -> the generic fallback UI appears with a single
 *     "Try again" button, and the report auto-sends exactly one
 *     boot_failure POST with a buildId string and a device object.
 * (b) WebGL-less device (getContext forced to null) -> the tailored
 *     no-WebGL copy appears instead of the generic heading.
 * (c) stale build -> the app's own "A new version of Meridian is available."
 *     refresh UI wins; the watchdog stands down (the app booted fine, so
 *     __meridian_ready is set, and the stale copy is an explicit watchdog
 *     stand-down signal too). The chunk-load failure emits nothing to the
 *     observability pipeline (see the note in the test).
 * (d) no double-report -> a previous kill's state (seeded cleanExit="0" +
 *     breadcrumb, mirrored from observability.spec.ts) makes the app emit
 *     exactly one suspected_crash on boot and none on reload; the watchdog
 *     never shows its fallback and never POSTs boot_failure.
 *
 * Route-registration order mirrors observability.spec.ts: serveBuiltArtifact
 * first, then the specific stubs — Playwright matches routes in reverse
 * registration order, so the later ones win.
 */

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const ENDPOINT = "https://obs.example.test/ingest";
const GENERIC_HEADING = "The game couldn't start on this phone.";
const NOWEBGL_HEADING = "This phone can't run the 3D map.";
const REFRESH_COPY = "A new version of Meridian is available.";

test.setTimeout(240_000);

/** Stub flags.json carrying an observability endpoint, and record every
 *  POST the (intercepted) endpoint receives. The watchdog fetches
 *  flags.json with a ?t= cache-buster at tap time, so the glob keeps a
 *  trailing * (the app's own query-less fetch matches it too). */
async function stubFlagsWithEndpoint(
  context: Parameters<typeof serveBuiltArtifact>[0],
  ingested: Array<Record<string, unknown>>,
): Promise<void> {
  await context.route("**/flags.json*", async (route) => {
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
}

/** Wait until the watchdog's 28 s timer has definitely fired (its single
 *  check runs at parse+28s, and parse is ~navigation start), so "never
 *  appears" assertions are literal rather than "not yet". */
async function waitOutWatchdogTimer(page: {
  waitForFunction: (
    fn: () => boolean,
    arg: undefined,
    options: { timeout: number },
  ) => Promise<void>;
}): Promise<void> {
  await page.waitForFunction(() => Date.now() - performance.timeOrigin > 33_000, undefined, {
    timeout: 60_000,
  });
}

test("blocked JS chunks: fallback UI appears and the report sends exactly one boot_failure", async ({
  context,
}) => {
  await serveBuiltArtifact(context);

  // The bundle never loads: abort every script, registered after
  // serveBuiltArtifact so these win.
  await context.route("**/*.js", (route) => route.abort());
  await context.route("**/*.mjs", (route) => route.abort());

  const ingested: Array<Record<string, unknown>> = [];
  await stubFlagsWithEndpoint(context, ingested);

  const page = await context.newPage();
  await page.goto(APP_URL);

  // ~28 s later the watchdog inserts the generic fallback UI.
  await expect(page.getByRole("heading", { name: GENERIC_HEADING })).toBeVisible({
    timeout: 60_000,
  });

  // A single "Try again" button (the report auto-sends; no second button).
  const buttonLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#ma button")).map((b) => (b.textContent ?? "").trim()),
  );
  expect(buttonLabels).toEqual(["Try again"]);

  // Auto-send: the endpoint was prefetched at watchdog init, so the
  // boot_failure event POSTs with no tap, then the confirmation appears.
  await expect(page.getByText("Crash note sent, no personal info - helps fix this.")).toBeVisible({
    timeout: 15_000,
  });

  expect(ingested).toHaveLength(1);
  const event = ingested[0];
  expect(event.type).toBe("boot_failure");
  expect(typeof event.buildId).toBe("string");
  expect((event.buildId as string).length).toBeGreaterThan(0);
  expect(typeof event.device).toBe("object");
  expect(event.device).not.toBeNull();

  await page.close();
});

test("WebGL-less device: fallback shows the tailored no-WebGL copy", async ({ context }) => {
  await serveBuiltArtifact(context);

  await context.route("**/*.js", (route) => route.abort());
  await context.route("**/*.mjs", (route) => route.abort());

  // The watchdog probes WebGL at parse time via canvas.getContext —
  // force it to fail so the device reads as WebGL-less. (The bundle is
  // blocked, so no app code is affected by the stub.)
  await context.addInitScript(() => {
    const proto = (
      window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }
    ).HTMLCanvasElement.prototype;
    proto.getContext = function () {
      return null;
    };
  });

  const page = await context.newPage();
  await page.goto(APP_URL);

  await expect(page.getByRole("heading", { name: NOWEBGL_HEADING })).toBeVisible({
    timeout: 60_000,
  });
  // The generic copy must NOT appear.
  await expect(page.getByText(GENERIC_HEADING, { exact: true })).toHaveCount(0);

  await page.close();
});

test("stale build: the app's refresh UI wins, the watchdog stands down, and the chunk error emits nothing", async ({
  context,
}) => {
  await serveBuiltArtifact(context);

  const ingested: Array<Record<string, unknown>> = [];
  await stubFlagsWithEndpoint(context, ingested);

  // Abort only the lazy geonames chunk (dist/client/assets/globe-<hash>.js,
  // lazy-imported by placesFor when a Globe run starts) — the main bundle
  // must boot. Registered after serveBuiltArtifact so it wins.
  await context.route("**/assets/globe-*.js", (route) => route.abort());
  // Pretend the deploy moved on while this tab was open.
  await context.route("**/build-meta.json", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ buildId: "e2e-different-build" }),
    });
  });

  const page = await context.newPage();
  // APP_NO_IDLE: the 33 s watchdog wait below must not trip the app's own
  // 2-minute idle watchdog.
  await page.goto(APP_NO_IDLE);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  await page.getByRole("button", { name: "Play the globe" }).click();

  // The chunk load fails -> openRun catches -> isNewBuildDeployed() sees
  // the stubbed mismatch -> the refresh UI appears (the player stays on
  // the menu with the explanation, exactly like helpers.startGlobeRun's
  // click path).
  await expect(page.getByText(REFRESH_COPY, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();

  // The chunk failure emits NOTHING to the observability pipeline:
  // openRun's catch (src/components/game-app.tsx ~L1130) only calls
  // setStartError — there is no emitEvent/recordMilestone on that path.
  // The only observability artifact is the breadcrumb trail in
  // sessionStorage (lastMilestone "data_chunk_load_start"), which a
  // *later* kill's next boot would carry inside suspected_crash — this
  // boot itself must stay silent.
  await page.waitForTimeout(8_000);
  expect(ingested).toHaveLength(0);
  const crumbMilestone = await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.breadcrumb");
    return raw ? ((JSON.parse(raw) as { lastMilestone?: string }).lastMilestone ?? null) : null;
  });
  expect(crumbMilestone).toBe("data_chunk_load_start");

  // No double recovery screen: the app booted fine (__meridian_ready was
  // set via rAF after first paint, long before the timer), and the
  // stale-build copy is an explicit watchdog stand-down signal too. Wait
  // out the 28 s timer so "never" is literal.
  await waitOutWatchdogTimer(page);
  await expect(page.locator("#mv")).toHaveCount(0);
  await expect(page.getByText(GENERIC_HEADING, { exact: true })).toHaveCount(0);
  expect(ingested).toHaveLength(0);

  await page.close();
});

test("no double-report: exactly one suspected_crash, watchdog stands down and never POSTs boot_failure", async ({
  context,
}) => {
  await serveBuiltArtifact(context);

  const ingested: Array<Record<string, unknown>> = [];
  await stubFlagsWithEndpoint(context, ingested);

  // Seed the kill state exactly once (mirrors observability.spec.ts):
  // the app's own initObservability() must report the previous kill.
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

  const page = await context.newPage();
  await page.goto(APP_URL);

  // The app's automatic pipeline fires exactly one suspected_crash
  // carrying the previous trail.
  await expect
    .poll(() => ingested.filter((e) => e.type === "suspected_crash").length, {
      timeout: 20_000,
    })
    .toBe(1);
  const crash = ingested.find((e) => e.type === "suspected_crash") as Record<string, unknown>;
  expect(crash.sessionId).toBe("prev-e2e-session");
  expect(crash.edition).toBe("globe");
  expect(crash.regionId).toBe("globe");
  expect(crash.lastMilestone).toBe("data_chunk_load_start");

  // The app booted fine (menu renders, readiness signalled).
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  // A reload emits none more (trail rotated + clean-exit re-armed).
  await page.reload();
  await page.waitForTimeout(3_000);
  expect(ingested.filter((e) => e.type === "suspected_crash").length).toBe(1);

  // The watchdog never showed its fallback UI and never POSTed
  // boot_failure — the app reported the kill itself, so the watchdog
  // must stand down. Wait out the 28 s timer so "never" is literal.
  await waitOutWatchdogTimer(page);
  await expect(page.locator("#mv")).toHaveCount(0);
  expect(ingested.filter((e) => e.type === "boot_failure").length).toBe(0);

  await page.close();
});
