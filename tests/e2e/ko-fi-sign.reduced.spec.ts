import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * KoFiSign E2E — reduced motion (prefers-reduced-motion: reduce).
 *
 * Covers: the sign is completely static (no sway animation), it stays
 * tappable and keyboard-focusable, the gate still opens on tap, no
 * console errors. Comet's WAAPI bounce already no-ops under reduced
 * motion (handled inside handleBoop).
 *
 * Build requirement: same as the desktop spec —
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 */
test.setTimeout(180_000);

// Reduced motion comes from the playwright "reduced" project
// (testMatch: /reduced\.spec\.ts/ → contextOptions.reducedMotion: "reduce").

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

async function loadHome(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("kofi-sign")).toBeVisible({ timeout: 20_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("sign is static and tappable under reduced motion", async ({ page }) => {
  const errors = await loadHome(page);
  const sign = page.getByTestId("kofi-sign");
  // The sway animation must be fully disabled.
  const animationName = await sign.evaluate(
    (el) => getComputedStyle(el).animationName,
  );
  expect(animationName).toBe("none");
  // Still tappable: gate opens.
  await sign.click();
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  await expect(page.getByTestId("support-dialog")).toContainText("Ask a grown-up!");
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("sign is keyboard-focusable with a visible focus ring", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const sign = page.getByTestId("kofi-sign");
  await sign.focus();
  await expect(sign).toBeFocused();
  const outlineWidth = await sign.evaluate(
    (el) => getComputedStyle(el).outlineWidth,
  );
  // :focus-visible ring must render (3px brass).
  expect(outlineWidth).toBe("3px");
  // Enter activates the gate.
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  expectCleanConsole(errors);
});
