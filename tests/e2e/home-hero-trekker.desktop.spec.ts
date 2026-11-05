import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Home hero + trekker + doorway — production composition pins
 * (feat/home-rework-hero-trekker, owner ship word 2026-11-04).
 *
 * The home page used to render a static mountain picture, with the
 * animated designs reachable only behind a variant test harness
 * on design branches. The harness is gone; production (no query
 * params) renders the composed design unconditionally:
 *
 * (a) the hero carries the V1b trail overlay (marching dots,
 *     climbing pulse, summit flag, drifting clouds) AND the
 *     trekking-kid overlay (simplified child, two poles, slow
 *     climb), and the Capitals & Flags doorway appears exactly
 *     once — beside the About card, at compact density, with the
 *     shipped copy and its manifest-driven land count;
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
 * (f) the signpost card is sized by its own content, never by its
 *     row partner: its box equals its max-content box at desktop,
 *     tablet and phone widths, and growing or shrinking the About
 *     card's height leaves the signpost's box untouched (owner
 *     defect, 2026-11-05: the card "sizes to match" its grid
 *     track — 484px wide for 276px of content at desktop).
 *
 * Fail-on-main: unmodified main's game-app.tsx contains none of
 * the .hv5-trail / .hv5-trekker / .hv5-clouds / .hv5-about-row
 * selectors these tests query (grep-verified when this spec was
 * written), so every test here fails there.
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

test("production home composes trail + trekker + clouds and one doorway beside About", async ({
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

  // Exactly one doorway on the page, riding beside the About card
  // in the about row (the under-map instance is gone).
  await expect(page.locator(".hv5-doorway")).toHaveCount(1);
  await expect(page.locator(".hv5-about-row > .hv5-doorway")).toHaveCount(1);
  await expect(page.locator(".hv5-about-row > #home-about")).toHaveCount(1);
  await expect(page.locator(".hv5-rail .hv5-doorway")).toHaveCount(0);

  // Compact (slim) density + the shipped copy, word for word, with
  // the land count read from the live pack manifest (110 lands).
  const doorway = page.locator(".hv5-doorway");
  await expect(doorway).toHaveClass(/hv5-doorway-compact/);
  await expect(doorway.locator("h2")).toHaveText("Capitals & Flags");
  await expect
    .poll(
      async () =>
        doorway.evaluate((el) =>
          (el.querySelector("p")?.textContent ?? "").replace(/\s+/g, " ").trim(),
        ),
      { timeout: 20_000 },
    )
    .toBe("110 lands · Find the capital, learn its flag");
  // Signpost only (owner's pick, Veeresh, 2026-11-05: "Option C —
  // signpost only, no buttons"): the doorway renders NO buttons —
  // both former door testids are absent.
  await expect(page.getByTestId("pack-doorway-geodetective")).toHaveCount(0);
  await expect(page.getByTestId("pack-doorway-coldtrail")).toHaveCount(0);
  await expect(doorway.getByRole("button")).toHaveCount(0);

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

test("signpost card is sized by its own content, never by its row partner", async ({
  browser,
}) => {
  // Owner defect (2026-11-05): the Capitals & Flags signpost beside
  // About "sizes to match" — as a grid item it stretched to its
  // about-row column track (484px at desktop) instead of hugging
  // its own content (276px), so the row, not the card's content,
  // dictated the card's size. Pins, at 1440 / 768 / 390 widths:
  //  (1) the card's rendered box equals the box it takes at
  //      width:max-content — its own content plus its own padding;
  //  (2) growing the About card's content, then shrinking the
  //      About card hard, leaves the signpost's width and height
  //      untouched (in the stacked phone layout its y position
  //      naturally follows the About card; its size must not);
  //  (3) the desktop height stays the signpost's measured ~160px.
  // Fail-on-bb05d17: (1) fails at every width — the card rendered
  // 484.09 / 290 / 350 wide against 276.11 of content (measured).
  const WIDTHS = [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];
  const doorBox = (page: Page) =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="pack-doorway"]');
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width * 100) / 100, h: Math.round(b.height * 100) / 100 };
    });
  const stableDoorBox = async (page: Page) => {
    let prev = "";
    let box = await doorBox(page);
    for (let i = 0; i < 24; i++) {
      const cur = JSON.stringify(box);
      if (cur === prev) return box;
      prev = cur;
      await page.waitForTimeout(200);
      box = await doorBox(page);
    }
    return box;
  };

  for (const v of WIDTHS) {
    const context = await browser.newContext({ viewport: { width: v.width, height: v.height } });
    await serveBuiltArtifact(context);
    const page = await context.newPage();
    try {
      await page.goto(APP);
      const doorway = page.locator('[data-testid="pack-doorway"]');
      await expect(doorway).toBeVisible({ timeout: 30_000 });
      await expect(doorway).toContainText("lands", { timeout: 15_000 });
      await page.locator(".hv5-about-row").scrollIntoViewIfNeeded();

      const base = await stableDoorBox(page);
      expect(base, `doorway box at ${v.width}px`).not.toBeNull();

      // (1) Content-sized: same box the card takes at max-content.
      await page.evaluate(() => {
        const door = document.querySelector(
          '[data-testid="pack-doorway"]',
        ) as HTMLElement | null;
        if (door) door.style.width = "max-content";
      });
      const contentBox = await stableDoorBox(page);
      await page.evaluate(() => {
        const door = document.querySelector(
          '[data-testid="pack-doorway"]',
        ) as HTMLElement | null;
        if (door) door.style.width = "";
      });
      await stableDoorBox(page);
      expect(
        Math.abs((base?.w ?? 0) - (contentBox?.w ?? 0)),
        `signpost width at ${v.width}px should be its content width ${contentBox?.w}, not its row track`,
      ).toBeLessThanOrEqual(1.5);
      expect(Math.abs((base?.h ?? 0) - (contentBox?.h ?? 0))).toBeLessThanOrEqual(1.5);

      // (2a) Grow the About card: the signpost's size must not move.
      await page.evaluate(() => {
        const about = document.querySelector("#home-about");
        if (!about) return;
        for (let i = 0; i < 5; i++) {
          const p = document.createElement("p");
          p.textContent =
            "Probe paragraph: extra About copy added only to test whether the signpost card's box is coupled to its row partner's height.";
          p.setAttribute("data-probe", "grow");
          about.appendChild(p);
        }
      });
      const grown = await stableDoorBox(page);
      expect(Math.abs((grown?.w ?? 0) - (base?.w ?? 0))).toBeLessThanOrEqual(0.75);
      expect(Math.abs((grown?.h ?? 0) - (base?.h ?? 0))).toBeLessThanOrEqual(0.75);

      // (2b) Shrink the About card hard: same expectation.
      await page.evaluate(() => {
        const about = document.querySelector("#home-about") as HTMLElement | null;
        if (!about) return;
        about.querySelectorAll("[data-probe]").forEach((n) => n.remove());
        about.style.height = "140px";
        about.style.overflow = "hidden";
      });
      const shrunk = await stableDoorBox(page);
      expect(Math.abs((shrunk?.w ?? 0) - (base?.w ?? 0))).toBeLessThanOrEqual(0.75);
      expect(Math.abs((shrunk?.h ?? 0) - (base?.h ?? 0))).toBeLessThanOrEqual(0.75);
      await page.evaluate(() => {
        const about = document.querySelector("#home-about") as HTMLElement | null;
        if (about) {
          about.style.height = "";
          about.style.overflow = "";
        }
      });

      // (3) The desktop signpost height is the measured ~160px.
      if (v.width === 1440) {
        expect(base?.h ?? 0).toBeGreaterThanOrEqual(155);
        expect(base?.h ?? 0).toBeLessThanOrEqual(166);
      }
    } finally {
      await context.close();
    }
  }
});
