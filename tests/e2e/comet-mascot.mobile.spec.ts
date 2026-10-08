import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * CometMascot E2E — mobile (390×844, touch).
 *
 * Veeresh 2026-10-07: Comet hosts from the banner — in-flow, right of the
 * "Meridian" h1 in `.atlas-banner-row`, composed with a brass armillary
 * ring (64px mobile). The greeting bubble opens DOWNWARD (tail up), the
 * gaze is dampened (90px dead zone, head offsets ×0.6), and the
 * auto-greeting stays quiet while the first-run tutorial invite is up
 * (`suppressAuto`).
 *
 * Covers: banner position at 64px without covering CTAs or the tour
 * invite, bubble opens below without overlapping banner chrome, boop on
 * tap, dampened touch tracking, no console errors.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadHome(page: Page): Promise<string[]> {
  // Grandpa's Tasting Tour dismisses the transient greeting when the walk
  // starts — seed a return visit so the tour doesn't run and the greeting
  // stays for its full lifetime in these tests.
  await page.context().addInitScript(
    ({ k, v }: { k: string; v: string }) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* private mode — ignore */
      }
    },
    { k: "meridian.grandpaTour.lastDate", v: todayKey() },
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

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("renders in the banner at mobile size, clear of CTAs and the tour invite", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  const emblem = page.locator(".comet-emblem");
  const wrap = page.getByTestId("comet-wrap");
  const banner = page.locator(".atlas-banner-row");
  const h1 = page.locator("h1.atlas-title");

  const mBox = await mascot.boundingBox();
  // The layout box is the emblem lockup: the mascot SVG overflows it by
  // design (overflow: visible tail/sparkle), so containment checks use
  // the emblem, not the button's painted box.
  const eBox = await emblem.boundingBox();
  const bBox = await banner.boundingBox();
  const hBox = await h1.boundingBox();
  expect(mBox, "mascot has a box").not.toBeNull();
  expect(eBox, "emblem has a box").not.toBeNull();
  expect(bBox, "banner row has a box").not.toBeNull();
  expect(hBox, "h1 has a box").not.toBeNull();

  // 64px mobile.
  expect(mBox!.width).toBeGreaterThanOrEqual(60);
  expect(mBox!.width).toBeLessThanOrEqual(68);
  expect(mBox!.height).toBeGreaterThanOrEqual(60);
  expect(mBox!.height).toBeLessThanOrEqual(68);

  // In-flow, not fixed: the old bottom-right wrapper is retired.
  expect(await wrap.evaluate((el) => getComputedStyle(el).position)).toBe("relative");

  // Right of the h1's right edge, inside the banner row.
  expect(eBox!.x).toBeGreaterThanOrEqual(hBox!.x + hBox!.width);
  expect(eBox!.y).toBeGreaterThanOrEqual(bBox!.y - 2);
  expect(eBox!.y + eBox!.height).toBeLessThanOrEqual(bBox!.y + bBox!.height + 2);
  expect(eBox!.x + eBox!.width).toBeLessThanOrEqual(bBox!.x + bBox!.width + 2);

  // The banner zone is new overlap territory: the emblem must not touch
  // the invite, the sound toggle, the h1, or the tagline.
  noOverlap("Comet emblem", eBox, "sound toggle", await page.getByTestId("sound-toggle").boundingBox());
  noOverlap("Comet emblem", eBox, "h1", hBox);
  noOverlap("Comet emblem", eBox, "tagline", await page.locator(".atlas-tagline").boundingBox());
  const invite = page.getByTestId("tutorial-invite");
  if ((await invite.count()) > 0) {
    noOverlap("Comet emblem", eBox, "tour invite", await invite.boundingBox());
  }

  // Every CTA stays tappable: scrolled into view, its center must not be
  // under the mascot or the greeting.
  const ctas = [
    page.getByRole("button", { name: /solve a mystery|resume your case/i }),
    page.getByRole("button", { name: "Choose a state" }),
    page.getByRole("button", { name: "Choose a country" }),
    page.getByRole("button", { name: "Play the globe" }),
    page.getByTestId("sound-toggle"),
  ];
  for (const cta of ctas) {
    await cta.scrollIntoViewIfNeeded();
    const cbox = await cta.boundingBox();
    expect(cbox, "CTA has a bounding box").not.toBeNull();
    const top = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el as HTMLElement).outerHTML.slice(0, 120) : "none";
      },
      [cbox!.x + cbox!.width / 2, cbox!.y + cbox!.height / 2],
    );
    expect(
      top.includes("comet-mascot") || top.includes("comet-greeting"),
      `CTA center covered by mascot: ${top}`,
    ).toBe(false);
  }
  expectCleanConsole(errors);
});

test("greeting bubble opens below Comet, clear of banner chrome", async ({
  page,
}) => {
  const errors = await loadHome(page);
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  // The 220ms scale-in must settle or the box reads mid-animation.
  await page.waitForTimeout(450);

  const mBox = await page.getByTestId("comet-mascot").boundingBox();
  const gBox = await bubble.boundingBox();
  expect(mBox, "mascot has a box").not.toBeNull();
  expect(gBox, "bubble has a box").not.toBeNull();

  // Opens DOWNWARD (tail up): the bubble's top edge sits at/below the
  // emblem's bottom edge.
  expect(gBox!.y).toBeGreaterThanOrEqual(mBox!.y + mBox!.height - 2);

  // Covers no banner chrome.
  noOverlap("greeting", gBox, "sound toggle", await page.getByTestId("sound-toggle").boundingBox());
  noOverlap("greeting", gBox, "h1", await page.locator("h1.atlas-title").boundingBox());
  noOverlap("greeting", gBox, "tagline", await page.locator(".atlas-tagline").boundingBox());

  // Fully inside the viewport — the old fixed bubble's no-clip rule.
  expect(gBox!.x, "bubble left edge").toBeGreaterThanOrEqual(-1);
  expect(gBox!.x + gBox!.width, "bubble right edge").toBeLessThanOrEqual(390 + 1);

  await expect(page.getByTestId("comet-greeting")).toHaveCount(1);
  expectCleanConsole(errors);
});

test("tap boops the mascot", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await mascot.tap();
  await expect(mascot).toHaveAttribute("data-state", "booped");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 5000 });
  expectCleanConsole(errors);
});

test("greeting bubble is visible and dismissible on mobile", async ({ page }) => {
  const errors = await loadHome(page);
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  await bubble.tap();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  expectCleanConsole(errors);
});

test("tap on the page turns Comet's head toward the tap (touch tracking)", async ({ page }) => {
  // Veeresh 2026-10-06: on touch devices the mascot looks at the last tap.
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await expect(mascot).toHaveAttribute("data-tracking", "on");
  // Dismiss the invite so the greeting starts, then dismiss the greeting
  // so taps land on the page, not the bubble.
  await dismissInvite(page);
  const bubble = page.getByTestId("comet-greeting");
  if (await bubble.isVisible()) await bubble.tap();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);

  // Tap well outside the 90px dead zone: 160px left, 200px below the
  // emblem's center. The head turns toward the tap with dampened travel
  // (head max 3.0 units, pupils max 1.5).
  const mBox = await mascot.boundingBox();
  const tx = Math.max(20, Math.round(mBox!.x - 160));
  const ty = Math.min(824, Math.round(mBox!.y + mBox!.height / 2 + 200));
  const dist = Math.hypot(tx - (mBox!.x + mBox!.width / 2), ty - (mBox!.y + mBox!.height / 2));
  expect(dist, "tap is outside the 90px dead zone").toBeGreaterThan(90);
  await page.touchscreen.tap(tx, ty);
  const pupils = page.getByTestId("comet-pupils");
  await expect
    .poll(async () => pupils.getAttribute("style"), { timeout: 5000 })
    .not.toContain("translate(0px, 0px)");
  const pStyle = await pupils.getAttribute("style");
  const pm = pStyle?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  expect(pm, "pupil transform parses").not.toBeNull();
  expect(Math.max(Math.abs(parseFloat(pm![1])), Math.abs(parseFloat(pm![2])))).toBeLessThanOrEqual(
    1.5 + 0.01,
  );
  expectCleanConsole(errors);
});
