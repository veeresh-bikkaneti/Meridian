import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  readPhase,
  dismissTileOverlayIfPresent,
  commitMiss,
  commitHit,
  clickNextPlace,
  resultCard,
  nextPlaceButton,
} from "./helpers";

/**
 * State-edition story regression spec.
 *
 * Veeresh (2026-10-01) reported the story card shows no details when
 * playing the state edition. The hit-story spec locks the globe path;
 * this one locks the state path (drill-down picker -> Nebraska) on both
 * the miss branch ("done" phase) and the hit branch ("story" phase), so
 * a future refactor can't silently drop the educational content here.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function startNebraskaStateRun(page) {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await page.getByRole("button", { name: "Choose a state" }).click();
  await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible();
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
}

test("miss: state-edition result card shows the place story, not just the score", async ({
  page,
}) => {
  await startNebraskaStateRun(page);
  await commitMiss(page);

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 10_000 });

  // The miss branch renders the story lede paragraph.
  const storyPara = card.locator('p[title^="Your pin is your guess"] span').last();
  await expect(storyPara).toBeVisible({ timeout: 5_000 });
  const text = (await storyPara.textContent()) ?? "";
  expect(
    text.trim().length,
    `state miss card story should carry the blurb, got: ${JSON.stringify(text.slice(0, 120))}`,
  ).toBeGreaterThan(40);

  // "Next place" advances the run.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
});

test("hit: state-edition result card renders the Place story region", async ({
  page,
}) => {
  await startNebraskaStateRun(page);
  await commitHit(page);

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 10_000 });

  // Cartographer's Plate PR3 (2026-10-07) folded the story scrollers into
  // one region renamed "Place details — scroll for more"; the spec still
  // used the old "Place story" name. Fixed 2026-10-11 during verification.
  const scroller = card.getByRole("region", {
    name: "Place details — scroll for more",
  });
  await expect(scroller).toBeVisible({ timeout: 5_000 });
  const text = (await scroller.textContent()) ?? "";
  expect(
    text.trim().length,
    `state hit card story should carry the blurb, got: ${JSON.stringify(text.slice(0, 120))}`,
  ).toBeGreaterThan(40);
});
