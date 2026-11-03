import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Pack shelf (story packs, swarm slice 4): deck chips inside the two
 * edition entry screens.
 *
 * The Capitals pack has not shipped on this branch, so the pack
 * manifest is stubbed at the network layer with the DESIGN.md section
 * 1.2 shape. Without the stub the manifest request 404s against the
 * built artifact and the shelf must show the core deck only. Dealing
 * itself is slice 1's work: these specs prove the shelf renders honest
 * per-deck progress, stores the player's pick, and starts the next
 * case through each screen's own next-case handler.
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

/** Serve the pack manifest (optionally slowly) instead of the on-disk 404. */
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
    "Your next case comes from Capitals.",
  );
  expect((await shelfSelection(page)).geodetective).toBe("capitals");
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
  // A fresh case deals (the deck head, index 100) and the pick is stored.
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  const store = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("meridian.loop.v2")!),
  );
  expect(store.current.index).toBe(100);
  expect(store.current.status).toBe("playing");
  expect((await shelfSelection(page)).geodetective).toBe("capitals");
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

  await pack.click();
  // The next case starts: sighting cards are back and the reveal is gone.
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("coldtrail-reveal")).toHaveCount(0);
  const store = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("meridian.coldtrail.v2")!),
  );
  expect(store.caseIndex).toBe(1);
  expect((await shelfSelection(page)).coldtrail).toBe("capitals");
});

test("Cold Trail shelf: no pack chip without a manifest", async ({ page }) => {
  await openColdTrail(page);
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("pack-chip-all")).toBeVisible();
  await expect(page.getByTestId("pack-chip-capitals")).toHaveCount(0);
});
