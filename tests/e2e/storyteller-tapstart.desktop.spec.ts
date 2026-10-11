import { test, expect, type Page, type Route } from "playwright/test";
import {
  serveBuiltArtifact,
  startGlobeRun,
  commitMiss,
  clickNextPlace,
  readPhase,
  installAudioProbe,
  readAudioProbe,
} from "./helpers";

/**
 * TEST cell — fix PR "Storyteller tap-to-start + visible mute state +
 * gesture-flag reset" (branch fix/storyteller-tap-start-and-mute).
 *
 * Owner's phone 2026-10-10: dead narration — (a) tapping the figure was a
 * no-op when audio never started (idle/failed/ended had no branch in
 * handleFigureToggle), (b) the speaker icon never showed mute state
 * (snapshot of isSoundEnabled() went stale — same-tab storage events don't
 * fire), (c) a tour-kill left the one-shot gesture flag consumed, blocking
 * post-tour audio forever.
 *
 * This file walks the three NEW runtime paths plus the full narration
 * figure-tap matrix on the story host (ResultCard, trigger="speaker" via
 * sound-off — the deterministic idle model), the home tour-kill path via
 * the component's public event seams, and the desktop cursor-tracking
 * journey. src/ is untouched — specs only.
 *
 * Project: "desktop" (1440x900, no touch emulation) — the story screen
 * needs the satellite map, which does not mount under mobile UA emulation.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const MP3_PATTERN = "**/audio/storyteller/*.mp3";
const TINY_MP3 = "tests/e2e/fixtures/storyteller-tiny.mp3";
const LONG_MP3 = "tests/e2e/fixtures/storyteller-long.mp3"; // 10 s silent
const TOUR_RETURN_LINE =
  "Welcome back, explorer! Grandpa showed you around — now, where shall our story go next?";

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

function expectCleanConsole(errors: string[], ignore: string[] = []): void {
  // Same filters as storyteller.spec.ts: React #418 is a pre-existing flaky
  // hydration warning; the crash-report beacon cannot reach its worker from
  // this VM (forced environmental failure, not an app bug).
  const relevant = errors.filter(
    (e) =>
      !e.includes("Minified React error #418") &&
      !e.includes("ERR_TUNNEL_CONNECTION_FAILED") &&
      !ignore.some((s) => e.includes(s)),
  );
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

async function fulfillLongMp3(route: Route): Promise<void> {
  await route.fulfill({ path: LONG_MP3, contentType: "audio/mpeg" });
}
async function fulfillTinyMp3(route: Route): Promise<void> {
  await route.fulfill({ path: TINY_MP3, contentType: "audio/mpeg" });
}

/**
 * Boot a globe run with sound OFF, commit a miss, wait for the story host.
 * Sound off → trigger="speaker": text-first, no auto audio — the figure
 * sits in the deterministic idle state the fix targets.
 */
async function reachStoryScreen(page: Page): Promise<string[]> {
  const errors = collectErrors(page);
  await installAudioProbe(page.context());
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem("meridian.sound"))
        localStorage.setItem("meridian.sound", "off");
      // Keep the first-win celebration parked — it can steal the reveal
      // timing and flake the audio assertions.
      localStorage.setItem("meridian.firstWinCelebrated", "1");
    } catch {
      /* private mode — ignore */
    }
  });
  await startGlobeRun(page);
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });
  return errors;
}

/** Requests for the story narration clip (reveal-01.mp3). */
function watchNarrationRequests(page: Page): { count: () => number } {
  let n = 0;
  page.on("request", (r) => {
    if (r.url().includes("/audio/storyteller/reveal-01.mp3")) n += 1;
  });
  return { count: () => n };
}

/**
 * Unmute via the real channel. reachStoryScreen seeds sound=off for a
 * deterministic idle model; the tap-start path honors persistent mute
 * (red-team BREAK 1), so tests asserting playback must unmute first.
 * R1 is the exception — it asserts the muted tap stays silent.
 */
async function unmute(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("meridian.sound", "on");
    window.dispatchEvent(
      new CustomEvent("meridian:sound-change", { detail: true }),
    );
  });
}

/** The figure's idle-float animation never settles — force the tap, exactly
 *  like the existing "figure tap pauses and resumes" spec. */
async function tapFigure(page: Page): Promise<void> {
  await page.getByTestId("storyteller-figure").click({ force: true });
}

/** Close the user-driven celebration overlay if it is up (no auto-timer). */
async function closeCelebrationIfPresent(page: Page): Promise<void> {
  const overlay = page.getByTestId("celebration-overlay");
  if (await overlay.isVisible().catch(() => false)) {
    await overlay
      .getByRole("button", { name: "Close celebration" })
      .click()
      .catch(() => page.keyboard.press("Escape"));
    await expect(overlay).toBeHidden({ timeout: 10_000 });
  }
}

/**
 * Reach the SECOND story reveal of the session with sound ON.
 * The session one-shot (claimFirstRevealNarration) makes the second
 * ResultCard mount StorytellerNarration with trigger="speaker" — the ONLY
 * story-screen model where the speaker button stays mounted across a mute
 * toggle (on trigger="first_gesture" + sound on, the button unmounts when
 * unmuted by design: showSpeaker = !autoAttempt || !soundOn). The button
 * being visible with sound on is itself the oracle that trigger="speaker".
 */
async function reachSecondReveal(page: Page): Promise<string[]> {
  const errors = collectErrors(page);
  await installAudioProbe(page.context());
  await page.addInitScript(() => {
    try {
      // Sound ON (default — leave meridian.sound unset) and suppress the
      // once-per-lifetime first-win celebration: on a fresh profile a rare
      // hit at the burn point would raise its user-driven overlay and block
      // the advance past the first reveal.
      localStorage.setItem("meridian.firstWinCelebrated", "1");
    } catch {
      /* private mode — ignore */
    }
  });
  await startGlobeRun(page);
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });
  await closeCelebrationIfPresent(page);
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await commitMiss(page);
  await expect(page.getByTestId("storyteller-narration")).toBeVisible({
    timeout: 20_000,
  });
  await closeCelebrationIfPresent(page);
  return errors;
}

/**
 * Tap the home figure until the greeting mp3 is requested (up to 3 tries).
 * The first tap can land before the asset manifest resolves and the
 * first-gesture listener arms — that tap is a harmless poke; the retry
 * then starts the greeting. Deterministic without racing the manifest.
 */
async function tapFigureUntilGreet(
  page: Page,
  getCount: () => number,
  want: number,
): Promise<void> {
  const figure = page.getByTestId("storyteller-figure");
  for (let attempt = 0; attempt < 3; attempt++) {
    await figure.click({ force: true });
    try {
      await expect
        .poll(getCount, { timeout: 10_000 })
        .toBeGreaterThanOrEqual(want);
      return;
    } catch {
      // Not armed yet — retry the tap.
    }
  }
  throw new Error(`greeting audio never started (want >= ${want} requests)`);
}

// ---------------------------------------------------------------------------
// (1) T1 — THE regression test: idle figure tap starts REAL audio.
// Before the fix, handleFigureToggle had no idle/failed/ended branch — the
// tap was a silent no-op (owner's phone). This asserts the audio ELEMENT
// actually plays: paused === false and currentTime advancing, not just
// React state.
// ---------------------------------------------------------------------------
test("T1: idle figure tap starts the narration audio (element really plays)", async ({
  page,
}) => {
  // Register the mp3 route BEFORE page load: post-load registration can
  // leave the clip stuck in "playing" (route-timing flake).
  await page.route(MP3_PATTERN, fulfillLongMp3);
  const errors = await reachStoryScreen(page);
  // reachStoryScreen seeds sound=off for a deterministic idle model; the
  // tap-start path honors persistent mute (red-team BREAK 1), so unmute
  // via the real channel before asserting playback. R1 covers the muted
  // tap staying silent.
  await unmute(page);
  const reqs = watchNarrationRequests(page);
  const figure = page.getByTestId("storyteller-figure");

  // Idle oracle: the fix renamed the idle label "The storyteller" →
  // "Play the story" (pre-fix builds fail here too).
  await expect(figure).toHaveAttribute("aria-label", "Play the story", {
    timeout: 10_000,
  });

  await tapFigure(page);

  // The clip was requested (play() called on a real element).
  await expect.poll(() => reqs.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

  // The ELEMENT is playing — paused === false, not just React state.
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 15_000 })
    .toBe(false);

  // Wait for the element to actually have data (readyState ≥ 2): on a
  // loaded VM `paused === false` can be true while the decoder is still
  // starved, and currentTime won't move until data arrives.
  await expect
    .poll(async () => (await readAudioProbe(page))?.readyState ?? 0, {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(2);

  // currentTime advances — the clock the user hears, not a flag.
  // Poll (not fixed sleeps): on a loaded VM the first frames can stall.
  const t1 = (await readAudioProbe(page))?.currentTime ?? -1;
  expect(t1, "currentTime after play()").toBeGreaterThanOrEqual(0);
  await expect
    .poll(async () => (await readAudioProbe(page))?.currentTime ?? -1, {
      timeout: 15_000,
    })
    .toBeGreaterThan(t1);

  // React state agrees: the figure is now the pause control.
  await expect(figure).toHaveAttribute("aria-label", "Pause the story", {
    timeout: 10_000,
  });
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// R1 — red-team BREAK 1 regression: a MUTED figure tap must not play audio.
// The idle tap-start path honors the persistent mute ("sound off until I
// say so", owner ruling). Pre-fix (builder's version), the tap bypassed
// mute and played audibly while the icon showed VolumeX.
// ---------------------------------------------------------------------------
test("R1: muted figure tap stays silent (persistent mute honored)", async ({
  page,
}) => {
  await page.route(MP3_PATTERN, fulfillLongMp3);
  const errors = await reachStoryScreen(page); // sound=off, idle figure
  const reqs = watchNarrationRequests(page);
  const figure = page.getByTestId("storyteller-figure");
  await expect(figure).toHaveAttribute("aria-label", "Play the story", {
    timeout: 10_000,
  });

  await tapFigure(page);

  // No narration request within a generous window — the tap is a silent
  // no-op while muted (the VolumeX icon is the indicator, not a bypass).
  await page.waitForTimeout(3000);
  expect(reqs.count(), "no mp3 requested while muted").toBe(0);

  // The figure is still the idle play control — state didn't transition.
  await expect(figure).toHaveAttribute("aria-label", "Play the story");
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// (1) T2 — the speaker icon reflects the LIVE mute state.
// The game-app eyebrow toggle flips meridian.sound and dispatches
// meridian:sound-change; the fix wires the storyteller speaker button to
// that event (previously a mount-time snapshot — the icon lied after any
// toggle). Assert the RENDERED SVG flips Volume2 ↔ VolumeX.
//
// Setup: the SECOND story reveal (trigger="speaker") with sound ON — the
// only story-screen model where the speaker button stays mounted across a
// mute toggle, so the icon flip is observable. (On the first reveal's
// trigger="first_gesture" + sound on, unmuting unmounts the button by
// design — verified by probe, not assumed.)
// ---------------------------------------------------------------------------
test("T2: eyebrow mute toggle flips the storyteller speaker icon Volume2↔VolumeX", async ({
  page,
}) => {
  const errors = await reachSecondReveal(page);
  const speaker = page.getByTestId("storyteller-speaker");
  // Oracle: with sound ON the button is visible ⟺ trigger="speaker"
  // (on the first_gesture model it would be unmounted).
  await expect(speaker).toBeVisible({ timeout: 10_000 });
  const eyebrow = page.getByTestId("sound-toggle-game");
  await expect(eyebrow).toBeVisible({ timeout: 10_000 });

  const svgHtml = () => speaker.locator("svg").first().innerHTML();

  // Sound on → the unmuted speaker icon.
  const unmutedIcon = await svgHtml();
  expect(unmutedIcon.length, "speaker renders an svg").toBeGreaterThan(0);
  expect(
    await page.evaluate(() => localStorage.getItem("meridian.sound")),
    "sound starts on",
  ).not.toBe("off");

  // Mute via the eyebrow → the icon must flip to the muted VolumeX.
  await eyebrow.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("meridian.sound")), {
      timeout: 10_000,
    })
    .toBe("off");
  await expect.poll(svgHtml, { timeout: 10_000 }).not.toBe(unmutedIcon);
  const mutedIcon = await svgHtml();

  // Unmute → the unmuted icon returns exactly.
  await eyebrow.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("meridian.sound")), {
      timeout: 10_000,
    })
    .toBe("on");
  await expect.poll(svgHtml, { timeout: 10_000 }).toBe(unmutedIcon);

  // The two states are genuinely different renders.
  expect(mutedIcon).not.toBe(unmutedIcon);
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// (1) T3 — tour-kill resets the one-shot gesture flag.
// Path: greeting audio playing → tour starts (yield) → tour ends →
// text-only return line → follow-up greeting pending → figure tap must
// start the greeting mp3. Pre-fix, gestureDoneRef stayed consumed and the
// post-tour tap was a dead no-op. Driven via the component's public seams:
// the meridian:tour-walk-start/end window events (the real tour UI is
// seeded away for the day — only the host's useTourActive hook reacts).
// ---------------------------------------------------------------------------
test("T3: tour-kill re-arms the gesture flag — post-tour figure tap narrates", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await installAudioProbe(page.context());
  await page.addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
    } catch {
      /* private mode — ignore */
    }
  }, {
    "meridian.grandpaTour.lastDate": todayKey(), // suppress the real tour UI
    "meridian.tutorialSeen": "1",
  } satisfies Record<string, string>);
  // Stall the greeting mp3: the request fires (observable) but never
  // fulfills, so phase stays in greeting_audio deterministically — no race
  // with the clip ending, mirroring the existing pause/resume spec.
  await page.route("**/audio/storyteller/greet-*.mp3", () => {
    /* never fulfill */
  });
  let greetRequests = 0;
  page.on("request", (r) => {
    if (/\/audio\/storyteller\/greet-\d+\.mp3/.test(r.url())) greetRequests += 1;
  });

  await page.goto("http://127.0.0.1:4123/Meridian/");
  const host = page.getByTestId("storyteller-home");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("storyteller-home-caption")).toContainText(
    expectedGreeting().slice(0, 24),
    { timeout: 10_000 },
  );
  // Let the asset manifest settle so the first-gesture listener is armed
  // (a tap that lands first is a harmless poke — tapFigureUntilGreet
  // retries it deterministically).
  await page.waitForTimeout(1000);

  // First gesture: the figure tap starts the greeting audio.
  await tapFigureUntilGreet(page, () => greetRequests, 1);
  await expect(host).toHaveAttribute("data-phase", "greeting_audio", {
    timeout: 10_000,
  });

  // The tour starts mid-greeting → the host yields (recedes, then null).
  await page.evaluate(() =>
    window.dispatchEvent(new Event("meridian:tour-walk-start")),
  );
  await expect(host).toHaveCount(0, { timeout: 10_000 });

  // The tour ends → the text-only return line wins once (copy G2).
  await page.evaluate(() =>
    window.dispatchEvent(new Event("meridian:tour-walk-end")),
  );
  await expect(page.getByText(TOUR_RETURN_LINE)).toBeVisible({
    timeout: 10_000,
  });

  // After the return line's hold, the follow-up greeting runs and waits
  // for a gesture again (owner ruling #1 — not a dead end).
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 20_000,
  });
  await expect(page.getByTestId("storyteller-home-caption")).toContainText(
    expectedGreeting().slice(0, 24),
    { timeout: 10_000 },
  );
  await page.waitForTimeout(500);

  // THE assertion: the post-tour figure tap starts the greeting mp3 —
  // the gesture flag was re-armed by the tour-kill fix. Pre-fix this
  // tap did nothing (flag still consumed) and greetRequests stayed at 1.
  await tapFigureUntilGreet(page, () => greetRequests, 2);
  await expect(host).toHaveAttribute("data-phase", "greeting_audio", {
    timeout: 10_000,
  });
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// R2 — red-team BREAK 2 regression: tour-kill AFTER natural end must NOT
// re-arm the gesture flag (no greeting replay).
// Path: greeting plays to natural end (tiny fixture) → tour starts+ends
// inside the 1500ms POST_AUDIO_HOLD_MS window (phase still "greeting_audio"
// but the element is dead) → return line → follow-up greeting arms →
// figure tap must NOT request a 2nd mp3. The builder's version reset the
// flag on phase alone and replayed the already-heard greeting.
// ---------------------------------------------------------------------------
test("R2: tour-kill after natural end does not replay the greeting", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await installAudioProbe(page.context());
  await page.addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
    } catch {
      /* private mode — ignore */
    }
  }, {
    "meridian.grandpaTour.lastDate": todayKey(), // suppress the real tour UI
    "meridian.tutorialSeen": "1",
  } satisfies Record<string, string>);
  // The tiny fixture ends in ~0.07s — fast enough to land the tour-kill
  // inside the 1500ms post-end hold window deterministically.
  await page.route("**/audio/storyteller/greet-*.mp3", fulfillTinyMp3);
  let greetRequests = 0;
  page.on("request", (r) => {
    if (/\/audio\/storyteller\/greet-\d+\.mp3/.test(r.url())) greetRequests += 1;
  });

  await page.goto("http://127.0.0.1:4123/Meridian/");
  const host = page.getByTestId("storyteller-home");
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 10_000,
  });
  await page.waitForTimeout(1000);

  // Start the greeting and let the tiny clip play to natural end.
  await tapFigureUntilGreet(page, () => greetRequests, 1);
  await page.waitForTimeout(600); // clip ended; hold window still active
  await expect(host).toHaveAttribute("data-phase", "greeting_audio", {
    timeout: 10_000,
  });

  // Tour kills during the hold: phase says "greeting_audio" but the
  // element is dead — the flag must stay consumed (no replay).
  await page.evaluate(() =>
    window.dispatchEvent(new Event("meridian:tour-walk-start")),
  );
  await expect(host).toHaveCount(0, { timeout: 10_000 });
  await page.evaluate(() =>
    window.dispatchEvent(new Event("meridian:tour-walk-end")),
  );
  await expect(page.getByText(TOUR_RETURN_LINE)).toBeVisible({
    timeout: 10_000,
  });

  // Follow-up greeting arms after the return line's hold.
  await expect(host).toHaveAttribute("data-phase", "greeting_text", {
    timeout: 20_000,
  });
  await page.waitForTimeout(500);

  // THE assertion: the tap does NOT replay — still exactly 1 request.
  await tapFigure(page);
  await page.waitForTimeout(3000);
  expect(greetRequests, "no greeting replay after post-end tour-kill").toBe(1);
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// (2) J2 — black-box journey: mute → muted icon → unmute → icon back.
// Same mechanics as T2, asserted as the user's journey on the second
// story reveal (trigger="speaker"): the eyebrow toggle is the mute
// control, the storyteller speaker icon is the visible answer to
// "how do I know the mute works" (owner 2026-10-10).
// ---------------------------------------------------------------------------
test("J2: mute journey — eyebrow toggle drives the visible muted state", async ({
  page,
}) => {
  const errors = await reachSecondReveal(page);
  const speaker = page.getByTestId("storyteller-speaker");
  const eyebrow = page.getByTestId("sound-toggle-game");
  await expect(speaker).toBeVisible({ timeout: 10_000 });

  // Start: sound on. The eyebrow offers to turn it off; the storyteller
  // shows the unmuted speaker.
  await expect(eyebrow).toHaveAttribute("aria-label", "Turn sound off");
  const unmutedIcon = await speaker.locator("svg").first().innerHTML();

  // The user mutes → the storyteller visibly shows the muted state.
  await eyebrow.click();
  await expect(eyebrow).toHaveAttribute("aria-label", "Turn sound on", {
    timeout: 10_000,
  });
  await expect
    .poll(() => speaker.locator("svg").first().innerHTML(), { timeout: 10_000 })
    .not.toBe(unmutedIcon);

  // The user unmutes → the unmuted icon comes back.
  await eyebrow.click();
  await expect(eyebrow).toHaveAttribute("aria-label", "Turn sound off", {
    timeout: 10_000,
  });
  await expect
    .poll(() => speaker.locator("svg").first().innerHTML(), { timeout: 10_000 })
    .toBe(unmutedIcon);
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// (2) J3 — desktop journey: cursor tracking still works after the fix.
// The fix touched the figure's tap handler, not the pointer tracking —
// prove the head still follows the mouse (background-position of the
// 3x3 directions sheet changes with pointer side).
// ---------------------------------------------------------------------------
test("J3: cursor tracking — the figure's gaze follows the mouse", async ({
  page,
}) => {
  const errors = collectErrors(page);
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
  await page.goto("http://127.0.0.1:4123/Meridian/");
  const figure = page.getByTestId("storyteller-figure");
  await expect(figure).toBeVisible({ timeout: 20_000 });
  const layers = page.getByTestId("storyteller-figure-directions");
  await expect(layers).toBeAttached({ timeout: 10_000 });

  const bgPos = () =>
    layers.evaluate((el) => (el as HTMLElement).style.backgroundPosition);
  const box = (await figure.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const initial = await bgPos();
  // Move well right of the figure (outside the dead zone).
  await page.mouse.move(cx + 220, cy, { steps: 5 });
  await expect.poll(bgPos, { timeout: 10_000 }).not.toBe(initial);
  const rightPos = await bgPos();
  // Move well left — the gaze must swing to a different cell.
  await page.mouse.move(cx - 220, cy, { steps: 5 });
  await expect.poll(bgPos, { timeout: 10_000 }).not.toBe(rightPos);
  expectCleanConsole(errors);
});

// ---------------------------------------------------------------------------
// (3) Interaction matrix — narration state × figure tap, EVERY cell.
// idle → start (T1 walks it deeply; re-asserted here via the label oracle)
// playing → pause · paused → resume · failed → restart · ended → replay.
// The pre-fix matrix had a hole at idle (no-op); failed/ended are new
// branches from the same fix — each cell must transition correctly.
// ---------------------------------------------------------------------------
test("matrix: playing → tap pauses → tap resumes (element-level)", async ({
  page,
}) => {
  await page.route(MP3_PATTERN, fulfillLongMp3);
  const errors = await reachStoryScreen(page);
  await unmute(page);
  const figure = page.getByTestId("storyteller-figure");
  await expect(figure).toHaveAttribute("aria-label", "Play the story", {
    timeout: 10_000,
  });

  // idle → playing
  await tapFigure(page);
  await expect(figure).toHaveAttribute("aria-label", "Pause the story", {
    timeout: 15_000,
  });
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 15_000 })
    .toBe(false);

  // playing → paused (the element itself pauses)
  await tapFigure(page);
  await expect(figure).toHaveAttribute("aria-label", "Resume the story", {
    timeout: 10_000,
  });
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 10_000 })
    .toBe(true);

  // paused → playing again
  await tapFigure(page);
  await expect(figure).toHaveAttribute("aria-label", "Pause the story", {
    timeout: 10_000,
  });
  await expect
    .poll(async () => (await readAudioProbe(page))?.paused, { timeout: 10_000 })
    .toBe(false);
  expectCleanConsole(errors);
});

test("matrix: failed → figure tap restarts the narration", async ({
  page,
}) => {
  // Abort the clip → narration_failed → text-only fallback renders.
  let aborted = 0;
  await page.route(MP3_PATTERN, (route) => {
    aborted += 1;
    return route.abort("failed");
  });
  const errors = await reachStoryScreen(page);
  await unmute(page);
  const reqs = watchNarrationRequests(page);
  const figure = page.getByTestId("storyteller-figure");

  await tapFigure(page); // idle → attempt → fails
  await expect(page.getByTestId("storyteller-fallback")).toBeVisible({
    timeout: 15_000,
  });
  expect(aborted, "the clip request must hit the abort route").toBeGreaterThanOrEqual(1);
  // Failed oracle — fast attribute read, no poll: the 6 s text-only
  // auto-dismiss is already ticking, so the re-tap below must follow
  // immediately (a poll here can burn the budget and let the narration
  // unmount mid-test — a test race, not a product bug).
  const failedLabel = await figure.getAttribute("aria-label");
  expect(failedLabel, "failed state offers replay").toBe("Play the story");

  // THE new branch: a tap in failed state re-attempts playback.
  // Pre-fix this was a no-op — no second request, fallback stuck.
  await tapFigure(page);
  await expect
    .poll(() => reqs.count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
  // The aborted request logs net::ERR_FAILED — the forced failure itself.
  expectCleanConsole(errors, ["net::ERR_FAILED"]);
});

test("matrix: ended → figure tap replays the narration", async ({
  page,
}) => {
  // Register the tiny-mp3 route BEFORE page load (debug showed post-load
  // registration can leave the clip stuck playing).
  await page.route(MP3_PATTERN, fulfillTinyMp3);
  const errors = await reachStoryScreen(page);
  await unmute(page);
  // 0.2 s clip: ends deterministically, then the 3 s post-audio hold
  // dismisses — tap promptly once the ended label lands.
  const reqs = watchNarrationRequests(page);
  const figure = page.getByTestId("storyteller-figure");

  await tapFigure(page); // idle → playing
  await expect
    .poll(() => reqs.count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  // Ended oracle: the figure offers to play again.
  await expect(figure).toHaveAttribute("aria-label", "Play the story", {
    timeout: 15_000,
  });

  // THE new branch: a tap in ended state replays. Pre-fix: no-op.
  await tapFigure(page);
  await expect
    .poll(() => reqs.count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
  expectCleanConsole(errors);
});
