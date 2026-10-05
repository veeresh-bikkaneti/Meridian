import { test, expect } from "playwright/test";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  commitPin,
  resultCard,
  nextPlaceButton,
  poolIds,
  seedSeenExcept,
  freshBoot,
  pickBand,
  startCountryRun,
  readQuestion,
  waitForSpotSettle,
  waitForAdmin1Chunk,
} from "./helpers";

/**
 * Admin-1 NARROW scope (feat/admin1-narrow-7): the 7 vendored per-country
 * chunks (EG/FR/DE/IT/JP/MX/GB, NE 10m → TopoJSON) let the reveal's classic
 * pin-compare path name admin-1 regions in country editions that previously
 * resolved admin1: null.
 *
 * Method (mirrors reveal-your-pin-country-globe): two runs per country.
 * Run A forces the pin town and records its settled screen point; Run B
 * forces the truth town and drops the pin on Run A's point (guaranteed
 * miss — the towns are hundreds of km apart). The 10 s warm tick fires
 * preloadAdmin1ForCountry, so Run B waits for the chunk (resource timing,
 * never a fixed sleep) before committing — the card computes the line
 * once at commit.
 *
 * Expected NE 10m names are probed against the built chunks, not assumed:
 * Paris → "Paris" (département), Marseille → "Bouches-du-Rhône",
 * Tokyo → "Tokyo" (prefecture), Osaka → "Ōsaka".
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

// Forced questions (id | name | subdivision | difficulty band).
const PARIS_ID = "gn-2988507"; // Paris, Île-de-France — easy (1)
const MARSEILLE_ID = "gn-2995469"; // Marseille, Provence-Alpes-Côte d'Azur — easy (1)
const TOKYO_ID = "gn-1850147"; // Tokyo, Tokyo — easy (1)
const OSAKA_ID = "gn-1853909"; // Osaka, Osaka — easy (1)

test("country (France): Marseille pin, Paris truth — the card names both departments", async ({
  page,
}: {
  page: Page;
}) => {
  const allIds = poolIds("country", "france");

  // Run A: force Marseille first; record its settled screen point.
  await freshBoot(page);
  await seedSeenExcept(page, "country", "france", MARSEILLE_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startCountryRun(page, "France");
  expect(await readQuestion(page)).toBe("Find Marseille, Provence-Alpes-Côte d'Azur.");
  const marsPin = await waitForSpotSettle(page);

  // Run B: force Paris; drop the pin on Marseille (~660 km — a miss).
  await freshBoot(page);
  await seedSeenExcept(page, "country", "france", PARIS_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startCountryRun(page, "France");
  expect(await readQuestion(page)).toBe("Find Paris, Île-de-France.");
  await waitForSpotSettle(page);
  await waitForAdmin1Chunk(page, "fr");

  const { phase } = await commitPin(page, marsPin.x, marsPin.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  await expect(line).toHaveText("Your pin: Bouches-du-Rhône · True spot: Paris");
});

test("country (Japan): Osaka pin, Tokyo truth — the card names both prefectures", async ({
  page,
}: {
  page: Page;
}) => {
  const allIds = poolIds("country", "japan");

  // Run A: force Osaka first; record its settled screen point.
  await freshBoot(page);
  await seedSeenExcept(page, "country", "japan", OSAKA_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startCountryRun(page, "Japan");
  expect(await readQuestion(page)).toBe("Find Osaka, Osaka.");
  const osakaPin = await waitForSpotSettle(page);

  // Run B: force Tokyo; drop the pin on Osaka (~400 km — a miss).
  await freshBoot(page);
  await seedSeenExcept(page, "country", "japan", TOKYO_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startCountryRun(page, "Japan");
  expect(await readQuestion(page)).toBe("Find Tokyo, Tokyo.");
  await waitForSpotSettle(page);
  await waitForAdmin1Chunk(page, "jp");

  const { phase } = await commitPin(page, osakaPin.x, osakaPin.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  await expect(line).toHaveText("Your pin: Ōsaka · True spot: Tokyo");
});
