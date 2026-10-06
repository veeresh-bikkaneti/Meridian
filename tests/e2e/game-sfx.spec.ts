import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Meridian SFX E2E — proves sounds fire on the real flows with a stubbed
 * AudioContext (no real audio in headless Chromium). The stub records every
 * created oscillator (type + frequency + glide target) and every noise
 * buffer source into `window.__sfxCalls`, and counts context constructions
 * in `window.__sfxCtxCreated`.
 *
 * The game must stay fully playable silent: the stub is a stand-in for
 * "no audio hardware" as much as for "audio works" — every flow here
 * asserts the game advances (guesses land, reveals render, deals happen)
 * while sounds are observed on the side.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  // Stub AudioContext before any page script runs. The sfx module reads
  // window.AudioContext lazily inside initAudio(), so this fully
  // substitutes the real implementation.
  await context.addInitScript(() => {
    const calls: Array<{
      kind: string;
      type?: string;
      freq?: number;
      glideTo?: number | null;
    }> = [];
    (window as unknown as Record<string, unknown>).__sfxCalls = calls;
    (window as unknown as Record<string, unknown>).__sfxCtxCreated = 0;
    const makeParam = (
      onValue?: (v: number) => void,
      onExp?: (v: number) => void,
    ) => ({
      value: 0,
      setValueAtTime(v: number) {
        this.value = v;
        onValue?.(v);
      },
      linearRampToValueAtTime(v: number) {
        this.value = v;
      },
      exponentialRampToValueAtTime(v: number) {
        this.value = v;
        onExp?.(v);
      },
      setTargetAtTime() {},
    });
    class FakeAudioContext {
      currentTime = 0;
      state = "running";
      sampleRate = 44100;
      destination = {};
      constructor() {
        (window as unknown as Record<string, unknown>).__sfxCtxCreated =
          ((window as unknown as Record<string, unknown>).__sfxCtxCreated as number) + 1;
      }
      resume() {
        return Promise.resolve();
      }
      createGain() {
        return { gain: makeParam(), connect() {} };
      }
      createOscillator() {
        const rec: { kind: string; type: string; freq: number; glideTo: number | null } = {
          kind: "osc",
          type: "sine",
          freq: 0,
          glideTo: null,
        };
        calls.push(rec);
        return {
          set type(v: string) {
            rec.type = v;
          },
          get type() {
            return rec.type;
          },
          frequency: makeParam(
            (v) => {
              rec.freq = v;
            },
            (v) => {
              rec.glideTo = v;
            },
          ),
          detune: makeParam(),
          connect() {},
          start() {},
          stop() {},
        };
      }
      createBiquadFilter() {
        return { type: "lowpass", frequency: makeParam(), Q: makeParam(), connect() {} };
      }
      createDynamicsCompressor() {
        return {
          threshold: makeParam(),
          knee: makeParam(),
          ratio: makeParam(),
          attack: makeParam(),
          release: makeParam(),
          connect() {},
        };
      }
      createBuffer(_ch: number, len: number, _rate: number) {
        return { getChannelData: () => new Float32Array(len) };
      }
      createBufferSource() {
        calls.push({ kind: "src" });
        return { buffer: null, connect() {}, start() {}, stop() {} };
      }
    }
    (window as unknown as Record<string, unknown>).AudioContext = FakeAudioContext;
  });
});

type SfxCall = { kind: string; type?: string; freq?: number; glideTo?: number | null };

async function sfxCalls(page: import("playwright/test").Page): Promise<SfxCall[]> {
  return page.evaluate(
    () => (window as unknown as { __sfxCalls: SfxCall[] }).__sfxCalls ?? [],
  );
}

async function oscRecords(page: import("playwright/test").Page): Promise<SfxCall[]> {
  return (await sfxCalls(page)).filter((c) => c.kind === "osc");
}

async function ctxCreated(page: import("playwright/test").Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __sfxCtxCreated: number }).__sfxCtxCreated ?? 0,
  );
}

async function srcCount(page: import("playwright/test").Page): Promise<number> {
  return (await sfxCalls(page)).filter((c) => c.kind === "src").length;
}

/** The spec's mapping, replicated to compute the expected ring pitch. */
function expectedHz(distKm: number): number {
  const d = Math.min(20000, Math.max(1, distKm));
  return Math.round(1568 * Math.pow(d, -0.28));
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

  // Win: deterministic rising major arpeggio C5→E5→G5→C6 + 2093 Hz shimmer.
  // (The winning guess also draws its ring: 1568 Hz ping + 3136 shimmer.)
  const freshFreqs = (await oscRecords(page)).slice(before.length).map((o) => o.freq);
  for (const f of [523.25, 659.25, 783.99, 1046.5, 2093]) {
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
  // Lose: the muted descending sting — deterministic 440 → 329.63 Hz.
  const stingFreqs = (await oscRecords(page)).map((o) => o.freq);
  expect(stingFreqs).toContain(440);
  expect(stingFreqs).toContain(329.63);

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
