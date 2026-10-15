import { readFileSync } from "node:fs";
import { test, expect, type BrowserContext, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  APP_NO_IDLE,
  pickBand,
  readPhase,
  readQuestion,
  dismissTileOverlayIfPresent,
} from "./helpers";

/**
 * globeTierSplit kill switch (WS-0, spec section 4.6). Black-box network-log
 * tests: an Easy Globe run must request only the globe-t1 and globe-t2 tier
 * assets when the flag is on, and all five when it is off, or when flags.json
 * is unreachable (fail-safe to the full pool). Only the network log and the
 * player-visible question are asserted. No production hooks: the flag is
 * forced by routing flags.json, and the service worker is disabled so every
 * request stays visible to the page.
 */

test.setTimeout(240_000);

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await page.addInitScript(() => {
    try {
      (navigator.serviceWorker as unknown as Record<string, unknown>).register = () =>
        Promise.reject(new Error("service worker disabled for test"));
    } catch {
      /* no service worker support: nothing to disable */
    }
  });
});

/**
 * Route flags.json (registered after serveBuiltArtifact, so it wins). When a
 * `gate` is given, the response is held until the gate opens, so the flags
 * request is still in flight when the player presses "Play the globe".
 */
async function routeFlagsJson(
  context: BrowserContext,
  body: string,
  gate?: Promise<void>,
): Promise<void> {
  await context.route("**/flags.json", async (route) => {
    if (gate) await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body,
    });
  });
}

/** Record every globe tier asset and any omitted-chunk request. Register BEFORE goto. */
function trackGlobeAssets(page: Page): { tiers: Set<string>; omitted: string[] } {
  const tiers = new Set<string>();
  const omitted: string[] = [];
  page.on("request", (req) => {
    const pathname = new URL(req.url()).pathname;
    const m = /\/assets\/globe-t([1-5])-[A-Za-z0-9_-]+\.js$/.exec(pathname);
    if (m) tiers.add(m[1]!);
    if (/omitted-globe-chunk/.test(pathname)) omitted.push(pathname);
  });
  return { tiers, omitted };
}

/** A promise that stays pending until `open()` is called. */
function gateOpener(): { gate: Promise<void>; open: () => void } {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { gate, open };
}

/**
 * Same steps a player takes: Easy, "Play the globe", wait for the aim phase.
 * `openFlags` (when given) runs right after the click, so a held flags.json
 * response is released only once the player has pressed the button.
 */
async function startEasyGlobeRun(page: Page, openFlags?: () => void): Promise<void> {
  await page.goto(APP_NO_IDLE);
  await pickBand(page, "Easy");
  await page.getByRole("button", { name: "Play the globe" }).click();
  openFlags?.();
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await dismissTileOverlayIfPresent(page);
}

test("globeTierSplit off (flags.json false): an Easy run requests all five tier files", async ({
  page,
  context,
}) => {
  await routeFlagsJson(context, JSON.stringify({ version: 1, flags: { globeTierSplit: false } }));
  const { tiers, omitted } = trackGlobeAssets(page);

  await startEasyGlobeRun(page);

  expect([...tiers].sort()).toEqual(["1", "2", "3", "4", "5"]);
  expect(omitted).toEqual([]);
  expect(await readQuestion(page)).toMatch(/^Find .+\.$/);
});

test("globeTierSplit on (flags.json true): an Easy run requests only tiers 1 and 2", async ({
  page,
  context,
}) => {
  const flags = gateOpener();
  await routeFlagsJson(
    context,
    JSON.stringify({ version: 1, flags: { globeTierSplit: true } }),
    flags.gate,
  );
  const { tiers, omitted } = trackGlobeAssets(page);

  // flags.json is released only after "Play the globe": a run that did not
  // wait for it would request all five tiers.
  await startEasyGlobeRun(page, flags.open);

  expect([...tiers].sort()).toEqual(["1", "2"]);
  expect(omitted).toEqual([]);
  expect(await readQuestion(page)).toMatch(/^Find .+\.$/);
});

test("unreachable flags.json fails safe to the full pool (all five tier files)", async ({
  page,
  context,
}) => {
  await context.route("**/flags.json", (route) => route.abort("failed"));
  const { tiers, omitted } = trackGlobeAssets(page);

  await startEasyGlobeRun(page);

  expect([...tiers].sort()).toEqual(["1", "2", "3", "4", "5"]);
  expect(omitted).toEqual([]);
  expect(await readQuestion(page)).toMatch(/^Find .+\.$/);
});

test("a flags.json still in flight at 'Play the globe' is waited for: an Easy run still requests only tiers 1 and 2", async ({
  page,
  context,
}) => {
  const flags = gateOpener();
  await routeFlagsJson(
    context,
    JSON.stringify({ version: 1, flags: { globeTierSplit: true } }),
    flags.gate,
  );
  const { tiers, omitted } = trackGlobeAssets(page);

  // Held until after the click: a run that never awaited loadFlags() would
  // request tiers 3-5 at the click and fail this test.
  await startEasyGlobeRun(page, flags.open);

  expect([...tiers].sort()).toEqual(["1", "2"]);
  expect(omitted).toEqual([]);
  expect(await readQuestion(page)).toMatch(/^Find .+\.$/);
});

test("as shipped: with no flags.json route, the shipped dist/client/flags.json gives an Easy Globe run tiers 1 and 2", async ({
  page,
}) => {
  // Precondition: the file the build actually serves ships the flag on.
  expect(JSON.parse(readFileSync("dist/client/flags.json", "utf8")).flags.globeTierSplit).toBe(true);
  const { tiers, omitted } = trackGlobeAssets(page);

  await startEasyGlobeRun(page);

  expect([...tiers].sort()).toEqual(["1", "2"]);
  expect(omitted).toEqual([]);
  expect(await readQuestion(page)).toMatch(/^Find .+\.$/);
});
