import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitHit,
  nextPlaceButton,
  resultCard,
} from "./helpers";

/**
 * Hit-path story regression spec.
 *
 * Veeresh (2026-10-01) believed the place blurb only shows on wrong answers
 * and asked for it on hits too. Verification showed the hit card (phase
 * "story") already renders the full story + source — this spec locks that
 * behavior so a future refactor can't silently drop it.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("hit: the result card renders the place blurb/story, not just the score", async ({
  page,
}) => {
  await startGlobeRun(page);
  await commitHit(page);

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });

  // The hit branch renders the story in a scrollable div (max-h-44).
  const storyPara = card.locator(".max-h-44 p");
  await expect(storyPara).toBeVisible({ timeout: 5_000 });
  const text = (await storyPara.textContent()) ?? "";
  expect(
    text.trim().length,
    `hit card story paragraph should carry the blurb, got: ${JSON.stringify(text.slice(0, 120))}`,
  ).toBeGreaterThan(40);

  // Source attribution link must be present too.
  await expect(card.getByRole("link")).toBeVisible();

  // The story scroller must be keyboard-scrollable (tabindex + labeled region).
  const scroller = card.getByRole("region", { name: "Place story" });
  await expect(scroller).toBeVisible();
  expect(await scroller.getAttribute("tabindex")).toBe("0");
});
