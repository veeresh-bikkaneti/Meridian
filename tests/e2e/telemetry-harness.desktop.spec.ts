import { test, expect } from "playwright/test";
import { collectTelemetry, serveBuiltArtifact, type TelemetryLedger } from "./helpers";

/**
 * Harness self-test (G1): positive proof the telemetry ledger records.
 * The guard test proves no unstubbed path exists and the spill teardown
 * proves an escape fails the run — this spec proves the middle: a real
 * post from the booted app lands in the ledger, via the stub (Test A)
 * and via the collector (Test C), and a plain boot produces no escapes
 * (Test B).
 */

const APP_URL = "http://127.0.0.1:4123/Meridian/";

let tel: TelemetryLedger;

test.beforeEach(async ({ context }) => {
  tel = await serveBuiltArtifact(context);
});

/** Force one js_error: an uncaught throw on a timer hits the app's
 *  window "error" handler, which emits js_error to the endpoint. Waits
 *  for the home UI first — the handlers are installed by the app's boot
 *  effect, and a throw before that is legitimately never captured. */
async function forceJsError(page: import("playwright/test").Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("telemetry-harness-probe");
    }, 0);
  });
}

test("A: forced js_error is recorded by the stub, and nothing escapes", async ({ page }) => {
  await page.goto(APP_URL);
  await forceJsError(page);
  await expect
    .poll(() => tel.count("js_error"), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1);
  // The recorded event must be THIS test's probe error (β-F8): any
  // js_error-shaped post would satisfy the count alone, so pin the
  // payload's error message to the exact error forceJsError throws.
  const probe = tel.first("js_error");
  const probeError = probe?.payload.error as { message?: unknown } | undefined;
  expect(probeError?.message).toBe("telemetry-harness-probe");
  tel.assertNoEscape();
});

test("B: a plain boot produces no escapes", async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(1_000);
  expect(tel.escapes()).toEqual([]);
});

test("C: collectTelemetry records the same post via the collector", async ({ context, page }) => {
  const collected = await collectTelemetry(context);
  expect(collected).toBe(tel);
  await page.goto(APP_URL);
  await forceJsError(page);
  await expect
    .poll(() => tel.count("js_error"), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1);
  expect(tel.first("js_error")?.via).toBe("collector");
  tel.assertNoEscape();
});
