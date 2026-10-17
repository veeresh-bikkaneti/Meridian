import { test, expect } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Journal storybook art (feat/journal-storybook-art, waves 1-6): notes that
 * carry an image render it above the title with alt text; all 106 notes
 * are now illustrated.
 *
 * DISCLOSED CLOCK PIN (journal consolidation, plan §1c): under set
 * rotation the section shows one set of notes per 2-hour window. This
 * spec pins the browser clock (installed BEFORE goto, with a
 * runFor(1_000) drain for boot timers, the pattern the journal spec uses)
 * to set index 26 so it always asserts against the same deterministic
 * set (taj, opera-house, redeemer). The pin's original rationale — set 26
 * being the only window whose notes all had art — is now stale: every
 * note is illustrated. The pin itself stays for determinism.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const WINDOW_MS = 7_200_000;
const SET_COUNT = 36;

/** A fixed instant whose 2-hour window index is exactly set 26. */
function set26Instant(): Date {
  let t = Date.UTC(2026, 9, 16, 12, 0, 0);
  while (Math.floor(t / WINDOW_MS) % SET_COUNT !== 26) t += WINDOW_MS;
  return new Date(t);
}

test("journal entries render storybook art with alt text, no overflow at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: set26Instant() });
  await page.goto(APP_NO_IDLE);
  // Let boot timers (which the mocked clock holds) drain a little.
  await page.clock.runFor(1_000);
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
