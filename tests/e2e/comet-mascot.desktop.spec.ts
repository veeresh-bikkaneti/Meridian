import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * CometMascot E2E — desktop (1440×900, fine pointer, full motion).
 *
 * Veeresh 2026-10-07: Comet hosts from the banner — in-flow, right of the
 * "Meridian" h1 in `.atlas-banner-row`, composed with a brass armillary
 * ring + dark-theme backplate (80px desktop). The fixed bottom-right
 * wrapper is retired. The greeting bubble opens DOWNWARD (tail up), the
 * gaze is dampened (90px dead zone, head offsets ×0.6), and the
 * auto-greeting stays quiet while the first-run tutorial invite is up
 * (`suppressAuto`).
 *
 * Covers: banner position (in-flow, right of h1, 72–88px), greeting
 * opens below without covering banner chrome, dampened gaze tracking,
 * armillary ring, dark-theme backplate, invite suppression, boop,
 * dizzy easter egg, autoplay gate, sound-off speaker opt-in, edition
 * reaction, no console errors.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

function expectedIndex(): number {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now.getTime() - jan1.getTime()) / 86_400_000) % 12;
}

async function loadHome(
  page: Page,
  opts: { sound?: "on" | "off" } = {},
): Promise<string[]> {
  await page.context().addInitScript(
    ({ sound }: { sound?: string }) => {
      try {
        // Set-if-absent: a reload must see the values the app itself wrote.
        if (sound && !localStorage.getItem("meridian.sound"))
          localStorage.setItem("meridian.sound", sound);
      } catch {
        /* private mode — ignore */
      }
    },
    opts,
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("comet-mascot")).toBeVisible({ timeout: 20_000 });
  return errors;
}

/**
 * Dismiss the first-run tutorial invite when present. While it is up,
 * `suppressAuto` keeps the auto-greeting quiet; dismissing it lets the
 * greeting start (once), so greeting-dependent tests call this first.
 */
async function dismissInvite(page: Page): Promise<void> {
  const invite = page.getByTestId("tutorial-invite");
  if ((await invite.count()) > 0) {
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(invite).toHaveCount(0);
  }
}

type Box = { x: number; y: number; width: number; height: number };

/** Two boxes overlap only if they share more than ~1px in both axes. */
function overlaps(a: Box, b: Box): boolean {
  const eps = 0.5;
  return (
    a.x + eps < b.x + b.width - eps &&
    b.x + eps < a.x + a.width - eps &&
    a.y + eps < b.y + b.height - eps &&
    b.y + eps < a.y + a.height - eps
  );
}

function noOverlap(nameA: string, a: Box | null, nameB: string, b: Box | null) {
  expect(a, `${nameA} has a bounding box`).not.toBeNull();
  expect(b, `${nameB} has a bounding box`).not.toBeNull();
  expect(overlaps(a!, b!), `${nameA} overlaps ${nameB}`).toBe(false);
}

/** The mascot must never sit on top of a CTA tap target. */
async function expectCtasUncovered(page: Page) {
  const ctas = [
    page.getByRole("button", { name: /solve a mystery|resume your case/i }),
    page.getByRole("button", { name: "Choose a state" }),
    page.getByRole("button", { name: "Choose a country" }),
    page.getByRole("button", { name: "Play the globe" }),
    page.getByTestId("sound-toggle"),
  ];
  for (const cta of ctas) {
    await cta.scrollIntoViewIfNeeded();
    const box = await cta.boundingBox();
    expect(box, "CTA has a bounding box").not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const top = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el as HTMLElement).outerHTML.slice(0, 120) : "none";
      },
      [cx, cy],
    );
    expect(
      top.includes("comet-mascot") || top.includes("comet-greeting"),
      `CTA center covered by mascot: ${top}`,
    ).toBe(false);
  }
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("Comet hosts from the banner: in-flow, right of the h1, desktop size", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  const wrap = page.getByTestId("comet-wrap");
  const banner = page.locator(".atlas-banner-row");
  const h1 = page.locator("h1.atlas-title");

  const mBox = await mascot.boundingBox();
  const bBox = await banner.boundingBox();
  const hBox = await h1.boundingBox();
  expect(mBox, "mascot has a box").not.toBeNull();
  expect(bBox, "banner row has a box").not.toBeNull();
  expect(hBox, "h1 has a box").not.toBeNull();

  // 72–88px desktop (80px emblem; bounding-box tolerance for subpixel).
  expect(mBox!.width).toBeGreaterThanOrEqual(72);
  expect(mBox!.width).toBeLessThanOrEqual(88);
  expect(mBox!.height).toBeGreaterThanOrEqual(72);
  expect(mBox!.height).toBeLessThanOrEqual(88);

  // In-flow, not fixed/absolute: the old bottom-right wrapper is retired.
  expect(await wrap.evaluate((el) => getComputedStyle(el).position)).toBe("relative");

  // Right of the h1's right edge, inside the banner row.
  expect(mBox!.x).toBeGreaterThanOrEqual(hBox!.x + hBox!.width);
  expect(mBox!.y).toBeGreaterThanOrEqual(bBox!.y - 2);
  expect(mBox!.y + mBox!.height).toBeLessThanOrEqual(bBox!.y + bBox!.height + 2);
  expect(mBox!.x + mBox!.width).toBeLessThanOrEqual(bBox!.x + bBox!.width + 2);

  await expectCtasUncovered(page);
  expectCleanConsole(errors);
});

test("greeting bubble opens below Comet and covers no banner chrome", async ({
  page,
}) => {
  const errors = await loadHome(page);
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  // The 220ms scale-in must settle or the box reads mid-animation.
  await page.waitForTimeout(450);

  const mBox = await page.getByTestId("comet-mascot").boundingBox();
  const gBox = await bubble.boundingBox();
  expect(mBox, "mascot has a box").not.toBeNull();
  expect(gBox, "bubble has a box").not.toBeNull();

  // Opens DOWNWARD (tail up): the bubble's top edge sits at/below the
  // emblem's bottom edge.
  expect(gBox!.y).toBeGreaterThanOrEqual(mBox!.y + mBox!.height - 2);

  // Covers nothing in the banner zone.
  noOverlap("greeting", gBox, "sound toggle", await page.getByTestId("sound-toggle").boundingBox());
  noOverlap("greeting", gBox, "h1", await page.locator("h1.atlas-title").boundingBox());
  noOverlap("greeting", gBox, "tagline", await page.locator(".atlas-tagline").boundingBox());
  expectCleanConsole(errors);
});

test("dampened gaze still tracks the pointer with smaller travel", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await expect(mascot).toHaveAttribute("data-tracking", "on");
  const head = page.locator(".comet-head");
  const pupils = page.getByTestId("comet-pupils");

  const readOffsets = async (): Promise<[number, number] | null> => {
    const style = await head.getAttribute("style");
    const m = style?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  };

  // Bottom-left corner: far outside the 90px dead zone → head turns SW.
  await page.mouse.move(60, 800);
  await expect
    .poll(async () => head.getAttribute("style"), { timeout: 5000 })
    .not.toContain("translate(0px, 0px)");
  const turned = await readOffsets();
  expect(turned, "head transform parses").not.toBeNull();
  const [dx, dy] = turned!;
  expect(dx, "SW = negative x").toBeLessThan(0);
  expect(dy, "SW = positive y").toBeGreaterThan(0);
  // Dampened: movement > 0 but below the old undampened max (5 SVG units;
  // 5 × 0.6 = 3.0 now).
  expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeGreaterThan(0.5);
  expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeLessThanOrEqual(3.0 + 0.01);
  // Pupils ride at half the head offset (dampened pupil max = 1.5).
  const pStyle = await pupils.getAttribute("style");
  const pm = pStyle?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  expect(pm, "pupil transform parses").not.toBeNull();
  expect(Math.max(Math.abs(parseFloat(pm![1])), Math.abs(parseFloat(pm![2])))).toBeLessThanOrEqual(
    1.5 + 0.01,
  );

  // Back onto the mascot: inside the 90px dead zone → neutral pose.
  const box = await mascot.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect
    .poll(async () => head.getAttribute("style"), { timeout: 5000 })
    .toContain("translate(0px, 0px)");
  expectCleanConsole(errors);
});

test("armillary ring renders as part of the emblem", async ({ page }) => {
  const errors = await loadHome(page);
  const ring = page.locator(".comet-armillary");
  await expect(ring).toHaveCount(1);
  const box = await ring.boundingBox();
  expect(box, "armillary ring has a box").not.toBeNull();
  // The ring overhangs the 80px emblem (inset -10px → ~100px).
  expect(box!.width).toBeGreaterThan(80);
  expectCleanConsole(errors);
});

test("backplate is hidden in light theme", async ({ page }) => {
  const errors = await loadHome(page);
  const plate = page.locator(".comet-backplate");
  await expect(plate).toHaveCount(1);
  expect(await plate.evaluate((el) => getComputedStyle(el).display)).toBe("none");
  expectCleanConsole(errors);
});

test.describe("dark theme", () => {
  test.use({ colorScheme: "dark" });

  test("backplate renders in dark theme for contrast", async ({ page }) => {
    const errors = await loadHome(page);
    const plate = page.locator(".comet-backplate");
    await expect(plate).toHaveCount(1);
    expect(await plate.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
    expect(
      parseFloat(await plate.evaluate((el) => getComputedStyle(el).opacity)),
    ).toBeGreaterThan(0);
    // The emblem is still the right size in dark theme.
    const mBox = await page.getByTestId("comet-mascot").boundingBox();
    expect(mBox!.width).toBeGreaterThanOrEqual(72);
    expect(mBox!.width).toBeLessThanOrEqual(88);
    expectCleanConsole(errors);
  });
});

test("auto-greeting stays quiet while the tutorial invite is up", async ({
  page,
}) => {
  const errors = await loadHome(page);
  // First run: the invite is visible, and the greeting must NOT auto-show.
  await expect(page.getByTestId("tutorial-invite")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  // Dismiss the invite → the greeting starts once.
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("comet-greeting")).toBeVisible({ timeout: 10_000 });
  expectCleanConsole(errors);
});

test("boop fires the squash reaction and resets", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await mascot.click();
  await expect(mascot).toHaveAttribute("data-state", "booped");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 5000 });
  expectCleanConsole(errors);
});

test("four quick boops trigger the dizzy easter egg", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  for (let i = 0; i < 4; i++) {
    await mascot.click({ delay: 60 });
  }
  await expect(mascot).toHaveAttribute("data-state", "dizzy", { timeout: 5000 });
  await expect(page.locator(".comet-svg")).toHaveAttribute("data-eyes", "dizzy");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 8000 });
  expectCleanConsole(errors);
});

test("greeting shows on every home page visit", async ({ page }) => {
  const errors = await loadHome(page);
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-greeting-index", String(expectedIndex()));
  const text = await page.getByTestId("comet-greeting-text").getAttribute("aria-label");
  expect(text).toBeTruthy();
  expect(text!.length).toBeGreaterThan(20);

  // Same-day reload → greeting again (Veeresh 2026-10-06: every visit,
  // not once per day; the invite stays dismissed so suppressAuto is off).
  await page.reload();
  await expect(page.getByTestId("comet-mascot")).toBeVisible();
  await expect(page.getByTestId("comet-greeting")).toBeVisible({ timeout: 10_000 });
  expectCleanConsole(errors);
});

test("autoplay gate: audio waits for the first gesture, then plays in sync", async ({ page }) => {
  const errors = await loadHome(page, { sound: "on" });
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-sound", "on");
  // No interaction yet → audio held.
  await expect(bubble).toHaveAttribute("data-audio", "idle");
  // First gesture anywhere → audio starts (or cleanly fails over).
  await page.mouse.click(200, 200);
  await expect
    .poll(async () => bubble.getAttribute("data-audio"), { timeout: 15_000 })
    .not.toBe("idle");
  const state = await bubble.getAttribute("data-audio");
  expect(["playing", "ended"]).toContain(state);
  expectCleanConsole(errors);
});

test("sound off: text greeting with speaker opt-in that leaves the toggle alone", async ({
  page,
}) => {
  const errors = await loadHome(page, { sound: "off" });
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-sound", "off");
  const speaker = page.getByTestId("comet-greeting-speaker");
  await expect(speaker).toBeVisible();
  await speaker.click();
  await expect
    .poll(async () => bubble.getAttribute("data-audio"), { timeout: 15_000 })
    .not.toBe("idle");
  // The global toggle is untouched by the opt-in.
  const sound = await page.evaluate(() => localStorage.getItem("meridian.sound"));
  expect(sound).toBe("off");
  expectCleanConsole(errors);
});

test("tap dismisses the greeting instantly", async ({ page }) => {
  const errors = await loadHome(page, { sound: "off" });
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await bubble.click();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  // Mascot stays put — only the bubble dismisses.
  await expect(page.getByTestId("comet-mascot")).toBeVisible();
  expectCleanConsole(errors);
});

test("picking an edition makes Comet look at the card and react", async ({ page }) => {
  // Veeresh 2026-10-06: tapping an edition card → Comet looks at the card,
  // does the happy boop, and shows an excited bubble.
  // Note: we dispatch the event directly rather than clicking a real card
  // button, because a real click navigates away from the home page (Comet
  // unmounts) before the reaction can be observed. The click→event wiring
  // is covered by the withCardTap unit path.
  const errors = await loadHome(page, { sound: "off" });
  await dismissInvite(page);
  // Dismiss the greeting so it doesn't overlap the reaction bubble.
  const bubble = page.getByTestId("comet-greeting");
  if (await bubble.isVisible()) await bubble.click();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  // Simulate the edition-card tap: game-app dispatches this on card click.
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("comet:edition-select", {
        detail: { x: 200, y: 300, edition: "Globe" },
      }),
    );
  });
  // Comet reacts: happy boop state + excited bubble naming the edition.
  const mascot = page.getByTestId("comet-mascot");
  await expect(mascot).toHaveAttribute("data-state", "booped", { timeout: 5000 });
  const reaction = page.getByTestId("comet-reaction");
  await expect(reaction).toBeVisible({ timeout: 5000 });
  await expect(reaction).toContainText("Globe");
  // The bubble clears itself after ~2.2s.
  await expect(reaction).toHaveCount(0, { timeout: 8000 });
  expectCleanConsole(errors);
});
