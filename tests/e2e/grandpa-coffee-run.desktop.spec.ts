import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Grandpa's Coffee Run E2E — animated donation scene on the Chart Room home
 * (Veeresh 2026-10-07; park workflow rework).
 *
 * Beats: entrance (dotted trail unrolls) → slow walk ~9.5s (bob, cane tap,
 * mug sip, NO cloud) → kettle beat at 45% (travel pauses, front pose, mug
 * raised; a kettle drops in a dolly-vertigo move, pours, fills the mug,
 * vanishes; the walk is silent — no mid-walk ask) → arrival → park finale
 * (tree + bench fade in; grandpa sits on the bench facing the viewer, head
 * fixed, mug raised with steam + periodic invite flourish; the cloud opens
 * with the Game Designer's kid-friendly copy "Grown-ups, buy me a coffee? ☕").
 *
 * The key UX change: tapping grandpa OR the cloud swaps the cloud content to
 * the "ask a grown-up" gate workflow INSIDE THE SAME CLOUD — no separate
 * dialog. Continue opens Ko-fi in a new tab and the cloud reverts;
 * Cancel/Esc reverts. Continue is focused on open.
 *
 * Covers: slow walk with no cloud, kettle drop + pour + mug fill, park
 * finale (tree + bench), cloud ask → gate via grandpa tap and via cloud tap,
 * Continue opens Ko-fi (no navigation) and reverts, Cancel/Esc revert,
 * keyboard focus + Enter, offline hides grandpa, never covers CTAs, no
 * console errors.
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

/** Wait until the scene reaches the seated finale. */
async function waitForSeated(page: Page) {
  const scene = page.getByTestId("grandpa-scene");
  await expect(scene).toHaveAttribute("data-beat", "seated", {
    timeout: 30_000,
  });
}

test("walk has no cloud, kettle fills the mug, then the park finale", async ({
  page,
}) => {
  const errors = await loadHome(page);
  const scene = page.getByTestId("grandpa-scene");

  // Beat 1: the slow stroll — dotted trail unrolling, NO thought cloud.
  await expect(scene).toHaveAttribute("data-beat", "walking", {
    timeout: 5_000,
  });
  await expect(page.getByTestId("grandpa-path")).toBeVisible();
  await expect(page.locator(".thought-cloud")).toHaveCount(0);
  // The donation cloud stays hidden until the finale.
  await expect(page.getByTestId("grandpa-donation-bubble")).toHaveCSS(
    "visibility",
    "hidden",
  );
  // The stroll is leisurely (~9.5s): after 3s he must still be walking.
  await page.waitForTimeout(3000);
  await expect(scene).toHaveAttribute("data-beat", "walking");

  // Beat 2: the kettle — travel pauses, he faces the viewer, and the
  // kettle drops in a dolly-vertigo move. The walk is silent by design —
  // there is no mid-walk ask (the cheers text was removed 2026-10-07).
  // (Walk is 9.5s; the kettle hits at 45% ≈ 4.3s and holds 2.8s.)
  await expect(scene).toHaveAttribute("data-beat", "kettle", {
    timeout: 12_000,
  });
  await expect(page.locator(".grandpa-cheers-text")).toHaveCount(0);

  // The kettle is looming (scaled up toward the viewer).
  const kettle = page.getByTestId("grandpa-kettle");
  await expect
    .poll(
      async () =>
        parseFloat(
          await kettle.evaluate((el) => getComputedStyle(el).opacity),
        ),
      { timeout: 4_000 },
    )
    .toBeGreaterThan(0.5);

  // The pour lands: stream visible and the mug filling (fill group rising
  // from its clipped-hidden start toward translateY(0)).
  const stream = page.getByTestId("grandpa-kettle-stream");
  await expect
    .poll(
      async () =>
        parseFloat(
          await stream.evaluate((el) => getComputedStyle(el).opacity),
        ),
      { timeout: 4_000 },
    )
    .toBeGreaterThan(0.5);
  const fillTY = await page
    .getByTestId("grandpa-mug-fill")
    .evaluate((el) => {
      const t = getComputedStyle(el).transform;
      if (t === "none") return 0;
      const m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
      return m ? parseFloat(m[1]) : 999;
    });
  // The fill rises over the 2.8s pour — poll until it's near the top rather
  // than racing the stream's appearance.
  await expect
    .poll(
      async () =>
        page.getByTestId("grandpa-mug-fill").evaluate((el) => {
          const t = getComputedStyle(el).transform;
          if (t === "none") return 0;
          const m = t.match(
            /matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/,
          );
          return m ? parseFloat(m[1]) : 999;
        }),
      { timeout: 5_000 },
    )
    .toBeLessThan(10);

  // Beat 4: the park finale — tree + bench fade in, he sits facing us.
  await waitForSeated(page);
  const walker = page.getByTestId("grandpa-walker");
  const box = await walker.boundingBox();
  expect(box).not.toBeNull();
  const vp = page.viewportSize()!;
  expect(box!.x).toBeGreaterThan(vp.width / 2);
  expect(vp.height - (box!.y + box!.height)).toBeLessThanOrEqual(80);
  const comet = await page.getByTestId("comet-mascot").boundingBox();
  expect(comet).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(comet!.x + 4);

  // The seated pose is the visible one.
  const seatedOpacity = await page
    .locator(".pose-seated")
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(parseFloat(seatedOpacity)).toBeGreaterThan(0.9);

  // Park environment: tree + bench rendered and faded in.
  const park = page.getByTestId("grandpa-park");
  await expect(park).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("grandpa-tree")).toBeVisible();
  await expect(page.getByTestId("grandpa-bench")).toBeVisible();

  // Steam rising from the filled mug; the invite flourish loops.
  const steamAnim = await page
    .locator(".pose-seated .steam-1")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(steamAnim).toBe("steam-rise");
  const gestureAnim = await page
    .getByTestId("grandpa-mug-gesture")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(gestureAnim).toBe("mug-invite");

  // The cloud opened with the ask.
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(bubble).toContainText("Grown-ups, buy me a coffee? ☕");
  await expect(bubble).toContainText(
    "Your coffee keeps Meridian free for kids",
  );
  // The cloud fades in over 0.3s — poll for full opacity rather than
  // reading once mid-transition.
  await expect
    .poll(
      async () =>
        parseFloat(
          await bubble.evaluate((el) => getComputedStyle(el).opacity),
        ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0.9);

  await expectGrandpaNotCoveringCtas(page);
  expectCleanConsole(errors);
});

test("tapping grandpa opens the Ko-fi workflow inside the cloud", async ({
  page,
}) => {
  const errors = await loadHome(page);
  await waitForSeated(page);
  // The walker is animated; dispatchEvent avoids click-stability flakiness.
  await page.getByTestId("grandpa-walker").dispatchEvent("click");
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  const gate = page.getByTestId("grandpa-cloud-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("You're leaving Meridian to visit Ko-fi. Ask a grown-up!");
  await expect(gate).toContainText("Meridian is free forever");
  // UX: focus lands on Continue the moment the gate opens.
  await expect(page.getByTestId("grandpa-cloud-continue")).toBeFocused();
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("tapping the cloud message opens the workflow too", async ({ page }) => {
  const errors = await loadHome(page);
  await waitForSeated(page);
  await page.getByTestId("grandpa-bubble-ask").click();
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("Continue opens Ko-fi in a new tab and the cloud reverts", async ({
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
  await waitForSeated(page);
  await page.getByTestId("grandpa-bubble-ask").click();
  await page.getByTestId("grandpa-cloud-continue").click();
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(1);
  const call = opened[0] as { url: string; target: string; features: string };
  expect(call.url).toBe(KOFI_URL);
  expect(call.target).toBe("_blank");
  expect(call.features).toContain("noopener");
  // The cloud reverts to the ask.
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(bubble).toContainText("Grown-ups, buy me a coffee? ☕");
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("Cancel reverts the cloud without opening anything", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __opened: unknown[] }).__opened = [];
    window.open = (() => {
      (window as unknown as { __opened: unknown[] }).__opened.push(1);
      return null;
    }) as typeof window.open;
  });
  const errors = await loadHome(page);
  await waitForSeated(page);
  await page.getByTestId("grandpa-bubble-ask").click();
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
  await page.getByTestId("grandpa-cloud-cancel").click();
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  await expect(bubble).toContainText("Grown-ups, buy me a coffee? ☕");
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: unknown[] }).__opened,
  );
  expect(opened).toHaveLength(0);
  expect(page.url()).toBe(APP);
  expectCleanConsole(errors);
});

test("Esc reverts the cloud", async ({ page }) => {
  const errors = await loadHome(page);
  await waitForSeated(page);
  await page.getByTestId("grandpa-bubble-ask").click();
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
  await page.keyboard.press("Escape");
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "ask");
  expectCleanConsole(errors);
});

test("grandpa is keyboard-focusable; Enter opens the workflow", async ({
  page,
}) => {
  const errors = await loadHome(page);
  await waitForSeated(page);
  const walker = page.getByTestId("grandpa-walker");
  await walker.focus();
  await expect(walker).toBeFocused();
  const outlineWidth = await walker.evaluate(
    (el) => getComputedStyle(el).outlineWidth,
  );
  expect(outlineWidth).toBe("3px");
  // Enter activates the in-cloud workflow.
  await page.keyboard.press("Enter");
  const bubble = page.getByTestId("grandpa-donation-bubble");
  await expect(bubble).toHaveAttribute("data-cloud", "gate");
  await expect(page.getByTestId("grandpa-cloud-gate")).toBeVisible();
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
