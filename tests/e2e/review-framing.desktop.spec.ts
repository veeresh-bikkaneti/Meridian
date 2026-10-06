import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  clickNextPlace,
  commitMiss,
  readPhase,
  resultCard,
} from "./helpers";

/**
 * Review-deck map framing (regression for Veeresh's live bug report):
 * the review map must reframe per card — a Nebraska state card renders
 * Nebraska flat, not a stuck globe over Africa. After answering a review
 * card, the reveal must show the pin-vs-true-spot mapping like normal play.
 *
 * Deck: two Nebraska state-edition cards (Lincoln, Auburn) + one globe card.
 * Assertions read the map wrapper's data-center/data-zoom DOM contract.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const FLAGS_PATTERN = "**/flags.json";
const DECK_KEY = "meridian:review-deck:v1";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const flagsBody = JSON.stringify({
  version: 1,
  flags: { pwaUpdateToast: true, learningOutcomes: true },
});

function card(
  id: string,
  name: string,
  lon: number,
  lat: number,
  edition: "state" | "globe",
) {
  return {
    v: 1,
    place: {
      id,
      name,
      lon,
      lat,
      story: "E2E seed card.",
      difficulty: 2,
      edition,
      regionId: edition === "state" ? "nebraska" : "globe",
      regionName: edition === "state" ? "Nebraska" : "Globe",
      subdivision: "Nebraska",
      sourceLabel: "E2E",
      sourceHref: "https://example.com",
      mapMode: edition === "state" ? "flat" : "globe",
      regionBounds: edition === "state" ? [-104.05, 39.99, -95.31, 43.0] : undefined,
      radiusKm: 75,
    },
    streak: 0,
    nextDueAt: 0,
    lastReviewedAt: 0,
    reviews: 0,
  };
}

function deckSeed() {
  const entries: Record<string, unknown> = {};
  for (const c of [
    card("e2e-framing-lincoln", "Lincoln", -96.7, 40.83, "state"),
    card("e2e-framing-auburn", "Auburn", -95.91, 40.39, "state"),
    card("e2e-framing-paris", "Paris", 2.35, 48.85, "globe"),
  ]) {
    (entries as Record<string, unknown>)[(c as { place: { id: string } }).place.id] = c;
  }
  return { v: 1, entries };
}

async function seedDeck(page: import("playwright/test").Page) {
  await page.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(seed));
      }
    },
    { key: DECK_KEY, seed: deckSeed() },
  );
}

async function mapCenter(page: import("playwright/test").Page) {
  const map = page.locator(".satellite-map");
  const lng = parseFloat((await map.getAttribute("data-center-lng")) ?? "NaN");
  const lat = parseFloat((await map.getAttribute("data-center-lat")) ?? "NaN");
  const zoom = parseFloat((await map.getAttribute("data-zoom")) ?? "NaN");
  return { lng, lat, zoom };
}

async function waitForMapSettled(page: import("playwright/test").Page) {
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

async function startReview(page: import("playwright/test").Page) {
  await page.goto(APP_URL);
  const start = page.getByRole("button", { name: "Start review" });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await waitForMapSettled(page);
}

test("review reframes the map per card: Nebraska flat, not a stuck globe", async ({
  page,
  context,
}) => {
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      body: flagsBody,
      contentType: "application/json; charset=utf-8",
    });
  });
  await seedDeck(page);
  await startReview(page);

  // Card 1 (Auburn, Nebraska — dueEntries sorts by place.id, so Auburn
  // deals first): flat framing on Nebraska.
  await expect(page.getByText("Auburn", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  // The DOM center mirror updates on moveend, which can lag the visual
  // framing (screenshot-verified: Nebraska renders correctly). Poll until
  // the attributes reflect the narrow beat's final position.
  const nebraskaFramed = await expect
    .poll(
      async () => {
        const m = await mapCenter(page);
        return m.zoom >= 4 &&
          Math.abs(m.lng - -99.8) < 3 &&
          Math.abs(m.lat - 41.5) < 3
          ? m
          : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  expect(nebraskaFramed).not.toBeNull();

  // Answer with a miss: the reveal must show the pin-vs-spot mapping.
  await commitMiss(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("done");
  await expect(resultCard(page)).toBeVisible({ timeout: 20_000 });
  // The reveal mapping: player pin + gold true-spot mark render on the map.
  // (A third marker may be present for the distance ring — assert at least
  // the pin and the spot.)
  await expect
    .poll(
      async () =>
        await page.locator(".satellite-map .maplibregl-marker").count(),
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(2);

  // Card 2 (Lincoln, Nebraska): the map must reframe to Nebraska again —
  // not sit on the globe it may have visited during the reveal beat.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect(page.getByText("Lincoln", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  // Same moveend-lag polling as card 1.
  await expect
    .poll(
      async () => {
        const m = await mapCenter(page);
        return m.zoom >= 4 &&
          Math.abs(m.lng - -99.8) < 3 &&
          Math.abs(m.lat - 41.5) < 3
          ? m
          : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();

  // Card 3 (Paris, globe edition): the map must open the globe.
  await commitMiss(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("done");
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await expect
    .poll(
      async () => {
        const m = await mapCenter(page);
        return m.zoom <= 2 ? m : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
});
