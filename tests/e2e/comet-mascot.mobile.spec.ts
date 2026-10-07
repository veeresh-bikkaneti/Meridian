import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * CometMascot E2E — mobile (390×844, touch).
 *
 * Covers: renders bottom-right at 72–88px without covering CTAs,
 * boop reaction fires on tap, no console errors.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";

function yesterdayKey(): string {
  const d = new Date(Date.now() - 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadHome(page: Page): Promise<string[]> {
  await page.context().addInitScript((key: string) => {
    try {
      if (!localStorage.getItem("meridian.cometGreeting.lastDate"))
        localStorage.setItem("meridian.cometGreeting.lastDate", key);
    } catch {
      /* private mode — ignore */
    }
  }, yesterdayKey());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await expect(page.getByTestId("comet-mascot")).toBeVisible({ timeout: 20_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("renders bottom-right at mobile size without covering CTAs", async ({ page }) => {
  const errors = await loadHome(page);
  const box = await page.getByTestId("comet-mascot").boundingBox();
  expect(box).not.toBeNull();
  // 72–88px mobile.
  expect(box!.width).toBeGreaterThanOrEqual(72);
  expect(box!.width).toBeLessThanOrEqual(88);
  const vp = page.viewportSize()!;
  expect(vp.width - (box!.x + box!.width)).toBeLessThanOrEqual(40);
  expect(vp.height - (box!.y + box!.height)).toBeLessThanOrEqual(40);

  // Every CTA stays tappable: scrolled into view, its center must not be
  // under the mascot.
  const ctas = [
    page.getByRole("button", { name: /solve a mystery|resume your case/i }),
    page.getByRole("button", { name: "Choose a state" }),
    page.getByRole("button", { name: "Choose a country" }),
    page.getByRole("button", { name: "Play the globe" }),
    page.getByTestId("sound-toggle"),
  ];
  for (const cta of ctas) {
    await cta.scrollIntoViewIfNeeded();
    const cbox = await cta.boundingBox();
    expect(cbox, "CTA has a bounding box").not.toBeNull();
    const top = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el as HTMLElement).outerHTML.slice(0, 120) : "none";
      },
      [cbox!.x + cbox!.width / 2, cbox!.y + cbox!.height / 2],
    );
    expect(
      top.includes("comet-mascot") || top.includes("comet-greeting"),
      `CTA center covered by mascot: ${top}`,
    ).toBe(false);
  }
  expectCleanConsole(errors);
});

test("tap boops the mascot", async ({ page }) => {
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await mascot.tap();
  await expect(mascot).toHaveAttribute("data-state", "booped");
  await expect(mascot).toHaveAttribute("data-state", "idle", { timeout: 5000 });
  expectCleanConsole(errors);
});

test("greeting bubble is visible and dismissible on mobile", async ({ page }) => {
  const errors = await loadHome(page);
  const bubble = page.getByTestId("comet-greeting");
  await expect(bubble).toBeVisible();
  await bubble.tap();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  expectCleanConsole(errors);
});

test("tap on the page turns Comet's head toward the tap (touch tracking)", async ({ page }) => {
  // Veeresh 2026-10-06: on touch devices the mascot looks at the last tap.
  const errors = await loadHome(page);
  const mascot = page.getByTestId("comet-mascot");
  await expect(mascot).toHaveAttribute("data-tracking", "on");
  // Dismiss the greeting first so taps land on the page, not the bubble.
  const bubble = page.getByTestId("comet-greeting");
  if (await bubble.isVisible()) await bubble.tap();
  await expect(page.getByTestId("comet-greeting")).toHaveCount(0);
  // Tap top-left of the viewport, far from the bottom-right mascot.
  await page.touchscreen.tap(40, 120);
  // The head should turn toward the tap (north-west sector = 5).
  const pupils = page.getByTestId("comet-pupils");
  await expect(pupils).toHaveAttribute("style", /translate\(-/, { timeout: 5000 });
  expectCleanConsole(errors);
});
