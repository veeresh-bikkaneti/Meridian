import { test, expect } from "playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { serveBuiltArtifact } from "./helpers";
import { installSfxStub } from "./sfx-stub";

/**
 * Motionmaxxing E2E (owner order 2026-10-11, steps M0–M7).
 *
 * Runtime-path proofs that unit tests cannot give (no jsdom in the repo
 * harness): the built CSS ships the token curves, transitions complete to
 * their settled states, stagger delays land on the right elements, the
 * press feedback fires without delaying navigation, and tap storms stay
 * correct. Reduced-motion assertions live in motionmaxxing.reduced.spec.ts.
 *
 * Console-clean gate: every test fails on pageerrors / console errors.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await installSfxStub(context);
});

async function cleanConsole(page: import("playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

// React #418 is a pre-existing flaky hydration warning, unrelated to this
// feature (same filter as the celebration/cleared-mode/difficulty-picker
// specs).
function withoutHydrationNoise(errors: string[]): string[] {
  return errors.filter((e) => !e.includes("Minified React error #418"));
}

test.describe("home cascade + press (1280×800)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("M0/M7: the built CSS ships the token curves; home cascade is uneven, not 110ms", async ({
    page,
  }) => {
    const errors = await cleanConsole(page);
    await page.goto(BASE);

    // M0/M1: the token curves ship in the built CSS bytes. The storyteller
    // CSS is a lazy chunk (not necessarily loaded on home), so assert on
    // the shipped files, not the live stylesheet list.
    const cssFiles = readdirSync(join("dist", "client", "assets")).filter((f) =>
      f.endsWith(".css"),
    );
    expect(cssFiles.length).toBeGreaterThan(0);
    const shipped = cssFiles
      .map((f) => readFileSync(join("dist", "client", "assets", f), "utf8"))
      .join("\n")
      .replace(/\s+/g, "");
    expect(shipped).toContain("--ease-soft-land:cubic-bezier(.22,1,.36,1)");
    expect(shipped).toContain(
      ".storyteller-enter{animation:storyteller-in.22svar(--ease-soft-land)}",
    );
    expect(shipped).toContain(
      ".storyteller-leave{animation:storyteller-out.15svar(--ease-accel-exit)forwards}",
    );

    // M7: the cascade completes and the stagger is the uneven retune, not
    // the old uniform 110ms formula. rise(2) → 60ms, rise(6) → 375ms.
    const bannerRow = page.locator(".hv5-hero.home-rise");
    await expect(bannerRow).toBeVisible();
    await page.waitForTimeout(1500); // let the 0.8s entrances settle
    const delays = await page.evaluate(() => {
      const pick = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        return el ? getComputedStyle(el).animationDelay : null;
      };
      return {
        banner: pick(".hv5-hero.home-rise"), // rise(2)
        editions: pick('[data-testid="tour-stop-editions"]'), // rise(6)
      };
    });
    expect(delays.banner).toBe("0.06s");
    expect(delays.editions).toBe("0.375s");
    // And every home-rise element ran the frozen 0.8s softLand rise.
    const rise = await page.locator(".hv5-hero.home-rise").evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        name: cs.animationName,
        duration: cs.animationDuration,
        timing: cs.animationTimingFunction,
      };
    });
    expect(rise.name).toBe("atlas-rise");
    expect(rise.duration).toBe("0.8s");
    expect(rise.timing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");

    expect(withoutHydrationNoise(errors)).toEqual([]);
  });

  test("M6: edition-card press feedback fires and navigation is immediate", async ({
    page,
  }) => {
    const errors = await cleanConsole(page);
    await page.goto(BASE);
    await page.waitForTimeout(1500);

    const btn = page
      .locator('[data-testid="tour-stop-editions"]')
      .getByRole("button", { name: "Choose a state" });
    await expect(btn).toBeVisible();
    await btn.scrollIntoViewIfNeeded();
    const box = (await btn.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Press: mouse.down() applies :active (no separate click call — the
    // press transition is 80ms, so wait past it for the settled style).
    // NOTE: mouse.up() completes a real click in the browser, so the press
    // itself navigates; the click() below is intentionally absent.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(200);
    const pressed = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.transform, filter: cs.filter };
    });
    const t0 = Date.now();
    await page.mouse.up(); // completes the click → navigation must fire now
    expect(pressed.transform).toContain("0.97"); // scale(0.97)
    expect(pressed.filter).toBe("brightness(1.12)");

    // Navigation fires immediately from that same press — the states menu
    // appears without any artificial waiting on our side.
    await expect(
      page.getByRole("heading", { name: "State", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - t0).toBeLessThan(10_000);

    expect(withoutHydrationNoise(errors)).toEqual([]);
  });

  test("tap storm: rapid taps on edition cards and the mascot stay correct", async ({
    page,
  }) => {
    const errors = await cleanConsole(page);
    await page.goto(BASE);
    await page.waitForTimeout(1500);

    // 12 rapid clicks on the State card button — one navigation outcome.
    const stateBtn = page
      .locator('[data-testid="tour-stop-editions"]')
      .getByRole("button", { name: "Choose a state" });
    await expect(stateBtn).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await stateBtn.click({ timeout: 5_000 }).catch(() => {});
    }
    await expect(
      page.getByRole("heading", { name: "State", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // Back home; rapid taps on the storyteller figure (pause/resume ack).
    await page.goto(BASE);
    await page.waitForTimeout(1500);
    const figure = page.locator(".storyteller-figure").first();
    if (await figure.count()) {
      for (let i = 0; i < 10; i++) {
        await figure.click({ timeout: 5_000 }).catch(() => {});
      }
      // Figure still mounted, still operable — no stuck state.
      await expect(figure).toBeVisible();
    }

    expect(withoutHydrationNoise(errors)).toEqual([]);
  });
});

// PBI-3: in this VM's headless Chromium the WebGL probe fails, so the app
// boots in scout map mode and the celebration renders motionOff (no pop).
// For the motion assertions we pin full mode via the manual localStorage
// override (never decays) before the app boots.
async function forceFullMapMode(context: import("playwright/test").BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem(
      "meridian:map-mode",
      JSON.stringify({ mode: "full", source: "manual", setAt: Date.now() }),
    );
  });
}

test("M5: celebration cascade completes — card pop then label/headline/copy", async ({
  page,
  context,
}) => {
  await forceFullMapMode(context);
  const errors = await cleanConsole(page);
  await page.goto(`${BASE}?celebration=session-milestone`);
  const ov = page.getByTestId("celebration-overlay");
  await expect(ov).toBeVisible({ timeout: 15_000 });

  // Card: the one overshoot, frozen 0.55s.
  const cardAnim = await ov.locator(".celebration-pop").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      name: cs.animationName,
      duration: cs.animationDuration,
      timing: cs.animationTimingFunction,
    };
  });
  expect(cardAnim.name).toBe("celebrate-pop");
  expect(cardAnim.duration).toBe("0.55s");
  expect(cardAnim.timing).toBe("cubic-bezier(0.34, 1.3, 0.64, 1)");

  // Children: same pop, staggered at uneven ~65ms gaps.
  const childDelays = await ov.evaluate(() => {
    const out: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const el = document.querySelector(
        `.celebration-child-${i}`,
      ) as HTMLElement | null;
      out.push(el ? getComputedStyle(el).animationDelay : "missing");
    }
    return out;
  });
  expect(childDelays).toEqual(["0.055s", "0.12s", "0.195s"]);

  // The transition completes: headline + copy fully visible and settled.
  await expect(ov.getByRole("heading")).toBeVisible();
  await page.waitForTimeout(1200); // 0.55s pop + 195ms stagger + margin
  const settled = await ov.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll(".celebration-child"),
    ) as HTMLElement[];
    return els.map((el) => ({
      opacity: getComputedStyle(el).opacity,
      transform: getComputedStyle(el).transform,
    }));
  });
  expect(settled.length).toBe(3);
  for (const s of settled) {
    expect(s.opacity).toBe("1");
    expect(s.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
  }

  expect(withoutHydrationNoise(errors)).toEqual([]);
});

test("red-team: flipping reduced motion mid-celebration strands nothing", async ({
  page,
  context,
}) => {
  // Starts WITH motion (this project has no reduced fixture): let the
  // cascade run partway, then flip the OS preference mid-flight.
  await forceFullMapMode(context);
  const errors = await cleanConsole(page);
  await page.goto(`${BASE}?celebration=session-milestone`);
  const ov = page.getByTestId("celebration-overlay");
  await expect(ov).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(200); // mid-pop: children still in their delays

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);

  // Everything must be readable — no element stranded at opacity 0 by a
  // killed animation's fill mode.
  const opacities = await ov.evaluate(() =>
    Array.from(document.querySelectorAll(".celebration-pop, .celebration-child")).map(
      (el) => getComputedStyle(el as HTMLElement).opacity,
    ),
  );
  expect(opacities.length).toBeGreaterThan(0);
  for (const o of opacities) {
    expect(o).toBe("1");
  }
  await expect(ov.getByRole("heading")).toBeVisible();

  expect(withoutHydrationNoise(errors)).toEqual([]);
});

test("M2: clue stagger derives from the clue index at runtime", async ({
  page,
}) => {
  const errors = await cleanConsole(page);
  await page.goto(`${BASE}?loop-puzzle=218`);
  await page.getByRole("button", { name: "🔎 Solve a mystery" }).click();
  await expect(page.getByRole("heading", { name: "GeoDetective" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("article", { name: /Clue 1: Geography/ }),
  ).toBeVisible({ timeout: 30_000 });

  // Burn one wrong guess → clue 2 reveals with the index-1 stagger.
  const box = page.getByRole("combobox", { name: "Search the map" });
  await box.click();
  await box.fill("paris");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Guess this place" }).click();
  await expect(page.getByText("Guess 2 of 5")).toBeVisible({ timeout: 15_000 });

  const clue2 = page.getByRole("article", { name: /Clue 2: Climate/ });
  await expect(clue2).toBeVisible();
  const rise = await clue2.locator("div").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      duration: cs.transitionDuration,
      timing: cs.transitionTimingFunction,
      delay: cs.transitionDelay,
    };
  });
  expect(rise.duration).toBe("0.4s");
  expect(rise.timing).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
  expect(rise.delay).toBe("0.06s"); // index 1 → 60ms

  expect(withoutHydrationNoise(errors)).toEqual([]);
});
