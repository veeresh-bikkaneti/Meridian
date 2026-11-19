import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Footer links must never be present in the DOM but painted over
 * (regression pin for the PR #534 Home regression, 2026-11-18).
 *
 * What happened: PR #534 moved Home's SiteFooter out of
 * <main class="atlas-home">. Inside main, the rule
 * `.atlas-home > :not(.atlas-bg)` lifted the footer above Home's
 * fixed, opaque .atlas-bg backdrop (position: fixed, z-index: 0).
 * Outside main the footer was a static element, and a positioned
 * z-index:0 backdrop paints above static in-flow content — so the
 * links kept their boxes, colours and hit targets (every existing
 * toBeVisible / elementFromPoint check stayed green) while the
 * backdrop's gradient covered the text. The owner saw only Grandpa.
 *
 * Playwright's toBeVisible cannot see a paint-order cover (the
 * backdrop is pointer-events: none, so hit tests pass too). This
 * spec therefore asserts RENDERED visibility: it screenshots each
 * link's box, decodes the shot in-page, and requires pixels of the
 * link's own computed text colour — the gradient alone paints none.
 */

test.setTimeout(120_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Count pixels in a PNG screenshot (base64) that match `rgb` within
 *  a per-channel tolerance. Decoded in the page via canvas so the
 *  spec needs no image library. */
async function countColourPixels(
  page: Page,
  pngBase64: string,
  rgb: [number, number, number],
  tolerance: number,
): Promise<number> {
  return page.evaluate(
    async ({ b64, rgb, tolerance }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i] - rgb[0]) <= tolerance &&
          Math.abs(data[i + 1] - rgb[1]) <= tolerance &&
          Math.abs(data[i + 2] - rgb[2]) <= tolerance
        ) {
          count += 1;
        }
      }
      return count;
    },
    { b64: pngBase64, rgb, tolerance },
  );
}

async function expectLinkPainted(page: Page, testId: string) {
  const link = page.getByTestId(testId);
  await expect(link).toBeVisible();
  // Centre the link itself: the footer wraps to several rows at phone
  // widths, so a lower-row link can sit outside the viewport (and the
  // clip) when only the footer's top was scrolled into view.
  await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(350);
  const box = await link.boundingBox();
  expect(box, `${testId} has a box`).not.toBeNull();
  const rgb = await link.evaluate((el) => {
    const m = getComputedStyle(el).color.match(/\d+/g);
    return (m ?? []).slice(0, 3).map(Number) as [number, number, number];
  });
  const shot = await page.screenshot({ clip: box! });
  const painted = await countColourPixels(page, shot.toString("base64"), rgb, 14);
  // A painted 14px label + its underline put well over a hundred
  // text-coloured pixels in the box; the bare backdrop gradient
  // paints none. 40 leaves generous room for anti-aliasing.
  expect(
    painted,
    `${testId} must be painted in its own text colour (got ${painted} matching px) — ` +
      `a link that is in the DOM but painted over is not visible`,
  ).toBeGreaterThanOrEqual(40);
}

for (const vp of [
  { name: "1280x800", width: 1280, height: 800 },
  { name: "390x844", width: 390, height: 844 },
]) {
  test(`home footer links are painted, not just in the DOM (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(APP_NO_IDLE);
    const footer = page.locator("footer.agep-footer");
    await footer.scrollIntoViewIfNeeded();
    await expectLinkPainted(page, "grownups-link");
    await expectLinkPainted(page, "privacy-link");
    await expectLinkPainted(page, "kids-privacy-note-link");
    // The links row must sit above any page backdrop in paint order:
    // the footer carries its own lift, it does not borrow its host's.
    const lift = await footer.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, zIndex: cs.zIndex };
    });
    expect(
      lift.position,
      "footer must be positioned so a fixed page backdrop cannot paint over it",
    ).not.toBe("static");
  });
}
