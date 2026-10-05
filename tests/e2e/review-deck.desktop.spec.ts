import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  clickNextPlace,
  commitHit,
  readPhase,
  resultCard,
} from "./helpers";

/**
 * Misses-review deck E2E (built Pages artifact, base path /Meridian/).
 *
 * - Empty state: flag on + empty deck → the picker shows the "Review my
 *   misses" section with the empty copy and no Start button.
 * - Flag off: no deck entry at all (the deck only populates while the
 *   learningOutcomes flag is on).
 * - Review flow: a seeded due card → Start review → question → hit via the
 *   true spot → reveal (growth line proves the learning-record hook) →
 *   Next → review-complete screen; the deck store shows the card
 *   rescheduled (streak 1, due in 1 day); no session was ever created
 *   (review never banks).
 * - Persistence across reload: the rescheduled card survives a reload and
 *   the picker shows "All caught up!".
 *
 * flags.json is route-intercepted per test (same pattern as
 * learning-outcomes.desktop.spec.ts). The deck is seeded through
 * localStorage before load — the same key the app reads.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const DECK_KEY = "meridian:review-deck:v1";
const SESSION_KEY = "meridian.session";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const flagsBody = (learningOutcomes: boolean) =>
  JSON.stringify({ version: 1, flags: { pwaUpdateToast: true, learningOutcomes } });

async function fulfillFlagsJson(
  context: import("playwright/test").BrowserContext,
  learningOutcomes: boolean,
) {
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      body: flagsBody(learningOutcomes),
      contentType: "application/json; charset=utf-8",
    });
  });
}

/** One due deck card: Lincoln, NE — a state-edition question replay. */
function deckSeed() {
  return {
    v: 1,
    entries: {
      "e2e-deck-lincoln": {
        v: 1,
        place: {
          id: "e2e-deck-lincoln",
          name: "Lincoln",
          lon: -96.7,
          lat: 40.83,
          story: "Nebraska's capital, named for Abraham Lincoln.",
          difficulty: 2,
          edition: "state",
          regionId: "nebraska",
          regionName: "Nebraska",
          subdivision: "Nebraska",
          sourceLabel: "E2E",
          sourceHref: "https://example.com",
          mapMode: "flat",
          regionBounds: [-104.05, 39.99, -95.31, 43.0],
          radiusKm: 75,
        },
        streak: 0,
        nextDueAt: 0,
        lastReviewedAt: 0,
        reviews: 0,
      },
    },
  };
}

async function seedDeck(page: import("playwright/test").Page) {
  // Seed-once: addInitScript runs before every navigation (including the
  // test's own reload), so only seed when the key is absent — otherwise a
  // reload would clobber the deck updates the test is asserting.
  await page.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(seed));
      }
    },
    { key: DECK_KEY, seed: deckSeed() },
  );
}

async function readDeck(page: import("playwright/test").Page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), DECK_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Wait for the map's intro/framing to settle before tapping: the wrapper is
 * inert during the intro beat, and the spot's screen point moves with the
 * camera. Polls data-zoom until stable (the startGlobeRun pattern), then
 * the spot projection until stable.
 */
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
  await expect(page.getByTestId("deck-due-count")).toHaveText("1 card due");
  await start.click();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await waitForMapSettled(page);
  // State-edition questions ask the bare place name.
  await expect(page.getByText("Lincoln", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test("empty deck: picker shows the empty-state copy, no Start button", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, true);
  await page.goto(APP_URL);
  const section = page.getByRole("region", { name: "Review my misses" });
  await expect(section).toBeVisible({ timeout: 20_000 });
  await expect(section).toContainText("Miss a place and it'll land here for review.");
  await expect(page.getByRole("button", { name: "Start review" })).toHaveCount(0);
});

test("flag off: no deck entry at all", async ({ page, context }) => {
  await fulfillFlagsJson(context, false);
  await seedDeck(page);
  await page.goto(APP_URL);
  // The edition picker loads; the deck section never renders with the flag off.
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("region", { name: "Review my misses" })).toHaveCount(0);
});

test("review flow: due card → hit → rescheduled, complete screen, no session", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, true);
  await seedDeck(page);
  await startReview(page);

  // commitHit only returns once the tap lands in the story phase (it
  // retries otherwise); poll the persisted phase explicitly — commitHit
  // itself returns { committedAt } only.
  await commitHit(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("story");
  await expect(resultCard(page)).toBeVisible({ timeout: 20_000 });
  // The review answer recorded a learning attempt (first sight, hit) —
  // the growth line proves the learning-record hook ran.
  await expect(resultCard(page)).toContainText("Great first try!", {
    timeout: 10_000,
  });

  await clickNextPlace(page);
  const complete = page.getByTestId("review-complete");
  await expect(complete).toBeVisible({ timeout: 15_000 });
  await expect(complete).toContainText("You remembered 1 of 1.");

  // Deck scheduling: the hit walked the Leitner ladder — streak 1, due in
  // ~1 day, still in the deck (not mastered yet).
  const deck = await readDeck(page);
  const entry = deck.entries["e2e-deck-lincoln"];
  expect(entry.streak).toBe(1);
  expect(entry.reviews).toBe(1);
  expect(entry.nextDueAt).toBeGreaterThan(Date.now());

  // Review never banks: no session was created by the review session.
  const sessionRaw = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY);
  expect(sessionRaw).toBeNull();
});

test("persistence across reload: rescheduled card survives, picker shows caught-up", async ({
  page,
  context,
}) => {
  await fulfillFlagsJson(context, true);
  await seedDeck(page);
  await startReview(page);

  // commitHit only returns once the tap lands in the story phase (it
  // retries otherwise); poll the persisted phase explicitly — commitHit
  // itself returns { committedAt } only.
  await commitHit(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("story");
  await expect(resultCard(page)).toBeVisible({ timeout: 20_000 });
  await clickNextPlace(page);
  await expect(page.getByTestId("review-complete")).toBeVisible({ timeout: 15_000 });

  const before = await readDeck(page);
  expect(before.entries["e2e-deck-lincoln"].streak).toBe(1);

  // Reload mid-app: the review run is dropped (fail closed to the picker),
  // but the deck — the durable state — persists with its new schedule.
  await page.reload();
  const after = await readDeck(page);
  expect(after.entries["e2e-deck-lincoln"].streak).toBe(1);
  expect(after.entries["e2e-deck-lincoln"].nextDueAt).toBe(
    before.entries["e2e-deck-lincoln"].nextDueAt,
  );

  const section = page.getByRole("region", { name: "Review my misses" });
  await expect(section).toBeVisible({ timeout: 20_000 });
  await expect(section).toContainText("All caught up! New misses will show up here.");
  await expect(page.getByRole("button", { name: "Start review" })).toHaveCount(0);
});
