import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Ko-fi persistent-cloud E2E — the owner's 2026-10-10 product call.
 *
 * The donation cloud is a PERSISTENT fixture: the once-per-session gate
 * (`meridian.grandpaTour.askShown` + the `askVisible` state) was removed
 * from `grandpa-coffee-run.tsx`. These are the constitution's runtime-path
 * tests for that new behavior — each one walks a path the removed gate
 * used to suppress:
 *
 *  - return visit (seeded as if a previous visit happened: today's
 *    tour-date in localStorage + the legacy session flag) → the cloud
 *    STILL renders with the locked ask copy, and its bounding box
 *    intersects the 390px viewport (the owner's phone showed the cloud
 *    ~3 screens below the fold — a DOM-presence assertion would have
 *    passed while the user saw nothing).
 *  - tap the cloud's ask button → the grown-up gate opens inside the cloud.
 *  - gate Continue → Ko-fi opens in a new tab (window.open stubbed and
 *    asserted) and the cloud reverts to the ask.
 *  - gate Cancel / Esc → reverts to the ask state; the cloud stays visible.
 *  - fail-closed: offline → grandpa renders nothing; a build WITHOUT
 *    VITE_KOFI_URL → grandpa renders nothing.
 *
 * Runs in the "mobile" project (viewport 390x844, touch).
 *
 * Build requirement: the artifact must be built with the Ko-fi URL, e.g.
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 * except for the "no Ko-fi URL" test, which needs an artifact built WITHOUT
 * the variable and served via KOFI_E2E_DIST:
 *   npm run build:pages                    # no VITE_KOFI_URL
 *   cp -r dist/client /tmp/dist-nokofi
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 *   KOFI_E2E_DIST=/tmp/dist-nokofi npx playwright test kofi-persistent-cloud -g "no Ko-fi URL"
 */
test.setTimeout(180_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = "http://127.0.0.1:4123/Meridian/";
const NO_KOFI_DIST = !!process.env.KOFI_E2E_DIST;

function kofiUrl(): string {
  const url = process.env.VITE_KOFI_URL?.trim();
  if (!url) {
    throw new Error(
      "E2E requires VITE_KOFI_URL at build time: " +
        "VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages",
    );
  }
  return url;
}

/** Seed a "return visit" the way the OLD session gate left it: the tour
 *  already ran today (localStorage) AND the legacy ask-shown flag is set
 *  (sessionStorage). The new code must ignore the session flag. */
async function seedReturnVisit(page: Page): Promise<void> {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  await page.addInitScript((v: string) => {
    // Written by the removed session gate — must now be a no-op.
    sessionStorage.setItem("meridian.grandpaTour.askShown", "1");
    localStorage.setItem("meridian.grandpaTour.lastDate", v);
  }, today);
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

/** The cloud's bounding box must intersect the 390px viewport — the
 *  owner's bug was a cloud that existed in the DOM but lived ~3 screens
 *  below the fold. */
async function expectCloudInViewport(page: Page, label: string) {
  const bubble = page.getByTestId("grandpa-donation-bubble");
  const bbox = await bubble.boundingBox();
  expect(bbox, `cloud has a bounding box (${label})`).not.toBeNull();
  const vp = page.viewportSize()!;
  expect(bbox!.x, `cloud left edge on-screen (${label})`).toBeGreaterThanOrEqual(-2);
  expect(
    bbox!.x + bbox!.width,
    `cloud right edge on-screen (${label})`,
  ).toBeLessThanOrEqual(vp.width + 2);
  expect(
    bbox!.y,
    `cloud top edge not below the fold (${label})`,
  ).toBeLessThan(vp.height);
  expect(
    bbox!.y + bbox!.height,
    `cloud bottom edge not above the fold (${label})`,
  ).toBeGreaterThan(0);
}

test("cloud is visible on a return visit, inside the viewport", async ({
  page,
}) => {
  test.skip(
    NO_KOFI_DIST,
    "needs the URL-bearing build",
  );
  await seedReturnVisit(page);
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");
  // Return visit (same calendar day): grandpa is already seated by design.
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 10_000,
  });
  // The removed once-per-session gate hid the cloud here. Now it renders.
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expect(bubble).toContainText(
    "Your support keeps Meridian free for kids",
  );
  // The owner's phone had the cloud ~3 screens below the fold — a
  // DOM-presence assertion would have passed while he saw nothing.
  await expectCloudInViewport(page, "return visit seated");
  expectCleanConsole(errors);
});

test("return-visit tap on the cloud opens the gate in-cloud", async ({
  page,
}) => {
  test.skip(NO_KOFI_DIST, "needs the URL-bearing build");
  await seedReturnVisit(page);
  const errors = await loadHome(page);
  await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
    "data-beat",
    "seated",
    { timeout: 10_000 },
  );
  await page.getByTestId("grandpa-bubble-ask").tap();
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  const gate = page.getByTestId("grandpa-cloud-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText(
    "You're leaving Meridian to visit Ko-fi. Ask a grown-up!",
  );
  // Focus lands on Continue so a grown-up can act without hunting.
  await expect(page.getByTestId("grandpa-cloud-continue")).toBeFocused();
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("gate Continue opens Ko-fi in a new tab (stubbed) and the cloud reverts", async ({
  page,
}) => {
  test.skip(NO_KOFI_DIST, "needs the URL-bearing build");
  const KOFI_URL = kofiUrl();
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
  await seedReturnVisit(page);
  const errors = await loadHome(page);
  await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
    "data-beat",
    "seated",
    { timeout: 10_000 },
  );
  await page.getByTestId("grandpa-bubble-ask").tap();
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
  await page.getByTestId("grandpa-cloud-continue").click();
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(1);
  const call = opened[0] as { url: string; target: string; features: string };
  expect(call.url).toBe(KOFI_URL);
  expect(call.target).toBe("_blank");
  expect(call.features).toContain("noopener");
  // The cloud reverts to the ask — still the persistent fixture.
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expectCloudInViewport(page, "after Continue");
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("gate Cancel and Esc revert to the ask state; cloud stays visible", async ({
  page,
}) => {
  test.skip(NO_KOFI_DIST, "needs the URL-bearing build");
  await page.addInitScript(() => {
    (window as unknown as { __opened: unknown[] }).__opened = [];
    window.open = (() => {
      (window as unknown as { __opened: unknown[] }).__opened.push(1);
      return null;
    }) as typeof window.open;
  });
  await seedReturnVisit(page);
  const errors = await loadHome(page);
  await expect(page.getByTestId("grandpa-scene")).toHaveAttribute(
    "data-beat",
    "seated",
    { timeout: 10_000 },
  );
  const bubble = page.getByTestId("grandpa-donation-bubble");
  // Cancel path.
  await page.getByTestId("grandpa-bubble-ask").tap();
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
  await page.getByTestId("grandpa-cloud-cancel").click();
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expectCloudInViewport(page, "after Cancel");
  // Esc path.
  await page.getByTestId("grandpa-bubble-ask").tap();
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(bubble).toContainText("Grown-ups — buy me a coffee? ☕");
  await expectCloudInViewport(page, "after Esc");
  // Nothing opened.
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(0);
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("fail-closed: offline hides grandpa and the cloud", async ({
  page,
  context,
}) => {
  test.skip(NO_KOFI_DIST, "needs the URL-bearing build");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await context.setOffline(true);
  await page.goto(APP);
  // Home still loads; grandpa (and his cloud) must not render offline.
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("grandpa-scene")).toHaveCount(0);
  await expect(page.getByTestId("grandpa-donation-bubble")).toHaveCount(0);
  await context.setOffline(false);
  const relevant = errors.filter(
    (e) =>
      !e.includes("ERR_INTERNET_DISCONNECTED") &&
      !e.includes("Minified React error #418"),
  );
  expect(relevant, `unexpected errors: ${JSON.stringify(relevant)}`).toEqual([]);
});

test("fail-closed: a build without VITE_KOFI_URL renders nothing", async ({
  page,
}) => {
  test.skip(
    !NO_KOFI_DIST,
    "serve the no-URL artifact via KOFI_E2E_DIST=/tmp/dist-nokofi",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(APP);
  // The Chart Room itself still loads — only the Ko-fi scene is gone.
  await expect(page.locator("main.atlas-home")).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("grandpa-scene")).toHaveCount(0);
  await expect(page.getByTestId("grandpa-donation-bubble")).toHaveCount(0);
  const relevant = errors.filter((e) => !e.includes("Minified React error #418"));
  expect(relevant, `unexpected errors: ${JSON.stringify(relevant)}`).toEqual([]);
});
