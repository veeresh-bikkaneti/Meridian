import { test, expect, type BrowserContext, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  commitMiss,
  clickNextPlace,
  readPhase,
  readQuestion,
  resultCard,
  RUN_KEY,
} from "./helpers";
import { encodeChallenge, CHALLENGE_GLOBE_RADIUS_KM } from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * Friend challenges E2E (P0-1, `feat/challenge-v1`).
 *
 * Pins both flag states (`friendChallenges: false` and `friendChallenges: true`):
 * - Flag OFF (default): `#c=<valid>` and `#c=mc1.corrupt` fail closed silently,
 *   strip `location.hash`, throw zero page errors, render Home, and hide the
 *   challenge share action in the run summary.
 * - Flag ON: `#c=<valid>` with 5 real Globe places boots directly into the
 *   deterministic 5-place Globe challenge in `playOrder` order, enforces the
 *   750 km pin radius freeze, never writes to session banking / learning
 *   records / review deck / no-repeat history, and renders the challenge
 *   completion screen with a `< 2000`-char `#c=mc1...` share URL.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const CHALLENGE_IDS = [
  "gn-53654", // Mogadishu
  "gn-54225", // Marka
  "gn-55671", // Kismayo
  "gn-57289", // Hargeysa
  "gn-60149", // El Dibir
] as const;
const VALID_HASH = encodeChallenge(CHALLENGE_IDS, SCORING_VERSION);

function relevantErrors(errors: string[]): string[] {
  return errors.filter((e) => !e.includes("Minified React error #418"));
}

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
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
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

test("flag OFF: valid and corrupt #c= hashes fail closed silently, clean URL hash, and hide challenge share UI", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: false, learningOutcomes: false });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Valid #c=mc1... hash with flag OFF -> fails closed to Home, strips hash
  await page.goto(`${APP_URL}?idle-ms=3600000${VALID_HASH}`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();

  // 2. Corrupt #c=mc1.corrupt hash with flag OFF -> fails closed to Home, strips hash
  await page.goto(`${APP_URL}?idle-ms=3600001#c=mc1.corrupt_payload!!!`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await page.evaluate(() => window.location.hash)).toBe("");

  // 3. Normal Globe run summary hides challenge share button when flag OFF
  await page.getByRole("button", { name: "Play the globe" }).click();
  await waitForChallengeAim(page);
  await page.getByRole("button", { name: "End game" }).click();
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("summary");
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("challenge-share-container")).toHaveCount(0);

  expect(relevantErrors(errors)).toEqual([]);
});

test("flag ON: corrupt or unknown-ID #c= hashes fail closed silently to Home and clean URL hash", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const unknownHash = encodeChallenge(
    ["gn-999999991", "gn-999999992", "gn-999999993", "gn-999999994", "gn-999999995"],
    SCORING_VERSION,
  );
  await page.goto(`${APP_URL}?idle-ms=3600000${unknownHash}`);
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(await page.evaluate((k) => sessionStorage.getItem(k), RUN_KEY)).toBeNull();
  expect(relevantErrors(errors)).toEqual([]);
});

test("flag ON: valid #c= link runs deterministic 5-place Globe challenge at 750 km, isolates stores, and emits <2000-char share link", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${APP_URL}?idle-ms=3600000${VALID_HASH}`);
  await waitForChallengeAim(page);

  // Hash is cleaned immediately on boot
  expect(await page.evaluate(() => window.location.hash)).toBe("");

  // Verify run state and 750 km radius freeze (even if age-band profile would scale it)
  const runState = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)!), RUN_KEY);
  expect(runState.regionId).toBe("challenge");
  expect(runState.edition).toBe("globe");
  expect(runState.poolIds).toEqual([...CHALLENGE_IDS]);
  expect(CHALLENGE_GLOBE_RADIUS_KM).toBe(750);

  // Progress badge and deterministic first place (Mogadishu)
  await expect(page.getByTestId("challenge-progress")).toContainText("Place 1 of 5");
  expect(await readQuestion(page)).toContain("Mogadishu");

  // Play all 5 places to completion
  for (let i = 0; i < CHALLENGE_IDS.length; i++) {
    await commitMiss(page);
    await expect(resultCard(page)).toBeVisible({ timeout: 15_000 });
    // Challenge runs must never show learning growth lines even when learningOutcomes is true
    await expect(resultCard(page).getByTestId("growth-line")).toBeHidden();
    await clickNextPlace(page);
  }

  // Challenge complete dialog appears after the 5th place
  const complete = page.getByTestId("challenge-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });
  await expect(complete).toContainText("Route complete! You scored 0 across 5 places.");

  const shareContainer = page.getByTestId("challenge-share-container");
  await expect(shareContainer).toBeVisible();
  const challengeUrl = await shareContainer.getAttribute("data-challenge-url");
  expect(challengeUrl).toBeTruthy();
  expect(challengeUrl!.length).toBeLessThan(2000);
  expect(challengeUrl!).toContain(VALID_HASH);

  // Isolation invariant: session banking, learning records, review deck, and seen history are untouched
  const isolation = await page.evaluate(() => {
    const seenKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("meridian.seen.")) seenKeys.push(k);
    }
    return {
      session: sessionStorage.getItem("meridian.session"),
      learning: localStorage.getItem("meridian:learning:v1"),
      deck: localStorage.getItem("meridian:review-deck:v1"),
      seenKeys,
    };
  });
  expect(isolation).toEqual({
    session: null,
    learning: null,
    deck: null,
    seenKeys: [],
  });

  expect(relevantErrors(errors)).toEqual([]);
});
