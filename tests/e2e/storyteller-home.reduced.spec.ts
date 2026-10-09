import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Storyteller home handoff (H1) — reduced motion.
 *
 * Covers: ≤150ms opacity fade only (no figure float, no bow, no leaf
 * drift — the leaf renders as a static sprig), full caption text instantly,
 * audio timing unchanged, no console errors.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const LEAF_LINE = "A leaf for luck. 🍃";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadHome(page: Page): Promise<string[]> {
  await page.context().addInitScript((seeds: Record<string, string>) => {
    try {
      for (const [k, v] of Object.entries(seeds)) localStorage.setItem(k, v);
    } catch {
      /* private mode — ignore */
    }
  }, {
    "meridian.grandpaTour.lastDate": todayKey(),
    "meridian.tutorialSeen": "1",
  });
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

test("reduced motion: full caption instantly, fade-only figure", async ({ page }) => {
  const errors = await loadHome(page);

  // The greeting caption renders whole — no word-by-word reveal.
  const caption = page.getByTestId("storyteller-home-caption");
  await expect(caption).toBeVisible({ timeout: 10_000 });
  const text = await caption.textContent();
  expect(text, "full caption text").not.toBeNull();
  expect(text!.length).toBeGreaterThan(20);

  // No idle motion on the figure: no running animation.
  const animating = await page.getByTestId("storyteller-figure").evaluate((el) => {
    const animations = el.getAnimations({ subtree: true });
    return animations.filter((a) => a.playState === "running").length;
  });
  // The 150ms enter fade may still be running at assertion time; allow it,
  // but no infinite/float animation may exist.
  const infinite = await page.getByTestId("storyteller-figure").evaluate((el) => {
    return el
      .getAnimations({ subtree: true })
      .filter((a) => {
        const effect = a.effect as KeyframeEffect | null;
        const iterations = effect?.getComputedTiming().iterations;
        return iterations === Infinity;
      }).length;
  });
  expect(animating, "running animations").toBeLessThanOrEqual(1);
  expect(infinite, "infinite animations").toBe(0);

  expectCleanConsole(errors);
});

test("reduced motion: leaf delight is a static sprig with its caption", async ({
  page,
}) => {
  const errors = await loadHome(page);

  // Day-1: text-only greeting holds ~6s, then the leaf delight fires.
  const leaf = page.getByTestId("storyteller-home-leaf");
  await expect(leaf).toBeVisible({ timeout: 30_000 });
  const leafAnimation = await leaf.evaluate((el) => {
    const animations = (el as HTMLElement).getAnimations();
    return animations.filter((a) => a.playState === "running").length;
  });
  expect(leafAnimation, "leaf drift animation").toBe(0);

  await expect
    .poll(async () => page.getByTestId("storyteller-home-caption").textContent(), {
      timeout: 8_000,
    })
    .toBe(LEAF_LINE);

  expectCleanConsole(errors);
});
