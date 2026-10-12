import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  installAudioProbe,
  readAudioProbe,
} from "./helpers";

/**
 * Home greeting follow-up path — Fix F (2026-10-11).
 *
 * Owner report: "When you tap on story teller the followup narrations are
 * showing in subtitle but no audio."
 *
 * Root cause: PR #136 hardened the CARD storyteller (storyteller.tsx), but
 * the HOME storyteller (storyteller-home.tsx) had its own
 * `beginGreetingAudio` path with no play() hang watchdog. The subtitle
 * bubble shows first (`showBubble(greetingText, null)` — no hold timer, it
 * stays up "while audio plays"), so a hung play() stranded the bubble with
 * zero audio — the exact reported symptom. The pause/resume tap path also
 * swallowed errors silently (`.catch(() => {})`).
 *
 * These are runtime-path tests: they walk the real tap → follow-up →
 * audio path in a mobile browser and assert on the LIVE media element
 * (via the audio probe), not on React state or captions.
 */
test.setTimeout(180_000);
// Screen-recording law: retain video of the follow-up narration session.
test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

test.beforeEach(async ({ context }) => {
  await installAudioProbe(context);
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

async function seed(page: Page, entries: Record<string, string>): Promise<void> {
  await page.context().addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
    } catch {
      /* private mode — ignore */
    }
  }, entries);
}

/** Suppress Grandpa's tour (it yields the host) and the tutorial invite. */
async function seedQuietHome(page: Page): Promise<void> {
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await seed(page, {
    "meridian.grandpaTour.lastDate": todayKey,
    "meridian.tutorialSeen": "1",
  });
}

async function loadHome(page: Page): Promise<void> {
  await page.goto(APP);
  await expect(page.getByTestId("storyteller-home")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("storyteller-home-caption")).toBeVisible({ timeout: 10_000 });
}

test("figure tap replays an unheard greeting with REAL audio, not just captions", async ({
  page,
}) => {
  // Fail the first attempt: abort the mp3 so play() rejects → the greeting
  // is "attempted but never heard", and the UI fails loud.
  await page.route("**/greet-*.mp3", (route) => route.abort());
  await seedQuietHome(page);
  await loadHome(page);

  const host = page.getByTestId("storyteller-home");
  const figure = page.getByTestId("storyteller-figure");

  // First gesture starts the (doomed) attempt.
  await page.locator("body").click({ position: { x: 200, y: 600 } });
  await expect(page.getByTestId("storyteller-home-fallback")).toBeVisible({
    timeout: 15_000,
  });

  // Let the mp3 serve normally now, then tap the figure: the Fix D replay
  // path must run beginGreetingAudio again.
  await page.unroute("**/greet-*.mp3");
  await page.waitForTimeout(700); // clear the figure-tap debounce
  await figure.click({ force: true });

  // The black-box proof: the LIVE media element is really playing —
  // paused === false — not just the bubble text showing.
  await expect
    .poll(
      async () => {
        const probe = await readAudioProbe(page);
        return probe !== null && probe.paused === false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  await expect(host).toHaveAttribute("data-phase", "greeting_audio");
});

test("hung play() fails loud via the watchdog — no stranded subtitle", async ({
  page,
}) => {
  // Hang the mp3 forever: play() never settles. Before Fix F this stranded
  // the subtitle bubble with zero audio — the owner's exact symptom.
  await page.route("**/greet-*.mp3", () => new Promise(() => {}));
  await seedQuietHome(page);
  await loadHome(page);

  const host = page.getByTestId("storyteller-home");
  const caption = page.getByTestId("storyteller-home-caption");

  // First gesture: the subtitle bubble goes up immediately (text-first).
  await page.locator("body").click({ position: { x: 200, y: 600 } });
  await expect(caption).toBeVisible({ timeout: 10_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_audio", {
    timeout: 10_000,
  });

  // The 4s hang watchdog must fire: fail loud into text + retry hint, and
  // the phase must LEAVE greeting_audio (no stranded subtitle).
  await expect(page.getByTestId("storyteller-home-fallback")).toBeVisible({
    timeout: 15_000,
  });
  await expect(host).not.toHaveAttribute("data-phase", "greeting_audio", {
    timeout: 10_000,
  });

  // The retry path works: un-hang the mp3, tap the figure → real audio.
  await page.unroute("**/greet-*.mp3");
  await page.waitForTimeout(700);
  await page.getByTestId("storyteller-figure").click({ force: true });
  await expect
    .poll(
      async () => {
        const probe = await readAudioProbe(page);
        return probe !== null && probe.paused === false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
});

test("pause/resume tap recovers instead of swallowing the error", async ({
  page,
}) => {
  await seedQuietHome(page);
  await loadHome(page);

  const figure = page.getByTestId("storyteller-figure");

  // Start the greeting with a working mp3.
  await page.locator("body").click({ position: { x: 200, y: 600 } });
  await expect
    .poll(
      async () => {
        const probe = await readAudioProbe(page);
        return probe !== null && probe.paused === false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);

  // Pause via figure tap…
  await page.waitForTimeout(700);
  await figure.click({ force: true });
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 10_000 })
    .toBe(true);

  // …then resume via figure tap: audio really plays again (the old
  // `.catch(() => {})` swallowed resume failures silently).
  await page.waitForTimeout(700);
  await figure.click({ force: true });
  await expect
    .poll(
      async () => {
        const probe = await readAudioProbe(page);
        return probe !== null && probe.paused === false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
});
