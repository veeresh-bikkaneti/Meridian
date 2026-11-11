import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Capitals & Flags (issue #344): the pack relabel and the flag
 * layer's GeoDetective + Cold Trail surfaces.
 *
 * The pack's only entry point is the in-mode deck shelf
 * (`pack-chip-capitals`): the flag tests below enter each mode via
 * its card and pick the pack on the shelf. The shelf entry patterns
 * mirror pack-shelf.desktop.spec.ts: a chip tap on a finished case
 * starts the next case from the picked deck.
 *
 * Home once carried a Capitals & Flags strip (issue #344 shipped it
 * with a door into each mode; the owner's pick — Veeresh, 2026-11-05:
 * "Option C — signpost only, no buttons" — then made it a pure
 * signpost beside the About card). The owner removed it from Home
 * entirely the same day (Veeresh, 2026-11-05: "card is not
 * clickable. if its not clickable then there is no point of putting
 * it on home page."), so no home-surface test remains here: there
 * is no doorway left to assert.
 *
 * The GeoDetective test stubs the pack manifest down to a single case
 * (Abu Dhabi, index 387 — its land, the United Arab Emirates, has a
 * licence-verified flag) so the dealt case is deterministic; the clue
 * file and sidecar are the real shipped ones. The Cold Trail test
 * uses the real pack deck: the pack store is fresh, so its first
 * case deals first, whose three witnesses (Lima, Buenos Aires,
 * Santiago) all carry verified flags and whose hideout (Yacuiba,
 * Bolivia) carries a country name but no flag — Bolivia is not a
 * pack land.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

const SINGLE_CASE_MANIFEST = {
  v: 1,
  packId: "capitals",
  category: "capitals",
  size: 1,
  generatedAt: "2026-11-04T00:00:00.000Z",
  loopIndexes: [387],
  loopTiers: [3],
  coldtrailFile: "cases.capitals.generated.json",
};

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("shelf into GeoDetective deals the pack with the briefing flag", async ({ page }) => {
  await page.route("**/packs/capitals/manifest.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SINGLE_CASE_MANIFEST),
    });
  });
  // Seed a finished core case (the pack-shelf pattern): the reveal's
  // shelf is where a chip tap starts the next case at once, so the
  // pack pick deals the pack's single stubbed case deterministically.
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
  // The briefing names the land and its flag sits beside the name.
  await expect(
    page.getByText("Your case: find the capital of United Arab Emirates."),
  ).toBeVisible({ timeout: 30_000 });
  const flag = page.getByTestId("flag-img").first();
  await expect(flag).toBeVisible({ timeout: 15_000 });
  await expect(flag).toHaveAttribute("data-flag-key", "ae");
  // The shelf chip carries the ratified relabel.
  await expect(page.getByTestId("pack-chip-capitals")).toContainText("Capitals & Flags");
});

test("shelf into Cold Trail deals the pack; witness flags render", async ({ page }) => {
  // Seed a revealed core case (the pack-shelf pattern): on the
  // reveal, a chip tap starts the next case from the picked deck —
  // here the fresh pack store's first case.
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
  await page.goto(BASE);
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("coldtrail-reveal")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("pack-chip-capitals").click();
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  const flags = page.getByTestId("sighting-flag");
  await expect(flags).toHaveCount(3);
  const keys = await flags
    .locator("img")
    .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("data-flag-key")));
  expect(keys).toEqual(["pe", "ar", "cl"]);
});
