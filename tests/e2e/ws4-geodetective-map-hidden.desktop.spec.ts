/**
 * WS-4 Phase 1: GeoDetective with the map hidden (desktop).
 *
 * Owner decision (2026-10-15, adopting the crew recommendation): when the map pictures fail, the map is hidden
 * and the clue -> guess -> feedback loop keeps working. One short line takes
 * the map's place. If the map cannot start at all, the same line shows.
 *
 * Spec: docs/ops/specs/ws-4-satellite-failure-phase1.md
 */
import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

test.setTimeout(240_000);

const BASE = "http://127.0.0.1:4123/Meridian/";
const TILE_HOST = "**/server.arcgisonline.com/**";
const LOOP_LINE = "Map pictures are off for now. Your clues and guesses still work!";
// ?loop-puzzle=218 pins the deal to Ankara (see badge-journey.spec.ts).
const PUZZLE = "218";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

async function openLoop(page: Page): Promise<void> {
  await page.goto(`${BASE}?loop-puzzle=${PUZZLE}`);
  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 60_000,
  });
}

/** A wrong guess (Paris) through the search box, then the confirm sheet. */
async function guessParis(page: Page): Promise<void> {
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill("Paris");
  await page.getByRole("option").filter({ hasText: "Paris" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

async function blockTiles(context: BrowserContext): Promise<void> {
  await context.route(TILE_HOST, (route) => route.abort());
}

test("pictures blocked: map hidden, line shown, a guess still gets feedback", async ({
  context,
  page,
}) => {
  await blockTiles(context);
  await openLoop(page);

  const line = page.getByRole("status").filter({ hasText: LOOP_LINE });
  await expect(line).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("loop-map")).toHaveCount(0);

  await guessParis(page);
  // The first guess reports distance and direction (warmer/colder needs a
  // second guess to compare against).
  await expect(page.getByText(/the target is .* of your guess/)).toBeVisible({
    timeout: 30_000,
  });
});

test("place list not cached while offline: the existing designed error, no crash", async ({
  context,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/loop/names.json", (route) => route.abort());
  await openLoop(page);
  // The place list loads when the search box is first used.
  await page.getByRole("combobox", { name: "Search the map" }).click();

  await expect(page.getByText("Couldn't load the place list")).toBeVisible({
    timeout: 60_000,
  });
  expect(errors).toEqual([]);
});

test("map cannot start at all: the same line, and the loop keeps running", async ({
  context,
  page,
}) => {
  // Simulate a device with no WebGL: MapLibre's constructor then throws.
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await openLoop(page);

  await expect(page.getByRole("status").filter({ hasText: LOOP_LINE })).toBeVisible({
    timeout: 60_000,
  });
  await guessParis(page);
  // The first guess reports distance and direction (warmer/colder needs a
  // second guess to compare against).
  await expect(page.getByText(/the target is .* of your guess/)).toBeVisible({
    timeout: 30_000,
  });
});
