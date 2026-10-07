import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Grandpa's Coffee Run E2E — animated donation scene on the Chart Room home
 * (Veeresh 2026-10-07; finale rework: slow stroll, seated cheers, donation
 * bubble, pointer-tracking eyes).
 *
 * Beats: entrance (dotted trail unrolls) → slow walk ~9.5s (bob, cane tap,
 * mug sip, cloud tracks) → cheers at 45% (travel pauses, front pose,
 * donation text) → arrival → seated finale (chair, mug raised with steam,
 * eyes track the pointer, thought cloud opens into the donation bubble).
 * Tap grandpa → "ask a grown-up" gate → Continue opens Ko-fi in a new tab.
 *
 * Covers: slow walk completes, cheers beat triggers with the ask text,
 * seated finale renders (chair pose, steam, bubble text, pupils track the
 * pointer), tap opens the gate (no navigation), Continue opens Ko-fi,
 * Cancel / Esc / backdrop dismiss, offline hides grandpa, never covers CTAs,
 * no console errors.
 *
 * Build requirement: the test artifact must be built with the Ko-fi URL, e.g.
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 * Analytics env vars (VITE_GA4_MEASUREMENT_ID / VITE_CLARITY_PROJECT_ID) are
 * intentionally OMITTED from the test build — the tags must not render, which
 * also keeps external-script noise out of the console gate.
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
// Fail fast with a clear message if the artifact wasn't built with the URL.
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
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

async function expectGrandpaNotCoveringCtas(page: Page) {
  const ctas = [
    page.getByRole("button", { name: /solve a mystery|resume your case/i }),
    page.getByRole("button", { name: "Choose a state" }),
    page.getByRole("button", { name: "Choose a country" }),
    page.getByRole("button", { name: "Play the globe" }),
    page.getByTestId("sound-toggle"),
  ];
  for (const cta of ctas) {
    await cta.scrollIntoViewIfNeeded();
    const box = await cta.boundingBox();
    expect(box, "CTA has a bounding box").not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const top = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el as HTMLElement).outerHTML.slice(0, 160) : "none";
    }, [cx, cy]);
    expect(
      /grandpa-/.test(top),
      `CTA center covered by Grandpa's scene: ${top}`,
    ).toBe(false);
  }
}

test("grandpa strolls in slowly, cheers halfway, then sits with his coffee", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");

  // Beat 1+2: the slow stroll — the dotted trail is unrolling beneath him.
  await expect(scene).toHaveAttribute("data-beat", "walking", {
    timeout: 5_000,
  });
  await expect(page.getByTestId("grandpa-path")).toBeVisible();
  // The stroll is leisurely now (~9.5s): after 3s he must still be walking,
  // not already parked.
  await page.waitForTimeout(3000);
  await expect(scene).toHaveAttribute("data-beat", "walking");

  // Beat 3: cheers — travel pauses, he faces the viewer, the ask appears.
  // (Walk is 9.5s; cheers hits at 45% ≈ 4.3s and holds 2s.)
  await expect(scene).toHaveAttribute("data-beat", "cheering", {
    timeout: 12_000,
  });
  const cheersText = page.locator(".grandpa-cheers-text");
  await expect(cheersText).toContainText("Support the Expedition");
  await expect(cheersText).toContainText(
    "Grown-ups — help keep Meridian funded and free for kids",
  );
  const cheersOpacity = await cheersText.evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  expect(parseFloat(cheersOpacity)).toBeGreaterThan(0.9);

  // Beat 5: the seated finale — chair pose, steam, donation bubble.
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 25_000,
  });
  const walker = page.getByTestId("grandpa-walker");
  const box = await walker.boundingBox();
  expect(box).not.toBeNull();
  const vp = page.viewportSize()!;
  // Bottom-right quadrant, near the bottom edge.
  expect(box!.x).toBeGreaterThan(vp.width / 2);
  expect(vp.height - (box!.y + box!.height)).toBeLessThanOrEqual(80);
  // Left of Comet (Comet sits at the far bottom-right corner).
  const comet = await page.getByTestId("comet-mascot").boundingBox();
  expect(comet).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(comet!.x + 4);

  // The seated pose is the visible one.
  const seatedOpacity = await page
    .locator(".pose-seated")
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(parseFloat(seatedOpacity)).toBeGreaterThan(0.9);

  // Steam is rising from the raised mug.
  const steamAnim = await page
    .locator(".pose-seated .steam-1")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(steamAnim).toBe("steam-rise");

  // The thought cloud opened into the donation bubble.
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toContainText("Help me buy coffee!");
  await expect(bubble).toContainText(
    "Grown-ups — donations keep Meridian free for kids",
  );
  const bubbleOpacity = await bubble.evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  expect(parseFloat(bubbleOpacity)).toBeGreaterThan(0.9);
  // The mid-walk ask text is gone; the bubble is the persistent ask.
  await expect(cheersText).toHaveCSS("opacity", "0");

  await expectGrandpaNotCoveringCtas(page);
  expectCleanConsole(errors);
});

test("seated grandpa's eyes track the pointer like Comet's", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 25_000,
  });
  await expect(page.getByTestId("grandpa-walker")).toHaveAttribute(
    "data-tracking",
    "on",
  );

  const pupils = page.getByTestId("grandpa-pupils");
  const pupilTransform = () =>
    pupils.evaluate((el) => (el as SVGGElement).style.transform);
  const vp = page.viewportSize()!;

  // Look far left of grandpa.
  await page.mouse.move(60, 200, { steps: 5 });
  await page.waitForTimeout(500);
  const left = await pupilTransform();

  // Look far right of grandpa.
  await page.mouse.move(vp.width - 60, 200, { steps: 5 });
  await page.waitForTimeout(500);
  const right = await pupilTransform();

  // The pupils moved (non-empty, distinct transforms).
  expect(left).toContain("translate");
  expect(right).toContain("translate");
  expect(left).not.toBe(right);
  expectCleanConsole(errors);
});

test("tapping grandpa opens the grown-up gate (no navigation)", async ({
  page,
}) => {
  const errors = await loadHome(page);
  // The walker is animated; dispatchEvent avoids click-stability flakiness.
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  const dialog = page.getByTestId("support-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Ask a grown-up!");
  await expect(dialog).toContainText("Meridian is free forever");
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("Continue opens Ko-fi in a new tab, app tab stays put", async ({
  page,
}) => {
  // Stub window.open to capture the call without hitting the network.
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
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  await page.getByTestId("support-dialog-continue").click();
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(1);
  const call = opened[0] as { url: string; target: string; features: string };
  expect(call.url).toBe(KOFI_URL);
  expect(call.target).toBe("_blank");
  expect(call.features).toContain("noopener");
  await expect(page.getByTestId("support-dialog")).toBeHidden();
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("Cancel closes the gate without opening anything", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __opened: unknown[] }).__opened = [];
    window.open = (() => {
      (window as unknown as { __opened: unknown[] }).__opened.push(1);
      return null;
    }) as typeof window.open;
  });
  const errors = await loadHome(page);
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  await page.getByTestId("support-dialog-cancel").click();
  await expect(page.getByTestId("support-dialog")).toBeHidden();
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(0);
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("Esc dismisses the gate", async ({ page }) => {
  const errors = await loadHome(page);
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("support-dialog")).toBeHidden();
  expectCleanConsole(errors);
});

test("backdrop tap dismisses the gate", async ({ page }) => {
  const errors = await loadHome(page);
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  const dialog = page.getByTestId("support-dialog");
  await expect(dialog).toBeVisible();
  // Click the backdrop: top-left corner of the viewport is outside the dialog.
  await page.mouse.click(10, 10);
  await expect(dialog).toBeHidden();
  expectCleanConsole(errors);
});

test("grandpa is keyboard-focusable with a visible focus ring", async ({
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
  // Enter activates the gate.
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  expect(page.url()).toBe(APP);
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
  // Home still loads; grandpa must not render while offline.
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("grandpa-scene")).toHaveCount(0);
  await context.setOffline(false);
  // Offline inherently logs resource failures; the assertion above is the
  // test — filter the expected offline noise here. React #418 is the known
  // pre-existing flaky hydration warning (same filter as expectCleanConsole).
  const relevant = errors.filter(
    (e) =>
      !e.includes("ERR_INTERNET_DISCONNECTED") &&
      !e.includes("Minified React error #418"),
  );
  expect(relevant, `unexpected errors: ${JSON.stringify(relevant)}`).toEqual([]);
});
