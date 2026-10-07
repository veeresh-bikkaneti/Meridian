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

  // Cartographer's Plate PR3: the hit story flows in the single card-body
  // scroll region (the nested max-h-44 scrollers are folded into it).
  const storyPara = card.locator(".result-body p.result-story").first();
  await expect(storyPara).toBeVisible({ timeout: 5_000 });
  const text = (await storyPara.textContent()) ?? "";
  expect(
    text.trim().length,
    `hit card story paragraph should carry the blurb, got: ${JSON.stringify(text.slice(0, 120))}`,
  ).toBeGreaterThan(40);

  // Source attribution link must be present too.
  await expect(card.getByRole("link")).toBeVisible();

  // The body region must be keyboard-scrollable (tabindex + labeled region).
  const scroller = card.getByRole("region", { name: "Place details — scroll for more" });
  await expect(scroller).toBeVisible();
  expect(await scroller.getAttribute("tabindex")).toBe("0");
});
