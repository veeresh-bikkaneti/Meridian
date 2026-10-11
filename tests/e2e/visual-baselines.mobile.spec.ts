import { test, expect, type Page } from "playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";

/**
 * Visual-regression BASELINE capture — mobile 390x844 (touch, mobile UA).
 *
 * Constitution gate (owner order 2026-10-10): every Meridian PR ships
 * key screens at 390px and 1280px, pixel-diffed against main's baselines.
 * This spec CREATES those baselines. It only runs when explicitly asked:
 *
 *   VISUAL_BASELINE_CAPTURE=1 npx playwright test visual-baselines.mobile.spec.ts
 *
 * Output: tests/e2e/visual-baselines/<buildId>/*.png + manifest.json
 * (console errors per screen, gstack-style evidence lines).
 *
 * Capture discipline: fresh browser context per screen (first-visit state),
 * CSS animations disabled at capture time so output is deterministic.
 * Do NOT add assertions here — this is a camera, not a test.
 */
test.setTimeout(180_000);

const CAPTURE = process.env.VISUAL_BASELINE_CAPTURE === "1";
test.skip(!CAPTURE, "baseline capture only (set VISUAL_BASELINE_CAPTURE=1)");

const APP = "http://127.0.0.1:4123/Meridian/";
const BUILD_ID = process.env.BASELINE_BUILD_ID || "main";
const OUT = path.resolve("tests/e2e/visual-baselines", BUILD_ID);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await mkdir(OUT, { recursive: true });
});

const manifest: Array<Record<string, unknown>> = [];

test.afterAll(async () => {
  await writeFile(
    path.join(OUT, "manifest.mobile.json"),
    JSON.stringify(
      { buildId: BUILD_ID, viewport: "390x844", capturedAt: new Date().toISOString(), screens: manifest },
      null,
      2,
    ),
  );
});

async function capture(
  page: Page,
  name: string,
  setup: (page: Page) => Promise<void>,
  opts: { fullPage?: boolean; element?: string } = {},
): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  await setup(page);
  // Freeze motion so the baseline is deterministic across runs.
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important}`,
  });
  const file = path.join(OUT, `${name}-390x844.png`);
  if (opts.element) {
    const el = page.locator(opts.element);
    if ((await el.count()) > 0) {
      await el.first().screenshot({ path: file, animations: "disabled" });
    } else {
      manifest.push({ name, file: null, note: "element absent", errors });
      return;
    }
  } else {
    await page.screenshot({
      path: file,
      fullPage: opts.fullPage ?? false,
      animations: "disabled",
    });
  }
  manifest.push({ name, file: path.basename(file), errors });
}

test("home top — storyteller banner", async ({ page }) => {
  await capture(page, "home-top", async (p) => {
    await expect(p.getByTestId("storyteller-home")).toBeVisible({ timeout: 20_000 });
  });
});

test("home full page", async ({ page }) => {
  await capture(
    page,
    "home-fullpage",
    async (p) => {
      await expect(p.getByTestId("storyteller-home")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("grandpa-scene")).toBeAttached({ timeout: 20_000 });
    },
    { fullPage: true },
  );
});

test("grandpa bench scene (cloud anchor area)", async ({ page }) => {
  await capture(page, "home-bench", async (p) => {
    const scene = p.getByTestId("grandpa-scene");
    await expect(scene).toBeVisible({ timeout: 20_000 });
    await scene.scrollIntoViewIfNeeded();
  });
});

test("ko-fi donation cloud — viewport framing at bench", async ({ page }) => {
  // Viewport (not element) screenshot: the RCA question is whether the cloud
  // is VISIBLE ON SCREEN, not merely in the DOM. Element screenshots hang
  // on the cloud's perpetual float animation (Playwright stability check),
  // so we capture the viewport the user actually sees.
  await capture(page, "kofi-cloud", async (p) => {
    const scene = p.getByTestId("grandpa-scene");
    await expect(scene).toBeVisible({ timeout: 20_000 });
    await scene.scrollIntoViewIfNeeded();
    // Fresh context = first visit = once-per-session gate open: the cloud
    // should be in the DOM. If absent, the manifest's console log + the
    // bench shot still document the state (no throw).
    await p.waitForTimeout(1500);
  });
});
