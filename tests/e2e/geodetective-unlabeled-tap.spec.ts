import { test, expect } from "playwright/test";
import { serveBuiltArtifact, sourceFeatures } from "./helpers";

/**
 * GeoDetective unlabeled-tap E2E (owner directive 2026-10-12).
 *
 * Every map tap registers a guess — even a tap on no labeled place.
 * The tap path: canvas click on an unlabeled spot (Point Nemo, the ocean
 * point farthest from any land) → the confirm bottom sheet opens with a
 * region-named synthetic guess ("Open Water") → confirming burns the
 * guess and draws the gold distance ring. The old "That spot isn't a
 * labeled place" rejection is gone.
 *
 * Deterministic puzzle via the ?loop-puzzle= seam (inert in production):
 *   ?loop-puzzle=218 -> Ankara (geonames:323786)
 */

const BASE = "http://127.0.0.1:4123/Meridian/";
// Point Nemo (-123.4, -48.9): >2000 km from any land, so no labeled place
// can resolve within the 150 km tap tolerance.
const NEMO: [number, number] = [-123.4, -48.9];

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Open the GeoDetective with the puzzle pinned via the ?loop-puzzle= seam. */
async function openLoop(page: import("playwright/test").Page) {
  await page.goto(`${BASE}?loop-puzzle=218`);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/** Drive the map camera deterministically through the E2E seam, then settle. */
async function jumpCamera(page: import("playwright/test").Page, lon: number, lat: number, zoom: number) {
  await page.evaluate(
    ([lo, la, z]) => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap: { jumpTo(o: unknown): void };
      };
      el.__loopMap.jumpTo({ center: [lo, la], zoom: z });
    },
    [lon, lat, zoom],
  );
  // The tap guard rejects taps while the camera moves — jumpTo is instant,
  // but settle anyway so the click can never race it.
  await page.waitForTimeout(800);
}

/** Direction-arrow features on the deduction surface (mirrors geodetective.spec.ts).
 * The gold distance ring for this ~17,900 km miss is asserted separately
 * below (issue #166): ringPolygon traces it around the guess's antipode.
 * Before the fix it emitted the loop in a repeated world copy (raw
 * longitudes -333…-274) and only the tile worker's wrap put it back on
 * the player's map; that raw range is pinned where it is observable,
 * in rings.test.ts — this spec pins the render contract. */
async function arrowFeatureCount(page: import("playwright/test").Page): Promise<number> {
  const handle = await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap?: {
          getSource(id: string): unknown;
          querySourceFeatures(id: string): unknown[];
        };
      } | null;
      const m = el?.__loopMap;
      if (!m || !m.getSource("loop-arrows")) return 0;
      try {
        return m.querySourceFeatures("loop-arrows").length;
      } catch {
        return 0;
      }
    },
    undefined,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as number;
}

/** Ring polygons present in the tiles loaded for the CURRENT framing —
 * what the renderer can actually draw here (querySourceFeatures, the
 * same read ringFeatureCount uses in geodetective.spec.ts). */
async function tiledRingCount(page: import("playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
      __loopMap: {
        querySourceFeatures: (
          src: string,
          params?: Record<string, unknown>,
        ) => Array<{ geometry: { type: string } }>;
      };
    };
    return el.__loopMap
      .querySourceFeatures("loop-rings", {})
      .filter((f) => f.geometry.type === "Polygon").length;
  });
}

/** Centroid of the first ring polygon in the loop-rings source. Reads
 * through MapLibre's tile worker (sourceFeatures → getData), which
 * wraps a coherent loop into the primary world copy — so these are
 * canonicalized coordinates on any build, and the raw emitted range is
 * NOT observable here (it is pinned in rings.test.ts instead). What
 * this pins: the loop lives around the guess's antipode, not the tap. */
async function ringCentroid(
  page: import("playwright/test").Page,
): Promise<[number, number]> {
  const features = await sourceFeatures(page, "loop-rings", 2);
  const poly = features.find((f) => (f.geometry as { type?: string }).type === "Polygon");
  const ring = (poly!.geometry.coordinates as Array<Array<[number, number]>>)[0]!;
  return [
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
  ];
}

async function guessListCount(page: import("playwright/test").Page): Promise<number> {
  return page
    .getByRole("region", { name: "Your guesses" })
    .getByRole("listitem")
    .count()
    .catch(() => 0);
}

test("tap on an unlabeled ocean spot opens the confirm sheet and registers the guess", async ({
  page,
}) => {
  await openLoop(page);
  await jumpCamera(page, NEMO[0], NEMO[1], 2.5);

  // Tap the map center — Point Nemo, no labeled place within tolerance.
  await page.locator('[data-testid="loop-map"] canvas').click();

  // The confirm sheet opens for the synthetic region-named guess…
  const dialog = page.getByRole("dialog", { name: "Guess Open Water?" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  // …and the old rejection hint never appears.
  await expect(page.getByText(/isn’t a labeled place/)).toHaveCount(0);

  // Confirm: the guess burns, the ring draws, clue 2 unlocks.
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible({ timeout: 15_000 });
  expect(await guessListCount(page)).toBe(1);
  expect(await arrowFeatureCount(page)).toBeGreaterThan(0); // shaft + head drawn (tile-splitting makes the exact count unreliable)
  // Issue #166: the far ring is drawn around the guess's ANTIPODE —
  // the target's neighborhood (Point Nemo's antipode is 56.6°E, 48.9°N,
  // in Central Asia). Frame the camera there and require the ring in
  // the loaded tiles, with its centroid by the antipode, not the tap.
  await jumpCamera(page, 56.6, 48.9, 3);
  await expect.poll(() => tiledRingCount(page), { timeout: 20_000 }).toBeGreaterThan(0);
  const [clon, clat] = await ringCentroid(page);
  expect(Math.abs(clon - 56.6)).toBeLessThan(10);
  expect(Math.abs(clat - 48.9)).toBeLessThan(10);
  await expect(page.getByRole("article", { name: /Clue 2: Climate/ })).not.toContainText(
    "Unlocks after your next guess.",
  );
});

test("tapping the same unlabeled spot twice warns instead of burning a guess", async ({
  page,
}) => {
  await openLoop(page);
  await jumpCamera(page, NEMO[0], NEMO[1], 2.5);

  const canvas = page.locator('[data-testid="loop-map"] canvas');
  await canvas.click();
  await expect(page.getByRole("dialog", { name: "Guess Open Water?" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible({ timeout: 15_000 });
  expect(await guessListCount(page)).toBe(1);

  // Same spot again: the sheet opens, but confirming warns — no second guess.
  await canvas.click();
  await expect(page.getByRole("dialog", { name: "Guess Open Water?" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect(page.getByText(/You already guessed Open Water/)).toBeVisible({ timeout: 15_000 });
  expect(await guessListCount(page)).toBe(1);
  expect(await arrowFeatureCount(page)).toBeGreaterThan(0); // shaft + head drawn (tile-splitting makes the exact count unreliable)
});
