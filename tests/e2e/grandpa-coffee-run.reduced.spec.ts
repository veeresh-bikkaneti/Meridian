import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Grandpa's Coffee Run E2E — reduced motion (prefers-reduced-motion: reduce).
 *
 * Covers: grandpa appears seated on the bench in his park near Comet, fully
 * static (no walk, no kettle, no bob, no steam, no sway, no head movement, no
 * mug-lift invite); the tree + bench render statically; the donation cloud is
 * shown statically so the CTA stays discoverable; the walker is still
 * tappable and keyboard-focusable; tapping opens the in-cloud gate workflow;
 * no console errors.
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

test("grandpa is seated and fully static under reduced motion", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  // No walk: beat goes straight to seated, never cheering.
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 10_000,
  });
  await expect(scene).toHaveAttribute("data-reduced-motion", "true");

  const walker = page.getByTestId("grandpa-walker");
  // No travel animation, no tracking flag at all.
  const walkerAnimation = await walker.evaluate(
    (el) => getComputedStyle(el).animationName,
  );
  expect(walkerAnimation).toBe("none");
  await expect(walker).not.toHaveAttribute("data-tracking");
  // No kettle under reduced motion — the spectacle is skipped entirely.
  await expect(page.getByTestId("grandpa-kettle")).toBeHidden();
  // No mug-lift invite either — fully static.
  const gestureAnim = await page
    .getByTestId("grandpa-mug-gesture")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(gestureAnim).toBe("none");
  // Parked left of Comet.
  const box = await walker.boundingBox();
  expect(box).not.toBeNull();
  const comet = await page.getByTestId("comet-mascot").boundingBox();
  expect(comet).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(comet!.x + 4);

  // The seated pose is the visible one, statically — on the bench.
  const seatedOpacity = await page
    .locator(".pose-seated")
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(parseFloat(seatedOpacity)).toBeGreaterThan(0.9);

  // The park renders statically: tree + bench, no animation.
  const park = page.getByTestId("grandpa-park");
  await expect(park).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("grandpa-tree")).toBeVisible();
  await expect(page.getByTestId("grandpa-bench")).toBeVisible();

  // The donation bubble is shown statically so the CTA stays discoverable.
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toContainText("Help me buy coffee!");
  await expect(bubble).toContainText(
    "Grown-ups — donations keep Meridian free for kids",
  );
  const bubbleOpacity = await bubble.evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  expect(parseFloat(bubbleOpacity)).toBeGreaterThan(0.9);

  // No head movement: moving the pointer leaves the pupils alone.
  const pupils = page.getByTestId("grandpa-pupils");
  const pupilTransform = () =>
    pupils.evaluate((el) => (el as SVGGElement).style.transform);
  await page.mouse.move(60, 200, { steps: 5 });
  await page.waitForTimeout(400);
  expect(await pupilTransform()).toBe("");

  // Still tappable: the in-cloud gate workflow opens.
  await walker.dispatchEvent("click");
  const cloudBubble = page.getByTestId("grandpa-donation-bubble");
  await expect(cloudBubble).toHaveAttribute("data-cloud", "gate");
  const gate = page.getByTestId("grandpa-cloud-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("Ask a grown-up!");
  // Cancel reverts.
  await page.getByTestId("grandpa-cloud-cancel").click();
  await expect(cloudBubble).toHaveAttribute("data-cloud", "ask");
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
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
  expectCleanConsole(errors);
});
