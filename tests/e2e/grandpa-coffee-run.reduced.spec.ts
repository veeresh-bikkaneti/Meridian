import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Grandpa's Coffee Run E2E — reduced motion (prefers-reduced-motion: reduce).
 *
 * Covers: grandpa appears parked near Comet, fully static (no walk, no bob,
 * no cheers animation, no swaying cloud); the cheers text is shown statically
 * so the CTA stays discoverable; the walker is still tappable and
 * keyboard-focusable; the gate still opens; no console errors.
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
  await expect(page.getByTestId("grandpa-scene")).toBeVisible({
    timeout: 20_000,
  });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("grandpa is parked and fully static under reduced motion", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  // No walk: beat goes straight to idle, never cheering.
  await expect(scene).toHaveAttribute("data-beat", "idle", {
    timeout: 10_000,
  });
  await expect(scene).toHaveAttribute("data-reduced-motion", "true");

  const walker = page.getByTestId("grandpa-walker");
  // No travel animation.
  const walkerAnimation = await walker.evaluate(
    (el) => getComputedStyle(el).animationName,
  );
  expect(walkerAnimation).toBe("none");
  // Parked left of Comet.
  const box = await walker.boundingBox();
  expect(box).not.toBeNull();
  const comet = await page.getByTestId("comet-mascot").boundingBox();
  expect(comet).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(comet!.x + 4);

  // The cheers text is shown statically so the CTA stays discoverable.
  const cheersText = page.locator(".grandpa-cheers-text");
  await expect(cheersText).toContainText("Support the Expedition");
  const opacity = await cheersText.evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  expect(parseFloat(opacity)).toBeGreaterThan(0.9);

  // Still tappable: gate opens.
  await walker.dispatchEvent("click");
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  await expect(page.getByTestId("support-dialog")).toContainText(
    "Ask a grown-up!",
  );
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("walker is keyboard-focusable with a visible focus ring", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const walker = page.getByTestId("grandpa-walker");
  await walker.focus();
  await expect(walker).toBeFocused();
  const outlineWidth = await walker.evaluate(
    (el) => getComputedStyle(el).outlineWidth,
  );
  expect(outlineWidth).toBe("3px");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  expectCleanConsole(errors);
});
