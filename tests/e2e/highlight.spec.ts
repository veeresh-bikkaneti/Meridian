import { test, expect, type Page } from "playwright/test";
import { readFile } from "node:fs/promises";
import {
  serveBuiltArtifact,
  readPhase,
  evidencePath,
  screenshotDiffRatio,
} from "./helpers";

/**
 * Region-highlight E2E (Track 2 — device feedback: the old highlight was
 * too subtle).
 *
 * Scenario: a "state" run narrows onto Nebraska; at narrow completion the
 * controller paints the region highlight (region-fill / region-casing /
 * region-outline layers). Both tests assert highlight VISIBLE via pixel
 * sampling — no flaky screenshot diffs:
 *
 * - H1 (animated path): after the reveal settles, the bold gold boundary
 *   stroke must produce a large count of bright-gold pixels. The threshold
 *   targets the 4.5 px full-opacity outline only (the 0.18 fill over the
 *   dark starfield is too dim to pass the gold gate), so this is a direct
 *   assertion on the "bolder boundary stroke" change.
 * - H2 (prefers-reduced-motion): the same highlight paints as a static
 *   strong highlight — gold pixels present, and two screenshots 1.2 s
 *   apart are visually identical (no reveal flash / settle animation in
 *   flight).
 *
 * Measurement surfaces (production-observable, no test hooks):
 * - `.satellite-map[data-zoom]` — rounded zoom, written on every zoomend.
 * - `.satellite-map > [aria-live="polite"]` — "Nebraska view" at narrow completion.
 *
 * NOTE: this spec needs a `highlight` project entry in
 * playwright.config.ts (`testMatch: /highlight\\.spec\\.ts/`); without it
 * no project picks the file up.
 */

const mapEl = (page: Page) => page.locator(".satellite-map");
const liveRegion = (page: Page) =>
  page.locator('.satellite-map > [aria-live="polite"]');
const readZoom = async (page: Page): Promise<number> =>
  Number(await mapEl(page).getAttribute("data-zoom"));
const readAnnouncement = async (page: Page): Promise<string> =>
  (await liveRegion(page).textContent())?.trim() ?? "";
const introActive = async (page: Page): Promise<boolean> =>
  (await mapEl(page).getAttribute("aria-hidden")) === "true";

/** Start a state run for `region` and wait for narrow completion. */
async function startStateRun(page: Page, region: string): Promise<void> {
  await page.goto("http://127.0.0.1:4123/Meridian/");
  await expect(
    page.getByRole("button", { name: "Choose a state" }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Choose a state" }).click();
  // State edition drills through the country list first (F8 drill-down).
  await page.getByRole("button", { name: "United States" }).click();
  await expect(page.getByRole("heading", { name: "United States" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: region }).click();
  await expect(mapEl(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 20_000,
  });
  // Narrow completion: intro releases the screen, the controller announces
  // "<Region> view", the game reaches the aim phase, zoom stabilizes.
  await expect.poll(() => introActive(page), { timeout: 45_000 }).toBe(false);
  await expect
    .poll(() => readAnnouncement(page), { timeout: 10_000 })
    .toBe(`${region} view`);
  await expect.poll(() => readPhase(page), { timeout: 10_000 }).toBe("aim");
  await expect
    .poll(
      async () => {
        const a = await readZoom(page);
        await page.waitForTimeout(500);
        return a === (await readZoom(page));
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

/**
 * Count bright-gold pixels in a PNG screenshot, decoded in-page (no new
 * npm packages). The gate admits the 4.5 px full-opacity gold outline
 * (#f2c14e) and rejects the dim fill wash, the dark casing, and the
 * near-black starfield.
 */
async function countGoldPixels(page: Page, pngPath: string): Promise<number> {
  const buf = await readFile(pngPath);
  return page.evaluate(async (b64) => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = b64;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let gold = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r >= 180 && g >= 120 && b <= 150 && r - b >= 60) gold++;
    }
    return gold;
  }, `data:image/png;base64,${buf.toString("base64")}`);
}

/**
 * Nebraska's border spans most of the 1440 px viewport at the settled
 * regional framing; a 4.5 px stroke along it covers on the order of ten
 * thousand pixels. The threshold sits an order of magnitude below that so
 * normal antialiasing/camera variance can't flake it, while a missing or
 * hairline stroke (the old 2.5 px at 0.95 over dim tiles) can't pass.
 */
const GOLD_PIXEL_THRESHOLD = 1500;

test.beforeEach(async ({ page }) => {
  await serveBuiltArtifact(page.context());
});

test("H1 — region highlight boundary stroke is unmistakable after reveal", async ({
  page,
}) => {
  await startStateRun(page, "Nebraska");
  // The reveal runs flash (650 ms) then settle (700 ms delay + 800 ms);
  // wait it out so the assertion measures the resting highlight.
  await page.waitForTimeout(3000);
  const shot = await evidencePath("h1-nebraska-highlight.png");
  await mapEl(page).screenshot({ path: shot });
  const gold = await countGoldPixels(page, shot);
  console.log(`H1 bright-gold boundary pixels: ${gold}`);
  expect(gold).toBeGreaterThan(GOLD_PIXEL_THRESHOLD);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("H2 — static strong highlight, no reveal animation", async ({
    page,
  }) => {
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);
    await startStateRun(page, "Nebraska");
    // Instant path: no transitions registered, so once the intro settles
    // the highlight is already at its resting strength — no wait needed.
    const shot = await evidencePath("h2-nebraska-highlight-reduced.png");
    await mapEl(page).screenshot({ path: shot });
    const gold = await countGoldPixels(page, shot);
    console.log(`H2 bright-gold boundary pixels (reduced): ${gold}`);
    expect(gold).toBeGreaterThan(GOLD_PIXEL_THRESHOLD);

    // No animation in flight: two frames 1.2 s apart must be identical.
    const a = await evidencePath("h2-reduced-still-a.png");
    const b = await evidencePath("h2-reduced-still-b.png");
    await mapEl(page).screenshot({ path: a });
    await page.waitForTimeout(1200);
    await mapEl(page).screenshot({ path: b });
    const { ratio } = await screenshotDiffRatio(page, a, b);
    console.log(`H2 stillness diff ratio: ${ratio}`);
    expect(ratio).toBeLessThan(0.002);
  });
});
