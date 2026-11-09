import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  expectPlaying,
  fixedInstant,
  loadHome,
  openEntry,
  shownNoteIds,
  stubJournalMediaRealClip,
} from "./journal-player.helpers";

/**
 * Journal player E2E — captions build on mobile 390px.
 *
 * The full-width progress row (was 27px wide) and the stacked layout
 * (no two-column below 681px). Media bytes are the REAL 10 s clip,
 * fulfilled locally; the video src stays the real meridian-media URL.
 */
test.setTimeout(180_000);
test.use({ video: "on" });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaRealClip(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  await loadHome(page, time);
});

test("progress row is full-width (>=200px) and the controls fit without overflow", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  expect(ids.length).toBe(3);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expectPlaying(video);

  const progress = page.locator(".hv5-journal-progress");
  const progressBox = await progress.boundingBox();
  console.log(`mobile progress: box ${JSON.stringify(progressBox)}`);
  expect(progressBox!.width, "progress bar is full-width, not the old 27px").toBeGreaterThanOrEqual(200);

  const rowBox = await page.locator(".hv5-journal-progress-row").boundingBox();
  console.log(`mobile progress-row: box ${JSON.stringify(rowBox)}`);
  expect(rowBox!.width, "progress row spans the player width").toBeGreaterThanOrEqual(200);
  expect(rowBox!.x + rowBox!.width, "progress row stays inside the 390px viewport").toBeLessThanOrEqual(390);

  // No horizontal overflow anywhere on the page with the player open.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow with the player open").toBe(0);

  // Every control is tappable and inside the viewport.
  for (const testId of [
    `journal-player-toggle-${id}`,
    `journal-player-cc-${id}`,
    `journal-player-transcript-${id}`,
    `journal-player-mute-${id}`,
    `journal-player-close-${id}`,
  ]) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box!.x + box!.width, `${testId} inside the 390px viewport`).toBeLessThanOrEqual(390);
    expect(box!.x, `${testId} inside the 390px viewport`).toBeGreaterThanOrEqual(0);
  }
});

test("mobile stacked layout: art above text, no two-column grid at 390px", async ({
  page,
}) => {
  const ids = await shownNoteIds(page);
  const id = ids[0]!;
  const video = await openEntry(page, id);
  await expectPlaying(video);

  const entry = page.locator(".hv5-entry", { has: page.getByTestId(`journal-movie-${id}`) });
  const columns = await entry.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns, "entry is a single column at 390px").toBe(1);

  const artBox = await page.locator(".hv5-entry-art", { has: page.getByTestId(`journal-movie-${id}`) }).boundingBox();
  const railBox = await entry.locator(".hv5-entry-text").boundingBox();
  console.log(`mobile layout: art ${JSON.stringify(artBox)} text ${JSON.stringify(railBox)}`);
  expect(railBox!.y, "text rail sits below the art, not beside it").toBeGreaterThanOrEqual(artBox!.y + artBox!.height - 1);
  expect(Math.abs(railBox!.x - artBox!.x), "text rail aligns under the art column").toBeLessThanOrEqual(30);
});
