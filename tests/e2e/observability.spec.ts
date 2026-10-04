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
