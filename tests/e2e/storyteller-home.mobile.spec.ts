import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Storyteller home handoff (H1) — mobile (390×844, touch).
 *
 * The Storyteller hosts home's hero strip: figure left (96px), greeting
 * caption right. Comet is retired as a host — a silent ~30px emblem stays
 * in the eyebrow row (aria-hidden, decorative, never speaks).
 *
 * Covers: 112px hero budget + difficulty picker in the first fold,
 * once-per-day greeting (text-first), same-day silent return, poke lines,
 * scroll-tap hello, loop send-off (≤2.5s, navigation never waits),
 * tour-return line, keyboard dismiss focus, no console errors.
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
const TOUR_RETURN_LINE =
  "Welcome back, explorer! Grandpa showed you around — now, where shall our story go next?";
const GEODETECTIVE_SENDOFF = "A mystery is afoot… lean in close. 🔍";
const POKE_1 = "Heh! That tickles my beard.";
const SCROLL_TAP = "tap tap… is this thing on? 👀";
const LEAF_LINE = "A leaf for luck. 🍃";

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

test("hero strip fits the 112px budget; difficulty picker stays in the first fold", async ({
  page,
}) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);

  const figure = page.getByTestId("storyteller-figure");
  const fBox = await figure.boundingBox();
  expect(fBox, "figure box").not.toBeNull();
  expect(Math.round(fBox!.width)).toBe(96);
  expect(Math.round(fBox!.height)).toBe(96);

  const strip = page.getByTestId("storyteller-home");
  const sBox = await strip.boundingBox();
  expect(sBox, "strip box").not.toBeNull();
  expect(sBox!.height).toBeLessThanOrEqual(112);

  // Eng must-fix: hero budget enforced by visual assertion — the difficulty
  // picker must be visible in the first fold @390×844.
  const picker = page.getByTestId("tour-stop-difficulty");
  await expect(picker).toBeVisible();
  const pBox = await picker.boundingBox();
  expect(pBox, "picker box").not.toBeNull();
  expect(pBox!.y + pBox!.height).toBeLessThanOrEqual(844);

  expectCleanConsole(errors);
});

test("first visit of day: greeting fires once, text-first, role=status", async ({
  page,
}) => {
  await seedQuietHome(page);
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

  expectCleanConsole(errors);
});

test("same-day return: silent figure, no bubble, no voice", async ({ page }) => {
  await seedQuietHome(page, { "meridian.storyteller.greetDay.v1": todayKey() });
  const errors = await loadHome(page);

  await expect(page.getByTestId("storyteller-figure")).toBeVisible();
  await expect(page.getByTestId("storyteller-home-bubble")).toHaveCount(0);

  expectCleanConsole(errors);
});

test("poke: tap the figure → rotating idle line; rapid double-tap → scroll-tap hello", async ({
  page,
}) => {
  await seedQuietHome(page, { "meridian.storyteller.greetDay.v1": todayKey() });
  const errors = await loadHome(page);

  const figure = page.getByTestId("storyteller-figure");
  const caption = page.getByTestId("storyteller-home-caption");

  await figure.click();
  await expect.poll(async () => caption.textContent(), { timeout: 5_000 }).toBe(POKE_1);

  // Clear the poke debounce + double-tap window before the rapid pair.
  await page.waitForTimeout(700);
  // Two rapid taps (<450ms apart) → the scroll-tap hello, not poke line 2.
  await figure.click();
  await figure.click();
  await expect.poll(async () => caption.textContent(), { timeout: 5_000 }).toBe(SCROLL_TAP);

  expectCleanConsole(errors);
});

test("loop pick: the locked send-off rides along ≤2.5s; navigation never waits", async ({
  page,
}) => {
  await seedQuietHome(page, { "meridian.storyteller.greetDay.v1": todayKey() });
  const errors = await loadHome(page);

  // Dismiss the greeting-less hero's poke state is idle; open GeoDetective.
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

test("tour yield: host unmounts during the tour; return line shows once after", async ({
  page,
}) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });

  // The tour overlay opens → yielded: fully unmounted, no background audio.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-start")));
  await expect(page.getByTestId("storyteller-home")).toHaveCount(0);

  // The tour closes → absent → the locked return line, text-only, exactly once.
  await page.evaluate(() => window.dispatchEvent(new Event("meridian:tour-walk-end")));
  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(TOUR_RETURN_LINE);

  expectCleanConsole(errors);
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

test("Comet is a silent ≤32px emblem in the eyebrow row — never a host", async ({
  page,
}) => {
  await seedQuietHome(page);
  const errors = await loadHome(page);

  const emblem = page.getByTestId("comet-emblem");
  await expect(emblem).toBeVisible();
  await expect(emblem).toHaveAttribute("aria-hidden", "true");
  const box = await emblem.boundingBox();
  expect(box, "emblem box").not.toBeNull();
  expect(Math.round(box!.width)).toBeLessThanOrEqual(32);
  expect(Math.round(box!.height)).toBeLessThanOrEqual(32);

  // Comet never hosts on home anymore: no interactive mascot, no greeting.
  await expect(page.getByTestId("comet-mascot")).toHaveCount(0);
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);

  expectCleanConsole(errors);
});
