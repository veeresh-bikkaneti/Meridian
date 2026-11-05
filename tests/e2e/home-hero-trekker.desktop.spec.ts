import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Home hero + trekker — production composition pins
 * (feat/home-rework-hero-trekker, owner ship word 2026-11-04;
 * doorway removed 2026-11-05, see (f) below).
 *
 * The home page used to render a static mountain picture, with the
 * animated designs reachable only behind a variant test harness
 * on design branches. The harness is gone; production (no query
 * params) renders the composed design unconditionally:
 *
 * (a) the hero carries the V1b trail overlay (marching dots,
 *     climbing pulse, summit flag, drifting clouds) AND the
 *     trekking-kid overlay (simplified child, two poles, slow
 *     climb);
 * (b) the motion actually runs — the trekker's SMIL master clock
 *     advances and the pulse travels the trail;
 * (c) with prefers-reduced-motion emulated, the hero lands on its
 *     still state: no clouds, no pulse, the trekker's clock paused
 *     on the mid-climb frame with the figure visible;
 * (d) the Save-Data / low-memory cohort (no OS reduced-motion)
 *     lands on the same still: no clouds, no pulse, the trail's
 *     dot march and flag wave killed by the JS-reflected still
 *     class, the trekker's clock paused;
 * (e) a mid-session flip from reduced-motion to no-preference
 *     lifts the gate and the trekker's clock resumes advancing
 *     instead of staying paused on the still frame.
 * (f) RETIRED 2026-11-05: this spec also pinned the Capitals &
 *     Flags doorway beside About (presence, copy, and finally the
 *     heights-match pin). The owner removed the card from Home
 *     entirely (Veeresh, 2026-11-05: "card is not clickable. if
 *     its not clickable then there is no point of putting it on
 *     home page."), so the doorway pins are gone with their
 *     subject; the composition test now pins the doorway's
 *     ABSENCE instead.
 *
 * Fail-on-main: unmodified main's game-app.tsx contains none of
 * the .hv5-trail / .hv5-trekker / .hv5-clouds selectors these
 * tests query (grep-verified when this spec was written), so
 * every test here fails there.
 */
test.setTimeout(240_000);

const APP = "http://127.0.0.1:4123/Meridian/";

async function openHome(
  browser: Browser,
  opts: { reducedMotion?: "reduce" | "no-preference"; saveData?: boolean } = {},
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: opts.reducedMotion ?? "no-preference",
  });
  if (opts.saveData) {
    // Save-Data cohort, forced before any app code runs: the hero's
    // mount gate reads navigator.connection.saveData (deviceMemory
    // pinned low as the second signal, the helpers.ts pattern).
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "connection", {
        get: () => ({ saveData: true }),
        configurable: true,
      });
      Object.defineProperty(Navigator.prototype, "deviceMemory", {
        get: () => 1,
        configurable: true,
      });
    });
  }
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await page.goto(APP);
  await expect(page.locator(".hv5-mtn-wrap")).toBeVisible({ timeout: 30_000 });
  return page;
}

test("production home composes trail + trekker + clouds and no doorway", async ({
  browser,
}) => {
  const page = await openHome(browser);
  try {

  // All three hero layers mounted on the sliced mountain wrap.
  await expect(page.locator(".hv5-trail")).toBeAttached();
  await expect(page.locator(".hv5-trekker")).toBeAttached();
  await expect(page.locator(".hv5-clouds")).toBeAttached();
  await expect(page.locator(".hv5-trail-pulse")).toBeAttached();
  await expect(page.locator(".hv5-trail-flag")).toBeAttached();

  // The Capitals & Flags doorway is gone from Home entirely
  // (owner's word, Veeresh, 2026-11-05: "card is not clickable.
  // if its not clickable then there is no point of putting it on
  // home page."): no doorway element, no about-row wrapper, and
  // the About card stands in the pages band on its own.
  await expect(page.locator(".hv5-doorway")).toHaveCount(0);
  await expect(page.getByTestId("pack-doorway")).toHaveCount(0);
  await expect(page.locator(".hv5-about-row")).toHaveCount(0);
  await expect(page.locator(".hv5-pages > #home-about")).toHaveCount(1);
  await expect(page.locator("#home-about")).toBeVisible();

  } finally {
    await page.context().close();
  }
});

test("hero motion runs: trekker clock advances and the pulse travels", async ({
  browser,
}) => {
  const page = await openHome(browser);
  try {

  // Bring the hero on screen first: Chromium does not tick
  // animation frames for off-viewport content, so sampling from
  // the top of the page would read frozen values even though the
  // layers animate.
  await page.locator(".hv5-mtn-wrap").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const clock1 = await page.evaluate(
    () => (document.querySelector(".hv5-trekker") as unknown as SVGSVGElement).getCurrentTime(),
  );
  const pulse1 = await page.evaluate(() => {
    const r = document.querySelector(".hv5-pulse-core")!.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
  await page.waitForTimeout(1500);
  const clock2 = await page.evaluate(
    () => (document.querySelector(".hv5-trekker") as unknown as SVGSVGElement).getCurrentTime(),
  );
  const pulse2 = await page.evaluate(() => {
    const r = document.querySelector(".hv5-pulse-core")!.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });

  expect(clock2 - clock1, "trekker SMIL clock should advance").toBeGreaterThan(0.8);
  expect(
    Math.abs(pulse2.x - pulse1.x) + Math.abs(pulse2.y - pulse1.y),
    "pulse should travel along the trail",
  ).toBeGreaterThan(2);

  } finally {
    await page.context().close();
  }
});

test("reduced motion: hero shows the still — no clouds or pulse, trekker clock paused mid-climb", async ({
  browser,
}) => {
  const page = await openHome(browser, { reducedMotion: "reduce" });
  try {

  // Trail still: static dots + flag only; the animated layers are
  // never rendered under the gate.
  await expect(page.locator(".hv5-trail")).toBeAttached();
  await expect(page.locator(".hv5-trail-dots")).toBeAttached();
  await expect(page.locator(".hv5-clouds")).toHaveCount(0);
  await expect(page.locator(".hv5-trail-pulse")).toHaveCount(0);
  const dotsAnimation = await page.evaluate(
    () => getComputedStyle(document.querySelector(".hv5-trail-dots")!).animationName,
  );
  expect(dotsAnimation).toBe("none");

  // Trekker still: the figure is visible (mid-climb frame) and the
  // SMIL clock is paused — polled until the still settles (a
  // boot-time remount restarts the svg, and its still effect needs
  // a beat to re-pause the fresh clock at 7.25s), then sampled
  // twice to prove it does not advance.
  await expect(page.locator(".hv5-trekker")).toBeAttached();
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const svg = document.querySelector(".hv5-trekker") as unknown as SVGSVGElement;
          const t = svg.getCurrentTime();
          return svg.animationsPaused() && t > 7 && t < 7.5;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  const still1 = await page.evaluate(() => {
    const svg = document.querySelector(".hv5-trekker") as unknown as SVGSVGElement;
    return { t: svg.getCurrentTime(), paused: svg.animationsPaused() };
  });
  await page.waitForTimeout(1200);
  const still2 = await page.evaluate(
    () => (document.querySelector(".hv5-trekker") as unknown as SVGSVGElement).getCurrentTime(),
  );
  expect(still1.paused).toBe(true);
  expect(still2).toBe(still1.t);
  expect(still1.t).toBeGreaterThan(7);
  expect(still1.t).toBeLessThan(7.5);
  // The rig (the trekker svg's first group) sits at SMIL opacity 1
  // on the 7.25s frame — the child is fully faded in, poles planted.
  // Polled: a boot-time remount restarts the svg, and its still
  // effect needs a beat to re-pause the fresh clock at 7.25s.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const rig = document.querySelector(".hv5-trekker")!.querySelector("g")!;
          return Number(getComputedStyle(rig).opacity);
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0.9);
  } finally {
    await page.context().close();
  }
});

test("save-data cohort: hero shows the still — no clouds or pulse, march + wave killed, trekker paused", async ({
  browser,
}) => {
  // No OS reduced-motion here: the still must come from the
  // Save-Data / low-memory mount gate alone, and the CSS dot march
  // + flag wave (which no media query reaches in this cohort) must
  // be killed by the JS-reflected .hv5-trail-still class. This case
  // MUST fail on the pre-cure code: before the cure the trail SVG
  // carried no still class and the dots + flag computed
  // animation-name was the live march/wave, not "none".
  const page = await openHome(browser, { saveData: true });
  try {

  await expect(page.locator(".hv5-trail")).toBeAttached();
  await expect(page.locator(".hv5-trail")).toHaveClass(/hv5-trail-still/);
  await expect(page.locator(".hv5-trail-dots")).toBeAttached();
  await expect(page.locator(".hv5-clouds")).toHaveCount(0);
  await expect(page.locator(".hv5-trail-pulse")).toHaveCount(0);
  const trailAnimations = await page.evaluate(() => ({
    dots: getComputedStyle(document.querySelector(".hv5-trail-dots")!).animationName,
    flag: getComputedStyle(document.querySelector(".hv5-trail-flag")!).animationName,
  }));
  expect(trailAnimations.dots).toBe("none");
  expect(trailAnimations.flag).toBe("none");

  // Trekker still, same as the reduced-motion case: clock paused
  // on the mid-climb frame, sampled twice, it does not advance.
  await expect(page.locator(".hv5-trekker")).toBeAttached();
  const still1 = await page.evaluate(() => {
    const svg = document.querySelector(".hv5-trekker") as unknown as SVGSVGElement;
    return { t: svg.getCurrentTime(), paused: svg.animationsPaused() };
  });
  await page.waitForTimeout(1200);
  const still2 = await page.evaluate(
    () => (document.querySelector(".hv5-trekker") as unknown as SVGSVGElement).getCurrentTime(),
  );
  expect(still1.paused).toBe(true);
  expect(still2).toBe(still1.t);
  expect(still1.t).toBeGreaterThan(7);
  expect(still1.t).toBeLessThan(7.5);

  } finally {
    await page.context().close();
  }
});

test("motion gate flips mid-session: trekker clock resumes when reduced motion lifts", async ({
  browser,
}) => {
  const page = await openHome(browser, { reducedMotion: "reduce" });
  try {

  // Settle on the still first (polled, for the same boot-remount
  // reason the reduced-motion test polls rig opacity): paused on
  // the mid-climb frame, and it stays there.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const svg = document.querySelector(".hv5-trekker") as unknown as SVGSVGElement;
          return svg.animationsPaused() && svg.getCurrentTime() > 7 && svg.getCurrentTime() < 7.5;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  const frozen = await page.evaluate(
    () => (document.querySelector(".hv5-trekker") as unknown as SVGSVGElement).getCurrentTime(),
  );
  await page.waitForTimeout(800);
  const frozen2 = await page.evaluate(
    () => (document.querySelector(".hv5-trekker") as unknown as SVGSVGElement).getCurrentTime(),
  );
  expect(frozen2).toBe(frozen);

  // Lift the gate mid-session: the shared hook is live, so the
  // still flips false — and the trekker effect must un-pause the
  // SMIL clock, not leave it frozen at 7.25 forever.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".hv5-clouds")).toBeAttached({ timeout: 15_000 });
  await expect(page.locator(".hv5-trail-pulse")).toBeAttached({ timeout: 15_000 });
  await expect(page.locator(".hv5-trail")).not.toHaveClass(/hv5-trail-still/);

  await page.locator(".hv5-mtn-wrap").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const resumed = await page.evaluate(() => {
    const svg = document.querySelector(".hv5-trekker") as unknown as SVGSVGElement;
    return { t: svg.getCurrentTime(), paused: svg.animationsPaused() };
  });
  await page.waitForTimeout(1500);
  const later = await page.evaluate(
    () => (document.querySelector(".hv5-trekker") as unknown as SVGSVGElement).getCurrentTime(),
  );
  expect(resumed.paused).toBe(false);
  expect(later - resumed.t, "trekker SMIL clock should advance again after the flip").toBeGreaterThan(
    0.8,
  );

  } finally {
    await page.context().close();
  }
});
