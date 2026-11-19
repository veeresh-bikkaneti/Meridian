import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * D1 hero geometry (owner-approved, 2026-11-18) — this spec
 * replaces why-learn-hero-cap.desktop.spec.ts, which pinned the
 * retired Variant B geometry (the viewport-height film cap and
 * the first-row peek). The D1 contract, measured on the built
 * page:
 *
 * - the world band (.wl-world) is its own section in normal flow
 *   directly under the header, ABOVE the hero card — the two
 *   never overlap, and the card's own mt-4 is the whole gap
 *   (card top − band bottom = 16px);
 * - the heading sits fully on the solid hero card, below the
 *   band's bottom edge, at every size;
 * - at 681px and up the film is a flex share of its card
 *   (flex 0 1 56% at 16/9), NOT sized by the viewport: inside the
 *   wide page container (max 1280px) the film measures the same
 *   675.4×379.9 at 1280, 1920 and 3840 wide;
 * - exactly one band control on the page, inside the hero title
 *   block, in its collapsed selected-band pill state (this spec
 *   seeds a band); the retired change-band-button is absent;
 * - no sideways overflow.
 */
test.setTimeout(120_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/?idle-ms=3600000";
const PROFILE_KEY = "meridian.ageProfile.v1";

async function setup(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true } }),
      contentType: "application/json; charset=utf-8",
    }),
  );
  await context.addInitScript(
    (key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          status: "active",
          band: "10-18",
          updatedAt: new Date().toISOString(),
          changeCount: 0,
          schemaVersion: 2,
        }),
      );
    },
    PROFILE_KEY,
  );
}

async function openPicker(page: Page) {
  await page.goto(APP_URL);
  const card = page.getByTestId("home-card-why-learn");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card
    .getByRole("button", { name: "Why Do We Learn This?: Start exploring" })
    .click();
  await expect(page.getByTestId("subject-picker")).toBeVisible();
  await expect(page.getByTestId("subject-row-math")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
}

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };

async function measure(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: r.top + window.scrollY,
        bottom: r.bottom + window.scrollY,
        left: r.left + window.scrollX,
        right: r.right + window.scrollX,
        width: r.width,
        height: r.height,
      };
    };
    const picker = document.querySelector('[data-testid="subject-picker"]');
    const band = document.querySelector(".wl-world");
    const card = document.querySelector(".screen-hero");
    const film = document.querySelector(".why-learn-hero");
    const heading = card?.querySelector("h1") ?? null;
    const overlapArea = (a: Box | null, b: Box | null) => {
      if (!a || !b) return -1;
      const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return w * h;
    };
    // Content = everything the picker renders after the header.
    let contentBottom = 0;
    let contentTop = Number.POSITIVE_INFINITY;
    picker?.querySelectorAll(":scope > *:not(header)").forEach((el) => {
      // Content = the page's real flow content. The band itself
      // and the aria-hidden drift layer (an absolute inset-0
      // texture) are not content.
      if (el === band || el.classList.contains("why-learn-drift")) return;
      const r = el.getBoundingClientRect();
      if (r.height === 0) return;
      contentTop = Math.min(contentTop, r.top + window.scrollY);
      contentBottom = Math.max(contentBottom, r.bottom + window.scrollY);
    });
    const bandBox = rect(band);
    const contentBox: Box | null =
      bandBox && Number.isFinite(contentTop)
        ? { top: contentTop, bottom: contentBottom, left: bandBox.left, right: bandBox.right, width: bandBox.width, height: contentBottom - contentTop }
        : null;
    return {
      band: bandBox,
      card: rect(card),
      film: rect(film),
      heading: rect(heading),
      bandOverlapsCard: overlapArea(bandBox, rect(card)),
      bandOverlapsContent: overlapArea(bandBox, contentBox),
      bandAndCardShareParent:
        !!band && !!card && band.parentElement === picker && card.parentElement === picker,
      bandBeforeCard:
        !!band && !!card &&
        (band.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      bandControlCount: document.querySelectorAll('[data-testid="age-band-control"]').length,
      bandControlInsideTitleBlock: !!document.querySelector(
        '.screen-hero-band [data-testid="age-band-control"]',
      ),
      changeBandButtonCount: document.querySelectorAll('[data-testid="change-band-button"]').length,
    };
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2000 },
]) {
  test(`D1 hero: band section above the card, film is a card share at ${viewport.width}x${viewport.height}`, async ({
    page,
    context,
  }) => {
    await setup(context);
    await page.setViewportSize(viewport);
    await openPicker(page);

    const m = await measure(page);
    expect(m.band, "world band present").not.toBeNull();
    expect(m.card, "hero card present").not.toBeNull();
    expect(m.film, "hero film present").not.toBeNull();
    expect(m.heading, "heading present").not.toBeNull();

    // The band is its own section: same parent as the card,
    // before it in the flow, with zero overlap anywhere.
    expect(m.bandAndCardShareParent, "band and card are sibling sections of the picker").toBe(true);
    expect(m.bandBeforeCard, "band section comes before the hero card").toBe(true);
    expect(m.bandOverlapsCard, "band × card overlap").toBe(0);
    expect(m.bandOverlapsContent, "band × content overlap").toBe(0);
    expect(m.card!.top - m.band!.bottom, "the card's mt-4 is the whole gap").toBeCloseTo(16, 0);

    // The heading lands fully on the solid card, below the band.
    expect(m.heading!.top, "heading below the band's bottom edge").toBeGreaterThanOrEqual(m.band!.bottom - 0.5);
    expect(m.heading!.top, "heading inside the card").toBeGreaterThanOrEqual(m.card!.top - 0.5);
    expect(m.heading!.bottom, "heading inside the card").toBeLessThanOrEqual(m.card!.bottom + 0.5);

    // The film is sized by its card: the same flex-share box at
    // every wide viewport (the container caps at 1280px), 16/9.
    expect(Math.abs(m.film!.width - 675.4), `film width ${m.film!.width}`).toBeLessThanOrEqual(3);
    expect(Math.abs(m.film!.height - 379.9), `film height ${m.film!.height}`).toBeLessThanOrEqual(3);
    expect(Math.abs(m.film!.width / m.film!.height - 16 / 9)).toBeLessThan(0.04);

    // One band control, in the title block, as the selected pill.
    expect(m.bandControlCount, "exactly one band control").toBe(1);
    expect(m.bandControlInsideTitleBlock, "band control inside the title block").toBe(true);
    expect(m.changeBandButtonCount, "the retired Change band button is absent").toBe(0);
    await expect(page.getByTestId("band-selected-pill")).toHaveText("Ages 10-18");

    expect(m.overflowX, "no sideways overflow").toBeLessThanOrEqual(0);
  });
}

test("D1 hero at 390x844: stacked layout, band still its own section", async ({ page, context }) => {
  await setup(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPicker(page);

  const m = await measure(page);
  expect(m.bandOverlapsCard, "band × card overlap").toBe(0);
  expect(m.bandOverlapsContent, "band × content overlap").toBe(0);
  expect(m.card!.top - m.band!.bottom, "the card's mt-4 is the whole gap").toBeCloseTo(16, 0);
  expect(m.heading!.top, "heading below the band's bottom edge").toBeGreaterThanOrEqual(m.band!.bottom - 0.5);
  // Phones stack: the film takes the card's full content width.
  expect(Math.abs(m.film!.width - (m.card!.width - 2)), "film fills the stacked card").toBeLessThanOrEqual(3);
  expect(m.overflowX, "no sideways overflow").toBeLessThanOrEqual(0);
});
