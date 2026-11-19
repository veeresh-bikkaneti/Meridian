import { test, expect, type Page } from "playwright/test";
import {
  serveBuiltArtifact,
  commitPin,
  readPhase,
  dismissTileOverlayIfPresent,
  spotViewportPoint,
  NO_IDLE,
} from "./helpers";

/**
 * Grandpa once per visit + tour card clearance (fix/grandpa-once-per-visit).
 *
 * Bug 1: GrandpaCoffeeRun lives in the shared footer, so every route
 * change remounted it and replayed the walk + trail lines. The scene now
 * records the session's one walk in sessionStorage when a walk begins;
 * later mounts in the same session start seated. This spec walks on a
 * fresh visit, leaves for /credits, comes back, and requires the first
 * trail caption to stay absent and Grandpa to be seated.
 *
 * Bug 2: the tutorial beat-2 banner (top-16) sat inside the run screen's
 * top chrome footprint on narrow screens. It now anchors at top-32;
 * this spec proves the sound toggle and Contrast pill are clear of the
 * card and clickable with the card on screen, at 1280 and 390 px.
 *
 * Build requirement (same as grandpa-coffee-run.desktop.spec.ts): the
 * artifact must be built with the Ko-fi URL, e.g.
 *   VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages
 */
test.setTimeout(240_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

const APP = `http://127.0.0.1:4123/Meridian/?idle-ms=${NO_IDLE}`;
const FIRST_CAPTION = "These hills did not ask my knees for permission.";

const KOFI_URL = process.env.VITE_KOFI_URL?.trim();
if (!KOFI_URL) {
  throw new Error(
    "E2E requires VITE_KOFI_URL at build time: " +
      "VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages",
  );
}

test("grandpa walks once per session: no replay after a route change", async ({
  page,
}) => {
  await page.goto(APP);
  const scene = page.getByTestId("grandpa-scene");
  await expect(scene).toBeVisible({ timeout: 20_000 });
  await scene.scrollIntoViewIfNeeded();
  // First visit: he walks and the first trail caption shows.
  await expect(page.locator(".grandpa-quip")).toHaveText(FIRST_CAPTION, {
    timeout: 20_000,
  });
  await expect(scene).toHaveAttribute("data-mode", "strip");

  // Away to /credits and back Home — same session, new footer mounts.
  // (In-app links: serveBuiltArtifact serves the shell at the root only,
  // so a deep-link goto would 404 — every spec navigates in-app.)
  const creditsLink = page.getByTestId("credits-link");
  await creditsLink.scrollIntoViewIfNeeded();
  await creditsLink.click();
  await expect(page).toHaveURL(/\/credits/);
  await expect(page.getByTestId("grandpa-scene")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("link", { name: "Play the game" }).click();
  await expect(page).toHaveURL(/\/Meridian\/($|\?|#)/);
  const back = page.getByTestId("grandpa-scene");
  await expect(back).toBeVisible({ timeout: 20_000 });
  await back.scrollIntoViewIfNeeded();
  await expect(back).toHaveAttribute("data-mode", "seated");
  await expect(back).toHaveAttribute("data-beat", "seated");
  // Bounded wait: the caption must not appear again this session.
  await expect(page.locator(".grandpa-quip")).toHaveCount(0);
  await page.waitForTimeout(3_000);
  await expect(page.locator(".grandpa-quip")).toHaveCount(0);
  await expect(page.getByText(FIRST_CAPTION)).toHaveCount(0);
});

async function commitPracticePin(page: Page): Promise<void> {
  const map = page.locator(".satellite-map");
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissTileOverlayIfPresent(page);
    try {
      await expect
        .poll(() => map.getAttribute("data-tile-status"), { timeout: 30_000 })
        .toBe("ready");
      break;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  await expect
    .poll(
      async () => {
        const a = await map.getAttribute("data-zoom");
        await page.waitForTimeout(800);
        const b = await map.getAttribute("data-zoom");
        return a === b ? a : null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  const spot = await spotViewportPoint(page);
  expect(spot).not.toBeNull();
  const { phase } = await commitPin(page, spot!.x, spot!.y);
  expect(phase).toBe("story");
}

async function expectTogglesClearAndClickable(page: Page): Promise<void> {
  const banner = page.getByTestId("tutorial-beat-2");
  await expect(banner).toBeVisible({ timeout: 30_000 });
  for (const testId of ["sound-toggle-game", "high-contrast-toggle-game"]) {
    const toggle = page.getByTestId(testId);
    await expect(toggle).toBeVisible();
    const result = await page.evaluate(
      ({ bannerId, toggleId }) => {
        const b = document
          .querySelector(`[data-testid="${bannerId}"]`)!
          .getBoundingClientRect();
        const el = document.querySelector(`[data-testid="${toggleId}"]`)!;
        const r = el.getBoundingClientRect();
        const intersects =
          b.left < r.right &&
          b.right > r.left &&
          b.top < r.bottom &&
          b.bottom > r.top;
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        const owned =
          hit instanceof Element &&
          (hit.closest(`[data-testid="${toggleId}"]`) !== null ||
            hit === el);
        return { intersects, owned };
      },
      { bannerId: "tutorial-beat-2", toggleId: testId },
    );
    expect(result.intersects, `${testId} must not intersect the tour card`).toBe(false);
    expect(result.owned, `${testId} centre must hit the toggle itself`).toBe(true);
  }
  // A real click lands on the sound toggle while the card is up.
  await page.getByTestId("sound-toggle-game").click();
}

for (const width of [1280, 390]) {
  test(`tour card clears the sound + contrast toggles at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width === 1280 ? 800 : 844,
    });
    await page.goto(APP);
    await expect(
      page.getByRole("button", { name: "Play the globe" }),
    ).toBeVisible({ timeout: 30_000 });
    const invite = page.getByTestId("tutorial-invite");
    await expect(invite).toBeVisible();
    await invite.getByRole("button", { name: "Take the tour" }).click();
    await expect(page.locator(".satellite-map")).toBeVisible({
      timeout: 60_000,
    });
    await expect.poll(() => readPhase(page), { timeout: 30_000 }).toBe("aim");
    await commitPracticePin(page);
    await expectTogglesClearAndClickable(page);
  });
}
