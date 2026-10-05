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
 * chunks (EG/FR/DE/IT/JP/MX/GB, NE 10m → TopoJSON) back the merged
 * boundary-admin1 map layer and the reverse-geocode admin-1 resolution.
 *
 * NOTE on the pin-compare line format (crew-lead call, 2026-10-05): the
 * reveal card in country editions renders PR #58's detail line — "Your pin:
 * near <city>, <admin1> · True spot: <city>, <admin1>" — NOT the bare
 * classic "Your pin: <admin1> · True spot: <admin1>". That is the shipped,
 * unit-tested behavior (reverse-geocode.test.ts: the "near" qualifier is
 * unconditional even for a pin exactly on a city — a raw pin is never an
 * exact pick; result-card.test.ts locks the country/globe format, the
 * classic line is the state-edition regression lock). The specs below were
 * first written against the classic format and failed on the first locked
 * run; they now assert the shipped format. The chunks are still exercised:
 * waitForAdmin1Chunk proves the vendored chunk loads, and the gold
 * department/prefecture boundaries render on the map (visible in the
 * Japan failure screenshot that surfaced this).
 *
 * Method (mirrors reveal-your-pin-country-globe): two runs per country.
 * Run A forces the pin town and records its settled screen point; Run B
 * forces the truth town and drops the pin on Run A's point (guaranteed
 * miss — the towns are hundreds of km apart). The 10 s warm tick fires
 * preloadAdmin1ForCountry, so Run B waits for the chunk (resource timing,
 * never a fixed sleep) before committing — the card computes the line
 * once at commit.
 *
 * The pin-side city is whatever pool place is nearest the tap
 * (integer-rounded screen point — cf. the Italy aborted-chunk test), so
 * the assertions pin the regions and the "near" qualifier, not the city.
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

test("country (France): Marseille pin, Paris truth — the card names both regions", async ({
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
  await expect(line).toHaveText(
    /Your pin: near .+, Provence-Alpes-Côte d'Azur · True spot: Paris, Île-de-France/,
  );
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
  await expect(line).toHaveText(/Your pin: near .+, Osaka · True spot: Tokyo, Tokyo/);
});
