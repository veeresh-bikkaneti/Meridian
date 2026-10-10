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

  // The figure lives in the banner row, right of the branding
  // (owner 2026-10-09).
  const row = page.locator(".atlas-banner-row").first();
  const rowBox = await row.boundingBox();
  const heading = page.getByTestId("home-heading");
  const hBox = await heading.boundingBox();
  expect(rowBox, "banner row box").not.toBeNull();
  expect(hBox, "h1 box").not.toBeNull();
  expect(fBox!.x).toBeGreaterThan(hBox!.x);
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

test("invite dismiss after tour: no greeting mp3 under the text-only return line", async ({
  page,
}) => {
  // Regression (owner panel BLOCK 1, 2026-10-09): dismissing the tutorial
  // invite AFTER the tour ran called beginGreetingAudio() without a mode
  // check — the greeting mp3 played UNDER the text-only return line while
  // the caption showed the locked copy. Invite shows (no tutorialSeen
  // seed); Grandpa's auto-tour is suppressed and the tour is driven
  // manually via events.
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

  // The tour opens and closes FIRST — the post-tour return line (text-only,
  // copy G2) is now the pending mode. The invite is still up, so the line
  // waits (started=false) until the kid dismisses the invite.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-end")));

  // Now the kid dismisses the invite — the dismiss tap must NOT start the
  // greeting mp3 under the text-only return line.
  await page.getByRole("button", { name: "Not now" }).click();
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(TOUR_RETURN_LINE);

  await page.waitForTimeout(2_000);
  const attempts = await page.evaluate(() => (window as any).__greetAudioAttempts);
  expect(attempts, "no greeting mp3 may play under the text-only return line").toBe(0);

  expectCleanConsole(errors);
});

test("poke startle + yield recede win over idle sway", async ({ page }) => {
  // Regression (owner panel BLOCK 2, 2026-10-09): a CSS specificity tie
  // let the infinite idle sway beat both the poke startle and the
  // yield-recede animations — both played invisible under the sway.
  // Part A — poke: force-click the swaying figure; the startle must win.
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const figure = page.getByTestId("storyteller-figure");
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // Dismiss into idle_linger (sway active). The dismiss tap is itself the
  // first gesture (narration starts, then dismiss stops it — existing
  // behavior, like the poke test above).
  await page.getByTestId("storyteller-home-dismiss").click();
  await expect
    .poll(async () => page.getByTestId("storyteller-home").getAttribute("data-phase"), {
      timeout: 5_000,
    })
    .toBe("idle_linger");

  // Force-click: the idle sway never settles, defeating the stability
  // check (real taps don't need it). Poll — the startle is a 480ms beat.
  await figure.click({ force: true });
  await expect
    .poll(async () => figure.evaluate((el) => getComputedStyle(el).animationName), {
      timeout: 3_000,
    })
    .toContain("homer-startle");

  // Part B — yield: fresh page, sway active, then the tour takes the
  // stage; the recede must beat the sway inside its 220ms window.
  await page.reload();
  const figure2 = page.getByTestId("storyteller-figure");
  await expect(page.getByTestId("storyteller-home-caption")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId("storyteller-home-dismiss").click();
  await expect
    .poll(async () => page.getByTestId("storyteller-home").getAttribute("data-phase"), {
      timeout: 5_000,
    })
    .toBe("idle_linger");

  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await expect
    .poll(
      async () => {
        try {
          return await figure2.evaluate((el) => getComputedStyle(el).animationName);
        } catch {
          // The host unmounts after the 220ms yield window — past it.
          return "";
        }
      },
      { timeout: 3_000, intervals: [10, 25, 50, 100] },
    )
    .toContain("homer-yield");

  expectCleanConsole(errors);
});

test("dismissing the return line still leads to the greeting", async ({ page }) => {
  // Regression (owner panel BLOCK 3, 2026-10-09): dismissing the tour-return
  // line cancelled its follow-up and the machine sat in silence forever —
  // contradicting owner ruling #1 (the greeting happens regardless).
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // Tour opens then closes → the locked return line (text-only, copy G2).
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await expect(page.getByTestId("storyteller-home")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-end")));
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(TOUR_RETURN_LINE);

  // The kid dismisses the return line — the follow-up greeting must still
  // run: the line's hold (6s) plus a fresh entering beat elapse first.
  await page.getByTestId("storyteller-home-dismiss").click();
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 15_000,
    })
    .toBe(expectedGreeting());

  expectCleanConsole(errors);
});

test("gesture under tour: no audio starts, greeting resumes after", async ({ page }) => {
  // Regression lock (owner panel BLOCK 4, 2026-10-09): the gesture
  // listener once fired under the tour (narration over the tour), and the
  // invite-dismiss narrated under the tour — both now guarded on yielded.
  // The invite-dismiss half is covered by "invite dismissed mid-tour: no
  // narration under the tour" (kept green below); this locks the gesture
  // half. It fails on current code only if the yielded guard were removed.
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

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

  // The tour owns the stage — wait for the yield to settle, then land a
  // synthetic first gesture mid-tour.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await expect(page.getByTestId("storyteller-home")).toHaveCount(0);
  await page.evaluate(
    () => window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );

  // No narration may start while the tour owns the stage.
  await page.waitForTimeout(2_000);
  const attempts = await page.evaluate(() => (window as any).__greetAudioAttempts);
  expect(attempts, "gesture audio must not start while the tour owns the stage").toBe(0);

  // Tour ends → the normal post-tour flow resumes: the return line first…
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-end")));
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(TOUR_RETURN_LINE);
  // …then the follow-up greeting (owner ruling #1).
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 15_000,
    })
    .toBe(expectedGreeting());

  expectCleanConsole(errors);
});

test("muted first tap shows the sound-off hint", async ({ page }) => {
  // Regression (owner panel BLOCK 5, 2026-10-09): with sound off, the
  // first tap silently consumed the narration opportunity — no cue for
  // the kid. Now a hint says the sound is off.
  await seed(page, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
    "meridian.sound": "off",
  });
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // Spy on Audio construction — muted must never construct one.
  await page.evaluate(() => {
    (window as any).__greetAudioAttempts = 0;
    const OrigAudio = window.Audio;
    (window as any).Audio = function (url?: string) {
      (window as any).__greetAudioAttempts++;
      return new OrigAudio(url);
    } as any;
    (window as any).Audio.prototype = OrigAudio.prototype;
  });

  // Synthetic first gesture — sound is off.
  await page.evaluate(
    () => window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );

  // The kid gets a cue — matched loosely; the exact hint copy lands with
  // the source fix.
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toMatch(/sound is off/i);

  // …and no audio was ever constructed.
  const attempts = await page.evaluate(() => (window as any).__greetAudioAttempts);
  expect(attempts, "muted must never construct audio").toBe(0);

  expectCleanConsole(errors);
});

test("muted tap keeps the one-shot: unmuting starts the tale", async ({ page }) => {
  // Regression (owner panel BLOCK 5 round 2, 2026-10-09): the muted-tap
  // hint promised "tap the speaker above to hear my tale", but the
  // one-shot was consumed while muted — unmuting + tapping played
  // nothing. Now the one-shot survives a muted tap, and unmuting starts
  // the pending tale, so the hint never lies.
  await seed(page, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
    "meridian.sound": "off",
  });
  const errors = await loadHome(page);
  const host = page.getByTestId("storyteller-home");
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() => {
    (window as any).__greetAudioAttempts = 0;
    const OrigAudio = window.Audio;
    (window as any).Audio = function (url?: string) {
      (window as any).__greetAudioAttempts++;
      return new OrigAudio(url);
    } as any;
    (window as any).Audio.prototype = OrigAudio.prototype;
  });

  // Muted first tap → hint, no audio, one-shot NOT consumed.
  await page.evaluate(
    () => window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toMatch(/sound is off/i);

  // Unmute via the real speaker toggle → the pending tale starts.
  await page.getByTestId("sound-toggle").click();
  await expect
    .poll(
      async () =>
        (await host.getAttribute("data-phase")) === "greeting_audio" ||
        (await page.evaluate(() => (window as any).__greetAudioAttempts)) > 0,
      { timeout: 15_000 },
    )
    .toBe(true);

  expectCleanConsole(errors);
});

test("hint popover: inside the viewport, dismiss never overlaps the caption", async ({
  page,
}) => {
  // Regression (owner 2026-10-09): after the figure moved right of the
  // branding, the popover's left: 0 anchoring pushed it off the viewport's
  // right edge — the dismiss × overlapped the hint text. The popover now
  // anchors right: 0 to the banner.
  await seed(page, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
    "meridian.sound": "off",
  });
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });
  await page.evaluate(
    () => window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  );
  await expect
    .poll(async () => caption.textContent(), { timeout: 8_000 })
    .toMatch(/sound is off/i);
  await page.waitForTimeout(300);

  const vw = page.viewportSize()?.width ?? 390;
  const pop = await page.getByTestId("storyteller-home-bubble").boundingBox();
  const dis = await page.getByTestId("storyteller-home-dismiss").boundingBox();
  const cap = await caption.boundingBox();
  expect(pop, "popover box").not.toBeNull();
  expect(dis, "dismiss box").not.toBeNull();
  expect(cap, "caption box").not.toBeNull();
  // Fully inside the viewport horizontally.
  expect(pop!.x).toBeGreaterThanOrEqual(0);
  expect(pop!.x + pop!.width).toBeLessThanOrEqual(vw + 1);
  // Dismiss × and caption text: 0px² intersection.
  const ix = Math.max(
    0,
    Math.min(dis!.x + dis!.width, cap!.x + cap!.width) - Math.max(dis!.x, cap!.x),
  );
  const iy = Math.max(
    0,
    Math.min(dis!.y + dis!.height, cap!.y + cap!.height) - Math.max(dis!.y, cap!.y),
  );
  expect(ix * iy, "dismiss × caption overlap").toBe(0);

  expectCleanConsole(errors);
});
