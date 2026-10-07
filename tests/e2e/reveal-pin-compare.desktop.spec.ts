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
  tapHitsMap,
} from "./helpers";

/**
 * Pin-compare line on the wrong-answer reveal card
 * (feat/reveal-pin-compare).
 *
 * On a miss, the result card names BOTH locations
 * (data-testid="pin-compare-line") so the player learns where their guess
 * actually landed: in globe edition both sides are COUNTRY-level
 * ("Your pin: Brazil · True spot: Iran"); "Right state, wrong town!"
 * when the state matches, "Right country, wrong town!" when only the
 * country matches (state/country editions). Fail closed: unresolvable pins
 * (mid-ocean) render no line and the card is otherwise identical; correct
 * answers never show the line.
 *
 * Determinism: the globe deal is a per-session shuffle (trail.ts), so the
 * date freeze alone cannot pin the first place. seedDeterministicDeal
 * freezes the calendar AND the RNG streams the session seed is minted
 * from (crypto.getRandomValues with a Math.random fallback), making the
 * first globe place (now a place in Iran — the difficulty-tiers merge
 * changed the dealer to fame-weighted, so the seeded first deal moved
 * from "El Tambo, Colombia") identical on every run —
 * verified stable across repeated runs during development. The miss pins
 * are fixed viewport points probed end-to-end against the live camera +
 * tap path; each sits deep inside its region (neighbor taps resolve
 * identically), so small camera jitter cannot flip the resolved name.
 * The admin-1 preload (fired at openRun) is awaited implicitly: the line
 * only renders once the boundary data is ready, so the assertions use
 * Playwright's auto-retrying expect, never fixed sleeps.
 *
 * The reveal camera is owned by a sibling crew — this spec asserts only
 * on card content and never touches camera behavior.
 */
test.setTimeout(240_000);

/**
 * Patient variant of helpers' startGlobeRun: identical steps, but the
 * map-mount waits get 60 s instead of the default 15 s. The shared VM
 * runs several crews' Playwright suites concurrently and the globe's
 * ~59k-place chunk load can push map mount past 15 s under contention;
 * helpers.ts itself is shared and left untouched.
 */
async function startGlobeRunPatient(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/?idle-ms=3600000");
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  const map = page.locator(".satellite-map");
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/**
 * Deterministic deal for the globe tests. The per-session shuffle seed
 * comes from trail.ts mintSeed(): crypto.getRandomValues when available,
 * Math.random otherwise. Seeding both (plus the calendar) pins the full
 * deal order — the first globe place is a place in Iran on every
 * run (it was "El Tambo, Colombia" before the difficulty-tiers merge
 * switched the dealer to fame-weighted). The streams stay varying (mulberry32), just deterministic, so no
 * app behavior changes — only the seed.
 */
async function seedDeterministicDeal(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const FIXED = Date.UTC(2026, 8, 29, 12, 0, 0);
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args: never[]) {
        if (args.length === 0) {
          super(FIXED);
        } else {
          super(...(args as unknown as ConstructorParameters<DateConstructor>));
        }
      }
      static now(): number {
        return FIXED;
      }
    }
    window.Date = FrozenDate as unknown as DateConstructor;

    let s = 0x12345678;
    const next = (): number => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    Math.random = next;
    const cryptoObj = window.crypto as unknown as {
      getRandomValues: (arr: ArrayBufferView) => ArrayBufferView;
    };
    const orig = cryptoObj.getRandomValues.bind(window.crypto);
    cryptoObj.getRandomValues = ((arr: ArrayBufferView) => {
      if (arr instanceof Uint32Array) {
        for (let i = 0; i < arr.length; i++)
          arr[i] = Math.floor(next() * 4294967296);
      } else if (arr instanceof Uint16Array) {
        for (let i = 0; i < arr.length; i++)
          arr[i] = Math.floor(next() * 65536);
      } else if (arr instanceof Uint8Array) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(next() * 256);
      } else {
        return orig(arr);
      }
      return arr;
    }) as typeof cryptoObj.getRandomValues;
  });
}

/**
 * Fixed miss pin: central Bahia, Brazil — far from the true spot and on
 * the visible hemisphere at the initial globe camera. The live tap path
 * resolves it to admin-1 "Bahia", country "Brazil" (neighbor taps at
 * ±20px resolve identically, so it is not near a state border), but the
 * globe line is country-level by design — Veeresh's symmetric-naming
 * decision (2026-10-05).
 */
const BAHIA_PIN = { x: 580, y: 490 };
// Canonical format: "Your pin: Brazil · True spot: Iran" (the <dl> text
// normalizes without separators; the E2E matches via regex).

/**
 * Fixed mid-ocean pin: South Atlantic. territoryAt() returns null there,
 * so resolvePin fails closed and no pin-compare line renders (neighbor
 * taps at ±20px are likewise unresolvable).
 */
const OCEAN_PIN = { x: 640, y: 440 };

test("miss in another country: the card names both locations", async ({
  page,
}) => {
  await seedDeterministicDeal(page);
  await startGlobeRunPatient(page);

  const { phase } = await commitPin(page, BAHIA_PIN.x, BAHIA_PIN.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });

  // The pin-compare line appears once the admin-1 preload resolves —
  // auto-retried, no sleeps.
  const line = card.getByTestId("pin-compare-line");
  await expect(line).toBeVisible({ timeout: 15_000 });
  // The <dl> text normalizes without the ": " and " · " separators — match
  // the two country names in order.
  await expect(line).toHaveText(/Your pin\s*Brazil.*True spot\s*Iran/s);
});

test("hit: the card shows no pin-compare line", async ({ page }) => {
  await seedDeterministicDeal(page);
  await startGlobeRunPatient(page);
  // commitHit only returns after tapping the true spot for a "story"
  // phase (true hit); it returns { committedAt }, not a phase.
  await commitHit(page);
  expect(await readPhase(page)).toBe("story");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 5_000 });

  // Correct answer: no pin-compare element at all.
  await expect(card.getByTestId("pin-compare-line")).toHaveCount(0);
});

test("miss in the ocean: no line, card otherwise identical", async ({
  page,
}) => {
  await seedDeterministicDeal(page);
  await startGlobeRunPatient(page);

  const { phase } = await commitPin(page, OCEAN_PIN.x, OCEAN_PIN.y);
  expect(phase).toBe("done");

  const card = resultCard(page);
  await expect(nextPlaceButton(page)).toBeVisible({ timeout: 15_000 });

  // Fail closed: the pin is unresolvable, so no line renders...
  await expect(card.getByTestId("pin-compare-line")).toHaveCount(0);

  // ...but everything else on the miss card is exactly as before: the
  // distance + bearing headline now reads e.g. "1,235 km east of your pin".
  await expect(card.getByTestId("miss-headline")).toHaveText(
    /[\d,]+(\.\d+)? (km|m) (north|northeast|east|southeast|south|southwest|west|northwest) of your pin/,
  );
  const subscript = card.getByTestId("miss-subscript");
  await expect(subscript).toContainText("Your pin is your guess");
  await expect(card.getByRole("link")).toBeVisible();
});

test("same-state miss: 'Right state, wrong town!'", async ({ page }) => {
  // Nebraska state run via the drill-down picker (same path as
  // state-story.desktop.spec.ts). Every dealt place is in Nebraska and
  // the flat map is framed on the state, so a center tap always lands
  // in Nebraska however the per-session shuffle deals — no seeding
  // needed for this scenario.
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

  // Tap the map center: unambiguously inside Nebraska in the state
  // framing, far from any state border. Dismiss the tile overlay first:
  // on a loaded VM the 15 s tile watchdog can fire and cover the map,
  // making elementFromPoint miss it.
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
  await expect(line).toHaveText("Right state, wrong town!");
});
