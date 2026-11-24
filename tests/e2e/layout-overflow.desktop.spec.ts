import { expect, test, type Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Layout overflow + first-visit sheet fit (fix/mobile-header-overflow,
 * PR 1 of the 2026-11-17 fix brief). Three regressions, one spec:
 *
 * 1. The shared header scrolled sideways on phones: the actions row
 *    (Join pill + Menu button) cannot shrink, so at 320px the page
 *    was 411px wide and the Menu button sat off-screen. Below the
 *    small breakpoint the Join pill now lives in the menu panel.
 * 2. The first-visit read-aloud sheet was clipped: hard-coded top
 *    offsets and a full-width class made it 411px wide at 390px and
 *    cut its last option off at 320x568. It now hangs from the
 *    --header-height token, inside the gutters, with a max height
 *    and its own scroll.
 * 3. The sheet (overlay layer) painted over the open mobile menu.
 *    The z-layer tokens put the open menu above the sheet.
 *
 * Every assertion here fails on main (4c3d84c8) and passes on the
 * branch; the revert check is recorded in the PR body.
 *
 * Extended (fix/geo-endgame-overflow): GeoDetective and the Why Learn
 * picker join the overflow contract. GeoDetective's header cluster
 * (case readout + mute + End game) could not shrink, so at 320px the
 * page was 338px wide and End game ran off-screen; the shell header's
 * gaps and the exit pill's padding now shrink below --bp-sm. The
 * sheet also pins the --header-height/--sheet-offset split: hung
 * from the real 84px header, the sheet's whole content fits 320x568
 * with no inner scroll.
 */

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Wait until the header's box stops moving after a viewport change
 *  (the grownups spec's settle rule: never measure mid-layout).
 *  Boot paints the splash twice for a moment (the route fallback and
 *  the game's ready gate). Both carry a header now, so wait until
 *  one header remains before reading its box. */
async function waitForHeaderSettled(page: Page) {
  const header = page.locator("header.site-header");
  await expect(header).toHaveCount(1);
  let last = "";
  await expect
    .poll(
      async () => {
        const box = await header.boundingBox();
        const key = box ? `${box.x},${box.y},${box.width},${box.height}` : "none";
        const stable = key === last;
        last = key;
        return stable;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

/** Answer the first-visit queue the way a player does, so the header
 *  can be measured at rest: invite "Not now", then the read-aloud
 *  sheet's "Never". Mirrors the grownups spec's pattern. */
async function dismissFirstVisitQueue(page: Page) {
  const notNow = page.getByRole("button", { name: "Not now" });
  if ((await notNow.count()) > 0) {
    await notNow.click();
  }
  const sheet = page.getByTestId("first-visit-queue");
  if (
    (await sheet.count()) > 0 &&
    (await sheet.getAttribute("data-prompt-id")) === "read-aloud-sheet"
  ) {
    await sheet.getByRole("button", { name: /Never/ }).click();
    await expect(page.locator('[data-prompt-id="read-aloud-sheet"]')).toHaveCount(0);
  }
}

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080],
] as const;

test("no horizontal overflow; every header control inside the viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(APP_NO_IDLE);
  await expect(page.locator("header.site-header")).toHaveCount(1);
  await dismissFirstVisitQueue(page);

  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitForHeaderSettled(page);

    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(widths.scroll, `${w}x${h} scrollWidth`).toBe(widths.inner);

    const controls = page.locator("header.site-header button:visible, header.site-header a:visible");
    const count = await controls.count();
    expect(count, `${w}x${h} header controls found`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = (await controls.nth(i).boundingBox())!;
      expect(box.x, `${w}x${h} control #${i} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${w}x${h} control #${i} right edge`).toBeLessThanOrEqual(w + 0.5);
    }

    // The Join pill's home: inside the menu panel below the small
    // breakpoint, on the actions row at and above it.
    const joinInRow = page.locator(".site-header-actions").getByRole("button", { name: /JOIN THE JOURNEY/ });
    if (w < 640) {
      await expect(joinInRow, `${w}x${h} Join out of the actions row`).toHaveCount(0);
      await page.locator(".site-header-menu-button").click();
      const joinInPanel = page
        .locator(".site-header-panel")
        .getByRole("button", { name: /JOIN THE JOURNEY/ });
      await expect(joinInPanel, `${w}x${h} Join inside the menu panel`).toBeVisible();
      const box = (await joinInPanel.boundingBox())!;
      expect(box.x + box.width, `${w}x${h} panel Join right edge`).toBeLessThanOrEqual(w + 0.5);
      await page.locator(".site-header-menu-button").click();
      await expect(page.locator(".site-header-panel")).toHaveCount(0);
    } else {
      await expect(joinInRow, `${w}x${h} Join on the actions row`).toBeVisible();
    }
  }
});

test("first-visit read-aloud sheet fits 320x568; every option reachable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(APP_NO_IDLE);

  const queue = page.getByTestId("first-visit-queue");
  await expect(queue).toBeVisible();
  if ((await queue.getAttribute("data-prompt-id")) === "tour-invite") {
    await queue.getByRole("button", { name: "Not now" }).click();
  }
  await expect(queue).toHaveAttribute("data-prompt-id", "read-aloud-sheet");

  // Q1 contract holds while the sheet is up: the header never moves.
  const headerBox = (await page.locator("header.site-header").boundingBox())!;
  expect(headerBox.y, "header top with sheet pending").toBeLessThanOrEqual(40);

  // The --sheet-offset split: hung from the real header, the sheet's
  // whole content fits this viewport — no inner scroll needed (on the
  // conflated 19rem token its scrollHeight was 363 against a 248 box).
  const sheetScroll = await queue.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }));
  expect(
    sheetScroll.scrollH,
    `sheet fits without inner scroll (scrollHeight ${sheetScroll.scrollH} vs clientHeight ${sheetScroll.clientH})`,
  ).toBeLessThanOrEqual(sheetScroll.clientH + 1);

  const sheetBox = (await queue.boundingBox())!;
  expect(sheetBox.x, "sheet left edge").toBeGreaterThanOrEqual(0);
  expect(sheetBox.x + sheetBox.width, "sheet right edge").toBeLessThanOrEqual(320 + 0.5);
  expect(sheetBox.y, "sheet top").toBeGreaterThanOrEqual(0);
  expect(sheetBox.y + sheetBox.height, "sheet bottom").toBeLessThanOrEqual(568 + 0.5);

  // Every option is reachable inside the sheet's own scroll and
  // tappable — the last one was cut off on main.
  const options = queue.getByRole("button");
  const count = await options.count();
  expect(count, "read-aloud options found").toBeGreaterThanOrEqual(3);
  for (let i = 0; i < count; i++) {
    const option = options.nth(i);
    await option.scrollIntoViewIfNeeded();
    const box = (await option.boundingBox())!;
    expect(box.x, `option #${i} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `option #${i} right edge`).toBeLessThanOrEqual(320 + 0.5);
    expect(box.y, `option #${i} top`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `option #${i} bottom`).toBeLessThanOrEqual(568 + 0.5);
  }
  // A real tap on the last option answers the sheet.
  await options.nth(count - 1).click();
  await expect(page.locator('[data-prompt-id="read-aloud-sheet"]')).toHaveCount(0);
});

/** The overflow contract on a screen: the page never scrolls
 *  sideways, and every visible header control sits inside the
 *  viewport. Returns the measured widths for the caller's message. */
async function expectNoOverflow(page: Page, label: string, w: number) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(widths.scroll, `${label} scrollWidth`).toBe(widths.inner);
  const controls = page.locator("header.site-header button:visible, header.site-header a:visible");
  const count = await controls.count();
  expect(count, `${label} header controls found`).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = (await controls.nth(i).boundingBox())!;
    expect(box.x, `${label} control #${i} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${label} control #${i} right edge`).toBeLessThanOrEqual(w + 0.5);
  }
}

test("GeoDetective: no horizontal overflow at five viewports; End game fits 320", async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(APP_NO_IDLE);
  await expect(page.locator("header.site-header")).toHaveCount(1);
  await dismissFirstVisitQueue(page);

  await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
  await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("end-game-button")).toBeVisible({ timeout: 45_000 });

  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitForHeaderSettled(page);
    await expectNoOverflow(page, `GeoDetective ${w}x${h}`, w);
    if (w === 320) {
      const end = (await page.getByTestId("end-game-button").boundingBox())!;
      expect(end.x + end.width, "End game right edge at 320").toBeLessThanOrEqual(320.5);
      expect(end.height, "End game hit height at 320").toBeGreaterThanOrEqual(44);
    }
  }
});

test("Why Learn picker: no horizontal overflow at five viewports", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(APP_NO_IDLE);
  await expect(page.locator("header.site-header")).toHaveCount(1);
  await dismissFirstVisitQueue(page);

  await page.getByRole("button", { name: "Why Do We Learn This?: Start exploring" }).click();
  await expect(page.getByTestId("subject-picker")).toBeVisible({ timeout: 30_000 });

  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(widths.scroll, `picker ${w}x${h} scrollWidth`).toBe(widths.inner);
  }
});

test("open menu paints above the first-visit sheet at 390", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP_NO_IDLE);

  const queue = page.getByTestId("first-visit-queue");
  await expect(queue).toBeVisible();

  await page.locator(".site-header-menu-button").click();
  const panel = page.locator(".site-header-panel");
  await expect(panel).toBeVisible();

  // Every menu item's centre must hit-test to the panel itself —
  // on main the sheet covers two of the seven items.
  const items = panel.locator("button:visible, a:visible");
  const count = await items.count();
  expect(count, "menu items found").toBeGreaterThanOrEqual(7);
  for (let i = 0; i < count; i++) {
    const box = (await items.nth(i).boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        const panelEl = document.querySelector(".site-header-panel");
        return !!el && !!panelEl && (el === panelEl || panelEl.contains(el));
      },
      [cx, cy],
    );
    expect(hit, `menu item #${i} centre hit-tests to the panel`).toBe(true);
  }
});
