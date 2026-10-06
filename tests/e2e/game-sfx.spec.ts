import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  spotViewportPoint,
  tapHitsMap,
  commitPin,
  readPhase,
  dismissTileOverlayIfPresent,
} from "./helpers";
import {
  installSfxStub,
  sfxCalls,
  oscRecords,
  srcRecords,
  ctxCreated,
  srcCount,
  expectedHz,
  type SfxCall,
  type SfxFilterCall,
  type SfxGainCall,
} from "./sfx-stub";

/**
 * Meridian SFX E2E — proves sounds fire on the real flows with the shared
 * stubbed AudioContext from ./sfx-stub.ts (no real audio in headless
 * Chromium).
 *
 * The game must stay fully playable silent: the stub is a stand-in for
 * "no audio hardware" as much as for "audio works" — every flow here
 * asserts the game advances (guesses land, reveals render, deals happen)
 * while sounds are observed on the side.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";
const NO_IDLE = `${BASE}?idle-ms=3600000`;

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Stub AudioContext before any page script runs.
  await installSfxStub(context);
});

type SfxCallT = SfxCall;

async function startGlobeAim(page: import("playwright/test").Page): Promise<void> {
  await page.goto(NO_IDLE);
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
}

function searchBox(page: import("playwright/test").Page) {
  return page.getByRole("combobox", { name: "Search the map" });
}

async function openLoop(page: import("playwright/test").Page, puzzle: string) {
  await page.goto(`${BASE}?loop-puzzle=${puzzle}`);
  await page.getByRole("button", { name: /Solve a mystery|Resume your case/ }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

async function guessViaSearch(page: import("playwright/test").Page, query: string) {
  const box = searchBox(page);
  await box.click();
  await box.fill(query);
  const option = page.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

async function guessCount(page: import("playwright/test").Page): Promise<number> {
  return page
    .getByRole("region", { name: "Your guesses" })
    .getByRole("listitem")
    .count()
    .catch(() => 0);
}

async function lastGuessDistKm(page: import("playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
    const guesses = store.current.guesses as Array<{ distKm: number }>;
    return guesses[guesses.length - 1]!.distKm;
  });
}

async function targetEntry(page: import("playwright/test").Page) {
  return page.evaluate(async () => {
    const store = JSON.parse(localStorage.getItem("meridian.loop.v2")!);
    const clue = await fetch(`loop/clues/${store.current.index}.json`).then((r) => r.json());
    const names = await fetch("loop/names.json").then((r) => r.json());
    return names.find((e: { id: string }) => e.id === clue.placeId) as {
      n: string;
      id: string;
    };
  });
}

async function guessTarget(
  page: import("playwright/test").Page,
  entry: { n: string; id: string },
) {
  const box = searchBox(page);
  await box.click();
  await box.fill(entry.n);
  const option = page.locator(`li[role="option"][data-entry-id="${entry.id}"]`);
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Guess this place" }).click();
}

async function wrongQueries(
  page: import("playwright/test").Page,
  targetId: string,
  count = 5,
): Promise<string[]> {
  return page.evaluate(
    async ({ targetId, count }: { targetId: string; count: number }) => {
      const names = await fetch("loop/names.json").then((r) => r.json());
      const cands = ["paris", "tokyo", "sydney", "cairo", "new york", "london", "moscow", "beijing"];
      const out: string[] = [];
      for (const q of cands) {
        const e = names.find((x: { n: string }) => x.n === q);
        if (e && e.id !== targetId) out.push(q);
        if (out.length === count) break;
      }
      return out;
    },
    { targetId, count },
  );
}

test("home: card tap fires on gesture-created context; toggle persists and silences", async ({
  page,
}) => {
  await page.goto(BASE);
  const dossier = page.getByRole("button", { name: /Solve a mystery|Resume your case/ });
  await expect(dossier).toBeVisible({ timeout: 30_000 });

  // The first pointerdown creates the AudioContext (autoplay gate); the
  // card tap then voices one triangle ~587 Hz (±2% UI jitter).
  await dossier.click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  expect(await ctxCreated(page)).toBeGreaterThanOrEqual(1);
  const tap = (await oscRecords(page)).at(-1)!;
  expect(tap.type).toBe("triangle");
  expect(tap.freq).toBeGreaterThanOrEqual(587.33 * 0.98);
  expect(tap.freq).toBeLessThanOrEqual(587.33 * 1.02);

  // Back home; the speaker toggle persists meridian.sound and silences play.
  await page.getByRole("button", { name: "Editions" }).click();
  const toggle = page.getByTestId("sound-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  expect(await page.evaluate(() => localStorage.getItem("meridian.sound"))).toBe("off");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  const before = (await oscRecords(page)).length;
  await page.getByRole("button", { name: /Solve a mystery|Resume your case/ }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  // Silent: no new voices — and the game still advances (loop screen loads).
  expect(await oscRecords(page)).toHaveLength(before);
  expect(await page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });

  // Turning ON confirms with the card tap; persistence round-trips.
  await page.getByRole("button", { name: "Editions" }).click();
  await page.getByTestId("sound-toggle").click();
  expect(await page.evaluate(() => localStorage.getItem("meridian.sound"))).toBe("on");
  await expect
    .poll(async () => (await oscRecords(page)).length, { timeout: 10_000 })
    .toBeGreaterThan(before);
});

test("in-game mute button toggles sound mid-game", async ({ page }) => {
  await startGlobeAim(page);

  const toggle = page.getByTestId("sound-toggle-game");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // Mute mid-game: the persisted value flips and the pressed state follows.
  await toggle.click();
  expect(await page.evaluate(() => localStorage.getItem("meridian.sound"))).toBe("off");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAccessibleName("Turn sound on");

  // Unmute: the card tap confirms (a new voice), persistence round-trips.
  const before = (await oscRecords(page)).length;
  await toggle.click();
  expect(await page.evaluate(() => localStorage.getItem("meridian.sound"))).toBe("on");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await oscRecords(page)).length, { timeout: 10_000 })
    .toBeGreaterThan(before);

  // The game is unaffected: the map is still interactive in the aim phase.
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("aim");
  await expect(page.locator(".satellite-map")).toBeVisible();
});

test("geodetective: guess confirm blip + distance-mapped ring reveal", async ({ page }) => {
  // ?loop-puzzle=218 -> Ankara.
  await openLoop(page, "218");
  const before = await oscRecords(page);

  await guessViaSearch(page, "paris");
  await expect
    .poll(() => guessCount(page), { timeout: 15_000 })
    .toBe(1);

  // The confirm blip: 660→720 Hz glide + fifth at 990 Hz (±2% jitter).
  const fresh = (await oscRecords(page)).slice(before.length);
  const inRange = (f: number | undefined, base: number) =>
    f !== undefined && f >= base * 0.98 && f <= base * 1.02;
  expect(fresh.some((o) => inRange(o.freq, 660) && o.glideTo !== null)).toBe(true);
  expect(fresh.some((o) => inRange(o.freq, 990))).toBe(true);

  // The ring reveal: pitch IS the distance (deterministic — no jitter).
  const distKm = await lastGuessDistKm(page);
  const hz = expectedHz(distKm);
  await expect
    .poll(async () => (await oscRecords(page)).some((o) => o.freq === hz), {
      timeout: 10_000,
    })
    .toBe(true);
  // Band check: paris→ankara is a mid-band distance — triangle with the
  // gentle f → 0.94f down-glide.
  const ring = (await oscRecords(page)).find((o) => o.freq === hz)!;
  expect(ring.type).toBe("triangle");
  expect(ring.glideTo).toBeCloseTo(0.94 * hz, 0);
});

test("geodetective: win arpeggio fires on a solved mystery", async ({ page }) => {
  await openLoop(page, "218");
  const entry = await targetEntry(page);
  const before = await oscRecords(page);

  await guessTarget(page, entry);
  await expect(page.getByText("🎯 You found it!")).toBeVisible({
    timeout: 15_000,
  });

  // Win: Mario-style ascending run C5→E5→G5→C6→E6 + triumphant chord.
  // (The winning guess also draws its ring: 1568 Hz ping.)
  const freshFreqs = (await oscRecords(page)).slice(before.length).map((o) => o.freq);
  for (const f of [523.25, 659.25, 783.99, 1046.5, 1318.5]) {
    expect(freshFreqs).toContain(f);
  }
  expect(freshFreqs).toContain(1568); // ring reveal on the exact guess
});

test("geodetective: lose sting after five misses; next-case deal snaps", async ({ page }) => {
  test.slow(); // five sequential guesses; the name index loads once
  await openLoop(page, "218");
  const entry = await targetEntry(page);
  const queries = await wrongQueries(page, entry.id, 5);
  expect(queries).toHaveLength(5);

  for (let i = 0; i < queries.length; i++) {
    const before = await oscRecords(page);
    await guessViaSearch(page, queries[i]!);
    await expect
      .poll(() => guessCount(page), { timeout: 15_000 })
      .toBe(i + 1);
    // Every miss draws its ring — the game is fully playable while sounds
    // fire (each guess voices its confirm blip + ring).
    await expect
      .poll(async () => (await oscRecords(page)).length > before.length, {
        timeout: 10_000,
      })
      .toBe(true);
  }

  await expect(page.getByText("Out of guesses")).toBeVisible({ timeout: 15_000 });
  // Lose: the Mario-style descending run — E5→Eb5→D5→Db5→C5.
  const stingFreqs = (await oscRecords(page)).map((o) => o.freq);
  expect(stingFreqs).toContain(659.25);
  expect(stingFreqs).toContain(523.25);

  // Next mystery: the deal snaps (cached noise buffer source + 196 Hz tick).
  const srcBefore = await srcCount(page);
  const oscBefore = (await oscRecords(page)).length;
  await page.getByRole("button", { name: "🔎 Next mystery" }).click();
  await expect(page.getByRole("article", { name: /Clue 1: Geography/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => srcCount(page), { timeout: 10_000 }).toBeGreaterThan(srcBefore);
  const dealFreqs = (await oscRecords(page)).slice(oscBefore).map((o) => o.freq);
  expect(dealFreqs).toContain(196);
});

test("globe spin: NO loop texture (disabled per Veeresh 2026-10-06)", async ({
  page,
}) => {
  await page.goto(NO_IDLE);
  // The edition-card tap creates the AudioContext (autoplay gate).
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  // Wait for the map to settle (spin would have started by now if enabled).
  await page.waitForTimeout(3000);
  // No looping buffer source should exist — the spin sound is disabled.
  const srcs = await srcRecords(page);
  expect(srcs.some((s) => s.loop)).toBe(false);
});


test("streak milestone: crossing 10 plays the small cheer", async ({ page }) => {
  test.slow(); // reload-restore round-trip plus a full reveal
  await startGlobeAim(page);

  // Isolate the cheer: the first-win fanfare shares the C-major triad, so
  // mark it celebrated — this bank must voice only the milestone cheer.
  await page.evaluate(() => localStorage.setItem("meridian.firstWinCelebrated", "1"));
  // Seed the run streak to 9 through the reload-restore path (resumeRun
  // preserves streak): the next hit crosses 10 and banks the cheer.
  await page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.run");
    if (!raw) throw new Error("no saved run to seed");
    const run = JSON.parse(raw);
    run.streak = 9;
    sessionStorage.setItem("meridian.run", JSON.stringify(run));
  });
  await page.reload();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
  await dismissTileOverlayIfPresent(page);

  // The exact spot is a guaranteed hit (distance ~0).
  const spot = await spotViewportPoint(page);
  expect(spot, "the true spot must project").not.toBeNull();
  expect(await tapHitsMap(page, spot!.x, spot!.y)).toBe(true);

  const before = await oscRecords(page);
  const { phase } = await commitPin(page, spot!.x, spot!.y);
  expect(phase).toBe("story"); // the exact-spot tap is a hit

  // Small cheer: deterministic C5→E5→G5 triangle triad, staggered 70 ms.
  // (The endless game wires no ring/win sounds, so the triad is the cheer.)
  const freshFreqs = (await oscRecords(page)).slice(before.length).map((o) => o.freq);
  for (const f of [523.25, 659.25, 783.99]) {
    expect(freshFreqs).toContain(f);
  }
});
