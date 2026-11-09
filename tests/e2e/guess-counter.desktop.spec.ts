import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Issue #337: the GeoDetective header counter in the finished state.
 *
 * While a case is playing, the header names the NEXT guess
 * ("Guess {guesses + 1} of {cap}") — that is the guess the player is
 * about to make, and the playing-state pins in geodetective.spec.ts
 * ("Guess 2 of 5" after one guess) already cover it, so this spec does
 * not duplicate them.
 *
 * Once the case is finished there is no next guess. Pre-fix the header
 * still added one, so a case lost on its 6th guess read
 * "Guess 7 of 6" and a 1-guess win read "Guess 2 of 5". These pins
 * seed finished cases and assert the header shows the guesses
 * actually made.
 *
 * Seeds mirror pack-shelf.desktop.spec.ts: an addInitScript writes
 * meridian.loop.v2 before the app loads, and the case resumes from
 * the store. The rendered cap comes from the puzzle's deal snapshot
 * (dealStartClues / dealMaxGuesses → persistedDealConfig in
 * LoopScreen.tsx), so each seed stamps the snapshot it asserts
 * against: cap 6 for the loss (an 8-10 deal), cap 5 for the win.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function openLoop(page: import("playwright/test").Page): Promise<void> {
  await page.goto(BASE);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 30_000 });
}

test("finished case: a case lost on its 6th guess reads 'Guess 6 of 6', never 'Guess 7 of 6'", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const wrong = (name: string, placeId: string, distKm: number, warmer: boolean | null) => ({
      name,
      placeId,
      distKm,
      octant: "north",
      warmer,
    });
    localStorage.setItem(
      "meridian.loop.v2",
      JSON.stringify({
        deck: { deck: [100], cycle: 1, cycleCompleted: 1 },
        current: {
          index: 218,
          cycle: 1,
          guesses: [
            wrong("Paris, France", "geonames:2988507", 2490, null),
            wrong("Berlin, Germany", "geonames:2950159", 1750, true),
            wrong("Rome, Italy", "geonames:3169070", 1490, true),
            wrong("Madrid, Spain", "geonames:3117735", 2280, false),
            wrong("Athens, Greece", "geonames:264371", 1010, true),
            wrong("Cairo, Egypt", "geonames:360630", 1230, false),
          ],
          status: "lost",
          cluesRevealed: 5,
          completedAt: "2026-11-03",
          streakEndedAt: null,
          completedCycle: false,
          dealStartClues: 3,
          dealMaxGuesses: 6,
        },
        streak: 0,
        bestStreak: 0,
        totals: { solved: 0, lost: 1 },
      }),
    );
  });
  await openLoop(page);
  // The seeded case restores as its loss reveal…
  await expect(page.getByText("Out of guesses")).toBeVisible({ timeout: 30_000 });
  // …and the header counts the guesses actually made: 6 of 6.
  await expect(page.getByText("Guess 6 of 6", { exact: true })).toBeVisible();
  await expect(page.getByText("Guess 7 of 6", { exact: true })).toHaveCount(0);
});

test("finished case: a case won in 1 guess reads 'Guess 1 of 5', never 'Guess 2 of 5'", async ({
  page,
}) => {
  const clue218 = JSON.parse(
    readFileSync(path.resolve("dist/client/loop/clues/218.json"), "utf8"),
  ) as { placeId: string };
  await page.addInitScript(
    (placeId) => {
      localStorage.setItem(
        "meridian.loop.v2",
        JSON.stringify({
          deck: { deck: [100], cycle: 1, cycleCompleted: 1 },
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
            dealStartClues: 1,
            dealMaxGuesses: 5,
          },
          streak: 1,
          bestStreak: 1,
          totals: { solved: 1, lost: 0 },
        }),
      );
    },
    clue218.placeId,
  );
  await openLoop(page);
  // The seeded case restores as its win reveal…
  await expect(page.getByText("🎯 You found it!")).toBeVisible({ timeout: 30_000 });
  // …and the header counts the guess actually made: 1 of 5.
  await expect(page.getByText("Guess 1 of 5", { exact: true })).toBeVisible();
  await expect(page.getByText("Guess 2 of 5", { exact: true })).toHaveCount(0);
});
