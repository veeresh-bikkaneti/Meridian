import { test, expect, type Page } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact, readPhase } from "./helpers";
import {
  closeEntry,
  expectPlaying,
  fixedInstant,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMedia,
  trackJournalRequests,
} from "./journal-player.helpers";

test.setTimeout(240_000);

/**
 * Journal prefetch E2E — desktop (lazy-load scenario 2).
 *
 * While a round is active, the first 1–2 movies of the current journal
 * set are warmed in the background (CORS fetch + drain into the HTTP
 * cache); a later tap plays instantly. Tap-to-load is unchanged.
 *
 * Harness limit (proven by the Step 0b real-server probe in
 * ~/workspace/journal-prefetch-probe/): Playwright route-interception
 * fulfills bypass the HTTP cache entirely, so an intercepted tap ALWAYS
 * re-requests through the route handler even when warm. These specs
 * therefore assert that prefetch requests happen (when, how many,
 * which entries, and under which gating) and that taps play — cache
 * reuse itself (zero additional transfers on the tap) is proven by the
 * real-server probe, not by this suite. The manifest NOT being
 * re-fetched on tap (memoized loader) is asserted as the observable
 * reuse signal this harness can see.
 */

/** Start a globe round from the already-loaded home page. */
async function startRound(page: Page): Promise<void> {
  // The journal specs freeze the clock; gameplay timers (map mount,
  // zoom settle) need real time, so resume from the fixed instant —
  // the 2 h journal window still cannot cross during the test.
  await page.clock.resume();
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/** End the round and return home. */
async function endRound(page: Page): Promise<void> {
  await page.getByTestId("end-game-button").click();
  await expect(page.getByRole("dialog", { name: "Game summary" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
}

/** The built manifest bytes, for the delayed-manifest tests. */
const MANIFEST_BODY = readFileSync(
  path.resolve("dist/client/videos/journal-manifest.json"),
);

/**
 * Delay the manifest response so the loading state (spinner + text) is
 * observable. Fulfilled from the built file — NOT route.continue():
 * a page-route continue() goes to the real network (nothing listens on
 * :4123; serveBuiltArtifact only fulfills via its own route), so the
 * fetch would fail and the player would land in the error state.
 */
async function delayManifest(page: Page, ms = 800): Promise<void> {
  await page.route("**/videos/journal-manifest.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: MANIFEST_BODY,
    });
  });
}

/** The mp4 URL for a note id. */
function clipUrl(id: string): string {
  return `https://veeresh-bikkaneti.github.io/meridian-media/journal/${id}.mp4`;
}

test.beforeEach(async ({ page, context }) => {
  await serveBuiltArtifact(context);
  await stubJournalMedia(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("(i) no movie bytes before gameplay starts: no media, no manifest, no video", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const section = page.getByTestId("journal-section");
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-testid^="journal-play-"]').first()).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
  await expect(page.locator("video")).toHaveCount(0);
});

test("(ii)+(iii) prefetch fires only after a round starts, at most the first 2 entries", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  const firstTwo = new Set([clipUrl(ids[0]!), clipUrl(ids[1]!)]);
  // Nothing before the round, even given time.
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);

  await startRound(page);
  await expect.poll(() => media.length, { timeout: 20_000 }).toBeGreaterThan(0);
  // Let any second warm land.
  await page.waitForTimeout(3_000);
  for (const url of media) {
    expect(firstTwo.has(url)).toBe(true);
  }
  expect(new Set(media).size).toBeLessThanOrEqual(2);
  // Prefetch also warms the memoized manifest cache: exactly one fetch.
  expect(manifest).toHaveLength(1);
});

test("(iv-a) no prefetch under Save-Data", async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(window.navigator, "connection", {
      value: { saveData: true, effectiveType: "4g" },
      configurable: true,
    });
  });
  // The init script above only applies to pages loaded after it is
  // added, so reload under it (clock + seeds are re-applied by loadHome
  // in beforeEach already; the reload keeps the frozen clock).
  const { time } = fixedInstant();
  await loadHome(page, time);
  const { media, manifest } = trackJournalRequests(page);
  await startRound(page);
  await page.waitForTimeout(5_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
});

test("(iv-b) no prefetch on a slow-2g connection", async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(window.navigator, "connection", {
      value: { saveData: false, effectiveType: "slow-2g" },
      configurable: true,
    });
  });
  const { time } = fixedInstant();
  await loadHome(page, time);
  const { media, manifest } = trackJournalRequests(page);
  await startRound(page);
  await page.waitForTimeout(5_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
});

test("(v) no prefetch after gameplay ends", async ({ page }) => {
  const { media } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  await startRound(page);
  await expect.poll(() => media.length, { timeout: 20_000 }).toBeGreaterThan(0);
  await endRound(page);
  // The set is unchanged after the round; a stale warm would show up here.
  expect(await shownNoteIds(page)).toEqual(ids);
  const countAtEnd = media.length;
  expect(countAtEnd).toBeGreaterThan(0);
  await page.waitForTimeout(5_000);
  expect(media.length).toBe(countAtEnd);
});

test("(vi) a prefetched entry's tap plays, without re-fetching the manifest", async ({
  page,
}) => {
  const { media, manifest } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  await startRound(page);
  await expect
    .poll(() => media.filter((u) => u === clipUrl(ids[0]!)).length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  await endRound(page);
  expect(await shownNoteIds(page)).toEqual(ids);
  const manifestBeforeTap = manifest.length;
  const video = await openEntry(page, ids[0]!);
  await expectPlaying(video);
  // The memoized manifest is reused: the tap fetches no manifest.
  expect(manifest.length).toBe(manifestBeforeTap);
  await closeEntry(page, ids[0]!);
});

test("(vii) a non-prefetched entry's tap loads only that clip, with the spinner", async ({
  page,
}) => {
  // Delay the manifest so the loading state (spinner + text) is observable.
  await delayManifest(page);
  const { media, manifest } = trackJournalRequests(page);
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  const third = ids[2]!;
  const playButton = page.getByTestId(`journal-play-${third}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  await expect(page.getByTestId(`journal-loading-spinner-${third}`)).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByTestId(`journal-loading-${third}`)).toHaveText("Loading the movie…");
  const video = page.getByTestId(`journal-movie-${third}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  // Only that clip's bytes moved, plus the one manifest fetch.
  expect(new Set(media)).toEqual(new Set([clipUrl(third)]));
  expect(manifest).toHaveLength(1);
  await closeEntry(page, third);
});

test("(viii-a) entry text stays on in closed, loading, and playing phases", async ({
  page,
}) => {
  await delayManifest(page);
  const ids = await shownNoteIds(page);
  const first = ids[0]!;
  const section = page.getByTestId("journal-section");
  const note = section.getByTestId("journal-note").first();
  // The entry text lives in .hv5-entry-text (h3 place, where, story,
  // source link) — outside the player figure, so its <p> indices never
  // shift when the figure swaps in a status <p> (loading / error).
  const assertTextOn = async () => {
    const text = note.locator(".hv5-entry-text");
    await expect(text.locator("h3")).not.toBeEmpty();
    await expect(text.locator("p").nth(0)).not.toBeEmpty();
    await expect(text.locator("p").nth(1)).not.toBeEmpty();
    await expect(text.locator("a").first()).toBeVisible();
  };
  // Closed.
  await assertTextOn();
  // Loading.
  const playButton = page.getByTestId(`journal-play-${first}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  await expect(page.getByTestId(`journal-loading-spinner-${first}`)).toBeVisible({
    timeout: 5_000,
  });
  await assertTextOn();
  // Playing.
  const video = page.getByTestId(`journal-movie-${first}`);
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expectPlaying(video);
  await assertTextOn();
  await closeEntry(page, first);
});

test("(viii-b) entry text stays on in the error phase", async ({ page }) => {
  const ids = await shownNoteIds(page);
  const first = ids[0]!;
  // This entry's clip fails outright; the tap must degrade to the error
  // state with the still + text, not a blank card.
  await page.route(`**/meridian-media/journal/${first}.mp4`, (route) => route.abort());
  const section = page.getByTestId("journal-section");
  const note = section.getByTestId("journal-note").first();
  const playButton = page.getByTestId(`journal-play-${first}`);
  await playButton.scrollIntoViewIfNeeded();
  await playButton.click();
  await expect(page.getByTestId(`journal-error-${first}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(`journal-player-retry-${first}`)).toBeVisible();
  const text = note.locator(".hv5-entry-text");
  await expect(text.locator("h3")).not.toBeEmpty();
  await expect(text.locator("p").nth(0)).not.toBeEmpty();
  await expect(text.locator("p").nth(1)).not.toBeEmpty();
  await expect(text.locator("a").first()).toBeVisible();
  await expect(note.locator("img").first()).toBeVisible();
});
