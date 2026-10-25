import { test, expect, type Page, type Route } from "playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact, installAudioProbe } from "./helpers";

/**
 * Narration-lifecycle fix (2026-10-13) — reproduction + contract pin.
 *
 * Defect 1 (primary): a figure tap that lands while the greeting is still
 * pending in `greeting_text` — the asset manifest has not resolved yet, so
 * `assets.greetAudio` is null and the first-gesture window listener was
 * never armed — falls through `handleFigureTap` to a poke line. Narration
 * never starts from that tap (the tapstart spec's `tapFigureUntilGreet`
 * helper works around exactly this swallow with up to 3 taps).
 *
 * Test R delays the storyteller-assets.json manifest by ~3s, taps the
 * figure ONCE, and asserts the greet mp3 is requested and the phase
 * reaches `greeting_audio` with NO second tap. Pre-fix this FAILS: the
 * tap pokes and no greet request ever fires.
 *
 * Test W is a CONTRACT PIN (not a repro): on a normal load, `entering`
 * must leave well within the ENTER_FALLBACK_MS (2000ms) bound the fix
 * adds as a watchdog — the primary 150ms path does this today and must
 * keep doing it.
 *
 * Project: "desktop" (mirrors storyteller-tapstart.desktop.spec.ts T3).
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await installAudioProbe(context);
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const TINY_MP3 = "tests/e2e/fixtures/storyteller-tiny.mp3";
const MANIFEST_DELAY_MS = 3000;

/** Locked greeting rotation (copy pack §0) — duplicated like the home specs. */
const GREETINGS = [
  "Ah, my young explorer! The map is whispering secrets today. Shall we hear its story together?",
  "New day, new tales hiding in the hills. Shall we go find one?",
  "Psst… the rivers told me a secret this morning. Want to hear it?",
  "Somewhere out there, a mountain is keeping a story warm. Let's go find it.",
  "The winds brought rumors from faraway cities today. Curious?",
  "Every dot on this map has a tale. Which one shall we wake up first?",
];
function expectedGreeting(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return GREETINGS[day % GREETINGS.length]!;
}
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

/** Seed meridian.tutorialSeen=1 and meridian.grandpaTour.lastDate=today to
 *  suppress invite/tour UI (mirrors storyteller-tapstart T3). */
async function seedQuietHome(page: Page): Promise<void> {
  await page.addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
    } catch {
      /* private mode — ignore */
    }
  }, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
  } satisfies Record<string, string>);
}

async function fulfillTinyMp3(route: Route): Promise<void> {
  await route.fulfill({ path: TINY_MP3, contentType: "audio/mpeg" });
}

/** The real manifest body, read from the built artifact (public/ fallback —
 *  vite copies public/ verbatim into dist/client). */
function realManifestBody(): Buffer {
  const built = path.resolve(
    "dist/client/assets/storyteller/storyteller-assets.json",
  );
  const source = path.resolve("public/assets/storyteller/storyteller-assets.json");
  return readFileSync(existsSync(built) ? built : source);
}

// ---------------------------------------------------------------------------
// Test R — THE repro: one figure tap while the greeting is pending (manifest
// still in flight) must start narration once the manifest resolves.
// ---------------------------------------------------------------------------
test("R: single figure tap while greeting is pending starts narration (manifest delayed)", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await seedQuietHome(page);

  // Delay the asset manifest by ~3s, then fulfill with the real body.
  // The flag lets the test prove the tap truly landed BEFORE the manifest
  // resolved (otherwise a slow page load could make this a false pass).
  let manifestDelivered = false;
  await page.route("**/assets/storyteller/storyteller-assets.json", async (route) => {
    await new Promise((r) => setTimeout(r, MANIFEST_DELAY_MS));
    manifestDelivered = true;
    await route.fulfill({
      body: realManifestBody(),
      contentType: "application/json",
    });
  });
  // The greet clip itself serves instantly (tiny fixture) and is counted.
  await page.route("**/audio/storyteller/greet-*.mp3", fulfillTinyMp3);
  let greetRequests = 0;
  page.on("request", (r) => {
    if (/\/audio\/storyteller\/greet-\d+\.mp3/.test(r.url())) greetRequests += 1;
  });

  await page.goto(APP);
  const host = page.getByTestId("storyteller-home");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("storyteller-home-caption")).toContainText(
    expectedGreeting().slice(0, 24),
    { timeout: 10_000 },
  );

  // Setup validity: the manifest must still be in flight at tap time.
  expect(
    manifestDelivered,
    "manifest must still be delayed when the figure is tapped",
  ).toBe(false);
  expect(greetRequests, "no greet request before the tap").toBe(0);

  // ONE tap only — pre-fix this pokes and narration never starts.
  await page.getByTestId("storyteller-figure").click({ force: true });

  // Without any second tap: once the manifest lands, the pending greeting
  // must start — greet mp3 requested, phase reaches greeting_audio.
  await expect
    .poll(() => greetRequests, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  await expect(host).toHaveAttribute("data-phase", "greeting_audio", {
    timeout: 15_000,
  });
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// Test W — CONTRACT PIN: on a normal load (no manifest delay), the phase
// leaves "entering" well within the 2000ms fallback bound (ENTER_FALLBACK_MS).
// Phase transitions are timestamped in-page via a 10ms poll installed
// before any app script, so the measurement is the entering dwell itself,
// not page-load time.
// ---------------------------------------------------------------------------
test("W (contract pin): entering advances well within the 2000ms fallback bound on a normal load", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await seedQuietHome(page);
  await page.addInitScript(() => {
    const w = window as unknown as {
      __phaseLog: Array<{ phase: string; t: number }>;
    };
    w.__phaseLog = [];
    let last: string | null = null;
    window.setInterval(() => {
      const el = document.querySelector('[data-testid="storyteller-home"]');
      const phase = el?.getAttribute("data-phase") ?? null;
      if (phase && phase !== last) {
        last = phase;
        w.__phaseLog.push({ phase, t: performance.now() });
      }
    }, 10);
  });

  await page.goto(APP);
  const host = page.getByTestId("storyteller-home");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 10_000,
  });

  const log = await page.evaluate(
    () =>
      (
        window as unknown as {
          __phaseLog: Array<{ phase: string; t: number }>;
        }
      ).__phaseLog,
  );
  const entering = log.find((e) => e.phase === "entering");
  const greetingText = log.find((e) => e.phase === "greeting_text");
  expect(entering, `entering must be observed (log: ${JSON.stringify(log)})`).toBeTruthy();
  expect(greetingText, `greeting_text must follow (log: ${JSON.stringify(log)})`).toBeTruthy();
  const dwellMs = greetingText!.t - entering!.t;
  expect(
    dwellMs,
    `entering dwell ${Math.round(dwellMs)}ms must be well within the 2000ms fallback bound`,
  ).toBeLessThan(2000);
  expectCleanConsole(errors);
});
