import { test } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import { stubJournalMediaFixedClips } from "./journal-player.helpers";
import { FIXED_ENTRIES, assertFixedEntry } from "./journal-player.facts.data";

/**
 * Journal player E2E — the 5 Historian-blocked facts, mobile 390x844.
 * Same per-entry assertions as the desktop facts spec (corrected cue-2
 * caption active in its window, transcript highlight, old wordings
 * nowhere); alamo + cadillac cover the mobile viewport.
 */
test.setTimeout(180_000);
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ context, page }) => {
  await serveBuiltArtifact(context);
  await stubJournalMediaFixedClips(page);
});

for (const entry of FIXED_ENTRIES.filter((e) => e.id === "alamo" || e.id === "cadillac")) {
  test(`facts mobile: ${entry.id} plays its corrected line`, async ({ page }) => {
    await assertFixedEntry(page, entry);
  });
}
