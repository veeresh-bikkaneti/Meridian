import { test, expect } from "playwright/test";
import type { Browser, BrowserContext, ElementHandle, Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Card-redesign runtime-path E2E (built Pages artifact, base /Meridian/).
 *
 * Covers the council-decided build only (feat/card-redesign-build):
 * A. nav JOIN button height at ≤1080px (46px floor) and untouched at 1280px.
 * B. GeoDetective + Cold Trail Variant A split (image first in DOM) with
 *    whole-card action via the stretched CTA (Form S): clicks on the
 *    image, heading, paragraph, and corner inset each open the game;
 *    one focus stop per card; focus ring around the whole card.
 * C. Review my misses: due → whole-card click + visible REVIEW → cue;
 *    empty/caught-up → not focusable/clickable, no cue, no button.
 * D. Grid band: .hv5-pages children span full width at 768/1280 (row
 *    stretch only); no-op at 390px. The 768 .hv5-grid3 orphan is a
 *    separate container and is deliberately NOT covered here.
 * E. Cold Trail deactivated = absent: NOT covered — no activation
 *    switch exists in src/game/coldtrail/store.ts (verified: store holds
 *    only {v, caseIndex, stars, solved, current} + the screen-open flag),
 *    so there is nothing to wire or test; the switch spec is owed.
 *
 * Form S note: the card itself is NOT the <button> — a <button> cannot
 * contain the <h2>, and GeoDetective nests real badge <button>s
 * (EarnedBadgeRow) that must stay independently tappable. The CTA keeps
 * its text as its accessible name; its ::after covers the whole card.
 * Click loops use a fresh browser context per iteration: a started run
 * or a rescheduled deck persists in localStorage, so re-using the page
 * would resume the game instead of showing a fresh picker.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const DECK_KEY = "meridian:review-deck:v1";

async function setupContext(context: BrowserContext) {
  await serveBuiltArtifact(context);
  await context.route(FLAGS_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true, learningOutcomes: true } }),
      contentType: "application/json; charset=utf-8",
    });
  });
}

test.beforeEach(async ({ context }) => {
  await setupContext(context);
});

function deckSeed(nextDueAt: number) {
  return {
    v: 1,
    entries: {
      "e2e-deck-lincoln": {
        v: 1,
        place: {
          id: "e2e-deck-lincoln",
          name: "Lincoln",
          lon: -96.7,
          lat: 40.83,
          story: "Nebraska's capital, named for Abraham Lincoln.",
          difficulty: 2,
          edition: "state",
          regionId: "nebraska",
          regionName: "Nebraska",
          subdivision: "Nebraska",
          sourceLabel: "E2E",
          sourceHref: "https://example.com",
          mapMode: "flat",
          regionBounds: [-104.05, 39.99, -95.31, 43.0],
          radiusKm: 75,
        },
        streak: 0,
        nextDueAt,
        lastReviewedAt: 0,
        reviews: 0,
      },
    },
  };
}

async function seedDeckOn(page: Page, seed: unknown) {
  await page.addInitScript(
    ({ key, s }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
    },
    { key: DECK_KEY, s: seed },
  );
}

/** Fresh context + page on the home picker at the given width. */
async function freshHome(browser: Browser, width: number, seed?: unknown) {
  const context = await browser.newContext();
  await setupContext(context);
  const page = await context.newPage();
  if (seed !== undefined) await seedDeckOn(page, seed);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(APP_URL);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
  return { context, page };
}

async function gotoHome(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(APP_URL);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
}

async function joinHeight(page: Page) {
  const join = page.locator(".hv5-actions .hv5-btn-brown").first();
  await expect(join).toBeVisible();
  const box = await join.boundingBox();
  return box?.height ?? -1;
}

/** Focusable descendants of an element (tab stops). */
async function focusableCount(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return -1;
    return [...root.querySelectorAll("button, a, input, select, textarea, [tabindex]")]
      .filter((el) => {
        const h = el as HTMLElement;
        if (h.tabIndex < 0) return false;
        const r = h.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length;
  }, selector);
}

/** Tab from the top of the page until the given element holds focus. */
async function tabTo(page: Page, handle: ElementHandle | null) {
  if (!handle) return false;
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate((t) => document.activeElement === t, handle)) return true;
    await page.keyboard.press("Tab");
  }
  return page.evaluate((t) => document.activeElement === t, handle);
}

async function stretchRingColor(page: Page, buttonSelector: string) {
  return page.evaluate((sel) => {
    const btn = document.querySelector(sel) as HTMLElement | null;
    if (!btn) return "missing";
    return getComputedStyle(btn, "::after").borderColor;
  }, buttonSelector);
}

/** Click points inside a card: image, heading, paragraph, corner inset. */
async function cardPoints(page: Page, cardSelector: string) {
  const card = page.locator(cardSelector);
  const box = await card.boundingBox();
  const head = await card.locator("h2").boundingBox();
  const para = await card.locator("p").first().boundingBox();
  const img = await card.locator("img.hv5-pic").boundingBox();
  return {
    image: { x: img!.x + img!.width / 2, y: img!.y + img!.height / 2 },
    heading: { x: head!.x + head!.width / 2, y: head!.y + head!.height / 2 },
    paragraph: { x: para!.x + para!.width / 2, y: para!.y + para!.height / 2 },
    corner: { x: box!.x + 8, y: box!.y + 8 },
  };
}

test("A: JOIN button is 46px at ≤1080px and untouched 46.8px at 1280px", async ({ page }) => {
  for (const [width, expected] of [[390, 46], [1080, 46], [1280, 46.8]] as const) {
    await gotoHome(page, width);
    const h = await joinHeight(page);
    expect(Math.abs(h - expected)).toBeLessThanOrEqual(1);
  }
  // 768px: the wrapped nav already measured 55px before this change — the
  // min-height is a floor, not a shrink, so it stays ≥44px.
  await gotoHome(page, 768);
  expect(await joinHeight(page)).toBeGreaterThanOrEqual(44);
});

test("B: GeoDetective split order + whole-card clicks open the game", async ({ page, browser }) => {
  await gotoHome(page, 1280);
  const card = page.getByTestId("tour-stop-geodetective");
  await expect(card).toBeVisible();
  // Image before text in DOM order (not CSS order).
  const firstChildClass = await card.evaluate((el) => el.firstElementChild?.className ?? "");
  expect(firstChildClass).toContain("hv5-pic");
  const imgBox = await card.locator("img.hv5-pic").boundingBox();
  const txtBox = await card.locator(".hv5-txt").boundingBox();
  expect(imgBox!.y).toBeLessThan(txtBox!.y);

  for (const point of ["image", "heading", "paragraph", "corner"] as const) {
    const { context, page: fresh } = await freshHome(browser, 1280);
    try {
      const freshCard = fresh.getByTestId("tour-stop-geodetective");
      await freshCard.scrollIntoViewIfNeeded();
      const pt = (await cardPoints(fresh, '[data-testid="tour-stop-geodetective"]'))[point];
      await fresh.mouse.click(pt.x, pt.y);
      // Leaving the picker = the game opened.
      await expect(freshCard).toHaveCount(0, { timeout: 20_000 });
      await expect(fresh.getByTestId("home-heading")).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
});

test("B: Cold Trail split order + whole-card clicks open the game", async ({ page, browser }) => {
  await gotoHome(page, 1280);
  const card = page.locator(".hv5-dispatch");
  await expect(card).toBeVisible();
  const firstChildClass = await card.evaluate((el) => el.firstElementChild?.className ?? "");
  expect(firstChildClass).toContain("hv5-pic");
  const imgBox = await card.locator("img.hv5-pic").boundingBox();
  const txtBox = await card.locator(".hv5-txt").boundingBox();
  expect(imgBox!.y).toBeLessThan(txtBox!.y);

  for (const point of ["image", "heading", "paragraph", "corner"] as const) {
    const { context, page: fresh } = await freshHome(browser, 1280);
    try {
      const freshCard = fresh.locator(".hv5-dispatch");
      await freshCard.scrollIntoViewIfNeeded();
      const pt = (await cardPoints(fresh, ".hv5-dispatch"))[point];
      await fresh.mouse.click(pt.x, pt.y);
      await expect(freshCard).toHaveCount(0, { timeout: 20_000 });
      await expect(fresh.getByTestId("home-heading")).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
});

test("B: one focus stop per game card, ring around the whole card", async ({ page }) => {
  await gotoHome(page, 1280);
  // Clean state: no earned badges, so GeoDetective has exactly one stop.
  expect(await focusableCount(page, '[data-testid="tour-stop-geodetective"]')).toBe(1);
  expect(await focusableCount(page, ".hv5-dispatch")).toBe(1);

  const gdHandle = await page.getByTestId("tour-stop-geodetective").locator("button.hv5-go").elementHandle();
  expect(await tabTo(page, gdHandle)).toBe(true);
  expect(await stretchRingColor(page, '[data-testid="tour-stop-geodetective"] button.hv5-go')).toBe(
    "rgb(119, 89, 31)",
  );

  const ctHandle = await page.locator(".hv5-dispatch button.hv5-go").elementHandle();
  expect(await tabTo(page, ctHandle)).toBe(true);
  expect(await stretchRingColor(page, ".hv5-dispatch button.hv5-go")).toBe("rgb(119, 89, 31)");
});

test("C: Review due → tap anywhere opens review, REVIEW → cue present", async ({ page, browser }) => {
  await seedDeckOn(page, deckSeed(0));
  await gotoHome(page, 1280);
  const section = page.getByTestId("tour-stop-review");
  await expect(section).toBeVisible();
  await expect(section.locator(".hv5-review-cue")).toHaveText("REVIEW →");
  await expect(page.getByRole("button", { name: "Start review" })).toBeVisible();
  expect(await focusableCount(page, '[data-testid="tour-stop-review"]')).toBe(1);

  for (const point of ["heading", "paragraph", "cue", "corner"] as const) {
    const { context, page: fresh } = await freshHome(browser, 1280, deckSeed(0));
    try {
      const freshSection = fresh.getByTestId("tour-stop-review");
      await freshSection.scrollIntoViewIfNeeded();
      const box = await freshSection.boundingBox();
      const head = await freshSection.locator("h2").boundingBox();
      const para = await freshSection.locator("p").first().boundingBox();
      const cue = await freshSection.locator(".hv5-review-cue").boundingBox();
      const pt = {
        heading: { x: head!.x + head!.width / 2, y: head!.y + head!.height / 2 },
        paragraph: { x: para!.x + para!.width / 2, y: para!.y + para!.height / 2 },
        cue: { x: cue!.x + cue!.width / 2, y: cue!.y + cue!.height / 2 },
        corner: { x: box!.x + 8, y: box!.y + 8 },
      }[point];
      await fresh.mouse.click(pt.x, pt.y);
      await expect(freshSection).toHaveCount(0, { timeout: 20_000 });
      await expect(fresh.getByText("Lincoln", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  }
});

test("C: Review empty and caught-up → not focusable, not clickable, no cue", async ({ page, browser }) => {
  // Empty deck: no entries at all.
  {
    const { context, page: fresh } = await freshHome(browser, 1280, { v: 1, entries: {} });
    try {
      const section = fresh.getByTestId("tour-stop-review");
      await expect(section).toBeVisible();
      await expect(section).toContainText("Miss a place and it'll land here for review.");
      await expect(fresh.getByRole("button", { name: "Start review" })).toHaveCount(0);
      await expect(section.locator(".hv5-review-cue")).toHaveCount(0);
      expect(await focusableCount(fresh, '[data-testid="tour-stop-review"]')).toBe(0);
      const box = await section.boundingBox();
      await fresh.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await expect(fresh.getByTestId("home-heading")).toBeVisible();
      await expect(section).toBeVisible();
    } finally {
      await context.close();
    }
  }
  // Caught-up: entries exist but none due (far-future nextDueAt).
  {
    const { context, page: fresh } = await freshHome(browser, 1280, deckSeed(Date.now() + 30 * 24 * 3600 * 1000));
    try {
      const section = fresh.getByTestId("tour-stop-review");
      await expect(section).toContainText("All caught up!");
      await expect(fresh.getByRole("button", { name: "Start review" })).toHaveCount(0);
      await expect(section.locator(".hv5-review-cue")).toHaveCount(0);
      expect(await focusableCount(fresh, '[data-testid="tour-stop-review"]')).toBe(0);
    } finally {
      await context.close();
    }
  }
});

test("D: grid band spans full width at 768/1280, no-op at 390", async ({ page }) => {
  for (const width of [390, 680, 768, 1280]) {
    await gotoHome(page, width);
    const layout = await page.evaluate(() => {
      const pages = document.querySelector(".hv5-pages") as HTMLElement;
      const kids = [...pages.children];
      const r = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y + window.scrollY, w: b.width, h: b.height };
      };
      const pr = r(pages);
      const [about, journal] = kids.map(r);
      const footer = document.querySelector("footer");
      const fr = footer ? r(footer) : null;
      return { pr, about, journal, gap: journal.y - (about.y + about.h), footerGap: fr ? fr.y - (journal.y + journal.h) : -1 };
    });
    // Both children span the container's full width (grid-column: 1/-1).
    expect(Math.abs(layout.about.x - layout.pr.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.about.w - layout.pr.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.journal.x - layout.pr.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.journal.w - layout.pr.w)).toBeLessThanOrEqual(1);
    // 22px rhythm between the bands; no stretched-row dead slot.
    expect(Math.abs(layout.gap - 22)).toBeLessThanOrEqual(2);
    // Footer follows the band closely (bounded shift, no orphan gap).
    expect(layout.footerGap).toBeGreaterThanOrEqual(0);
    expect(layout.footerGap).toBeLessThanOrEqual(400);
  }
});
