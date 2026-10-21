import { test, expect, type Browser, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Home visual layout pins (two defects, 2026-10-21). Provenance, so
 * the record stays honest: the owner reported defect 1 from an ~880px
 * screenshot of the live page; the fixing crew's reproduction sweep
 * established the other widths and found defect 2 — the owner did not
 * report that one.
 *
 * Defect 1 — the storyteller's greeting bubble left the screen. The
 * bubble (.storyteller-banner-popover) anchors to the host's right edge
 * and opens leftward, but in the v5 hero the host is the last item of a
 * wrapping flex row (.hv5-hero-top). Whenever the row wrapped — 768,
 * 880, 1280 and 1440px in the crew's sweep — the host landed at the
 * LEFT of its new line and the bubble opened off the left edge of the
 * viewport, covering the headline. At 1024px the row did not wrap and
 * everything was fine; at 390px a phones-only margin rule saved it.
 * The fix keeps the host at the right end of its line at every width
 * and caps the bubble above 680px so it also clears the headline's
 * text — 184px at 681–767px, 224px at 768px and up. The band needs the
 * narrower cap because the headline wraps: its lower lines can reach
 * further right than its first line, and the panel's first review
 * measured a 224px bubble overlapping them at 681–708px (worst at
 * 681px, ~29px of overlap). These tests measure real boxes in a FRESH
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
 * within 56px — the card's own 26px bottom padding plus slack.
 *
 * Honest limit: this pin drives a pointer tap only — it exercises no
 * keyboard or screen-reader route to the greeting, so it says nothing
 * about that path.
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

const MASCOT_WIDTHS = [390, 681, 700, 767, 768, 880, 1024, 1280, 1440];

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
    // Force-click: the figure's breathing animation never settles,
    // which defeats Playwright's stability check (real taps don't need
    // it) — the sibling storyteller specs force theirs for the same
    // reason.
    await page.getByTestId("storyteller-figure").click({ force: true });
    const bubble = page.getByTestId("storyteller-home-bubble");
    await expect(bubble).toBeVisible({ timeout: 15_000 });

    const figure = page.getByTestId("storyteller-figure");
    // Wait for the BUBBLE's box to settle (two samples 150ms apart
    // agreeing within 1px) instead of sleeping a fixed 1,200ms: the
    // entrance animations (650ms figure arrival, 150ms bubble fade)
    // end on their own schedule, and a fixed wait both wastes time on
    // fast runs and can still land mid-animation on a slow machine —
    // the sibling storyteller-home.desktop spec's "56x56" settle race
    // is the standing lesson. The bubble's box settles once its fade
    // ends; the FIGURE's box never does (it breathes while the greeting
    // plays, reading 56–58px against its designed 56px), so the figure
    // checks below keep their tolerance.
    await expect
      .poll(
        async () => {
          const a = await bubble.boundingBox();
          await page.waitForTimeout(150);
          const b = await bubble.boundingBox();
          if (!a || !b) return false;
          return (
            Math.abs(a.x - b.x) <= 1 &&
            Math.abs(a.y - b.y) <= 1 &&
            Math.abs(a.width - b.width) <= 1 &&
            Math.abs(a.height - b.height) <= 1
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);

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

    // Bubble clear of the headline's actual text glyphs — EVERY line,
    // not just the first: at these widths the headline wraps, and its
    // lower lines can reach further right than line 1 (that is exactly
    // what the 681–708px overlap was). Asserted at ≥681px, where the
    // fix's geometry (right-end host + the banded caps in home-v5.css —
    // 184px at 681–767px, 224px above) guarantees the clearance. On
    // phones (390px) the bubble
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
    // The void under the text may not exceed 56px: #home-about is a
    // .hv5-card, whose bottom padding is 26px, so 56px allows the
    // padding plus slack for rounding and font settling — and still
    // discriminates, since pre-fix this measured 1,336–1,827px at
    // two-column widths.
    const voidPx = about!.y + about!.height - (lastP!.y + lastP!.height);
    expect(
      voidPx,
      `about void @${width}: ${Math.round(voidPx)}px of empty card`,
    ).toBeLessThanOrEqual(56);

    await page.context().close();
  });
}
