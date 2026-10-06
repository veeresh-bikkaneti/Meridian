import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * GeoDetective "Detective's Atlas" (Option A) deploy-gate E2E.
 *
 * Deterministic days via the `?loop-date=` seam (inert in production):
 *   2026-10-03 -> clue 218 -> Ankara (geonames:323786)
 *   2026-10-04 -> clue 219 -> Tarija (geonames:3903320)
 *
 * The map is the primary guess surface: the jump search flies the camera
 * and opens the confirm sheet; tapping the map resolves the nearest
 * labeled place through the E2E seam (`__loopMap` on the map element).
 * The built Pages artifact is served from disk (see helpers.ts); the loop
 * data (manifest, clues, names index) ships in dist/client/loop/.
 */

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Force the clipboard share path (mirrors endgame-share.spec.ts): the
  // native sheet is unavailable in headless Chromium.
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    } catch {
      /* navigator.share stays; the test asserts the path taken instead */
    }
  });
  await serveBuiltArtifact(context);
});

async function openLoop(page: import("playwright/test").Page, loopDate: string) {
  await page.goto(`http://127.0.0.1:4123/Meridian/?loop-date=${loopDate}`);
  await page.getByRole("button", { name: "Solve today's mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({ timeout: 30_000 });
  // The day's first clue card is visible once the clue file loads.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  // The Detective's Atlas map is the primary guess surface.
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

function searchBox(page: import("playwright/test").Page) {
  return page.getByRole("combobox", { name: "Search the map" });
}

/**
 * Jump-search to a place (flies the camera + opens the confirm sheet),
 * then confirm. The jump never burns a guess by itself — only the sheet's
 * button does.
 */
async function guessViaMap(page: import("playwright/test").Page, query: string) {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.getByRole("option").first();
  // The 11 MB name index parses on first focus; allow headroom on slow VMs.
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  // Jump auto-selects: the confirm bottom sheet opens.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

/** Drive the map camera deterministically through the E2E seam. */
async function jumpCamera(
  page: import("playwright/test").Page,
  lon: number,
  lat: number,
  zoom: number,
) {
  await page.evaluate(
    ([lo, la, z]) => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap: { jumpTo(o: unknown): void };
      };
      el.__loopMap.jumpTo({ center: [lo, la], zoom: z });
    },
    [lon, lat, zoom],
  );
}

/** Tap the map canvas center (resolves the nearest labeled place). */
async function tapMapCenter(page: import("playwright/test").Page) {
  await page.locator('[data-testid="loop-map"] canvas').click();
}

/** Click "Share result" (clipboard path) and return the shared text. */
async function sharedText(page: import("playwright/test").Page): Promise<string> {
  await page.getByRole("button", { name: "Share result" }).click();
  await expect(page.getByRole("button", { name: "Copied ✓" })).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

async function guessCount(page: import("playwright/test").Page): Promise<number> {
  return page.getByRole("region", { name: "Your guesses" }).getByRole("listitem").count().catch(() => 0);
}

/** Ring features on the deduction surface. Polls until the GeoJSON source
 * exists, finishes (re)tiling after setData, and reports its features —
 * all three are asynchronous, so a single read races. */
async function ringFeatureCount(page: import("playwright/test").Page): Promise<number> {
  const handle = await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap?: {
          getSource(id: string): unknown;
          querySourceFeatures(id: string): unknown[];
        };
      } | null;
      const m = el?.__loopMap;
      if (!m || !m.getSource("loop-rings")) return 0;
      try {
        return m.querySourceFeatures("loop-rings").length;
      } catch {
        return 0;
      }
    },
    undefined,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as number;
}

test("loop-date seam pins the day; UTC date header matches", async ({ page }) => {
  await openLoop(page, "2026-10-03");
  await expect(page.getByText("October 3 · UTC")).toBeVisible();
});

test("win path: clues unlock in order, map guess wins, share text formats", async ({
  page,
}) => {
  await openLoop(page, "2026-10-03"); // Ankara

  // Clue 1 visible; clue 2 locked before any guess.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toContainText(
    "capital of Turkey",
  );
  await expect(page.getByRole("article", { name: /Clue 2: Climate \(locked\)/ })).toContainText(
    "Unlocks after your next guess.",
  );

  // Wrong guess 1: Paris via the map. Far from Ankara -> red square in share.
  await guessViaMap(page, "paris");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your guesses" }).getByText("Paris, France"),
  ).toBeVisible();
  // The deduction surface drew the miss ring.
  expect(await ringFeatureCount(page)).toBeGreaterThan(0);

  // Clue 2 unlocked after the first guess; clue 3 still locked.
  await expect(
    page.getByRole("article", { name: /Clue 2: Climate/ }).getByText("Unlocks after"),
  ).toHaveCount(0);
  await expect(page.getByRole("article", { name: /Clue 3: History \(locked\)/ })).toContainText(
    "Unlocks after your next guess.",
  );

  // Duplicate: Paris again must not consume a guess.
  await guessViaMap(page, "paris");
  // The confirm still opens (the sheet doesn't know); confirming is rejected.
  await expect(page.getByText(/You already guessed Paris/)).toBeVisible();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(1);

  // Correct guess: Ankara.
  await guessViaMap(page, "ankara");
  await expect(page.getByRole("heading", { name: "Ankara, Türkiye" })).toBeVisible();
  await expect(page.getByText("🎯 You found it!")).toBeVisible();
  await expect(page.getByText("Solved in 2 guesses.")).toBeVisible();

  // All clues revealed on a finished day (no locked cards promising a next guess).
  await expect(page.getByText("Unlocks after your next guess.")).toHaveCount(0);

  // Share text: three lines, proximity-graded grid, solved-in-N.
  const share = await sharedText(page);
  expect(share).toContain("meridian geodetective October 3");
  expect(share).toContain("https://veeresh-bikkaneti.github.io/Meridian/");
  expect(share).toContain("🟥🟩⬜⬜⬜ solved in 2");
});

test("map tap selects the nearest labeled place; sheet confirm burns the guess", async ({
  page,
}) => {
  await openLoop(page, "2026-10-03");

  // Fly to Paris deterministically, then tap the canvas center.
  await jumpCamera(page, 2.35, 48.85, 10);
  await tapMapCenter(page);

  // The confirm sheet names the resolved place; nothing guessed yet.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Paris", { timeout: 15_000 });
  expect(await guessCount(page)).toBe(0);

  // Cancel burns nothing.
  await page.getByRole("button", { name: "Not this one" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await guessCount(page)).toBe(0);

  // Tap again, confirm this time.
  await tapMapCenter(page);
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(1);
});

test("ocean tap selects nothing and hints", async ({ page }) => {
  await openLoop(page, "2026-10-03");

  // Mid-Atlantic at low zoom: no labeled place within tap range.
  await jumpCamera(page, -30, 30, 3);
  await tapMapCenter(page);

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/isn’t a labeled place/)).toBeVisible();
  expect(await guessCount(page)).toBe(0);
});

test("reload mid-game restores the day state and the rings", async ({ page }) => {
  await openLoop(page, "2026-10-03");
  await guessViaMap(page, "tokyo");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  expect(await ringFeatureCount(page)).toBeGreaterThan(0);

  await page.reload();
  // Reload-restore: the in-progress day comes back, not a reset.
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your guesses" }).getByText("Tokyo, Japan"),
  ).toBeVisible();
  // The ring repaints from the persisted guess coordinates.
  expect(await ringFeatureCount(page)).toBeGreaterThan(0);
  // Clue 2 is still unlocked after the restore.
  await expect(
    page.getByRole("article", { name: /Clue 2: Climate/ }).getByText("Unlocks after"),
  ).toHaveCount(0);
});

test("loss path: 5 wrong guesses, giveaway shown, share says not solved", async ({
  page,
}) => {
  await openLoop(page, "2026-10-04"); // Tarija

  for (const q of ["paris", "tokyo", "sydney", "cairo", "new york"]) {
    await guessViaMap(page, q);
  }

  await expect(page.getByText("Out of guesses")).toBeVisible();
  // The giveaway clue (tier 5) is revealed and names the landmark.
  await expect(page.getByRole("article", { name: /Clue 5: Giveaway/ })).toContainText(
    "Central Valley",
  );
  // The answer is looked up from the guess index on a loss.
  await expect(
    page.getByRole("heading", { name: "Tarija, Bolivia" }),
  ).toBeVisible({ timeout: 15_000 });
  // No locked cards remain on a finished day.
  await expect(page.getByText("Unlocks after your next guess.")).toHaveCount(0);

  const share = await sharedText(page);
  expect(share).toContain("meridian geodetective October 4");
  // Proximity-graded: all five guesses are >2000 km from Tarija (red).
  expect(share).toMatch(/🟥🟥🟥🟥🟥 not solved/);
});

test("unknown search consumes nothing; no-match message is friendly", async ({ page }) => {
  await openLoop(page, "2026-10-03");

  const box = searchBox(page);
  await box.click();
  await box.fill("xqzzy-not-a-place");
  await expect(page.getByText(/No places match/)).toBeVisible();
  // Enter with no suggestions must not submit (and there is no Guess button).
  await box.press("Enter");
  await expect(page.getByText("Guess 1 of 5")).toBeVisible();
  expect(await guessCount(page)).toBe(0);
});

test("explicit leave stays on the menu after reload (no hijack)", async ({ page }) => {
  await openLoop(page, "2026-10-03");
  await guessViaMap(page, "paris");
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();

  // Leave explicitly, then reload: the menu stays, the day is not hijacked.
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Solve today's mystery" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Solve today's mystery" })).toBeVisible({
    timeout: 30_000,
  });
  // The loop screen (not the menu's edition card) is closed: no map, no search.
  await expect(page.getByTestId("loop-map")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Search the map" })).toHaveCount(0);

  // The day state itself survived — reopening resumes mid-game.
  await page.getByRole("button", { name: "Solve today's mystery" }).click();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Guess 2 of 5")).toBeVisible();
});

test("loop state is namespaced: endless-run keys untouched", async ({ page }) => {
  await openLoop(page, "2026-10-03");
  await guessViaMap(page, "paris");

  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain("meridian.loop.v1");
  expect(keys).not.toContain("meridian.run");
  expect(keys).not.toContain("meridian.drop");

  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("meridian.loop.v1")!));
  expect(store["2026-10-03"].guesses).toHaveLength(1);
  expect(store["2026-10-03"].status).toBe("playing");
  // Map-era guesses persist coordinates for the rings.
  expect(store["2026-10-03"].guesses[0].lon).toBeCloseTo(2.35, 1);
});
