import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Feature-flag E2E (built Pages artifact, base path /Meridian/).
 *
 * Covers the two halves of the flag system:
 *
 * A. The service-worker flags.json rule: network-first — a changed remote
 *    flags.json is observed on the next load (never a stale cache serve),
 *    the response populates a small flag cache, and the cache is the
 *    offline fallback only.
 * B. The first consumer, the PWA kill-switch (pwaUpdateToast):
 *    - flag off  → no service-worker registration attempt, no toast;
 *    - flag on   → today's behavior (SW registers);
 *    - flags.json missing / slow / network-failing → baked-in defaults,
 *      boot unaffected.
 *
 * flags.json is route-intercepted per test. The app's module-scope
 * loadFlags() fires before the PwaUpdateToast effect commits, so the
 * intercepted value wins the boot-time read deterministically with local
 * (sub-ms) route fulfillment.
 */

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";

// React #418 is a pre-existing flaky hydration warning in this build — it
// comes and goes on unmodified loads, so it is excluded from the error
// assertions here exactly as in tests/e2e/pwa.spec.ts.
function relevantErrors(errors: string[]): string[] {
  return errors.filter((e) => !e.includes("Minified React error #418"));
}

const flagsBody = (pwaUpdateToast: boolean) =>
  JSON.stringify({ version: 1, flags: { pwaUpdateToast } });

async function fulfillFlagsJson(
  context: import("playwright/test").BrowserContext,
  body: string,
  opts: { status?: number; delayMs?: number } = {},
) {
  await context.route(FLAGS_PATTERN, async (route) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    await route.fulfill({
      status: opts.status ?? 200,
      body,
      contentType: "application/json; charset=utf-8",
    });
  });
}

async function waitForControlled(page: import("playwright/test").Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => !!navigator.serviceWorker.controller),
      { timeout: 30_000 },
    )
    .toBe(true);
}

async function swRegistered(page: import("playwright/test").Page) {
  return page.evaluate(() =>
    navigator.serviceWorker.getRegistration().then((r) => !!r),
  );
}

async function cachedFlagsJson(page: import("playwright/test").Page) {
  return page.evaluate(() =>
    caches
      .match("http://127.0.0.1:4123/Meridian/flags.json")
      .then((r) => (r ? r.text() : null)),
  );
}

async function networkFlagsJson(page: import("playwright/test").Page) {
  return page.evaluate(() =>
    fetch("/Meridian/flags.json").then((r) => r.text()),
  );
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("SW: flags.json is network-first — never a stale cache serve", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(true));

  // Load 1: SW installs but does not control this document yet.
  await page.goto(APP_URL);
  await waitForControlled(page);

  // Load 2: the controlling SW intercepts the flags.json fetch and
  // populates its flag cache on the network hit.
  await page.reload();
  await waitForControlled(page);
  await expect
    .poll(() => cachedFlagsJson(page), { timeout: 15_000 })
    .toBe(flagsBody(true));

  // Change the remote file between loads (a kill decision landing).
  await context.unroute(FLAGS_PATTERN);
  await fulfillFlagsJson(context, flagsBody(false));

  // Load 3: the new value must be served — network-first, no stale cache.
  await page.reload();
  await waitForControlled(page);
  await expect
    .poll(() => networkFlagsJson(page), { timeout: 15_000 })
    .toBe(flagsBody(false));
  // And the cache followed the network (it is a fallback store, not a source).
  await expect
    .poll(() => cachedFlagsJson(page), { timeout: 15_000 })
    .toBe(flagsBody(false));
});

test("SW: flags.json falls back to the cache only when the network fails", async ({
  page,
  context,
}) => {
  // Flag value true so the SW registers; the cached value is what matters.
  await fulfillFlagsJson(context, flagsBody(true));

  await page.goto(APP_URL);
  await waitForControlled(page);
  await page.reload();
  await waitForControlled(page);
  await expect
    .poll(() => cachedFlagsJson(page), { timeout: 15_000 })
    .toBe(flagsBody(true));

  // Offline: the SW cannot reach the network, so it serves the last-known
  // flags from its cache. (Route fulfillments still work offline — only the
  // SW's internal fetch fails, which is exactly the fallback path.)
  await context.setOffline(true);
  try {
    expect(await networkFlagsJson(page)).toBe(flagsBody(true));
  } finally {
    await context.setOffline(false);
  }
});

test("consumer: flag off → no SW registration, no toast", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(false));

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(APP_URL);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  // Give the (skipped) registration path time it would have used, then
  // assert nothing was registered and no toast can ever appear.
  await page.waitForTimeout(3000);
  expect(await swRegistered(page)).toBe(false);
  await expect(
    page.getByText("A new version is ready to install."),
  ).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test("consumer: flag on → today's behavior (SW registers)", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, flagsBody(true));

  await page.goto(APP_URL);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  await waitForControlled(page);
  expect(await swRegistered(page)).toBe(true);
  const scope = await page.evaluate(() =>
    navigator.serviceWorker.getRegistration().then((r) => r?.scope ?? null),
  );
  expect(scope).toBe("http://127.0.0.1:4123/Meridian/");
});

test("consumer: flags.json missing (404) → defaults → today's behavior", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, "not found", { status: 404 });

  await page.goto(APP_URL);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  await waitForControlled(page);
  expect(await swRegistered(page)).toBe(true);
});

test("consumer: slow flags.json (past the 1.5s timeout) → defaults, boot unaffected", async ({
  page,
  context,
}) => {
  // 5s delay: the app's ~1.5s timeout fires first, defaults win, and the
  // late response is absorbed harmlessly.
  await fulfillFlagsJson(context, flagsBody(false), { delayMs: 5000 });

  await page.goto(APP_URL);
  // Boot is unaffected: the app renders while flags.json is still in flight.
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  // Defaults win (pwaUpdateToast: true) → the SW registers.
  await waitForControlled(page);
  expect(await swRegistered(page)).toBe(true);
});

test("consumer: flags.json network failure → defaults, boot unaffected", async ({
  page,
  context,
}) => {
  await context.route(FLAGS_PATTERN, (route) => route.abort("failed"));

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(APP_URL);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();

  await waitForControlled(page);
  expect(await swRegistered(page)).toBe(true);
  expect(relevantErrors(errors)).toEqual([]);
});
