import {
  test,
  expect,
  type BrowserContext,
  type Page,
} from "playwright/test";
import { readFileSync } from "node:fs";
import {
  serveBuiltArtifact,
  commitHit,
  clickNextPlace,
  readPhase,
} from "./helpers";
import { decodeChallenge2 } from "../../src/game/challenge.ts";
import { SCORING_VERSION } from "../../src/game/scoring.ts";

/**
 * mc2 creation from the review surfaces (Package C, manifest
 * 2026-10-28 §1(e)):
 * - The home Review card and the review-complete screen both carry a
 *   deck-level entry, "Challenge a friend — pick a map" (never a
 *   per-card control), opening the shipped region mini-picker.
 * - The route it deals is FRESH from the picked region's catalog. The
 *   privacy rail (owner ruling OQ4: no "Beat my misses") — deck ids
 *   are decodable from any link, so a deck-sourced deal would publish
 *   the sender's misses. The seeded deck below holds REAL Texas
 *   catalog ids; picking Nebraska must deal five Nebraska catalog ids
 *   with an empty intersection against the deck. If creation ever
 *   dealt from the deck, the ids would be the deck's Texas ids and
 *   both assertions would fail.
 * - Flag OFF (friendChallenges): no entry on either review surface,
 *   while the deck's own controls (Start over) still render — the
 *   surfaces themselves are alive; only the challenge door is gone.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const DECK_KEY = "meridian:review-deck:v1";

const NEBRASKA_CHUNK = JSON.parse(
  readFileSync(
    new URL("../../src/game/data/geonames/chunks/nebraska.json", import.meta.url),
    "utf8",
  ),
) as { places: { id: string; name: string }[] };
const NEBRASKA_CATALOG_IDS = new Set(NEBRASKA_CHUNK.places.map((p) => p.id));

/** The seeded deck's card ids: real Texas catalog places. */
const DECK_IDS = ["gn-4669635", "gn-4670300"];

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

/** Two due deck cards carrying REAL Texas catalog ids + snapshots. */
function deckSeed() {
  const card = (
    id: string,
    name: string,
    lon: number,
    lat: number,
    story: string,
    difficulty: number,
  ) => ({
    v: 1,
    place: {
      id,
      name,
      lon,
      lat,
      story,
      difficulty,
      edition: "state",
      regionId: "texas",
      regionName: "Texas",
      subdivision: "Texas",
      sourceLabel: "E2E",
      sourceHref: "https://example.com",
      mapMode: "flat",
      regionBounds: [-106.65, 25.83, -93.51, 36.5],
      radiusKm: 100,
    },
    streak: 0,
    nextDueAt: 0,
    lastReviewedAt: 0,
    reviews: 0,
  });
  return {
    v: 1,
    entries: {
      "gn-4669635": card(
        "gn-4669635",
        "Abilene",
        -99.73314,
        32.44874,
        "Abilene is a county seat in central Texas.",
        1,
      ),
      "gn-4670300": card(
        "gn-4670300",
        "Allen",
        -96.67055,
        33.10317,
        "Allen is a city in northeastern Texas.",
        2,
      ),
    },
  };
}

async function seedDeck(page: Page) {
  // Seed-once (the review-deck spec's pattern): addInitScript runs on
  // every navigation, so only write when the key is absent — a reload
  // must not clobber the deck updates the flow itself makes.
  await page.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(seed));
      }
    },
    { key: DECK_KEY, seed: deckSeed() },
  );
}

async function waitForMapSettled(page: Page) {
  const map = page.locator(".satellite-map");
  await expect(map).toBeVisible({ timeout: 30_000 });
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

/** Play the seeded two-card review through to the complete screen. */
async function completeReview(page: Page) {
  await page.goto(`${APP_URL}?idle-ms=3600000`);
  const start = page.getByRole("button", { name: "Start review" });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("deck-due-count")).toHaveText("2 cards due");
  await start.click();
  for (let cardIndex = 0; cardIndex < DECK_IDS.length; cardIndex++) {
    await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
    await waitForMapSettled(page);
    await commitHit(page);
    await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("story");
    await clickNextPlace(page);
  }
  await expect(page.getByTestId("review-complete")).toBeVisible({ timeout: 30_000 });
}

function fragmentOf(url: string): string {
  return url.slice(url.indexOf("#"));
}

test("privacy: review-complete entry deals a fresh Nebraska five, never the deck's Texas cards", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await seedDeck(page);
  await completeReview(page);

  const entry = page.getByTestId("review-challenge-a-friend");
  await expect(entry).toBeVisible();
  await expect(entry).toHaveText("Challenge a friend — pick a map");
  await entry.click();

  // The shipped mini-picker: pick Nebraska, land in the preview sheet.
  await expect(page.getByRole("heading", { name: "Challenge a friend" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: /Nebraska/ }).click();
  const preview = page.getByTestId("challenge-preview");
  await expect(preview).toBeVisible({ timeout: 30_000 });
  await expect(preview).toContainText("5 places in Nebraska");
  await expect(preview).toContainText("87 km circle");
  await expect(preview).toContainText("Same places, same circle for everyone.");

  const container = preview.getByTestId("challenge-share-container");
  const url = await container.getAttribute("data-challenge-url");
  expect(url).toBeTruthy();
  const decoded = decodeChallenge2(fragmentOf(url!), SCORING_VERSION);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  expect(decoded.e).toBe("state");
  expect(decoded.r).toBe("nebraska");
  expect(decoded.rad).toBe(87);
  expect(decoded.ids).toHaveLength(5);
  for (const id of decoded.ids) {
    expect(NEBRASKA_CATALOG_IDS.has(id), `${id} must be a Nebraska catalog place`).toBe(true);
    expect(DECK_IDS.includes(id), `${id} came from the review deck — privacy breach`).toBe(false);
  }
});

test("home Review card: the entry opens the same mini-picker and deals in-region", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: true, learningOutcomes: true });
  await seedDeck(page);
  await page.goto(`${APP_URL}?idle-ms=3600000`);

  const entry = page.getByTestId("review-challenge-a-friend");
  await expect(entry).toBeVisible({ timeout: 30_000 });
  await expect(entry).toHaveText("Challenge a friend — pick a map");
  await entry.click();

  await expect(page.getByRole("heading", { name: "Challenge a friend" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: /Nebraska/ }).click();
  const preview = page.getByTestId("challenge-preview");
  await expect(preview).toBeVisible({ timeout: 30_000 });
  const container = preview.getByTestId("challenge-share-container");
  const url = await container.getAttribute("data-challenge-url");
  expect(url).toBeTruthy();
  const decoded = decodeChallenge2(fragmentOf(url!), SCORING_VERSION);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  expect(decoded.r).toBe("nebraska");
  expect(decoded.ids).toHaveLength(5);
  for (const id of decoded.ids) {
    expect(NEBRASKA_CATALOG_IDS.has(id), `${id} must be a Nebraska catalog place`).toBe(true);
    expect(DECK_IDS.includes(id), `${id} came from the review deck — privacy breach`).toBe(false);
  }
});

test("flag off: no challenge entry on either review surface (deck controls still render)", async ({
  page,
  context,
}) => {
  await routeFlags(context, { friendChallenges: false, learningOutcomes: true });
  await seedDeck(page);
  await page.goto(`${APP_URL}?idle-ms=3600000`);

  // Home Review card is alive (due count shows) but carries no entry.
  await expect(page.getByTestId("deck-due-count")).toHaveText("2 cards due", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("review-challenge-a-friend")).toHaveCount(0);

  await completeReview(page);
  await expect(page.getByTestId("review-challenge-a-friend")).toHaveCount(0);
  // Surface sanity control: the deck's own Start over entry DOES render
  // (the deck still holds cards), proving the surface is the right one.
  await expect(page.getByTestId("reset-history-open")).toBeVisible();
});
