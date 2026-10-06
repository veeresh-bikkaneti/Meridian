import { test, expect } from "playwright/test";
import type { Page } from "playwright/test";
import {
  serveBuiltArtifact,
  commitPin,
  commitHit,
  readPhase,
  resultCard,
  nextPlaceButton,
  clickNextPlace,
  dismissTileOverlayIfPresent,
  spotViewportPoint,
  tapHitsMap,
  poolIds,
  seedSeenExcept,
  freshBoot,
  pickBand,
  startCountryRun,
  startGlobeRun,
  readQuestion,
  waitForSpotSettle,
  waitForAdmin1Chunk,
} from "./helpers";

/**
 * Pin-compare line in country & globe editions
 * (fix/reveal-your-pin-country-globe).
 *
 * The fix layers a nearest-place-in-pool fallback over the untouched classic
 * pinCompareLine: in the COUNTRY edition a miss now renders
 * "Your pin: near <city>, <state> · True spot: <truth city>, <truth state>"
 * (data-testid="pin-compare-line") even for countries with no vendored
 * admin-1 boundaries (IT/FR/...). In the GLOBE edition the line is
 * symmetric country-level ("Your pin: Spain · True spot: Hungary") —
 * Veeresh's 2026-10-05 naming decision; the "near <city>" detail path is
 * not used in globe. State edition is byte-identical to before; hits and
 * ocean pins show no line.
 *
 * Determinism: the no-repeat seen store (localStorage
 * `meridian:seen:v2:<edition>:<regionId>:<band>`) is pre-seeded with every
 * pool id EXCEPT the target — the same trick question-labels.spec.ts uses —
 * so the forced question is dealt first. The pool ids are read from the same
 * chunk JSON + starters.ts the app ships, so the seeding can never silently
 * diverge from the dealt pool. The player's pin is a previously dealt
 * truth's own screen point: Run A forces the pin region's place first and
 * records its settled spotViewportPoint; Run B (fresh boot after clearing
 * sessionStorage, otherwise the app restores Run A's run) forces the truth
 * region's place first and taps the recorded point. Both runs share the
 * identical deterministic initial camera, so the pin lands exactly on the
 * recorded place — the nearest pool place is that place itself (distance 0)
 * and the test asserts the line names both regions with the "near"
 * qualifier (the exact pin town is regex-relaxed: the integer-rounded tap
 * point can resolve to a neighboring town). No fixed screen coordinates are
 * hardcoded for land pins; the only fixed point is the probed ocean point
 * (1360, 780), verified unresolvable (no line) at the Italy camera.
 *
 * Camera: waitForSpotSettle waits until the truth's screen point stops
 * moving (covers the globe intro dive) before recording or tapping, so a
 * mid-flight sample can never shift the pin.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});


// Forced questions (id | name | subdivision | difficulty band).
const SASSARI_ID = "gn-3167096"; // Sassari, Sardinia — medium (2)
const CATANZARO_ID = "gn-2525059"; // Catanzaro, Calabria — medium (2)
const MUMBAI_ID = "gn-1275339"; // Mumbai, Maharashtra — easy (1)
const BENGALURU_ID = "gn-1277333"; // Bengaluru, Karnataka — easy (1)
const SEVILLA_ID = "gn-2510911"; // Sevilla, Andalusia, ES — easy (1)
const DEBRECEN_ID = "gn-721472"; // Debrecen, Hajdú-Bihar, HU — easy (1)

/**
 * Probed mid-ocean point at the Italy country camera: commitPin there lands
 * phase "done" and renders NO pin-compare line (fail-closed), verified
 * against the Catanzaro truth during development.
 */
const ITALY_OCEAN_PT = { x: 1360, y: 780 };

test("country (Italy): Sardinia pin, Calabria truth — the card names both regions", async ({
  page,
}) => {
  // admin1-narrow: Italy ships a vendored admin-1 chunk (NE 10m), loaded
  // below. NOTE on the line format (crew-lead call, 2026-10-05): the card
  // renders PR #58's detail line — "Your pin: near <city>, <region> ·
  // True spot: <city>, <region>" — not the bare classic "Your pin:
  // <admin1> · True spot: <admin1>". That is the shipped, unit-tested
  // behavior (the "near" qualifier is unconditional — a raw pin is never
  // an exact pick); this test was first written against the classic
  // format and failed on the first locked run.
  const allIds = poolIds("country", "italy");

  // Run A: force Sassari (Sardinia) first; record its settled screen point.
  await freshBoot(page);
  await seedSeenExcept(page, "country", "italy", SASSARI_ID, allIds, "medium");
  await startCountryRun(page, "Italy");
  expect(await readQuestion(page)).toBe("Find Sassari, Sardinia.");
  const sardPin = await waitForSpotSettle(page);

  // Run B: force Catanzaro (Calabria) first; drop the pin on Sassari.
  // Sassari -> Catanzaro is ~700 km, far outside the ~144 km country hit
  // radius: a guaranteed miss.
  await freshBoot(page);
  await seedSeenExcept(page, "country", "italy", CATANZARO_ID, allIds, "medium");
  await startCountryRun(page, "Italy");
  expect(await readQuestion(page)).toBe("Find Catanzaro, Calabria.");
  await waitForSpotSettle(page);
  // The 10 s warm tick fires preloadAdmin1ForCountry("it"); the card's
  // pin-compare line is computed once at commit, so the chunk must be in
  // before the pin drops.
  await waitForAdmin1Chunk(page, "it");

  const { phase } = await commitPin(page, sardPin.x, sardPin.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  // PR2: the ledger is a real <dl> (DT/DD), not the flat "Your pin: … ·
  // True spot: …" text. Assert the structured sides.
  // The pin town is whatever pool place is nearest the tap (integer-rounded
  // screen point); the regions and the "near" qualifier are the assertions.
  const dds = line.locator("dd");
  await expect(dds.nth(0)).toHaveText(/near .+, Sardinia/);
  await expect(dds.nth(1)).toHaveText(/Catanzaro, Calabria/);
});

test("country (Italy): aborted admin-1 chunk falls back to the 'near' line", async ({
  page,
}) => {
  // Fail-closed proof for the PR #58 fallback: with the IT chunk
  // unreachable, resolvePin degrades to country-only and the card must
  // still name the pin honestly ("near <city>") instead of dropping it.
  const allIds = poolIds("country", "italy");

  // Run A: record Sassari's settled screen point (chunk not needed).
  await freshBoot(page);
  await seedSeenExcept(page, "country", "italy", SASSARI_ID, allIds, "medium");
  await startCountryRun(page, "Italy");
  const sardPin = await waitForSpotSettle(page);

  // Run B: abort the IT admin-1 chunk before the run starts. page.route
  // outranks the spec's context-level catch-all (registered later wins).
  await freshBoot(page);
  await page.route(/\/assets\/it-[A-Za-z0-9_-]+\.js$/, (route) => route.abort());
  await seedSeenExcept(page, "country", "italy", CATANZARO_ID, allIds, "medium");
  await startCountryRun(page, "Italy");
  expect(await readQuestion(page)).toBe("Find Catanzaro, Calabria.");
  await waitForSpotSettle(page);

  const { phase } = await commitPin(page, sardPin.x, sardPin.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  // PR2: the ledger is a real <dl> (DT/DD), not the flat text.
  // The pin town is whatever pool place is nearest the tap (integer-rounded
  // screen point); the regions and the "near" qualifier are the assertions.
  const dds2 = line.locator("dd");
  await expect(dds2.nth(0)).toHaveText(/near .+, Sardinia/);
  await expect(dds2.nth(1)).toHaveText(/Catanzaro, Calabria/);
});

test("country (India): Maharashtra pin, Karnataka truth — never dropped", async ({
  page,
}) => {
  const allIds = poolIds("country", "india");

  // Run A: force Mumbai (Maharashtra) first; record its settled screen point.
  await freshBoot(page);
  await seedSeenExcept(page, "country", "india", MUMBAI_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startCountryRun(page, "India");
  expect(await readQuestion(page)).toBe("Find Mumbai, Maharashtra.");
  const mhPin = await waitForSpotSettle(page);

  // Run B: force Bengaluru (Karnataka) first; drop the pin on Mumbai.
  // Mumbai -> Bengaluru is ~845 km, far outside the ~360 km country hit
  // radius: a guaranteed miss. This is Veeresh's working reference for the
  // bug: the line must name both locations, never be silently dropped.
  await freshBoot(page);
  await seedSeenExcept(page, "country", "india", BENGALURU_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startCountryRun(page, "India");
  expect(await readQuestion(page)).toBe("Find Bengaluru, Karnataka.");
  await waitForSpotSettle(page);

  const { phase } = await commitPin(page, mhPin.x, mhPin.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  // PR2: the ledger is a real <dl> (DT/DD), not the flat text.
  // The pin town is whatever pool place is nearest the tap (integer-rounded
  // screen point); the regions and the "near" qualifier are the assertions.
  const dds3 = line.locator("dd");
  await expect(dds3.nth(0)).toHaveText(/near .+, Maharashtra/);
  await expect(dds3.nth(1)).toHaveText(/Bengaluru, Karnataka/);
});

test("globe: pin and truth in two different countries — suffixes on both sides", async ({
  page,
}) => {
  const allIds = poolIds("globe", "globe");

  // Run A: force Sevilla (Spain) first; record its settled screen point
  // (settle covers the globe intro dive).
  await freshBoot(page);
  await seedSeenExcept(page, "globe", "globe", SEVILLA_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startGlobeRun(page);
  expect(await readQuestion(page)).toBe("Find Sevilla, Andalusia, Spain.");
  const esPin = await waitForSpotSettle(page);

  // Run B: force Debrecen (Hungary) first; drop the pin on Sevilla.
  // Sevilla -> Debrecen is ~1900 km, far outside the 750 km globe hit
  // radius: a guaranteed miss. Both countries have no vendored admin-1,
  // and the globe line is symmetric country-level (the detail path is
  // country-edition only).
  await freshBoot(page);
  await seedSeenExcept(page, "globe", "globe", DEBRECEN_ID, allIds, "easy");
  await pickBand(page, "Easy");
  await startGlobeRun(page);
  expect(await readQuestion(page)).toBe("Find Debrecen, Hajdú-Bihar, Hungary.");
  await waitForSpotSettle(page);

  const { phase } = await commitPin(page, esPin.x, esPin.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  // Symmetric country-level by design (Veeresh, 2026-10-05): the pin town
  // is whatever pool place is nearest the tap, but the line names only
  // the countries. PR2: the ledger is a real <dl> (DT/DD).
  const dds4 = line.locator("dd");
  await expect(dds4.nth(0)).toHaveText("Spain");
  await expect(dds4.nth(1)).toHaveText("Hungary");
});

test("country (Italy): ocean pin — no line, fail closed", async ({ page }) => {
  const allIds = poolIds("country", "italy");
  await freshBoot(page);
  await seedSeenExcept(page, "country", "italy", CATANZARO_ID, allIds, "medium");
  await startCountryRun(page, "Italy");
  expect(await readQuestion(page)).toBe("Find Catanzaro, Calabria.");

  const { phase } = await commitPin(page, ITALY_OCEAN_PT.x, ITALY_OCEAN_PT.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });

  // Fail closed: the pin is unresolvable, so no line renders...
  await expect(card.getByTestId("pin-compare-line")).toHaveCount(0);

  // ...but everything else on the miss card is exactly as before: the
  // headline teaches direction as well as distance.
  await expect(card.getByTestId("miss-headline")).toHaveText(
    /[\d,]+(\.\d+)? (km|m) (north|northeast|east|southeast|south|southwest|west|northwest) of your pin/,
  );
  await expect(card.getByTestId("miss-subscript")).toContainText(
    "Your pin is your guess",
  );
});

test("country (Italy): hit — the card shows no pin-compare line", async ({
  page,
}) => {
  // No seen-store seeding here: seeding would leave a single unseen place
  // in the band, and commitHit's miss-burns would exhaust the band into the
  // "You cleared Medium" modal instead of dealing the next question.
  // commitHit finds a tappable true spot on its own across questions.
  await freshBoot(page);
  await startCountryRun(page, "Italy");
  await commitHit(page);
  expect(await readPhase(page)).toBe("story");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });

  // Correct answer: no pin-compare element at all.
  await expect(card.getByTestId("pin-compare-line")).toHaveCount(0);
});

test("state (Nebraska): regression — 'Right state, wrong town!' unchanged", async ({
  page,
}) => {
  // Same drill-down path as reveal-pin-compare's state test: every dealt
  // place is in Nebraska and the flat map is framed on the state, so a
  // center tap always lands in Nebraska. The state edition must keep the
  // classic byte-identical line.
  await freshBoot(page);
  await page.getByRole("button", { name: "Choose a state" }).click();
  await expect(page.getByRole("heading", { name: "State" })).toBeVisible();
  await page.getByRole("button", { name: "United States" }).click();
  await expect(
    page.getByRole("heading", { name: "United States" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nebraska" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");

  await dismissTileOverlayIfPresent(page);
  await expect
    .poll(() => page.locator(".satellite-map").getAttribute("data-tile-status"), {
      timeout: 30_000,
    })
    .toBe("ready");
  const box = await page.locator(".satellite-map").boundingBox();
  expect(box).not.toBeNull();
  const cx = Math.round(box!.x + box!.width / 2);
  const cy = Math.round(box!.y + box!.height / 2);
  expect(await tapHitsMap(page, cx, cy)).toBe(true);

  let phase: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    ({ phase } = await commitPin(page, cx, cy));
    if (phase === "done") break;
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  // PR2: the ledger is a real <dl>; the verdict text is in the first DD.
  await expect(line.locator("dd").nth(0)).toHaveText("Right state, wrong town!");
});
