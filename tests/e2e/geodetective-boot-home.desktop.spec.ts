import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  fixedInstant,
  loadHome,
  stubJournalMedia,
  trackJournalRequests,
} from "./journal-player.helpers";

test.setTimeout(240_000);

/**
 * B7 (owner ruling, 2026-11-09): a new session always lands on Home —
 * GeoDetective opens only when the kid taps into it. The persisted
 * `meridian.loop.open` flag no longer auto-opens LoopScreen on boot.
 *
 * The saved loop itself (deck/progress/streak in `meridian.loop.v2`)
 * is untouched: tapping the card after boot resumes the saved mystery
 * where it left off, without re-dealing.
 *
 * Consequence for B4 (mooted by B7): a reload lands on Home, so there
 * is no restored loop to warm — no prefetch runs on a reload. The
 * first test asserts that directly (no media/manifest requests after
 * the seeded-flag boot lands on Home).
 */

/** An in-progress mystery, as the app itself persists it (puzzle 218 = Ankara). */
const SEEDED_LOOP_V2 = {
  deck: { deck: [100], cycle: 1, cycleCompleted: 3 },
  current: {
    index: 218,
    cycle: 1,
    guesses: [],
    status: "playing",
    cluesRevealed: 1,
    completedAt: null,
    streakEndedAt: null,
    completedCycle: false,
  },
  streak: 1,
  bestStreak: 1,
  totals: { solved: 3, lost: 0 },
};

/** The persisted loop blob, as read back from the page. */
async function loopStore(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("meridian.loop.v2")!));
}

test.beforeEach(async ({ page, context }) => {
  await serveBuiltArtifact(context);
  await stubJournalMedia(page);
  const { time } = fixedInstant();
  await page.clock.install({ time });
  // The loop seeds are added per-test via addInitScript before loadHome;
  // loadHome adds its own (tour/tutorial) seeds and navigates.
  await loadHome(page, time);
});

test("(B7) fresh load with a persisted loopOpen flag lands on Home, GeoDetective closed", async ({
  page,
}) => {
  // Seed AFTER beforeEach's loadHome: the seeded-flag boot is a fresh
  // navigation, so re-seed via init script and reload under the seed.
  await page.context().addInitScript((blob) => {
    try {
      localStorage.setItem("meridian.loop.v2", JSON.stringify(blob));
      localStorage.setItem("meridian.loop.open", "1");
    } catch {
      /* private mode — ignore */
    }
  }, SEEDED_LOOP_V2);
  const { media, manifest } = trackJournalRequests(page);
  const { time } = fixedInstant();
  await loadHome(page, time);

  // Home, not GeoDetective: the journal card is up, the loop screen is not.
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toHaveCount(0);
  await expect(page.getByTestId("loop-map")).toHaveCount(0);
  await expect(page.getByTestId("loop-screen")).toHaveCount(0);
  // The menu offers the resume variant for the saved in-progress mystery.
  await expect(
    page.getByRole("button", { name: "GeoDetective: Resume your case" }),
  ).toBeVisible();

  // Boot deletes nothing: the flag and the saved loop survive the landing.
  expect(await page.evaluate(() => localStorage.getItem("meridian.loop.open"))).toBe("1");
  const afterBoot = await loopStore(page);
  expect(afterBoot.current.index).toBe(218);
  expect(afterBoot.current.status).toBe("playing");
  expect(afterBoot.streak).toBe(1);

  // B4-moot: no restored loop, so no prefetch runs on this reload.
  await page.waitForTimeout(2_000);
  expect(media).toEqual([]);
  expect(manifest).toEqual([]);
});

test("(B7) tapping in after a flagged boot resumes the saved loop without re-dealing", async ({
  page,
}) => {
  await page.context().addInitScript((blob) => {
    try {
      localStorage.setItem("meridian.loop.v2", JSON.stringify(blob));
      localStorage.setItem("meridian.loop.open", "1");
    } catch {
      /* private mode — ignore */
    }
  }, SEEDED_LOOP_V2);
  const { time } = fixedInstant();
  await loadHome(page, time);
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });

  const before = await loopStore(page);

  await page.getByRole("button", { name: "GeoDetective: Resume your case" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
  // Same mystery, same progress point: no guesses yet, no re-deal.
  await expect(page.getByText("Guess 1 of 5")).toBeVisible();
  await expect(page.getByText("🎯 You found it!")).toHaveCount(0);

  // The saved loop is the one that resumed: index, deck, streak, totals
  // identical to what was persisted — the tap did not deal fresh.
  const after = await loopStore(page);
  expect(after.current.index).toBe(before.current.index);
  expect(after.current.status).toBe("playing");
  expect(after.current.guesses).toHaveLength(0);
  expect(after.deck).toEqual(before.deck);
  expect(after.streak).toBe(before.streak);
  expect(after.totals).toEqual(before.totals);
});

test("(B7) plain boot with no saved flag lands on Home (control)", async ({ page }) => {
  await expect(page.getByTestId("journal-card")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toHaveCount(0);
  await expect(page.getByTestId("loop-map")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("meridian.loop.open"))).toBeNull();
});
