import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Ko-fi tour-cloud E2E — the headline flow (mobile 390x844, touch).
 *
 * Covers PR #111's fix on the tasting tour: the donation cloud is VISIBLE
 * for the whole walk (not only once seated), sits fully inside the 390px
 * viewport (a previous bug hung it ~46px off-screen), carries the locked
 * ask copy, the strip walker is not a tap target mid-walk, a touch tap on
 * the cloud's ask button opens the grown-up gate with focus on Continue,
 * the sip animation runs its full 800ms dwell, and the tour completes with
 * the cloud still visible once seated.
 *
 * Runs in the "mobile" project (testMatch: /mobile\.spec\.ts/ → viewport
 * 390x844, hasTouch, isMobile).
 *
 * Build requirement: the test artifact must be built with the Ko-fi URL, e.g.
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
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

/** Wait for the mobile walk to start and return the donation bubble. */
async function midWalkBubble(page: Page) {
  const scene = page.getByTestId("grandpa-scene");
  await expect(scene).toHaveAttribute("data-mode", "tour", { timeout: 30_000 });
  await expect(page.getByTestId("grandpa-tour")).toHaveAttribute(
    "data-tour-stage",
    "walk",
    { timeout: 20_000 },
  );
  return page.getByTestId("grandpa-donation-bubble");
}

/** Assert the bubble is fully inside the viewport (no edge clipping). */
async function expectBubbleOnScreen(page: Page, contextLabel: string) {
  const bubble = page.getByTestId("grandpa-donation-bubble");
  const bbox = await bubble.boundingBox();
  expect(bbox, `cloud has a bounding box (${contextLabel})`).not.toBeNull();
  const vp = page.viewportSize()!;
  expect(bbox!.x, `cloud left edge on-screen (${contextLabel})`).toBeGreaterThanOrEqual(-2);
  expect(
    bbox!.x + bbox!.width,
    `cloud right edge on-screen (${contextLabel})`,
  ).toBeLessThanOrEqual(vp.width + 2);
}

test("cloud is visible mid-walk and fully inside the 390px viewport", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const bubble = await midWalkBubble(page);
  // Fully faded in (the cloud reveals with a transition; a single read can
  // catch it mid-fade, so poll).
  await expect
    .poll(
      async () =>
        parseFloat(
          await bubble.evaluate((el) => getComputedStyle(el).opacity),
        ),
      { timeout: 10_000 },
    ).toBe(1);
  expect(
    await bubble.evaluate((el) => getComputedStyle(el).visibility),
    "cloud not visibility-hidden mid-walk",
  ).toBe("visible");
  // Regression: the bubble used to hang ~46px off the right edge at 390px.
  await expectBubbleOnScreen(page, "mid-walk");
  expectCleanConsole(errors);
});

test("cloud shows the locked ask copy mid-walk", async ({ page }) => {
  const errors = await loadHome(page);
  const bubble = await midWalkBubble(page);
  // Veeresh's locked wording — read-only assertions, never edited here.
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expect(bubble).toContainText("Your support keeps Meridian free for kids");
  expectCleanConsole(errors);
});

test("strip walker is not a tap target mid-walk", async ({ page }) => {
  const errors = await loadHome(page);
  await midWalkBubble(page);
  const walker = page.getByTestId("grandpa-walker");
  // No role, no tabindex: it is not in the tab order and no assistive-tech
  // tap target.
  await expect(walker).not.toHaveAttribute("role", "button");
  await expect(walker).not.toHaveAttribute("tabindex", "0");
  const pe = await walker.evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pe, "walker lets taps pass through mid-walk").toBe("none");
  // A forced click (bypasses actionability, like an AT activation) still
  // opens nothing: the handler is detached when not interactive.
  await walker.dispatchEvent("click");
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(page.getByTestId("grandpa-cloud-gate")).toHaveCount(0);
  expectCleanConsole(errors);
});

test("tapping the cloud's ask button mid-tour opens the gate, focus on Continue", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const bubble = await midWalkBubble(page);
  // The gate entry mid-tour is the cloud's own ask button (not the walker).
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  // Touch tap: the project runs with hasTouch.
  await page.getByTestId("grandpa-bubble-ask").tap();
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  const gate = page.getByTestId("grandpa-cloud-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toHaveAttribute("role", "dialog");
  // Focus lands on Continue so a grown-up can act without hunting.
  await expect(page.getByTestId("grandpa-cloud-continue")).toBeFocused();
  expectCleanConsole(errors);
});

test("sip animation runs the full 800ms dwell, no mid-drink snap", async ({
  page,
}) => {
  const errors = await loadHome(page);
  await midWalkBubble(page);
  const tour = page.getByTestId("grandpa-tour");
  // Reach the first sip stop.
  await expect(tour).toHaveAttribute("data-stop-index", "0", {
    timeout: 60_000,
  });
  await expect(tour).toHaveAttribute("data-tour-phase", "sip", {
    timeout: 10_000,
  });
  // The mug-arm plays the deliberate raise-and-hold sip-drink keyframes for
  // the whole 800ms dwell — synced to TOUR_SIP_MS, so the arm never snaps
  // back mid-animation.
  const sipAnim = await page
    .locator('[data-testid="grandpa-tour"] .mug-arm')
    .evaluate((el) => ({
      name: getComputedStyle(el).animationName,
      duration: getComputedStyle(el).animationDuration,
    }));
  expect(sipAnim.name, "mug plays sip-drink during the dwell").toBe("sip-drink");
  expect(sipAnim.duration, "sip-drink matches TOUR_SIP_MS").toBe("0.8s");
  // The tour advances past the sip stop on its own — the phase resolved,
  // the arm was not cut off.
  await expect(tour).toHaveAttribute("data-stop-index", "1", {
    timeout: 30_000,
  });
  expectCleanConsole(errors);
});

test("tour completes and settles with the cloud visible on-screen", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  await midWalkBubble(page);
  // Let the shortened mobile walk (~9s) + pour + settle run to the end.
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 60_000,
  });
  await expect(page.getByTestId("grandpa-tour")).toHaveAttribute(
    "data-tour-stage",
    "settled",
    { timeout: 10_000 },
  );
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect
    .poll(
      async () =>
        parseFloat(
          await bubble.evaluate((el) => getComputedStyle(el).opacity),
        ),
      { timeout: 10_000 },
    ).toBeGreaterThan(0.9);
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expect(bubble).toContainText("Your support keeps Meridian free for kids");
  await expectBubbleOnScreen(page, "seated");
  expectCleanConsole(errors);
});
