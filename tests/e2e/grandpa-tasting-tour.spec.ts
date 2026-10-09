import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Grandpa's Tasting Tour E2E — mobile-only screenplay (≤1023.5px).
 *
 * Beats: compass-rose origin (~1s) → the tasting tour (grandpa walks a
 * dotted S-trail down the gutters, STOPS at each option — difficulty,
 * GeoDetective, editions, review when present — turns to look, sips ~1.2s,
 * walks on; silent, untappable mid-walk, hard-capped at 25s) → the kettle
 * top-up at the pour waypoint above the park strip → settle (seated on the
 * bench, trail fades to ~18%, donation cloud with Veeresh's exact copy).
 *
 * Covers: trail clearance (never inside an interactive rect +2px) across
 * 360/390px × dark/light × tour shown/hidden × deck present/absent; stops
 * at each option; the top-up pour (kettle + mug fill); settle + cloud copy
 * + gate workflow (Ko-fi new tab, Cancel/Esc revert); once-per-day replay;
 * once-per-session ask; reduced-motion static scene; offline hidden.
 *
 * Runs in the dedicated "grandpa-tour" project (mobile viewport 390x844,
 * touch) — see playwright.config.ts.
 *
 * Build requirement: the test artifact must be built with the Ko-fi URL, e.g.
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 * Analytics env vars (VITE_GA4_MEASUREMENT_ID / VITE_CLARITY_PROJECT_ID) are
 * intentionally OMITTED from the test build.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const KOFI_URL = process.env.VITE_KOFI_URL?.trim();
if (!KOFI_URL) {
  throw new Error(
    "E2E requires VITE_KOFI_URL at build time: " +
      "VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages",
  );
}

const TOUR_DATE_KEY = "meridian.grandpaTour.lastDate";
const DECK_KEY = "meridian:review-deck:v1";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

async function loadHome(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("grandpa-scene")).toBeVisible({
    timeout: 20_000,
  });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

/** Seed a due review-deck entry + the learningOutcomes flag (deck present). */
async function seedDeck(page: Page): Promise<void> {
  await page.context().route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ flags: { learningOutcomes: true } }),
    }),
  );
  await page.addInitScript((key: string) => {
    const deck = {
      v: 1,
      entries: {
        "e2e-seed": {
          v: 1,
          place: {
            id: "e2e-seed",
            name: "Seed Place",
            lon: 0,
            lat: 0,
            story: "seed",
            difficulty: "easy",
            edition: "globe",
            regionId: "globe",
            regionName: "Globe",
            sourceLabel: "seed",
            sourceHref: "https://example.com",
            mapMode: "flat",
            radiusKm: 50,
          },
          streak: 0,
          nextDueAt: Date.now() - 1000,
          lastReviewedAt: 0,
          reviews: 0,
        },
      },
    };
    localStorage.setItem(key, JSON.stringify(deck));
  }, DECK_KEY);
}

async function waitForWalkStage(page: Page): Promise<void> {
  await expect(page.getByTestId("grandpa-tour")).toHaveAttribute(
    "data-tour-stage",
    "walk",
    { timeout: 20_000 },
  );
}

async function waitForSeated(page: Page): Promise<void> {
  await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
    "data-beat",
    "seated",
    { timeout: 45_000 },
  );
}

/**
 * Sample ~100 points along the rendered trail and assert none falls inside
 * any interactive rect (+2px margin). One evaluate call so the page's
 * auto-scroll can't skew the measurement mid-sample.
 */
async function expectTrailClear(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    const path = document.querySelector(
      '[data-testid="grandpa-tour-path"]',
    ) as unknown as SVGPathElement | null;
    if (!path) return ["no tour path rendered"];
    // SVG user units → viewport px. NOTE: path.getBoundingClientRect() is
    // the path geometry's bbox, NOT the SVG viewport — getScreenCTM() is
    // the correct mapping.
    const ctm = path.getScreenCTM();
    if (!ctm) return ["no screen CTM for the tour path"];
    const total = path.getTotalLength();
    const rects: Array<{ l: number; t: number; r: number; b: number }> = [];
    document
      .querySelectorAll(
        'main.atlas-home button, main.atlas-home a[href], main.atlas-home input, main.atlas-home select, main.atlas-home textarea, main.atlas-home [role="button"]',
      )
      .forEach((el) => {
        const b = (el as HTMLElement).getBoundingClientRect();
        if (b.width > 0 && b.height > 0) {
          const m = 2;
          rects.push({ l: b.left - m, t: b.top - m, r: b.right + m, b: b.bottom + m });
        }
      });
    const bad: string[] = [];
    const N = 100;
    for (let i = 0; i <= N; i++) {
      const pt = path.getPointAtLength((total * i) / N);
      const x = ctm.a * pt.x + ctm.c * pt.y + ctm.e;
      const y = ctm.b * pt.x + ctm.d * pt.y + ctm.f;
      for (const rc of rects) {
        if (x >= rc.l && x <= rc.r && y >= rc.t && y <= rc.b) {
          bad.push(`trail point ${i}/${N} at (${x.toFixed(1)}, ${y.toFixed(1)}) inside interactive rect`);
          break;
        }
      }
      if (bad.length >= 5) break;
    }
    return bad;
  });
  expect(violations, "trail overlaps an interactive rect").toEqual([]);
}

const WIDTHS = [360, 390];
const SCHEMES = ["dark", "light"] as const;

for (const width of WIDTHS) {
  for (const scheme of SCHEMES) {
    test.describe(`${width}px · ${scheme}`, () => {
      test.use({ viewport: { width, height: 844 }, colorScheme: scheme });

      test("trail never overlaps interactives — full tour, no deck", async ({
        page,
      }) => {
        const errors = await loadHome(page);
        await waitForWalkStage(page);
        await expectTrailClear(page);
        expectCleanConsole(errors);
      });

      test("trail never overlaps interactives — full tour, deck present", async ({
        page,
      }) => {
        await seedDeck(page);
        const errors = await loadHome(page);
        // The deck section must render before the tour measures (~1.6s).
        await expect(page.getByTestId("tour-stop-review")).toBeVisible({
          timeout: 8_000,
        });
        await waitForWalkStage(page);
        await expectTrailClear(page);
        expectCleanConsole(errors);
      });

      test("trail never overlaps interactives — return visit (faint trail)", async ({
        page,
      }) => {
        const key = todayKey();
        await page.addInitScript(
          ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
          { k: TOUR_DATE_KEY, v: key },
        );
        const errors = await loadHome(page);
        // No replay: seated immediately, faint trail, no walker.
        await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
          "data-beat",
          "seated",
          { timeout: 10_000 },
        );
        await expect(page.getByTestId("grandpa-tour")).toHaveAttribute(
          "data-tour-stage",
          "faint",
          { timeout: 15_000 },
        );
        await expect(page.getByTestId("grandpa-tour-walker")).toHaveCount(0);
        await expectTrailClear(page);
        expectCleanConsole(errors);
      });
    });
  }
}

test("walker stops at each option, looks, sips, walks on", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const tour = page.getByTestId("grandpa-tour");
  await waitForWalkStage(page);
  const stopIds = [
    "tour-stop-difficulty",
    "tour-stop-geodetective",
    "tour-stop-editions",
  ];
  const walker = page.getByTestId("grandpa-tour-walker");

  for (let i = 0; i < stopIds.length; i++) {
    // The walker dwells at stop i (sip phase, 0.8s). Sample the bounding box
    // twice inside the sip window — the walk bob (±3px) is the only expected
    // motion — and confirm the phase is still "sip" so a late poll can't
    // mistake the next leg's first steps for the dwell. The 250ms gap keeps
    // both samples inside the 800ms sip window even under load.
    await expect(tour).toHaveAttribute("data-stop-index", String(i), {
      timeout: 60_000,
    });
    const box1 = await walker.boundingBox();
    await page.waitForTimeout(250);
    const box2 = await walker.boundingBox();
    await expect(tour).toHaveAttribute("data-tour-phase", "sip", {
      timeout: 2_000,
    });
    expect(box1 && box2, "walker has a bounding box while sipping").toBeTruthy();
    expect(
      Math.abs(box1!.x - box2!.x),
      `walker dwells at stop ${i} (x)`,
    ).toBeLessThan(12);
    // Sip beat: during the dwell the mug arm plays the deliberate
    // raise-and-hold drink, not the subtle periodic walk sip.
    const sipAnim = await page.evaluate(() => {
      const arm = document.querySelector(
        '[data-testid="grandpa-tour"] .mug-arm',
      );
      return arm ? getComputedStyle(arm).animationName : null;
    });
    expect(sipAnim, `mug plays sip-drink at stop ${i}`).toBe("sip-drink");
    expect(
      Math.abs(box1!.y - box2!.y),
      `walker dwells at stop ${i} (y)`,
    ).toBeLessThan(12);
    const cardBox = await page.getByTestId(stopIds[i]).boundingBox();
    expect(cardBox, `stop card ${stopIds[i]} has a box`).not.toBeNull();
    const wcx = box2!.x + box2!.width / 2;
    const wcy = box2!.y + box2!.height / 2;
    expect(
      wcy,
      `walker vertically near stop ${i}`,
    ).toBeGreaterThan(cardBox!.y - 80);
    expect(wcy, `walker vertically near stop ${i}`).toBeLessThan(
      cardBox!.y + cardBox!.height + 80,
    );
    const dx = Math.max(
      cardBox!.x - wcx,
      0,
      wcx - (cardBox!.x + cardBox!.width),
    );
    expect(dx, `walker horizontally near stop ${i}`).toBeLessThan(130);
  }
  expectCleanConsole(errors);
});

test("top-up: the kettle pours and the mug fills at the pour waypoint", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const tour = page.getByTestId("grandpa-tour");
  await waitForWalkStage(page);
  // Fast-forward through the stops to the pour.
  await expect(tour).toHaveAttribute("data-tour-beat", "pour", {
    timeout: 60_000,
  });
  const kettle = page.getByTestId("grandpa-tour-kettle");
  await expect
    .poll(
      async () =>
        parseFloat(await kettle.evaluate((el) => getComputedStyle(el).opacity)),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0.5);
  const stream = page.getByTestId("grandpa-tour-kettle-stream");
  await expect
    .poll(
      async () =>
        parseFloat(await stream.evaluate((el) => getComputedStyle(el).opacity)),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0.5);
  // The mug fills while the pour lands (fill group rises to translateY(0)).
  await expect
    .poll(
      async () => {
        const t = await page
          .getByTestId("grandpa-tour-mug-fill")
          .evaluate((el) => getComputedStyle(el).transform);
        if (t === "none") return 0;
        const m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
        return m ? parseFloat(m[1]) : 999;
      },
      { timeout: 5_000 },
    )
    .toBeLessThan(10);
  expectCleanConsole(errors);
});

test("settle: faint trail, Veeresh's cloud copy, gate workflow", async ({
  page,
}) => {
  // Stub window.open to capture the Ko-fi call without hitting the network.
  await page.addInitScript(() => {
    (window as unknown as { __opened: unknown[] }).__opened = [];
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      (window as unknown as { __opened: unknown[] }).__opened.push({
        url: String(url),
        target,
        features,
      });
      return null;
    }) as typeof window.open;
  });
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  await waitForSeated(page);
  const tour = page.getByTestId("grandpa-tour");
  await expect(tour).toHaveAttribute("data-tour-stage", "settled", {
    timeout: 10_000,
  });
  // The trail fades to ~15–20% over ~2s.
  const trailOpacityNow = () =>
    page
      .getByTestId("grandpa-tour-path")
      .evaluate((el) => parseFloat(getComputedStyle(el).opacity));
  await expect
    .poll(trailOpacityNow, { timeout: 10_000 })
    .toBeLessThan(0.3);
  expect(await trailOpacityNow()).toBeGreaterThan(0.1);

  // Veeresh's exact copy (2026-10-07, parent-directed).
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expect(bubble).toContainText("Your support keeps Meridian free for kids");

  // Tap the cloud → gate → Continue opens Ko-fi in a new tab, cloud reverts.
  await page.getByTestId("grandpa-bubble-ask").click();
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  const gate = page.getByTestId("grandpa-cloud-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("Ask a grown-up!");
  await page.getByTestId("grandpa-cloud-continue").click();
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(1);
  const call = opened[0] as { url: string; target: string; features: string };
  expect(call.url).toBe(KOFI_URL);
  expect(call.target).toBe("_blank");
  expect(call.features).toContain("noopener");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");

  // Tap grandpa → gate → Cancel reverts without opening anything.
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  await page.getByTestId("grandpa-cloud-cancel").click();
  await expect(bubble).toHaveAttribute("data-cloud", "ask");

  // Esc reverts too.
  await page.getByTestId("grandpa-bubble-ask").click();
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  await page.keyboard.press("Escape");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("skip tour: button settles the tour immediately", async ({ page }) => {
  const errors = await loadHome(page);
  await waitForWalkStage(page);
  const skip = page.getByTestId("tour-skip");
  await expect(skip).toBeVisible();
  // ≥44px tap target, the one interactive element in the tour plane.
  const box = await skip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
  await skip.click();
  // Same end-state as a completed walk: seated finale, faint trail, the
  // parent-directed ask per normal session logic.
  await waitForSeated(page);
  await expect(page.getByTestId("grandpa-tour")).toHaveAttribute(
    "data-tour-stage",
    "settled",
    { timeout: 10_000 },
  );
  await expect(page.getByTestId("grandpa-donation-bubble")).toContainText(
    "Grown-ups — buy me a coffee? ☕",
  );
  expectCleanConsole(errors);
});

test("manual scroll opts out of auto-scroll; the walk continues", async ({
  page,
}) => {
  const errors = await loadHome(page);
  await waitForWalkStage(page);
  const tour = page.getByTestId("grandpa-tour");
  // Fresh load starts at top → the snap posture.
  await expect(tour).toHaveAttribute("data-tour-scroll", "snap", {
    timeout: 10_000,
  });
  // A real user scroll gesture opts out of all further auto-scroll.
  await page.mouse.wheel(0, 600);
  await expect(tour).toHaveAttribute("data-tour-scroll", "optout", {
    timeout: 10_000,
  });
  // The walk itself continues — only the camera yields to the player.
  await expect(tour).toHaveAttribute("data-tour-stage", "walk", {
    timeout: 5_000,
  });
  expectCleanConsole(errors);
});

test("no snap-to-top when the user already scrolled", async ({ page }) => {
  const errors = await loadHome(page);
  // Programmatic pre-scroll: does NOT trip the wheel/touchmove opt-out,
  // isolating the snap decision itself.
  await page.evaluate(() => window.scrollTo(0, 500));
  await waitForWalkStage(page);
  const tour = page.getByTestId("grandpa-tour");
  await expect(tour).toHaveAttribute("data-tour-scroll", "nosnap", {
    timeout: 10_000,
  });
  expectCleanConsole(errors);
});

test("origin caption appears, then fades with the tour", async ({ page }) => {
  const errors = await loadHome(page);
  await waitForWalkStage(page);
  const caption = page.getByTestId("tour-caption");
  await expect(caption).toContainText("Grandpa's rounds");
  await waitForSeated(page);
  // Faded out once settled. (Playwright's toBeHidden ignores opacity, so
  // assert computed style directly — poll because the fade is a 0.5s
  // transition.)
  const captionOpacity = () =>
    caption.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
  await expect.poll(captionOpacity, { timeout: 10_000 }).toBeLessThan(0.1);
  expectCleanConsole(errors);
});

test("once per day: seeded date → seated immediately, no replay", async ({
  page,
}) => {
  const key = todayKey();
  await page.addInitScript(
    ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
    { k: TOUR_DATE_KEY, v: key },
  );
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  // No 20s walk: seated within seconds.
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 10_000,
  });
  // The tour never walked: no walker, no sip stops observed.
  await expect(page.getByTestId("grandpa-tour-walker")).toHaveCount(0);
  await expect(page.getByTestId("grandpa-tour")).toHaveAttribute(
    "data-tour-phase",
    "walk",
    { timeout: 15_000 },
  );
  expectCleanConsole(errors);
});

test("ask once per session: reload hides the cloud", async ({ page }) => {
  const errors = await loadHome(page);
  await waitForSeated(page);
  // First settle shows the ask…
  await expect(page.getByTestId("grandpa-donation-bubble")).toContainText(
    "Grown-ups — buy me a coffee? ☕",
  );
  // …a same-session reload (same calendar day) keeps grandpa seated but
  // the ask stays shown only once per session.
  await page.reload();
  await expect(page.getByTestId("grandpa-scene")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
    "data-beat",
    "seated",
    { timeout: 10_000 },
  );
  await expect(page.getByTestId("grandpa-donation-bubble")).toHaveCount(0);
  expectCleanConsole(errors);
});

test.describe("reduced motion", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    hasTouch: true,
    isMobile: true,
  });

  test("static seated scene: no trail, no walker", async ({ page }) => {
    const errors = await loadHome(page);
    const scene = page.getByTestId("grandpa-scene");
    await expect(scene).toHaveAttribute("data-beat", "seated", {
      timeout: 10_000,
    });
    // No tour layer at all — a static trail would imply motion.
    await expect(page.getByTestId("grandpa-tour")).toHaveCount(0);
    await expect(page.getByTestId("grandpa-tour-path")).toHaveCount(0);
    await expect(page.getByTestId("grandpa-tour-walker")).toHaveCount(0);
    // The seated finale + CTA are statically present.
    const seatedOpacity = await page
      .locator(".pose-seated")
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(seatedOpacity)).toBeGreaterThan(0.9);
    const bubble = page.getByTestId("grandpa-donation-bubble");
    await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
    expectCleanConsole(errors);
  });
});

test("Comet plush sits static on the bench; ask copy unchanged", async ({
  page,
}) => {
  // Veeresh 2026-10-07: a static Comet plush on the bench's right end —
  // set dressing, zero animation.
  const key = todayKey();
  await page.addInitScript(
    ({ k, v }: { k: string; v: string }) => localStorage.setItem(k, v),
    { k: TOUR_DATE_KEY, v: key },
  );
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  // No 20s walk: seated within seconds.
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 10_000,
  });
  // The park vignette fades in when he sits down — wait it out.
  await expect
    .poll(
      async () =>
        parseFloat(
          await page
            .getByTestId("grandpa-park")
            .evaluate((el) => getComputedStyle(el).opacity),
        ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0.9);
  // The plush is present when seated.
  const plush = page.getByTestId("grandpa-comet-plush");
  await expect(plush).toHaveCount(1);
  const box = await plush.boundingBox();
  expect(box, "plush has a bounding box").not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
  // Static: no CSS animation on the plush itself.
  const animName = await plush.evaluate(
    (el) => getComputedStyle(el).animationName,
  );
  expect(animName, "plush has no CSS animation").toBe("none");
  // Veeresh's ask copy is unchanged.
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expect(bubble).toContainText("Your support keeps Meridian free for kids");
  expectCleanConsole(errors);
});

test("offline hides grandpa entirely", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await context.setOffline(true);
  await page.goto(APP);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("grandpa-scene")).toHaveCount(0);
  await expect(page.getByTestId("grandpa-tour")).toHaveCount(0);
  await context.setOffline(false);
  const relevant = errors.filter(
    (e) =>
      !e.includes("ERR_INTERNET_DISCONNECTED") &&
      !e.includes("Minified React error #418"),
  );
  expect(relevant, `unexpected errors: ${JSON.stringify(relevant)}`).toEqual([]);
});
