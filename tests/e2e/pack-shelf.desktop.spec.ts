import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Pack shelf (story packs): deck chips inside the two edition entry
 * screens, and deck-correct dealing on the integrated branch.
 *
 * The pack manifest is stubbed at the network layer with the
 * docs/story-packs.md section 1.2 shape so the specs control whether the pack exists;
 * a 404 stub stands in for an unshipped pack, and the shelf must then
 * show the core deck only. Selection has one store per edition: the
 * loop store's activeDeckId for GeoDetective, the shelf selection
 * blob for Cold Trail. The dealing specs prove the deal path reads
 * the same store the chips write: pick Capitals on a finished case
 * and the next GeoDetective case comes from the pack deck (index
 * 387 or later, with its sidecar briefing), and the next Cold Trail
 * case is a pack case whose sightings are capital anchors, with the
 * core store left untouched.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

const PACK_MANIFEST = {
  v: 1,
  packId: "capitals",
  category: "capitals",
  size: 72,
  generatedAt: "2026-11-03T00:00:00.000Z",
  loopIndexes: Array.from({ length: 72 }, (_, i) => 387 + i),
  coldtrailFile: "cases.capitals.generated.json",
};

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Serve the pack manifest (optionally slowly) instead of the built one. */
async function stubPackManifest(
  page: import("playwright/test").Page,
  delayMs = 0,
): Promise<void> {
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PACK_MANIFEST),
    });
  });
}

/** Stand in for an unshipped pack: the manifest request 404s. */
async function stubPackManifestMissing(
  page: import("playwright/test").Page,
): Promise<void> {
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    await route.fulfill({ status: 404, body: "not found" });
  });
}

async function openLoop(page: import("playwright/test").Page): Promise<void> {
  await page.goto(BASE);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByTestId("pack-shelf")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
}

async function openColdTrail(page: import("playwright/test").Page): Promise<void> {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pack-shelf")).toBeVisible({ timeout: 30_000 });
}

async function shelfSelection(
  page: import("playwright/test").Page,
): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("meridian.pack-shelf.v1");
    return raw ? (JSON.parse(raw).decks as Record<string, string>) : {};
  });
}

test("GeoDetective shelf: core progress shows, no pack chip before the pack ships", async ({
  page,
}) => {
  await stubPackManifestMissing(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "meridian.loop.v2",
      JSON.stringify({
        deck: { deck: [10, 11], cycle: 1, cycleCompleted: 3 },
        current: null,
        streak: 0,
        bestStreak: 0,
        totals: { solved: 2, lost: 1 },
      }),
    );
  });
  await openLoop(page);
  const core = page.getByTestId("pack-chip-all");
  await expect(core).toBeVisible();
  await expect(core).toContainText("All cases");
  await expect(core).toContainText("3 of 387 cases closed");
  await expect(core).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pack-chip-capitals")).toHaveCount(0);
});

test("GeoDetective shelf: pack chip arrives from the manifest and stores the pick", async ({
  page,
}) => {
  await stubPackManifest(page);
  await openLoop(page);
  const pack = page.getByTestId("pack-chip-capitals");
  await expect(pack).toBeVisible({ timeout: 15_000 });
  await expect(pack).toContainText("Capitals");
  await expect(pack).toContainText("72 cases");
  await expect(pack).toHaveAttribute("aria-pressed", "false");

  await pack.click();
  await expect(pack).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pack-chip-all")).toHaveAttribute("aria-pressed", "false");
  // The case on screen is mid-play: the pick applies to the next case,
  // and the shelf says so instead of changing the open case.
  await expect(page.getByTestId("pack-shelf-status")).toHaveText(
    "Your next case comes from Capitals & Flags.",
  );
  // GeoDetective selection lives in the loop store itself, the store
  // the dealer reads; the shelf blob never carries this edition.
  const loopStore = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("meridian.loop.v2")!),
  );
  expect(loopStore.activeDeckId).toBe("capitals");
  expect((await shelfSelection(page)).geodetective).toBeUndefined();
});

test("GeoDetective shelf: tapping a chip on a finished case starts the next case", async ({
  page,
}) => {
  await stubPackManifest(page);
  const clue218 = JSON.parse(
    readFileSync(path.resolve("dist/client/loop/clues/218.json"), "utf8"),
  ) as { placeId: string };
  await page.addInitScript(
    (placeId) => {
      localStorage.setItem(
        "meridian.loop.v2",
        JSON.stringify({
          deck: { deck: [100], cycle: 1, cycleCompleted: 3 },
          current: {
            index: 218,
            cycle: 1,
            guesses: [
              { name: "Ankara", placeId, distKm: 0, octant: "north", warmer: null },
            ],
            status: "won",
            cluesRevealed: 1,
            completedAt: "2026-11-03",
            streakEndedAt: null,
            completedCycle: false,
          },
          streak: 1,
          bestStreak: 1,
          totals: { solved: 3, lost: 0 },
        }),
      );
    },
    clue218.placeId,
  );
  await page.goto(BASE);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  // The finished case restores as its reveal, with the shelf above it.
  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pack-shelf-status")).toHaveText(
    "Tap a deck chip to start your next case.",
  );

  await page.getByTestId("pack-chip-capitals").click();
  // The next case deals from the pack deck, not the core deck: its
  // index is a pack index (387 or later), it is stamped with the pack
  // deck id, and its sidecar briefing renders above the clues.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Your (case|drill):/)).toBeVisible({ timeout: 30_000 });
  const store = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("meridian.loop.v2")!),
  );
  expect(store.current.index).toBeGreaterThanOrEqual(387);
  expect(store.current.deckId).toBe("capitals");
  expect(store.current.status).toBe("playing");
  expect(store.activeDeckId).toBe("capitals");
});

test("GeoDetective shelf: a late pack manifest shifts nothing below the shelf", async ({
  page,
}) => {
  await stubPackManifest(page, 1_500);
  await openLoop(page);
  const clue = page.getByRole("article", { name: /Clue 1: Geography/ });
  const before = await clue.boundingBox();
  expect(before).not.toBeNull();
  await expect(page.getByTestId("pack-chip-capitals")).toBeVisible({ timeout: 15_000 });
  const after = await clue.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});

test("Cold Trail shelf: progress shows and a chip tap on the reveal starts the next case", async ({
  page,
}) => {
  await stubPackManifest(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "meridian.coldtrail.v2",
      JSON.stringify({
        v: 2,
        caseIndex: 0,
        stars: 10,
        solved: 1,
        current: {
          ringsPlaced: [true, true, true],
          informantOn: [false, false, false],
          ringCenters: [
            { lon: 0, lat: 0 },
            { lon: 1, lat: 1 },
            { lon: 2, lat: 2 },
          ],
          guess: { lon: 0, lat: 0 },
          revealed: true,
          scoreKm: 120,
        },
      }),
    );
  });
  await openColdTrail(page);
  await expect(page.getByTestId("coldtrail-reveal")).toBeVisible({ timeout: 30_000 });
  const core = page.getByTestId("pack-chip-all");
  await expect(core).toContainText("1 of 60 cases closed");
  const pack = page.getByTestId("pack-chip-capitals");
  await expect(pack).toBeVisible({ timeout: 15_000 });
  // The pack chip's progress line is denominated in the Cold Trail
  // deck's own case count (85), never the GeoDetective pack size (110).
  await expect(pack).toContainText("85 cases");
  await expect(pack).not.toContainText("110");

  await pack.click();
  // The next case is a pack case: the sighting cards name the pack
  // deck's first case's capital anchors (read from the generated pack
  // file itself), and the reveal is gone.
  const packDeck = JSON.parse(
    readFileSync(path.resolve("src/game/coldtrail/cases.capitals.generated.json"), "utf8"),
  ) as { cases: Array<{ sightings: Array<{ cityName: string }> }> };
  const anchorNames = packDeck.cases[0]!.sightings.map((s) => s.cityName);
  const cards = page.getByTestId("sighting-card");
  await expect(cards).toHaveCount(3, { timeout: 30_000 });
  for (let i = 0; i < 3; i++) {
    await expect(cards.nth(i)).toHaveAttribute(
      "aria-label",
      `Sighting ${i + 1}: ${anchorNames[i]}`,
    );
  }
  await expect(page.getByTestId("coldtrail-reveal")).toHaveCount(0);
  // The core store is untouched by the switch: the finished core case
  // keeps its own progress under its own key.
  const store = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("meridian.coldtrail.v2")!),
  );
  expect(store.caseIndex).toBe(0);
  expect(store.solved).toBe(1);
  expect((await shelfSelection(page)).coldtrail).toBe("capitals");
});

test("Cold Trail shelf: an unrevealed pack case resumes ahead of the stored selection", async ({
  page,
}) => {
  await stubPackManifest(page);
  await page.addInitScript(() => {
    // The shelf blob says "core deck", but the pack store holds a
    // case mid-play (one ring placed, not revealed). On mount the
    // unrevealed case wins over the stored selection: the screen
    // opens on the pack deck, mid-case.
    localStorage.setItem(
      "meridian.pack-shelf.v1",
      JSON.stringify({ v: 1, decks: { coldtrail: "all" } }),
    );
    localStorage.setItem(
      "meridian.coldtrail.pack.capitals.v1",
      JSON.stringify({
        v: 2,
        caseIndex: 0,
        stars: 20,
        solved: 0,
        current: {
          ringsPlaced: [true, false, false],
          informantOn: [false, false, false],
          ringCenters: [{ lon: 1, lat: 1 }, null, null],
          guess: null,
          revealed: false,
          scoreKm: null,
        },
      }),
    );
  });
  await openColdTrail(page);
  const pack = page.getByTestId("pack-chip-capitals");
  // The pack chip's progress line carries the pack store's own count
  // against the Cold Trail deck total: 0 of 85, never 110.
  await expect(pack).toContainText("0 of 85 cases closed", { timeout: 15_000 });
  // The case on screen is the pack deck's first case, mid-play — the
  // resume won over the stored selection. (The chips still show the
  // stored pick for the NEXT case; the status line says so.)
  const packDeck = JSON.parse(
    readFileSync(path.resolve("src/game/coldtrail/cases.capitals.generated.json"), "utf8"),
  ) as { cases: Array<{ sightings: Array<{ cityName: string }> }> };
  const anchorNames = packDeck.cases[0]!.sightings.map((s) => s.cityName);
  const cards = page.getByTestId("sighting-card");
  await expect(cards).toHaveCount(3, { timeout: 30_000 });
  for (let i = 0; i < 3; i++) {
    await expect(cards.nth(i)).toHaveAttribute(
      "aria-label",
      `Sighting ${i + 1}: ${anchorNames[i]}`,
    );
  }
});

test("Cold Trail shelf: no pack chip without a manifest", async ({ page }) => {
  await stubPackManifestMissing(page);
  await openColdTrail(page);
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("pack-chip-all")).toBeVisible();
  await expect(page.getByTestId("pack-chip-capitals")).toHaveCount(0);
});
