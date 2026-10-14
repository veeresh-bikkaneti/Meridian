/**
 * WS-4 Phase 1: satellite failure path (desktop).
 *
 * Owner decision (2026-10-14): when the satellite pictures fail, the child
 * gets one "Try again". If that retry also fails, the map switches to
 * Scout Map for this visit only. Nothing is written to meridian:map-mode,
 * so a reload starts over on the full map with one "Try again" again.
 *
 * Spec: docs/ops/specs/ws-4-satellite-failure-phase1.md
 */
import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact, startGlobeRun, commitMiss, APP_NO_IDLE } from "./helpers";
import { readMapMode, spoofCapableDevice } from "./scout-helpers";

test.setTimeout(240_000);

const TILE_HOST = "**/server.arcgisonline.com/**";
const MAP_MODE_KEY = "meridian:map-mode";
const TRY_AGAIN_COPY =
  "The map pictures won't load right now. Check your internet, then tap Try again.";
const SWITCH_COPY = "We switched to Scout Map so you can keep playing.";

const TILE_STUB = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Registered after serveBuiltArtifact, so these routes take precedence. */
async function blockTiles(context: BrowserContext): Promise<void> {
  await context.route(TILE_HOST, (route) => route.abort());
}

function tryAgainCard(page: Page) {
  return page.getByRole("alert").filter({ hasText: TRY_AGAIN_COPY });
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Start FULL: capable devices otherwise qualify for Scout at boot.
  await spoofCapableDevice(context);
});

test("one failed retry switches to Scout Map for this visit, storing nothing", async ({
  context,
  page,
}) => {
  await blockTiles(context);
  await startGlobeRun(page, 0);

  const card = tryAgainCard(page);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByRole("button", { name: "Try again" })).toBeVisible();

  const storedBefore = await page.evaluate((k) => localStorage.getItem(k), MAP_MODE_KEY);

  // The one retry. It fails again, so the map switches with no second offer.
  await card.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => readMapMode(page), { timeout: 90_000 }).toBe("scout");
  await expect(tryAgainCard(page)).toHaveCount(0);

  // Nothing about the switch is stored.
  const storedAfter = await page.evaluate((k) => localStorage.getItem(k), MAP_MODE_KEY);
  expect(storedAfter).toBe(storedBefore);

  // The switch note waits for the next natural break, after the reveal.
  await commitMiss(page);
  await expect(page.getByText(SWITCH_COPY)).toBeVisible({ timeout: 30_000 });
});

test("after the switch, a reload starts on the full map with one 'Try again'", async ({
  context,
  page,
}) => {
  await blockTiles(context);
  await startGlobeRun(page, 0);
  await expect(tryAgainCard(page)).toBeVisible({ timeout: 60_000 });
  await tryAgainCard(page).getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => readMapMode(page), { timeout: 90_000 }).toBe("scout");

  await page.reload();

  // Nothing was stored, so the reload is full again and the card comes back.
  await expect.poll(() => readMapMode(page), { timeout: 60_000 }).toBe("full");
  await expect(tryAgainCard(page)).toBeVisible({ timeout: 60_000 });
  await expect(tryAgainCard(page).getByRole("button", { name: "Try again" })).toBeVisible();
});

test("if the retry works, nothing switches", async ({ context, page }) => {
  let failing = true;
  await context.route(TILE_HOST, (route) =>
    failing
      ? route.abort()
      : route.fulfill({ status: 200, body: TILE_STUB, contentType: "image/png" }),
  );
  await startGlobeRun(page, 0);

  const card = tryAgainCard(page);
  await expect(card).toBeVisible({ timeout: 60_000 });
  failing = false;
  await card.getByRole("button", { name: "Try again" }).click();

  await expect(tryAgainCard(page)).toHaveCount(0, { timeout: 60_000 });
  // Give a stray switch time to happen; it must not.
  await page.waitForTimeout(3_000);
  expect(await readMapMode(page)).toBe("full");
});
