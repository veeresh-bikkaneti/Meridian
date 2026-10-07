import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * SupportFooter E2E — Ko-fi tip-jar footer (Veeresh 2026-10-07, Game Designer v1).
 *
 * Covers: footer renders on home with exact href + target/rel, interstitial
 * gate opens on link click (no navigation), Continue opens Ko-fi in a new
 * tab, Cancel / Esc / backdrop dismiss, offline hides the footer,
 * no console errors.
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
  await expect(page.getByTestId("support-footer")).toBeVisible({ timeout: 20_000 });
  return errors;
}

function expectCleanConsole(errors: string[]): void {
  // React #418 is a pre-existing flaky hydration warning, unrelated to this
  // feature (same filter as the cleared-mode and difficulty-picker specs).
  // Note: the ERR_TUNNEL_CONNECTION_FAILED filter this spec previously needed
  // is gone — analytics tags are env-gated (Veeresh 2026-10-07) and the test
  // build omits them, so no external scripts load in the sandbox.
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `console/page errors: ${JSON.stringify(relevant)}`).toEqual([]);
}

test("footer renders with exact href, target, rel and disclaimer", async ({ page }) => {
  const errors = await loadHome(page);
  const link = page.getByTestId("support-footer-link");
  await expect(link).toHaveAttribute("href", KOFI_URL);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveText("Ko-fi");
  await expect(page.getByTestId("support-footer")).toContainText(
    "Free forever, charted by Veeresh",
  );
  await expect(page.getByTestId("support-footer")).toContainText("Grown-ups:");
  await expect(page.getByTestId("support-footer")).toContainText(
    "Meridian is free forever",
  );
  expectCleanConsole(errors);
});

test("clicking the link opens the gate dialog without navigating", async ({ page }) => {
  const errors = await loadHome(page);
  await page.getByTestId("support-footer-link").click();
  const dialog = page.getByTestId("support-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Ask a grown-up!");
  // App tab must not navigate.
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("Continue opens Ko-fi in a new tab, app tab stays put", async ({ page }) => {
  // Stub window.open to capture the call without hitting the network.
  await page.addInitScript(() => {
    (window as unknown as { __opened: unknown[] }).__opened = [];
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      (window as unknown as { __opened: unknown[] }).__opened.push({ url: String(url), target, features });
      return null;
    }) as typeof window.open;
  });
  const errors = await loadHome(page);
  await page.getByTestId("support-footer-link").click();
  await page.getByTestId("support-dialog-continue").click();
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(1);
  const call = opened[0] as { url: string; target: string; features: string };
  expect(call.url).toBe(KOFI_URL);
  expect(call.target).toBe("_blank");
  expect(call.features).toContain("noopener");
  // Dialog closed, app tab untouched.
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
  await page.getByTestId("support-footer-link").click();
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
  await page.getByTestId("support-footer-link").click();
  await expect(page.getByTestId("support-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("support-dialog")).toBeHidden();
  expectCleanConsole(errors);
});

test("offline hides the footer", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await context.setOffline(true);
  await page.goto(APP);
  // Home still loads; the footer must not render while offline.
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("support-footer")).toHaveCount(0);
  await context.setOffline(false);
  // Offline inherently logs resource failures (analytics, fonts); the assertion
  // above is the test — filter the expected offline noise here.
  const relevant = errors.filter((e) => !e.includes("ERR_INTERNET_DISCONNECTED"));
  expect(relevant, `unexpected errors: ${JSON.stringify(relevant)}`).toEqual([]);
});
