import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import { installSfxStub } from "./sfx-stub";
import { CELEBRATION_COPY } from "../../src/components/celebration-copy";

/**
 * Celebration overlay E2E (celebration spec §7.6) — driven through the
 * `?celebration=<variant>` seam (mirrors `?loop-puzzle=`).
 *
 * Note on sound: the overlay's mount effect plays the variant's mapped SFX,
 * but a fresh `?celebration=` load has seen no user gesture, so the
 * browser's autoplay gate keeps the AudioContext suspended and the recipe
 * stays silent — the same reason the game inits audio on first
 * pointerdown/keydown. The recipe mapping itself is unit-tested
 * (CELEBRATION_SFX), and the fanfare/applause/cheer recipes are proven on
 * real gesture-backed flows: the Hard/Easy cleared-dialog tests in
 * cleared-mode.spec.ts and the streak-cheer test in game-sfx.spec.ts.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await installSfxStub(context);
});

const overlay = (page: import("playwright/test").Page) =>
  page.getByTestId("celebration-overlay");

test("seam renders the overlay: character, copy, confetti, layering", async ({
  page,
}) => {
  await page.goto(`${BASE}?celebration=session-milestone`);
  const ov = overlay(page);
  await expect(ov).toBeVisible({ timeout: 15_000 });

  // Character SVG visible.
  await expect(ov.locator("svg")).toBeVisible();

  // Title/body match CELEBRATION_COPY (session-milestone → streak-10).
  const moment = CELEBRATION_COPY["streak-10"];
  await expect(ov.getByRole("heading")).toHaveText(moment.headline);
  await expect(ov.getByText(moment.line, { exact: false })).toBeVisible();
  await expect(ov.getByText(moment.greeting, { exact: false })).toBeVisible();

  // Confetti canvas present (normal motion).
  await expect(ov.locator("canvas")).toBeVisible();

  // Layering: the atmosphere never intercepts input; only the card does.
  const atmospherePointerEvents = await ov.evaluate((el) => {
    const atmo = el.querySelector(".pointer-events-none");
    return atmo ? getComputedStyle(atmo).pointerEvents : null;
  });
  expect(atmospherePointerEvents).toBe("none");
  const cardPointerEvents = await ov.evaluate((el) => {
    const card = el.querySelector(".pointer-events-auto");
    return card ? getComputedStyle(card).pointerEvents : null;
  });
  expect(cardPointerEvents).toBe("auto");

  // The card is interactive: the close button is enabled.
  await expect(ov.getByRole("button", { name: "Close celebration" })).toBeEnabled();
});

test("game-complete: dismiss via button and via Escape unmounts", async ({ page }) => {
  await page.goto(`${BASE}?celebration=game-complete`);
  const ov = overlay(page);
  await expect(ov).toBeVisible({ timeout: 15_000 });
  await expect(ov.getByRole("heading")).toHaveText(CELEBRATION_COPY["deck-complete"].headline);

  // Dismiss via the close button → unmount.
  await ov.getByRole("button", { name: "Close celebration" }).click();
  await expect(ov).toHaveCount(0);

  // Reload with the seam; Escape dismisses → unmount.
  await page.goto(`${BASE}?celebration=game-complete`);
  await expect(ov).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(ov).toHaveCount(0);
});

test("all four variants render without throwing; bad variant renders nothing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const variants = [
    "difficulty-clear",
    "mystery-solved",
    "session-milestone",
    "game-complete",
  ] as const;
  const moments = {
    "difficulty-clear": "difficulty-clear",
    "mystery-solved": "first-win",
    "session-milestone": "streak-10",
    "game-complete": "deck-complete",
  } as const;
  for (const variant of variants) {
    await page.goto(`${BASE}?celebration=${variant}`);
    const ov = overlay(page);
    await expect(ov).toBeVisible({ timeout: 15_000 });
    await expect(ov.locator("svg")).toBeVisible();
    await expect(ov.getByRole("heading")).toHaveText(
      CELEBRATION_COPY[moments[variant]].headline,
    );
  }

  // An unknown variant is inert — production never sets the seam.
  await page.goto(`${BASE}?celebration=bogus`);
  await expect(overlay(page)).toHaveCount(0);

  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode/difficulty-picker specs).
  expect(errors.filter((e) => !e.includes("Minified React error #418"))).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("static card: no confetti, data-reduced-motion, copy intact", async ({
    page,
  }) => {
    await page.goto(`${BASE}?celebration=difficulty-clear`);
    const ov = overlay(page);
    await expect(ov).toBeVisible({ timeout: 15_000 });

    await expect(ov).toHaveAttribute("data-reduced-motion", "true");
    // No confetti canvas under reduced motion — the static card only.
    await expect(ov.locator("canvas")).toHaveCount(0);
    // The character still renders (static, no float animation).
    await expect(ov.locator("svg")).toBeVisible();

    const moment = CELEBRATION_COPY["difficulty-clear"];
    await expect(ov.getByRole("heading")).toHaveText(moment.headline);
    await expect(ov.getByText(moment.line, { exact: false })).toBeVisible();
  });
});
