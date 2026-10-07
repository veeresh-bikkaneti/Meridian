import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * KoFiSign E2E — animated Ko-fi tip-jar sign presented by Comet
 * (Veeresh 2026-10-07, overriding the earlier "Comet never presents" rule).
 *
 * Covers: sign renders bottom-right next to Comet without covering CTAs,
 * tap → Comet boops + gate dialog opens (no navigation), Continue opens
 * Ko-fi in a new tab, Cancel / Esc / backdrop dismiss, offline hides the
 * sign, no console errors.
 *
 * Build requirement: the test artifact must be built with the Ko-fi URL, e.g.
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 * Analytics env vars (VITE_GA4_MEASUREMENT_ID / VITE_CLARITY_PROJECT_ID) are
 * intentionally OMITTED from the test build — the tags must not render, which
 * also keeps external-script noise out of the console gate.
 */
test.setTimeout(180_000);

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
  await expect(page.getByTestId("kofi-sign")).toBeVisible({ timeout: 20_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

async function expectSignNotCoveringCtas(page: Page) {
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
      return el ? (el as HTMLElement).outerHTML.slice(0, 120) : "none";
    }, [cx, cy]);
    expect(
      top.includes("kofi-sign"),
      `CTA center covered by the Ko-fi sign: ${top}`,
    ).toBe(false);
  }
}

test("sign renders bottom-right next to Comet without covering CTAs", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const sign = page.getByTestId("kofi-sign");
  await expect(sign).toContainText("Support the Expedition");
  await expect(sign).toContainText("Grown-ups");
  const box = await sign.boundingBox();
  expect(box).not.toBeNull();
  // Bottom-right quadrant: right of viewport center, near the bottom.
  const vp = page.viewportSize()!;
  expect(box!.x).toBeGreaterThan(vp.width / 2);
  expect(vp.height - (box!.y + box!.height)).toBeLessThanOrEqual(60);
  // Left of Comet (Comet sits at the far bottom-right corner).
  const comet = await page.getByTestId("comet-mascot").boundingBox();
  expect(comet).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(comet!.x + 4);
  await expectSignNotCoveringCtas(page);
  expectCleanConsole(errors);
});

test("tapping the sign makes Comet boop and opens the gate", async ({
  page,
}) => {
  const errors = await loadHome(page);
  await page.getByTestId("kofi-sign").dispatchEvent("click"); // sway animation defeats click stability checks
  // Comet does the happy boop…
  await expect(page.getByTestId("comet-mascot")).toHaveAttribute(
    "data-state",
    "booped",
    { timeout: 5_000 },
  );
  // …and the COPPA gate opens without navigating.
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
  await page.getByTestId("kofi-sign").dispatchEvent("click"); // sway animation defeats click stability checks
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
  await page.getByTestId("kofi-sign").dispatchEvent("click"); // sway animation defeats click stability checks
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
  await page.getByTestId("kofi-sign").dispatchEvent("click"); // sway animation defeats click stability checks
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("support-dialog")).toBeHidden();
  expectCleanConsole(errors);
});

test("backdrop tap dismisses the gate", async ({ page }) => {
  const errors = await loadHome(page);
  await page.getByTestId("kofi-sign").dispatchEvent("click"); // sway animation defeats click stability checks
  const dialog = page.getByTestId("support-dialog");
  await expect(dialog).toBeVisible();
  // Click the backdrop: top-left corner of the viewport is outside the dialog.
  await page.mouse.click(10, 10);
  await expect(dialog).toBeHidden();
  expectCleanConsole(errors);
});

test("offline hides the sign", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await context.setOffline(true);
  await page.goto(APP);
  // Home still loads; the sign must not render while offline.
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("kofi-sign")).toHaveCount(0);
  await context.setOffline(false);
  // Offline inherently logs resource failures; the assertion above is the
  // test — filter the expected offline noise here.
  const relevant = errors.filter(
    (e) => !e.includes("ERR_INTERNET_DISCONNECTED"),
  );
  expect(relevant, `unexpected errors: ${JSON.stringify(relevant)}`).toEqual([]);
});
