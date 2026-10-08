import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  dropButton,
  dismissTileOverlayIfPresent,
} from "./helpers";

/**
 * Facts-ladder pilot browser test (feat/facts-ladder).
 *
 * Boots the built app against the real pilot chunks (australia.json +
 * arkansas.json) with single-place seeded runs via sessionStorage — no menu
 * navigation, no date-shuffle roulette. Verifies the composer → render
 * contract end to end:
 *
 *  1. A place WITH a merged fact renders the fact-first story on the
 *     result card, with the fact-kind attribution link.
 *  2. A place WITHOUT a fact renders the plain chunk blurb, unchanged.
 *  3. No console errors / page errors in either flow.
 *
 * Pilot places (arkansas chunk):
 *  - gn-4119403 Little Rock — wikidata fact
 *    "Founded in 1821 and named after The Little Rock." (qid Q33405)
 *  - gn-4099296 Alma — no fact, no history; blurb only.
 */

const LITTLE_ROCK_FACT = "Founded in 1821 and named after The Little Rock.";
const LITTLE_ROCK_QID_HREF = "https://www.wikidata.org/wiki/Q33405";
const ALMA_BLURB = "Alma is a town in northwestern Arkansas, the United States.";

function singlePlaceRun(placeId: string) {
  return {
    edition: "state",
    regionId: "arkansas",
    regionName: "Arkansas",
    dateKey: new Date().toISOString().slice(0, 10),
    index: 0,
    hits: 0,
    phase: "aim",
    streak: 0,
    bestStreak: 0,
    results: [],
    seed: 20261002,
    poolIds: [placeId],
    prevLastId: null,
  };
}

/** Seed a one-place run before the app boots; it resumes straight into aim. */
async function seedRun(page: Page, placeId: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.addInitScript(
    ({ run }) => sessionStorage.setItem("meridian.run", JSON.stringify(run)),
    { run: singlePlaceRun(placeId) },
  );
  return errors;
}

/** Drop a pin and wait for the result card (hit or miss — both render it). */
async function playToResult(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => readPhase(page), { timeout: 20_000 })
    .toBe("aim");
  // Let the intro camera settle (same stabilization startGlobeRun uses):
  // a click mid-dive can be swallowed by the animation.
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
  await dismissTileOverlayIfPresent(page);
  // Click until the pin registers (the drop button enables on a placed pin).
  await expect
    .poll(
      async () => {
        if (await dropButton(page).isEnabled()) return true;
        await page.mouse.click(500, 400);
        await page.waitForTimeout(500);
        return await dropButton(page).isEnabled();
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  await dropButton(page).click();
  await expect
    .poll(() => readPhase(page), { timeout: 20_000 })
    .toMatch(/^(story|done)$/);
  await expect(page.getByRole("button", { name: "Next place" })).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("pilot: place WITH a fact renders the fact-first story + attribution", async ({
  page,
}) => {
  const errors = await seedRun(page, "gn-4119403");
  await playToResult(page);

  // The merged fact leads the story on the result card (hit or miss card).
  await expect(
    page.getByText(LITTLE_ROCK_FACT, { exact: false }),
  ).toBeVisible();

  // Per-kind attribution: wikidata facts link the Wikidata entity.
  const attr = page.getByRole("link", { name: "Wikidata" });
  await expect(attr).toBeVisible();
  await expect(attr).toHaveAttribute("href", LITTLE_ROCK_QID_HREF);

  expect(errors).toEqual([]);
});

test("pilot: place WITHOUT a fact renders the plain blurb", async ({
  page,
}) => {
  const errors = await seedRun(page, "gn-4099296");
  await playToResult(page);

  // No fact prefix: the story is exactly the chunk blurb. Read from
  // whichever card rendered (hit story region vs miss lede + rest).
  const story = await page.evaluate(() => {
    const hit = document.querySelector('[aria-label="Place story"]');
    if (hit?.textContent?.trim()) return hit.textContent.trim();
    const lede = document.querySelector('[data-testid="miss-subscript"] span.mt-1');
    const rest = document.querySelector('[aria-label="Place story, continued"]');
    return [lede?.textContent ?? "", rest?.textContent ?? ""]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });
  expect(story).toBe(ALMA_BLURB);
  // And no fact text leaked in from anywhere else on the card.
  await expect(page.getByText("Founded in 1821")).toHaveCount(0);

  expect(errors).toEqual([]);
});
