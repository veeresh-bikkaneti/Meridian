import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitHit,
  commitMiss,
  nextPlaceButton,
  resultCard,
  freshBoot,
  seedSeenExcept,
  poolIds,
  pickBand,
} from "./helpers";

/**
 * WI-14 hit/miss story parity e2e.
 *
 * Both tests force the SAME curated globe place — Giza Plateau
 * (globe-giza) — by seeding the no-repeat seen store with every other
 * pool id (helpers.seedSeenExcept / poolIds), so hit and miss are
 * asserted against the same authored, reviewed story text, deterministically:
 * the place's story in src/game/starters.ts. The default age band in a
 * fresh profile is 11-13, so both cards must show the FULL story (the
 * 5-7 shortening is proven by src/game/story-card-coverage.test.ts).
 *
 * The miss card renders its story split (lede inside the miss-subscript,
 * the rest in the .result-story paragraph), so the miss assertion
 * reconstructs the two parts and compares the whole against the authored
 * text — a one-line GeoNames blurb could not satisfy it. B-UX-1: the
 * miss card must also expose the same read-aloud control as the hit card
 * (button with accessible name "Listen to the story", per
 * ReadAloudButton's aria-label).
 */
test.setTimeout(240_000);

const GIZA_ID = "globe-giza";
const GIZA_STORY =
  "Three stone pyramids sit on the desert edge of Cairo. They were already old when the city around them was young.";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function startForcedGizaRun(page: Parameters<typeof startGlobeRun>[0]): Promise<void> {
  await freshBoot(page);
  // Seed the EASY seen store, not Medium: Giza is difficulty 1, so it is
  // only in the Easy band's catalog — seeding Medium all-but-Giza reads
  // as a completed Medium catalog and the app opens with the
  // cleared-mode celebration instead of a run (found on the first run of
  // this spec; the globe-band-switch spec seeds Easy the same way).
  await seedSeenExcept(page, "globe", "globe", GIZA_ID, poolIds("globe", "globe"), "easy");
  await pickBand(page, "Easy");
  await startGlobeRun(page);
}

test("hit: curated place card shows the full authored story and the read-aloud control", async ({
  page,
}) => {
  await startForcedGizaRun(page);
  await commitHit(page);

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });

  const storyPara = card.locator(".result-body p.result-story").first();
  await expect(storyPara).toBeVisible({ timeout: 5_000 });
  const text = ((await storyPara.textContent()) ?? "").replace(/\s+/g, " ").trim();
  expect(text.length, `hit story should be > 40 chars, got: ${JSON.stringify(text)}`).toBeGreaterThan(40);
  // The authored text itself — both sentences of the reviewed story.
  expect(text).toContain("Three stone pyramids sit on the desert edge of Cairo.");
  expect(text).toContain("They were already old when the city around them was young.");

  await expect(
    card.getByRole("button", { name: "Listen to the story" }),
    "hit card must expose the read-aloud control",
  ).toBeVisible();
});

test("miss: curated place card shows the same authored story (not a blurb) and the read-aloud control (B-UX-1)", async ({
  page,
}) => {
  await startForcedGizaRun(page);
  await commitMiss(page);

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });
  await expect(card.getByTestId("miss-subscript")).toBeVisible({ timeout: 5_000 });

  // Story, reconstructed from the lede (miss-subscript) + the rest
  // (.result-story paragraph), must equal the authored story exactly.
  const lede = (
    (await card.locator('[data-testid="miss-subscript"] span.mt-1').textContent()) ?? ""
  ).trim();
  const restPara = card.locator(".result-body p.result-story").first();
  await expect(restPara).toBeVisible({ timeout: 5_000 });
  const rest = ((await restPara.textContent()) ?? "").trim();
  const combined = `${lede} ${rest}`.replace(/\s+/g, " ").trim();
  expect(
    combined.length,
    `miss story should be > 40 chars, got: ${JSON.stringify(combined)}`,
  ).toBeGreaterThan(40);
  expect(combined, "miss story must be the place's authored reviewed text").toBe(GIZA_STORY);

  // B-UX-1: the miss card carries the same listen row as the hit card.
  await expect(card.locator(".agep-listen-row")).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Listen to the story" }),
    "miss card must expose the read-aloud control (B-UX-1)",
  ).toBeVisible();
});
