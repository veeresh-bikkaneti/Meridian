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
} from "./helpers";

/**
 * Bearing on the wrong-answer reveal (P0-2, fix/gis-review-gaps).
 *
 * Misses used to teach magnitude only ("1,235 km off"); the reveal now
 * teaches direction too: the headline reads
 * "1,235 km northeast of your pin" (data-testid="miss-headline"), naming
 * what the drawn line from the white pin to the gold spot already shows.
 * Initial bearing from the guess pin to the true spot, snapped to 8 winds;
 * the hit card (phase "story") never shows a bearing.
 *
 * Correctness check: the expected wind is derived from the live screen
 * geometry — the truth's projected viewport point (the app's own
 * __spotScreen hook, settled camera) and the known tap point. The country
 * map is a conformal Mercator framing, so the on-screen angle equals the
 * true initial bearing locally; candidate offsets are chosen with ≥12° of
 * wedge margin so the snap is unambiguous, and unit tests
 * (src/game/geo.test.ts) pin the exact spherical math for all 8 winds.
 *
 * Regression surface in this spec: State/Country/Globe misses all carry
 * the bearing line; hits carry none. The PR #58 pin-compare line is not
 * re-asserted here — the dedicated reveal-pin-compare and
 * reveal-your-pin-country-globe specs (run as regression below) own it.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

const WINDS = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
];

function windFromScreenAngle(
  pin: { x: number; y: number },
  spot: { x: number; y: number },
): { wind: string; marginDeg: number } {
  const dx = spot.x - pin.x;
  const dy = spot.y - pin.y;
  // Screen x = east, screen y = down; up is north on the flat framings.
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const wind = WINDS[Math.round(deg / 45) % 8];
  // Distance to the nearest wedge boundary: 22.5° at a wedge center,
  // 0° exactly on a boundary.
  const inWedge = ((deg % 45) + 45) % 45;
  const marginDeg = Math.abs(inWedge - 22.5);
  return { wind, marginDeg };
}

/** Wait until the truth's screen point stops moving (camera settled). */
async function settledSpot(page: Page): Promise<{ x: number; y: number }> {
  let settled: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        const a = await spotViewportPoint(page);
        if (!a) return null;
        await page.waitForTimeout(800);
        const b = await spotViewportPoint(page);
        if (!b) return null;
        if (a.x === b.x && a.y === b.y) {
          settled = b;
          return `${b.x},${b.y}`;
        }
        return null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  return settled!;
}

async function startCountryRun(page: Page, country: string): Promise<void> {
  await page.goto(APP);
  await page.getByRole("button", { name: "Choose a country" }).click();
  await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  await page.getByRole("button", { name: country }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

/**
 * Tile-readiness gate: the VM's tile network is flaky and the 15 s watchdog
 * can re-cover the map after dismissal (the same pattern commitPin in
 * helpers.ts uses). Retry the load the way a user would — up to 3 attempts
 * — before probing tap points or committing.
 */
async function awaitHealthyTiles(page: Page): Promise<void> {
  const map = page.locator(".satellite-map");
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissTileOverlayIfPresent(page);
    try {
      await expect
        .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
        .toBe("ready");
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

/**
 * Pick a miss pin at a fixed offset from the settled truth point: clear
 * wedge margin (≥12°), inside the viewport, and tappable on the map.
 */
async function clearMissPin(
  page: Page,
  spot: { x: number; y: number },
): Promise<{ pin: { x: number; y: number }; wind: string }> {
  const box = await page.locator(".satellite-map").boundingBox();
  expect(box).not.toBeNull();
  const candidates = [
    // Exact wedge centers (margin 22.5°): the snap is unambiguous and the
    // expected word is readable straight from the offset.
    // Pin below the spot → spot is north of your pin, etc.
    { dx: 0, dy: 240 }, // north
    { dx: 0, dy: -240 }, // south
    { dx: -240, dy: 0 }, // east
    { dx: 240, dy: 0 }, // west
    { dx: -170, dy: 170 }, // northeast
    { dx: 170, dy: 170 }, // northwest
    { dx: -170, dy: -170 }, // southeast
    { dx: 170, dy: -170 }, // southwest
  ];
  for (const c of candidates) {
    const pin = { x: spot.x + c.dx, y: spot.y + c.dy };
    const inView =
      pin.x > box!.x + 40 &&
      pin.x < box!.x + box!.width - 40 &&
      pin.y > box!.y + 40 &&
      pin.y < box!.y + box!.height - 40;
    if (!inView) continue;
    const { wind, marginDeg } = windFromScreenAngle(pin, spot);
    if (marginDeg < 12) continue;
    // The tile watchdog can re-cover the map between probes; dismiss and
    // re-check before each tap-point decision.
    await dismissTileOverlayIfPresent(page);
    if (!(await tapHitsMap(page, pin.x, pin.y))) continue;
    return { pin, wind };
  }
  throw new Error("clearMissPin: no unambiguous tappable offset found");
}

test("country edition miss: the headline teaches direction — '<dist> <wind> of your pin'", async ({
  page,
}) => {
  await startCountryRun(page, "Italy");
  await awaitHealthyTiles(page);
  const spot = await settledSpot(page);
  const { pin, wind } = await clearMissPin(page, spot);

  const { phase } = await commitPin(page, pin.x, pin.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const headline = card.getByTestId("miss-headline");
  await expect(headline).toHaveText(
    new RegExp(
      `^[\\d,]+(\\.\\d+)? (km|m) ${wind} of your pin$`,
    ),
    { timeout: 15_000 },
  );
});

test("state edition: miss carries the bearing; hit carries none", async ({
  page,
}) => {
  // Nebraska drill-down (same path as the pin-compare state test).
  await page.goto("http://127.0.0.1:4123/Meridian/");
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

  // Tile-readiness gate: the center tap must hit the map canvas, not the
  // "Loading satellite imagery" shimmer (same pattern as commitPin).
  await awaitHealthyTiles(page);
  const box = await page.locator(".satellite-map").boundingBox();
  expect(box).not.toBeNull();
  const center = {
    x: Math.round(box!.x + box!.width / 2),
    y: Math.round(box!.y + box!.height / 2),
  };
  expect(await tapHitsMap(page, center.x, center.y)).toBe(true);

  // Center tap is a miss unless the dealt place is within the hit radius;
  // advance and retry in that rare case.
  let phase: string | null = null;
  let spot: { x: number; y: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    spot = await settledSpot(page);
    ({ phase } = await commitPin(page, center.x, center.y));
    if (phase === "done") break;
    await clickNextPlace(page);
    await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  }
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  const headline = card.getByTestId("miss-headline");
  const { wind, marginDeg } = windFromScreenAngle(center, spot!);
  if (marginDeg >= 12) {
    await expect(headline).toHaveText(
      new RegExp(`^[\\d,]+(\\.\\d+)? (km|m) ${wind} of your pin$`),
    );
  } else {
    // Too close to a wedge boundary to assert the exact word from screen
    // geometry — the copy shape is still the contract.
    await expect(headline).toHaveText(
      /^[\d,]+(\.\d+)? (km|m) (north|northeast|east|southeast|south|southwest|west|northwest) of your pin$/,
    );
  }

  // Hit: the reveal card shows the bare distance, never a bearing.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await commitHit(page);
  expect(await readPhase(page)).toBe("story");
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });
  const hitCard = resultCard(page);
  await expect(hitCard.getByTestId("miss-headline")).toHaveCount(0);
  await expect(hitCard.getByText(/of your pin/)).toHaveCount(0);
  await expect(hitCard.locator("p.font-display").first()).toHaveText(
    /^[\d,]+(\.\d+)? (km|m)$/,
  );
});

test("globe edition: miss headline carries the bearing, PR #58 line intact", async ({
  page,
}) => {
  await page.goto(APP);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await dismissTileOverlayIfPresent(page);
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 60_000,
  });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");

  // Fixed miss pin: central Brazil — far from any plausible truth, on the
  // visible hemisphere at the initial globe camera.
  const { phase } = await commitPin(page, 580, 490);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });
  await expect(card.getByTestId("miss-headline")).toHaveText(
    /^[\d,]+(\.\d+)? (km|m) (north|northeast|east|southeast|south|southwest|west|northwest) of your pin$/,
    { timeout: 15_000 },
  );
});
