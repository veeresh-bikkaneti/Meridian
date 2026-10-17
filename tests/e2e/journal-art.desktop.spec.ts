import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Journal storybook art (feat/journal-storybook-art, wave 1): notes that
 * carry an image render it above the title with alt text; notes without
 * art render exactly as before. Window-agnostic — the 2-hour window
 * rotates over 106 notes, so the spec asserts whatever the current
 * window shows.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("journal entries render storybook art with alt text, no overflow at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP_NO_IDLE);
  const journal = page.locator("#home-journal");
  await journal.scrollIntoViewIfNeeded();
  await expect(journal.locator("article.hv5-entry")).toHaveCount(3);

  const imgs = journal.locator("img");
  const count = await imgs.count();
  for (let i = 0; i < count; i++) {
    const img = imgs.nth(i);
    const alt = await img.getAttribute("alt");
    expect(alt && alt.trim().length > 0, "journal art image has alt text").toBeTruthy();
    const naturalWidth = await img.evaluate(
      (el) => (el as HTMLImageElement).naturalWidth,
    );
    expect(naturalWidth, "journal art image decoded").toBeGreaterThan(0);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal overflow at 390px").toBeLessThanOrEqual(1);
});
