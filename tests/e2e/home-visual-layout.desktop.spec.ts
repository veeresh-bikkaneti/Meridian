import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Home visual layout pins (owner report 2026-10-21, two defects).
 *
 * Defect 1 — the storyteller's greeting bubble left the screen. The
 * bubble (.storyteller-banner-popover) anchors to the host's right edge
 * and opens leftward, but in the v5 hero the host is the last item of a
 * wrapping flex row (.hv5-hero-top). Whenever the row wrapped — 768,
 * 880, 1280 and 1440px in the 2026-10-21 sweep — the host landed at the
 * LEFT of its new line and the bubble opened off the left edge of the
 * viewport, covering the headline. At 1024px the row did not wrap and
 * everything was fine; at 390px a phones-only margin rule saved it.
 * The fix keeps the host at the right end of its line at every width
 * and caps the bubble at 224px above 680px so it also clears the
 * headline's text. These tests measure real boxes in a FRESH
 * first-visit profile (tutorial invite up; a figure tap dismisses it
 * and starts the greeting, the owner's exact path): figure and bubble
 * fully inside the viewport at every width, and — at ≥681px, where the
 * bubble hangs beside the headline — the bubble clear of every
 * headline glyph box (Range rects, not the h1's layout box). At 390px
 * the bubble transiently overlays the headline's first line by design
 * (see the note in the test), so phones pin containment only.
 *
 * Defect 2 — the About card's white void. .hv5-pages is a grid whose
 * items stretch to the row height by default, so the two-paragraph
 * About section was stretched to the Journal section's height and
 * painted ~1,300–1,800px of empty card under its text at two-column
 * widths. The fix is align-items: start. These tests measure the void
 * (card bottom minus last paragraph bottom) and require it to stay
 * within the card's own bottom padding.
 */
test.setTimeout(240_000);

const APP = "http://127.0.0.1:4123/Meridian/";
/** Box tolerance in px (sub-pixel rounding + entrance-animation rest). */
const TOL = 2;

async function openFreshHome(browser: Browser, width: number): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  await serveBuiltArtifact(context);
  const page = await context.newPage();
  await page.goto(APP);
  await expect(page.getByTestId("storyteller-home")).toBeVisible({
    timeout: 20_000,
  });
  return page;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/** The h1's visible glyph boxes (one Range rect per line fragment). */
async function headlineGlyphRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const h1 = document.querySelector('[data-testid="home-heading"]');
    if (!h1) return [];
    const range = document.createRange();
    range.selectNodeContents(h1);
    return [...range.getClientRects()]
      .filter((r) => r.width >= 3 && r.height >= 5)
      .map((r) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      }));
  });
}

function intersects(a: Rect, b: Rect, tol: number): boolean {
  return (
    a.x < b.right - tol &&
    a.right > b.x + tol &&
    a.y < b.bottom - tol &&
    a.bottom > b.y + tol
  );
}

const MASCOT_WIDTHS = [390, 768, 880, 1024, 1280, 1440];

for (const width of MASCOT_WIDTHS) {
  test(`storyteller greeting on screen and clear of the headline @${width}px`, async ({
    browser,
  }) => {
    const page = await openFreshHome(browser, width);
    // First visit: the tutorial invite is up and holds the greeting.
    await expect(page.getByTestId("tutorial-invite")).toBeVisible({
      timeout: 15_000,
    });
    // The owner's path: tap the figure — the invite dismisses and the
    // greeting bubble appears under the figure.
    await page.getByTestId("storyteller-figure").click({ force: true });
    const bubble = page.getByTestId("storyteller-home-bubble");
    await expect(bubble).toBeVisible({ timeout: 15_000 });

    const figure = page.getByTestId("storyteller-figure");
    // Let the entrance animations finish (650ms figure arrival, 150ms
    // bubble fade). The figure keeps a subtle "breathing" animation
    // while the greeting plays, so its box is never perfectly still —
    // it is 56px by design and reads 56–58px mid-breath; the checks
    // below use a tolerance that absorbs that.
    await page.waitForTimeout(1_200);

    const fBox = await figure.boundingBox();
    const bBox = await bubble.boundingBox();
    expect(fBox, "figure box").not.toBeNull();
    expect(bBox, "bubble box").not.toBeNull();
    const fig: Rect = {
      x: fBox!.x,
      y: fBox!.y,
      width: fBox!.width,
      height: fBox!.height,
      right: fBox!.x + fBox!.width,
      bottom: fBox!.y + fBox!.height,
    };
    const bub: Rect = {
      x: bBox!.x,
      y: bBox!.y,
      width: bBox!.width,
      height: bBox!.height,
      right: bBox!.x + bBox!.width,
      bottom: bBox!.y + bBox!.height,
    };

    // The figure is its designed size (56px, ±breath/rounding).
    expect(fig.width, `figure width @${width}`).toBeGreaterThanOrEqual(54);
    expect(fig.width, `figure width @${width}`).toBeLessThanOrEqual(62);
    expect(fig.height, `figure height @${width}`).toBeGreaterThanOrEqual(54);
    expect(fig.height, `figure height @${width}`).toBeLessThanOrEqual(62);

    // Figure fully inside the viewport.
    expect(fig.x, `figure left @${width}`).toBeGreaterThanOrEqual(-TOL);
    expect(fig.right, `figure right @${width}`).toBeLessThanOrEqual(width + TOL);
    expect(fig.y, `figure top @${width}`).toBeGreaterThanOrEqual(-TOL);

    // Bubble fully inside the viewport (the owner's screenshot: it
    // hung off the left edge with only the dismiss button showing).
    expect(bub.x, `bubble left @${width}: ${JSON.stringify(bub)}`).toBeGreaterThanOrEqual(-TOL);
    expect(bub.right, `bubble right @${width}`).toBeLessThanOrEqual(width + TOL);

    // Bubble clear of the headline's actual text glyphs. This is
    // asserted at ≥681px, where the bubble hangs BESIDE the headline's
    // first line and the fix's geometry (right-end host + 224px cap)
    // guarantees horizontal clearance. On phones (390px) the bubble
    // hangs from a wrapped figure row directly above the headline and
    // transiently overlays its first line until dismissed — that is
    // the popover's long-standing design ("absolute, never reflows the
    // page; it overlays what is below the row") and is NOT the owner's
    // defect, so phones are pinned on viewport containment only.
    if (width >= 681) {
      const glyphs = await headlineGlyphRects(page);
      expect(glyphs.length, "headline glyph rects").toBeGreaterThan(0);
      for (const g of glyphs) {
        expect(
          intersects(bub, g, TOL),
          `bubble overlaps headline glyph ${JSON.stringify(g)} @${width}: bubble ${JSON.stringify(bub)}`,
        ).toBe(false);
      }
    }

    await page.context().close();
  });
}

const ABOUT_WIDTHS = [390, 768, 1024, 1280];

for (const width of ABOUT_WIDTHS) {
  test(`about card keeps its own height beside the journal @${width}px`, async ({
    browser,
  }) => {
    const page = await openFreshHome(browser, width);
    await page.locator("#home-about").scrollIntoViewIfNeeded();
    // Journal art is lazy — wait until the section's height settles so
    // the void measurement is not taken mid-load.
    await expect
      .poll(
        async () => {
          const b = await page.locator("#home-journal").boundingBox();
          return b ? Math.round(b.height) : 0;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(300);
    await page.waitForTimeout(500);

    const about = await page.locator("#home-about").boundingBox();
    const lastP = await page.locator("#home-about p").last().boundingBox();
    expect(about, "about box").not.toBeNull();
    expect(lastP, "about last paragraph box").not.toBeNull();
    // The void under the text may not exceed the card's bottom padding
    // (40px desktop / 32px phone) plus slack. Pre-fix this measured
    // 1,336–1,827px at two-column widths.
    const voidPx = about!.y + about!.height - (lastP!.y + lastP!.height);
    expect(
      voidPx,
      `about void @${width}: ${Math.round(voidPx)}px of empty card`,
    ).toBeLessThanOrEqual(56);

    await page.context().close();
  });
}
