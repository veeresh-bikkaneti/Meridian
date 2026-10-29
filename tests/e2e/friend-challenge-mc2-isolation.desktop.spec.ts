import {
  test,
  expect,
  type BrowserContext,
  type Page,
} from "playwright/test";
import {
  serveBuiltArtifact,
  commitMiss,
  MC2_RUN_KEY,
  clickNextPlace,
  readPhase,
  resultCard,
} from "./helpers";
import { encodeChallenge2 } from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * mc2 isolation E2E (Package A): a state-edition challenge run must be
 * as invisible to the player's own records as the mc1 globe challenge
 * is (the shipped isolation contract, per edition): no session banking,
 * no learning records, no review-deck writes, and no no-repeat seen
 * history — proven with a live sentinel control on the seen scan, the
 * same technique the frozen mc1 spec uses, so the scan itself is
 * proven able to fail.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";

const NEBRASKA_IDS = [
  "gn-5072006", // Lincoln
  "gn-5074472", // Omaha
  "gn-5063805", // Bellevue
  "gn-5068725", // Fremont
  "gn-5069297", // Grand Island
] as const;

const NEBRASKA_HASH = encodeChallenge2(
  { edition: "state", regionId: "nebraska", radiusKm: 87, ids: NEBRASKA_IDS },
  SCORING_VERSION,
);

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await page.addInitScript(() => {
    try {
      (navigator.serviceWorker as unknown as Record<string, unknown>).register = () =>
        Promise.reject(new Error("service worker disabled for test"));
    } catch {
      /* ignore */
    }
  });
});

async function routeFlags(
  context: BrowserContext,
  flags: Record<string, boolean>,
): Promise<void> {
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: 1,
        flags: { pwaUpdateToast: true, ...flags },
      }),
    });
  });
}

async function waitForChallengeAim(page: Page): Promise<void> {
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page, MC2_RUN_KEY), { timeout: 30_000 }).toBe("aim");
  const map = page.locator(".satellite-map");
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

function scanSeenKeysInPage(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("meridian:seen:v2:")) keys.push(k);
  }
  return keys.sort();
}

test("a Nebraska challenge writes nothing to session, learning, deck, or seen history", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${APP_URL}?idle-ms=3600000${NEBRASKA_HASH}`);
  await expect(page.getByTestId("challenge-welcome")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("challenge-start").click();
  await waitForChallengeAim(page);

  // Play two places (misses are still plays: a leaked write would land).
  for (let i = 0; i < 2; i++) {
    await commitMiss(page, MC2_RUN_KEY);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    await clickNextPlace(page);
    if (i === 0) await waitForChallengeAim(page);
  }

  const stores = await page.evaluate(() => ({
    session: sessionStorage.getItem("meridian.session"),
    learning: localStorage.getItem("meridian:learning:v1"),
    deck: localStorage.getItem("meridian:review-deck:v1"),
  }));
  expect(stores).toEqual({ session: null, learning: null, deck: null });

  // Seen-history scan with a live control (see the frozen mc1 spec for
  // why the control matters: a scan over the wrong prefix can never fail).
  expect(await page.evaluate(scanSeenKeysInPage)).toEqual([]);
  const SENTINEL = "meridian:seen:v2:e2e-control:control:medium";
  await page.evaluate(
    (k) => localStorage.setItem(k, JSON.stringify(["sentinel-place"])),
    SENTINEL,
  );
  expect(await page.evaluate(scanSeenKeysInPage)).toContain(SENTINEL);
  await page.evaluate((k) => localStorage.removeItem(k), SENTINEL);
  expect(await page.evaluate(scanSeenKeysInPage)).toEqual([]);

  expect(errors.filter((e) => !e.includes("Minified React error #418"))).toEqual([]);
});
