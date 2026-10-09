import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Grandpa's Coffee Run E2E — mobile (390px viewport, touch).
 *
 * Covers: the seated finale renders at phone width, the donation bubble is
 * visible and readable, grandpa never covers edition CTAs, and a touch tap
 * opens the "ask a grown-up" gate. No console errors.
 *
 * Build requirement: same as the desktop spec —
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 */
test.setTimeout(180_000);

// Mobile comes from the playwright "mobile" project
// (testMatch: /mobile\.spec\.ts/ → viewport 390x844, hasTouch, isMobile).

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

test("seated finale + donation bubble render at phone width", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 30_000,
  });

  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toContainText("Grown-ups, buy me a coffee? ☕");
  // Poll for full opacity (the cloud fades in; a single read can catch it
  // mid-transition).
  await expect
    .poll(
      async () =>
        parseFloat(
          await bubble.evaluate((el) => getComputedStyle(el).opacity),
        ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0.9);
  // The bubble stays inside the viewport horizontally.
  const bbox = await bubble.boundingBox();
  expect(bbox).not.toBeNull();
  expect(bbox!.x).toBeGreaterThanOrEqual(-2);
  expect(bbox!.x + bbox!.width).toBeLessThanOrEqual(392);
  expectCleanConsole(errors);
});

test("grandpa never covers edition CTAs at phone width", async ({ page }) => {
  const errors = await loadHome(page);
  await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
    "data-beat",
    "seated",
    { timeout: 25_000 },
  );
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
  expectCleanConsole(errors);
});

test("touch tap opens the in-cloud grown-up workflow", async ({ page }) => {
  const errors = await loadHome(page);
  await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
    "data-beat",
    "seated",
    { timeout: 30_000 },
  );
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  const gate = page.getByTestId("grandpa-cloud-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("You're leaving Meridian to visit Ko-fi. Ask a grown-up!");
  // The gate stays inside the viewport horizontally at phone width.
  const bbox = await gate.boundingBox();
  expect(bbox).not.toBeNull();
  expect(bbox!.x).toBeGreaterThanOrEqual(-2);
  expect(bbox!.x + bbox!.width).toBeLessThanOrEqual(392);
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});
