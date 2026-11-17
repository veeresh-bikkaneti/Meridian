import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Shared shell adoption (fix/ui-shared-shell, Round 2 review A.1/A.2).
 *
 * The review measured the drift this cures: the home control sat at a
 * different x on every screen (GeoDetective 596 / Cold Trail 404 /
 * Board 440 at 1920) and wore a different name ("Meridian home" on
 * some screens, "Home" on others), and desktop headers wrapped to
 * 106px with nav items on 2–3 lines. The fix is one component —
 * SiteHeader with HomeButton — adopted screen by screen. This spec
 * pins the adopted screens (Home, GeoDetective):
 *
 * - the home control is named exactly "Home", is ≥44×44, and sits in
 *   the same slot on both screens: same size, same offset from the
 *   header's top-left content corner (the screens' page columns
 *   differ — wide vs read — so the identical quantity is the slot
 *   inside the one shared header, not the viewport x);
 * - the header is ONE row at 1280/1920/2560: brand, nav and actions
 *   share one centre line, the header stays ≤88px tall (44px control
 *   + the row's 22/18 padding), and nothing overflows horizontally.
 *
 * On main both screens fail: Home's header is the bespoke .hv5-nav
 * (brand named "Meridian home", no home-button testid in a shared
 * header) and GeoDetective's bar is a hand-rolled div.
 *
 * Runs on the built artifact via serveBuiltArtifact (hermetic
 * recipe, docs/e2e-hermetic.md); layout only, no map interaction.
 */
test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "meridian.ageProfile.v1",
      JSON.stringify({
        status: "active",
        band: "7-10",
        updatedAt: new Date().toISOString(),
        changeCount: 0,
        schemaVersion: 2,
      }),
    );
  });
}

type Box = { x: number; y: number; width: number; height: number };

async function homeControl(page: Page, label: string) {
  const home = page.getByTestId("home-button");
  await expect(home, `${label}: home control present`).toBeVisible({ timeout: 45_000 });
  // The header's entrance animation transforms the row for its first
  // beat, and a box read mid-flight lands a hair under the 44px floor
  // (43.999996 measured — the flake this wait cures). Measure only
  // once the control's box has stopped moving; the ≥44 assertion
  // itself is unchanged.
  let lastKey = "";
  await expect
    .poll(
      async () => {
        const b = await home.boundingBox();
        const key = b ? `${b.x},${b.y},${b.width},${b.height}` : "none";
        const stable = key === lastKey;
        lastKey = key;
        return stable;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  const name = await home.evaluate((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim());
  expect(name, `${label}: home control name`).toBe("Home");
  const box = (await home.boundingBox()) as Box;
  expect(box, `${label}: home control box`).not.toBeNull();
  expect(box.width, `${label}: home width ${box.width}`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label}: home height ${box.height}`).toBeGreaterThanOrEqual(44);
  return box;
}

async function headerReport(page: Page, label: string) {
  const header = page.locator("header.site-header");
  await expect(header, `${label}: SiteHeader present`).toBeVisible();
  const report = await header.evaluate((el) => {
    const hb = el.getBoundingClientRect();
    const row = el.querySelector(".site-header-row") as HTMLElement;
    const parts = [".brand-home-button, [data-testid='home-button']", ".site-header-nav", ".site-header-actions"]
      .map((sel) => row.querySelector(sel) as HTMLElement | null)
      .filter((n): n is HTMLElement => !!n && n.offsetParent !== null)
      .map((n) => {
        const b = n.getBoundingClientRect();
        return { centreY: b.top + b.height / 2, left: b.left };
      });
    const padLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    return {
      header: { x: hb.x, y: hb.y, contentX: hb.x + padLeft, width: hb.width, height: hb.height },
      parts,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(report.parts.length, `${label}: header parts on the row`).toBeGreaterThanOrEqual(2);
  const ys = report.parts.map((p) => p.centreY);
  expect(
    Math.max(...ys) - Math.min(...ys),
    `${label}: header parts share one centre line (spread ${Math.max(...ys) - Math.min(...ys)}px)`,
  ).toBeLessThanOrEqual(2);
  expect(report.header.height, `${label}: header height ${report.header.height}`).toBeLessThanOrEqual(88);
  expect(report.scrollWidth, `${label}: no horizontal overflow`).toBeLessThanOrEqual(report.innerWidth + 1);
  return report.header;
}

for (const vp of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  const tag = `${vp.width}x${vp.height}`;
  test(`Home and GeoDetective share one header and one Home at ${tag}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: vp, serviceWorkers: "block" });
    await setup(context);
    const page = await context.newPage();

    await page.goto(APP_URL);
    await expect(page.getByTestId("home-card-why-learn")).toBeVisible({ timeout: 30_000 });
    const homeHeader = await headerReport(page, `${tag} Home`);
    const homeBox = await homeControl(page, `${tag} Home`);
    // Same slot inside the header: the control's offset from the
    // header's top-left content corner is the row's padding (22px
    // top, 0 left — the row spans the header's content box). ±2px
    // for sub-pixel rounding and the entrance animation's rest state.
    expect(Math.abs(homeBox.y - homeHeader.y - 22), `${tag} Home: control top offset in header`).toBeLessThanOrEqual(2);
    expect(Math.abs(homeBox.x - homeHeader.contentX), `${tag} Home: control left offset in header`).toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: "GeoDetective: Solve a mystery" }).click();
    await expect(page.getByTestId("loop-screen")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("end-game-button")).toBeVisible({ timeout: 45_000 });
    const loopHeader = await headerReport(page, `${tag} GeoDetective`);
    const loopBox = await homeControl(page, `${tag} GeoDetective`);
    expect(Math.abs(loopBox.y - loopHeader.y - 22), `${tag} GeoDetective: control top offset in header`).toBeLessThanOrEqual(2);
    expect(Math.abs(loopBox.x - loopHeader.contentX), `${tag} GeoDetective: control left offset in header`).toBeLessThanOrEqual(2);

    // The control itself is identical on both screens.
    expect(Math.abs(loopBox.width - homeBox.width), `${tag}: home control width identical`).toBeLessThanOrEqual(1);
    expect(Math.abs(loopBox.height - homeBox.height), `${tag}: home control height identical`).toBeLessThanOrEqual(1);

    await context.close();
  });
}
