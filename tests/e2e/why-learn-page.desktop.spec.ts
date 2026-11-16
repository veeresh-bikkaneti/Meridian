import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Why Do We Learn This? — the owner's A+B layout (2026-11-13, checklist
 * t352u). Targeted spec for this one screen:
 *
 * - all three age groups (7-10, 10-18, 18+) at 1280 and 390: same layout,
 *   only the ages line changes; a screenshot of each for the PR;
 * - each ready card is one button whose accessible name starts with the
 *   subject name and shows an "N cases" pill; Journals is "Coming soon",
 *   disabled and out of the Tab order;
 * - Tab order is Home, then the montage controls, then the band
 *   control (the "Change band" option — this spec seeds a band, so
 *   the control is in its collapsed set state; amendment
 *   2026-11-15), then the cards left to right, top to bottom, each
 *   with a visible focus outline;
 * - the hero slot carries the montage film (feat/why-learn-montage):
 *   autoplay, muted, looping, poster-filled, in a fixed box, with
 *   pause / replay / sound controls; under reduced motion the hero
 *   is the montage poster's still picture with alt text and no film;
 *   the page montage wallpaper is a CSS background (nothing to focus
 *   or announce), and the formula drift is aria-hidden texture;
 * - no sideways scroll at 390/320, nothing clipped at 1280/1440;
 * - reduced motion: no card transition.
 */
test.setTimeout(180_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";
const BANDS = ["7-10", "10-18", "18+"] as const;
const SUBJECTS = ["Math", "Physics", "Chemistry", "General knowledge", "Social studies", "Journals"];
const SHOTS = process.env.WHY_LEARN_SHOTS_DIR;

async function openPicker(browser: Browser, width: number, height: number, band: string, reducedMotion = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    serviceWorkers: "block",
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  await serveBuiltArtifact(context);
  await context.addInitScript(
    ({ key, b }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ status: "active", band: b, updatedAt: new Date().toISOString(), changeCount: 0, schemaVersion: 2 }),
      );
    },
    { key: PROFILE_KEY, b: band },
  );
  const page = await context.newPage();
  await page.goto(APP_URL);
  await page.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-row-math")).toBeVisible({ timeout: 30_000 });
  return { context, page };
}

async function noSideways(page: Page, label: string) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  expect(sw, `${label}: page wider than the viewport`).toBeLessThanOrEqual(iw);
}

for (const vp of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  for (const band of BANDS) {
    test(`Why Learn A+B at ${vp.width} for ages ${band}`, async ({ browser }) => {
      const { context, page } = await openPicker(browser, vp.width, vp.height, band);
      const tag = `${vp.width} ages ${band}`;

      await expect(page.getByText(`Pick a subject · Ages ${band}`)).toBeVisible();

      // Hero: the montage film — autoplay, muted, looping, poster
      // first, fixed box (CSS aspect-ratio, no layout shift).
      const hero = page.locator("video.why-learn-hero");
      await expect(hero).toHaveAttribute("poster", /why-learn-montage-poster/);
      await expect(hero).toHaveAttribute("src", /why-learn-montage\.mp4/);
      const heroState = await hero.evaluate((el) => {
        const v = el as HTMLVideoElement;
        return { muted: v.muted, loop: v.loop, ratio: getComputedStyle(v).aspectRatio };
      });
      expect(heroState.muted, `${tag}: montage starts muted`).toBe(true);
      expect(heroState.loop, `${tag}: montage loops`).toBe(true);
      expect(heroState.ratio, `${tag}: hero aspect ratio`).toBe("16 / 9");
      // Its controls are real buttons with spoken labels.
      await expect(page.getByTestId("why-learn-hero-playpause")).toHaveAttribute("aria-label", /montage/);
      await expect(page.getByTestId("why-learn-hero-replay")).toHaveAttribute("aria-label", "Replay montage");
      await expect(page.getByTestId("why-learn-hero-sound")).toHaveAttribute("aria-pressed", "false");

      // Montage: decoration in CSS only.
      const montage = await page
        .getByTestId("subject-picker")
        .evaluate((el) => getComputedStyle(el, "::after").backgroundImage);
      expect(montage, `${tag}: montage is a CSS background`).toContain("why-learn-montage");

      // Cards: names start with the subject, count pill, Journals closed.
      const cards = page.locator('[data-testid^="subject-row-"]');
      await expect(cards).toHaveCount(SUBJECTS.length);
      for (const [i, subject] of SUBJECTS.entries()) {
        const card = cards.nth(i);
        const id = await card.getAttribute("data-testid");
        // Accessible name (not just text) starts with the subject name.
        const byName = page.getByRole("button", { name: new RegExp(`^${subject}\\b`) });
        await expect(byName.and(page.getByTestId(id!)), `${tag}: card ${i + 1} name starts with ${subject}`).toHaveCount(1);
        if (subject === "Journals") {
          await expect(card).toBeDisabled();
          await expect(card).toContainText("Coming soon");
        } else if (await card.isEnabled()) {
          await expect(card.locator(".why-learn-chip")).toHaveText(/^\d+ cases?$/);
          await expect(card).toContainText("Open case");
        }
      }

      // Tab order: Home, then the montage controls, then the band
      // control, then each enabled card in DOM (reading) order.
      await page.getByTestId("home-button").focus();
      for (const controlId of ["why-learn-hero-playpause", "why-learn-hero-replay", "why-learn-hero-sound"]) {
        await page.keyboard.press("Tab");
        const focusedId = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
        expect(focusedId, `${tag}: Tab order (montage controls)`).toBe(controlId);
      }
      await page.keyboard.press("Tab");
      const bandFocusedId = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
      expect(bandFocusedId, `${tag}: Tab order (band control)`).toBe("change-band-button");
      const enabled = await cards.evaluateAll((els) =>
        els.filter((e) => !(e as HTMLButtonElement).disabled).map((e) => e.getAttribute("data-testid")),
      );
      for (const id of enabled) {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return { id: el?.getAttribute("data-testid"), outline: el ? getComputedStyle(el).outlineStyle : "none" };
        });
        expect(focused.id, `${tag}: Tab order`).toBe(id);
        expect(focused.outline, `${tag}: focus ring on ${id}`).not.toBe("none");
      }
      // Reading order holds: each card starts at or below/right of the last.
      const boxes = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((b) => [b.top, b.left]));
      for (let i = 1; i < boxes.length; i++) {
        const [t0, l0] = boxes[i - 1];
        const [t1, l1] = boxes[i];
        expect(t1 > t0 + 1 || (Math.abs(t1 - t0) <= 1 && l1 > l0), `${tag}: card ${i + 1} follows card ${i}`).toBe(true);
      }

      await noSideways(page, tag);
      if (SHOTS) {
        await page.mouse.move(1, 1);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.screenshot({ path: `${SHOTS}/why-learn-${vp.width}-ages-${band.replace("+", "plus")}.png`, fullPage: true });
      }
      await context.close();
    });
  }
}

test("Why Learn: no sideways scroll at 320, nothing clipped at 1440", async ({ browser }) => {
  for (const vp of [
    { width: 320, height: 568 },
    { width: 1440, height: 900 },
  ]) {
    const { context, page } = await openPicker(browser, vp.width, vp.height, "10-18");
    await noSideways(page, `${vp.width}`);
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="subject-picker"] *')]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.right > innerWidth + 0.5 || b.left < -0.5);
        })
        .map((e) => e.className),
    );
    expect(clipped, `${vp.width}: elements past the viewport edge`).toEqual([]);
    await context.close();
  }
});

test("Why Learn under reduced motion: cards do not animate", async ({ browser }) => {
  const { context, page } = await openPicker(browser, 1280, 800, "10-18", true);
  // Reduced motion: the hero is the montage poster as a still —
  // no video element exists, so the film is never fetched.
  await expect(page.locator("video.why-learn-hero")).toHaveCount(0);
  const heroStill = page.locator("img.why-learn-hero");
  await expect(heroStill).toHaveAttribute("src", /why-learn-montage-poster/);
  await expect(heroStill).toHaveAttribute("alt", /gravity scene/);
  const card = page.getByTestId("subject-row-math");
  const transition = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
  // The app's global reduced-motion reset leaves 0.01ms; nothing visible.
  expect(transition.split(",").every((d) => parseFloat(d) <= 0.001), `transition ${transition}`).toBe(true);
  await card.hover();
  const transform = await card.evaluate((el) => getComputedStyle(el).transform);
  expect(transform).toBe("none");
  await context.close();
});

test("Why Learn at 2560: the page caps at the home width and the band control sits in the hero card", async ({ browser }) => {
  // fix/why-learn-picker-wide-layout: the picker used to lift the
  // shell's width cap entirely (lg:max-w-none), so on a wide monitor
  // the hero card and grid stretched to the viewport while the
  // height-driven film stayed a small slot at the card's left, and
  // the band control sat in its own row under the header. Now the
  // screen caps at the home page's max-w-7xl and the band control
  // lives inside the hero card's titles band.
  const { context, page } = await openPicker(browser, 2560, 1440, "10-18");
  const geo = await page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const picker = document.querySelector('[data-testid="subject-picker"]');
    const heroCard = document.querySelector(".screen-hero");
    const slot = document.querySelector(".why-learn-hero-wrap") ?? document.querySelector(".why-learn-hero");
    const band = document.querySelector('[data-testid="age-band-control"]');
    const grid = document.querySelector('[data-testid="subject-cards"]');
    const cards = [...document.querySelectorAll('[data-testid="subject-cards"] > li')].map((el) => box(el)!);
    const top0 = cards[0].y;
    const row1 = cards.filter((c) => Math.abs(c.y - top0) < 4);
    return { picker: box(picker), heroCard: box(heroCard), slot: box(slot), band: box(band), grid: box(grid), row1 };
  });
  expect(geo.picker!.width, "picker capped at the home page's 1280px, not stretched to 2560").toBe(1280);
  expect(geo.heroCard!.width, "hero card composes at the capped width").toBe(1240);
  expect(Math.abs(geo.slot!.width / geo.slot!.height - 16 / 9), "hero slot stays exactly 16:9").toBeLessThan(0.01);
  const b = geo.band!;
  const h = geo.heroCard!;
  expect(
    b.x >= h.x && b.y >= h.y && b.right <= h.right && b.bottom <= h.bottom,
    "the Change band control sits inside the hero card",
  ).toBe(true);
  expect(geo.row1.length, "four cards across at wide width").toBe(4);
  const widths = geo.row1.map((c) => c.width);
  expect(Math.max(...widths) - Math.min(...widths), "first-row cards share the row evenly").toBeLessThanOrEqual(1);
  expect(Math.abs(geo.row1[3].right - geo.grid!.right), "the first row fills the grid to its right edge").toBeLessThanOrEqual(1);
  await noSideways(page, "2560");
  await context.close();
});
