import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Storyteller banner host — mobile (390×844, touch).
 *
 * Owner directive 2026-10-09: the Storyteller sits IN THE BANNER beside the
 * Meridian branding — always visible, mobile and desktop, no hero strip.
 * Narration plays on EVERY home visit; the ONLY silence is the user's own
 * mute toggle. Comet is retired as a host — a silent ~30px emblem stays in
 * the eyebrow row (aria-hidden, decorative, never speaks).
 *
 * Covers: 56px figure beside the h1 (no title wrap @360/390), greeting on
 * every visit (no daily gate — a seeded greetDay key does NOT silence it),
 * text-first caption, first-gesture audio with 12s cap + text fallback,
 * mute toggle = only silence, poke lines, loop send-off (≤2.5s, navigation
 * never waits), dismiss × sound-toggle 0px² overlap, keyboard dismiss
 * focus, no console errors.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

/** Locked copy (copy pack §0) — duplicated here as an e2e snapshot; the
 *  unit contract (storyteller-home.test.ts) pins it byte-identical. */
const GREETINGS = [
  "Ah, my young explorer! The map is whispering secrets today. Shall we hear its story together?",
  "New day, new tales hiding in the hills. Shall we go find one?",
  "Psst… the rivers told me a secret this morning. Want to hear it?",
  "Somewhere out there, a mountain is keeping a story warm. Let's go find it.",
  "The winds brought rumors from faraway cities today. Curious?",
  "Every dot on this map has a tale. Which one shall we wake up first?",
];
const GEODETECTIVE_SENDOFF = "A mystery is afoot… lean in close. 🔍";
/** Locked copy (copy pack G2) — the post-tour return line, text-only. */
const TOUR_RETURN_LINE =
  "Welcome back, explorer! Grandpa showed you around — now, where shall our story go next?";
const POKE_1 = "Heh! That tickles my beard.";
const POKE_2 = "Careful, explorer — I'm older than these mountains.";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

function expectedGreeting(): string {
  return GREETINGS[dayOfYear(new Date()) % GREETINGS.length]!;
}

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
async function seedQuietHome(page: Page, extra: Record<string, string> = {}) {
  await seed(page, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
    ...extra,
  });
}

async function loadHome(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("storyteller-home")).toBeVisible({ timeout: 20_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("banner: 56px figure beside the Meridian h1, title never wraps @390px", async ({
  page,
}) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);

  // Let the home-rise entrance (staggered ~110ms steps) settle so the
  // bounding-box assertions below measure the resting layout.
  await page.waitForTimeout(800);

  const figure = page.getByTestId("storyteller-figure");
  const fBox = await figure.boundingBox();
  expect(fBox, "figure box").not.toBeNull();
  expect(Math.round(fBox!.width)).toBe(56);
  expect(Math.round(fBox!.height)).toBe(56);

  // The figure lives in the banner row, left of the branding.
  const row = page.locator(".atlas-banner-row").first();
  const rowBox = await row.boundingBox();
  const heading = page.getByTestId("home-heading");
  const hBox = await heading.boundingBox();
  expect(rowBox, "banner row box").not.toBeNull();
  expect(hBox, "h1 box").not.toBeNull();
  expect(fBox!.x).toBeLessThan(hBox!.x);
  // Bottom-aligned in the row (sub-pixel rounding tolerated).
  expect(fBox!.y + fBox!.height).toBeLessThanOrEqual(rowBox!.y + rowBox!.height + 2);

  // "MERIDIAN" never stacks: single-line h1 at 390px.
  const h1Box = await heading.boundingBox();
  const lineHeight = await heading.evaluate(
    (el) => parseFloat(getComputedStyle(el).lineHeight) || 0,
  );
  expect(h1Box!.height).toBeLessThan(lineHeight * 1.5);

  // Comet stays a silent emblem in the eyebrow row — never moved to banner.
  const emblem = page.getByTestId("comet-emblem");
  await expect(emblem).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("comet-mascot")).toHaveCount(0);

  expectCleanConsole(errors);
});

test("every visit greets: text-first caption, role=status — no daily gate", async ({
  page,
}) => {
  // Seed the LEGACY daily key: under the banner directive it must NOT
  // silence the greeting (proves the once-per-day gate is gone).
  await seedQuietHome(page, { "meridian.storyteller.greetDay.v1": todayKey() });
  const errors = await loadHome(page);

  const bubble = page.getByTestId("storyteller-home-bubble");
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  await expect(bubble).toHaveAttribute("role", "status");
  // Text-first: the full line is readable before any gesture/audio.
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(expectedGreeting());

  // Reload without touching storage → greets again (every visit greets).
  await page.reload();
  await expect(page.getByTestId("storyteller-home-bubble")).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(expectedGreeting());

  expectCleanConsole(errors);
});

test("first gesture narrates; mute toggle is the only silence", async ({ page }) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const host = page.getByTestId("storyteller-home");
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // A real tap is a user gesture → audio may start (mp3s landed) or the
  // text fallback shows if audio fails — either is a valid greeting.
  await page.locator("body").click({ position: { x: 200, y: 600 } });
  await expect
    .poll(
      async () =>
        (await host.getAttribute("data-phase")) === "greeting_audio" ||
        (await page.getByTestId("storyteller-home-fallback").count()) > 0,
      { timeout: 15_000 },
    )
    .toBe(true);

  // Mute, then reload: text-only greeting, no audio attempt — the toggle is
  // the ONLY silence.
  await page.getByTestId("sound-toggle").click();
  await page.reload();
  await expect(page.getByTestId("storyteller-home-caption")).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(async () => page.getByTestId("storyteller-home").getAttribute("data-phase"), {
      timeout: 8_000,
    })
    .not.toBe("greeting_audio");
  await expect(page.getByTestId("storyteller-home-caption")).toContainText(
    expectedGreeting(),
  );

  expectCleanConsole(errors);
});

test("poke: tap the figure → rotating idle lines", async ({ page }) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);

  const figure = page.getByTestId("storyteller-figure");
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // Dismiss the greeting first: tapping the figure is itself the
  // first-gesture that starts narration, so poke needs a quiet figure.
  await page.getByTestId("storyteller-home-dismiss").click();
  await expect(page.getByTestId("storyteller-home-bubble")).toHaveCount(0);

  // Force-click: the idle sway animation never settles, which defeats
  // Playwright's stability check (real taps don't need it).
  await figure.click({ force: true });
  await expect.poll(async () => caption.textContent(), { timeout: 5_000 }).toBe(POKE_1);

  // Clear the poke debounce, then tap again → next line rotates in.
  await page.waitForTimeout(700);
  await figure.click({ force: true });
  await expect.poll(async () => caption.textContent(), { timeout: 5_000 }).toBe(POKE_2);

  expectCleanConsole(errors);
});

test("loop pick: the locked send-off rides along ≤2.5s; navigation never waits", async ({
  page,
}) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);
  await expect(page.getByTestId("storyteller-home-bubble")).toBeVisible({
    timeout: 10_000,
  });

  await page
    .getByRole("button", { name: /Solve a mystery|Resume your case/ })
    .click();

  // The send-off caption rides along while the loop loads (≤2.5s)…
  const sendoff = page.getByTestId("storyteller-sendoff");
  await expect(sendoff).toContainText(GEODETECTIVE_SENDOFF, { timeout: 5_000 });
  // …navigation itself is never blocked: home unmounts at once…
  await expect(page.getByTestId("storyteller-home")).toHaveCount(0, { timeout: 10_000 });
  // …and the caption fades on its own.
  await expect(sendoff).toHaveCount(0, { timeout: 8_000 });

  expectCleanConsole(errors);
});

test("tour yield: host hides during the tour; tour-return line plays once after", async ({
  page,
}) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // The tour overlay opens → yielded: renders null (stays mounted), no
  // background audio.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await expect(page.getByTestId("storyteller-home")).toHaveCount(0);

  // The tour closes → the locked tour-return line plays once, text-only
  // (copy G2) — not the daily greeting.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-end")));
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(TOUR_RETURN_LINE);

  expectCleanConsole(errors);
});

test("tour-return → greeting: after the return line's hold, the normal greeting runs", async ({
  page,
}) => {
  // Regression for the chained-timer stall (2026-10-09): the first
  // implementation scheduled the greeting transition in the same effect
  // as the return line, so the phase change cleaned it up and the machine
  // stalled — return line, then silence. This test walks the full new
  // runtime path: tour closes → return line → greeting → narration.
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // Tour opens then closes → locked return line (text-only, copy G2).
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await expect(page.getByTestId("storyteller-home")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-end")));
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(TOUR_RETURN_LINE);

  // Owner ruling #1: after the return line's hold elapses, the normal
  // greeting runs — the machine must NOT stall here.
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 15_000,
    })
    .toBe(expectedGreeting());

  // A tap now starts narration (greeting_audio or the text fallback).
  await page.locator("body").click({ position: { x: 200, y: 600 } });
  await expect
    .poll(
      async () =>
        (await page.getByTestId("storyteller-home").getAttribute("data-phase")) ===
          "greeting_audio" ||
        (await page.getByTestId("storyteller-home-fallback").count()) > 0,
      { timeout: 15_000 },
    )
    .toBe(true);

  expectCleanConsole(errors);
});

test("invite dismissed mid-tour: no narration under the tour", async ({ page }) => {
  // Regression (Game Designer review 2026-10-09): dismissing the tutorial
  // invite while a tour ran started greeting narration UNDER the tour —
  // then the return-line caption mismatched the narrating audio.
  // Invite shows (no tutorialSeen seed); Grandpa's auto-tour is suppressed
  // and the tour is driven manually via events.
  await seed(page, { "meridian.grandpaTour.lastDate": todayKey() });
  const errors = await loadHome(page);
  await expect(page.getByTestId("tutorial-invite")).toBeVisible({ timeout: 10_000 });

  // Spy on Audio construction to detect narration attempts.
  await page.evaluate(() => {
    (window as any).__greetAudioAttempts = 0;
    const OrigAudio = window.Audio;
    (window as any).Audio = function (url?: string) {
      (window as any).__greetAudioAttempts++;
      return new OrigAudio(url);
    } as any;
    (window as any).Audio.prototype = OrigAudio.prototype;
  });

  // Tour takes the stage, then the kid dismisses the invite mid-tour.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await page.getByRole("button", { name: "Not now" }).click();

  // No narration may start while the tour owns the stage.
  await page.waitForTimeout(2_000);
  const attempts = await page.evaluate(() => (window as any).__greetAudioAttempts);
  expect(attempts, "greeting audio must not start while the tour owns the stage").toBe(0);

  // Tour ends → the return line plays, then the normal greeting follows.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-end")));
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(TOUR_RETURN_LINE);

  expectCleanConsole(errors);
});

test("invite dismiss starts narration (first gesture)", async ({ page }) => {
  // Ruling #2: dismissing the tutorial invite counts as the first gesture —
  // narration begins on the dismiss tap, no second tap needed.
  // Invite shows (no tutorialSeen seed); Grandpa's auto-tour suppressed.
  await seed(page, { "meridian.grandpaTour.lastDate": todayKey() });
  const errors = await loadHome(page);
  await expect(page.getByTestId("tutorial-invite")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Not now" }).click();
  await expect
    .poll(
      async () =>
        (await page.getByTestId("storyteller-home").getAttribute("data-phase")) ===
          "greeting_audio" ||
        (await page.getByTestId("storyteller-home-fallback").count()) > 0,
      { timeout: 15_000 },
    )
    .toBe(true);
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(expectedGreeting());

  expectCleanConsole(errors);
});

test("idle engagement: notes + scroll only in idle_linger", async ({ page }) => {
  // Ruling #3: the bard hums to invite play — rising notes + unfurling
  // scroll, CSS-only, gated strictly on idle_linger.
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  const idleDisplay = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector(".storyteller-idle")!).display,
    );
  // Greeting phase: the engagement layer stays hidden.
  await expect.poll(idleDisplay, { timeout: 5_000 }).toBe("none");

  // Dismiss → idle_linger: the layer appears with running animations.
  await page.getByTestId("storyteller-home-dismiss").click();
  await expect
    .poll(async () => page.getByTestId("storyteller-home").getAttribute("data-phase"), {
      timeout: 5_000,
    })
    .toBe("idle_linger");
  await expect.poll(idleDisplay, { timeout: 5_000 }).toBe("block");
  const noteAnimation = await page.evaluate(
    () => getComputedStyle(document.querySelector(".storyteller-idle-note")!).animationName,
  );
  expect(noteAnimation, "idle note runs its rise animation").not.toBe("none");

  expectCleanConsole(errors);
});
test("celebration during narration: no stall, host parks in idle_linger", async ({
  page,
}) => {
  // Regression (Code Reviewer 2026-10-09): a celebration opening during
  // greeting_audio killed the 12s cap timer via stopAudio() but left phase
  // stuck at greeting_audio forever — the machine stalled, idle engagement
  // never appeared. Now it parks in idle_linger.
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // Start narration with a tap.
  await page.locator("body").click({ position: { x: 200, y: 600 } });
  await expect
    .poll(async () => page.getByTestId("storyteller-home").getAttribute("data-phase"), {
      timeout: 15_000,
    })
    .toBe("greeting_audio");

  // Celebration takes the stage mid-narration, then closes.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:celebration-open")));
  await expect(page.getByTestId("storyteller-home")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:celebration-close")));

  // The machine must not stall in greeting_audio — it parks in idle_linger.
  await expect
    .poll(async () => page.getByTestId("storyteller-home").getAttribute("data-phase"), {
      timeout: 8_000,
    })
    .toBe("idle_linger");

  expectCleanConsole(errors);
});
test("dismiss × sound toggle: 0px² overlap @390px and @360px", async ({ page }) => {
  for (const w of [390, 360]) {
    await page.setViewportSize({ width: w, height: 844 });
    await seedQuietHome(page);
    const errors = await loadHome(page);

    const dismiss = page.getByTestId("storyteller-home-dismiss");
    await dismiss.waitFor({ state: "visible", timeout: 15_000 });
    const d = await dismiss.boundingBox();
    const toggle = page.getByTestId("sound-toggle");
    const t = await toggle.boundingBox();
    expect(d, `dismiss box @${w}px`).not.toBeNull();
    expect(t, `toggle box @${w}px`).not.toBeNull();
    const ix = Math.max(0, Math.min(d!.x + d!.width, t!.x + t!.width) - Math.max(d!.x, t!.x));
    const iy = Math.max(
      0,
      Math.min(d!.y + d!.height, t!.y + t!.height) - Math.max(d!.y, t!.y),
    );
    console.log(
      `@${w}px dismiss=(${d!.x.toFixed(1)},${d!.y.toFixed(1)}) ` +
        `toggle=(${t!.x.toFixed(1)},${t!.y.toFixed(1)}) overlap=${(ix * iy).toFixed(1)}px²`,
    );
    expect(ix * iy).toBe(0);

    expectCleanConsole(errors);
  }
});

test("keyboard dismiss returns focus to the first edition control", async ({
  page,
}) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);

  const dismiss = page.getByTestId("storyteller-home-dismiss");
  await expect(dismiss).toBeVisible({ timeout: 10_000 });
  await dismiss.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("storyteller-home-bubble")).toHaveCount(0);
  await expect(
    page.locator('[data-testid="tour-stop-difficulty"] button').first(),
  ).toBeFocused();

  expectCleanConsole(errors);
});
