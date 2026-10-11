import { test, expect, type Page, type Route } from "playwright/test";
import {
  serveBuiltArtifact,
  installAudioProbe,
  readAudioProbe,
} from "./helpers";

/**
 * TEST cell — fix PR "Storyteller tap-to-start + visible mute state +
 * gesture-flag reset" (branch fix/storyteller-tap-start-and-mute).
 *
 * (2) J1 — black-box journey on a phone viewport (390×844, touch):
 * fresh visit → tour skipped for the day → tap Grandpa → the greeting
 * REALLY starts (audio element playing, clock advancing) → tap again →
 * pauses → tap again → resumes. Asserts what the user experiences —
 * audible start / silence / resume — via the audio element's live media
 * state, never DOM internals alone.
 *
 * Project: "mobile" (390x844, hasTouch, isMobile) — home screen only, no
 * satellite map needed.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const LONG_MP3 = "tests/e2e/fixtures/storyteller-long.mp3"; // 10 s silent
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

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED"),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

async function fulfillLongMp3(route: Route): Promise<void> {
  await route.fulfill({ path: LONG_MP3, contentType: "audio/mpeg" });
}

test("J1: fresh visit → tap figure → narration starts → tap pauses → tap resumes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await installAudioProbe(page.context());
  await page.addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
    } catch {
      /* private mode — ignore */
    }
  }, {
    // Fresh visit, tour skipped for the day (the journey's "skip tour").
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
  } satisfies Record<string, string>);
  // Real 10 s clip: comfortable windows for start/pause/resume, and the
  // 12 s greeting cap never fires mid-journey.
  await page.route("**/audio/storyteller/*.mp3", fulfillLongMp3);

  await page.goto("http://127.0.0.1:4123/Meridian/");
  const host = page.getByTestId("storyteller-home");
  const figure = page.getByTestId("storyteller-figure");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("storyteller-home-caption")).toContainText(
    expectedGreeting().slice(0, 24),
    { timeout: 10_000 },
  );

  // The user taps Grandpa → the greeting must REALLY start: the audio
  // element playing, its clock advancing. (The figure's idle-float
  // animation never settles — force the tap like the existing specs.)
  await figure.click({ force: true });
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 15_000 })
    .toBe(false);
  const t1 = (await readAudioProbe(page))?.currentTime ?? -1;
  await page.waitForTimeout(800);
  const t2 = (await readAudioProbe(page))?.currentTime ?? -1;
  expect(t2, `narration clock advances (${t1} → ${t2})`).toBeGreaterThan(t1);
  await expect(host).toHaveAttribute("data-phase", "greeting_audio", {
    timeout: 10_000,
  });

  // The tap that STARTED audio must not instantly pause it (600 ms guard)
  // — wait it out, then tap again: the user hears it pause.
  await page.waitForTimeout(900);
  await figure.click({ force: true });
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 10_000 })
    .toBe(true);

  // Tap once more: narration resumes from where it paused.
  const pausedAt = (await readAudioProbe(page))?.currentTime ?? -1;
  await figure.click({ force: true });
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 10_000 })
    .toBe(false);
  await page.waitForTimeout(800);
  const resumedAt = (await readAudioProbe(page))?.currentTime ?? -1;
  expect(
    resumedAt,
    `resumes forward (${pausedAt} → ${resumedAt})`,
  ).toBeGreaterThan(pausedAt);
  expectCleanConsole(errors);
});
