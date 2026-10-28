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
 *    empty → not focusable/clickable, no cue, no button; caught-up →
 *    no cue/CTA either, but the Part 1 reset opener renders (total > 0).
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
 *
 * Seeded-badge tests (panel nit 🟡3): badges are seeded with the repo's
 * own fixture — meridian.passport.badges.v1 = [{ id: "clean-round",
 * earnedAt: "2026-10-09T12:00:00.000Z", schemaVersion: 1 }] (the same
 * seed tests/e2e/home-badges-readaloud.spec.ts uses). They cover the
 * highest-risk interaction, previously checked only by a live visual
 * pass: chip taps toggle the blurb without opening the game, card taps
 * still open the game with badges present, and the chip stop precedes
 * the CTA stop in tab order with the CTA remaining one stop.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const FLAGS_PATTERN = "**/flags.json";
const DECK_KEY = "meridian:review-deck:v1";
const BADGES_KEY = "meridian.passport.badges.v1";

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

/** Seed earned badges with the repo's own fixture (see header note). */
async function seedBadgesOn(page: Page) {
  await page.addInitScript(
    ({ key }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify([
            { id: "clean-round", earnedAt: "2026-10-09T12:00:00.000Z", schemaVersion: 1 },
          ]),
        );
    },
    { key: BADGES_KEY },
  );
}

/** Fresh context + page on the home picker at the given width. */
async function freshHome(browser: Browser, width: number, seed?: unknown, badges = false) {
  const context = await browser.newContext();
  await setupContext(context);
  const page = await context.newPage();
  if (seed !== undefined) await seedDeckOn(page, seed);
  if (badges) await seedBadgesOn(page);
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

/** F1: sample the stretched ring WHILE focus is held on the button —
 * sampling after focus moves reads the unfocused style (a false
 * reading that bit a previous pass). Returns the ::after ring style,
 * its geometry vs the card, and the button's own fallback outline. */
async function ringWhileFocused(page: Page, cardSelector: string) {
  return page.evaluate((sel) => {
    const card = document.querySelector(sel) as HTMLElement | null;
    const btn = card?.querySelector("button.hv5-go") as HTMLElement | null;
    if (!card || !btn) return null;
    const after = getComputedStyle(btn, "::after");
    const btnStyle = getComputedStyle(btn);
    const cardBox = card.getBoundingClientRect();
    const img = card.querySelector(".hv5-pic img") as HTMLElement | null;
    const imgBox = img ? img.getBoundingClientRect() : null;
    return {
      focused: document.activeElement === btn,
      borderColor: after.borderColor,
      boxShadow: after.boxShadow,
      // ::after inset:0 against the card (its offsetParent) = the ring
      // box IS the card box, so the ring perimeter crosses the photo.
      offsetParentIsCard: btn.offsetParent === card,
      top: after.top,
      left: after.left,
      right: after.right,
      bottom: after.bottom,
      fallbackOutlineWidth: btnStyle.outlineWidth,
      fallbackOutlineColor: btnStyle.outlineColor,
      // Photo sits strictly inside the card box the ring encloses.
      photoInsideCard: imgBox
        ? imgBox.top >= cardBox.top - 1 &&
          imgBox.left >= cardBox.left - 1 &&
          imgBox.bottom <= cardBox.bottom + 1 &&
          imgBox.right <= cardBox.right + 1
        : false,
    };
  }, cardSelector);
}

/** Click points inside a card: image, heading, paragraph, corner inset. */
async function cardPoints(page: Page, cardSelector: string) {
  const card = page.locator(cardSelector);
  const box = await card.boundingBox();
  const head = await card.locator("h2").boundingBox();
  const para = await card.locator("p").first().boundingBox();
  const img = await card.locator(".hv5-pic img").boundingBox();
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
  const imgBox = await card.locator(".hv5-pic img").boundingBox();
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
  const imgBox = await card.locator(".hv5-pic img").boundingBox();
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
  // F1, sampled WHILE focus is held: two-tone ring (brown border +
  // cream halo + brown outer band, inset so card overflow:hidden
  // cannot clip it), geometry = whole card, fallback outline present.
  const gdRing = await ringWhileFocused(page, '[data-testid="tour-stop-geodetective"]');
  expect(gdRing?.focused).toBe(true);
  expect(gdRing?.borderColor).toBe("rgb(119, 89, 31)");
  expect(gdRing?.boxShadow).toContain("rgb(253, 251, 243)");
  expect(gdRing?.boxShadow).toContain("rgb(119, 89, 31)");
  expect(gdRing?.boxShadow).toContain("inset");
  expect(gdRing?.offsetParentIsCard).toBe(true);
  expect(gdRing?.top).toBe("0px");
  expect(gdRing?.left).toBe("0px");
  expect(gdRing?.right).toBe("0px");
  expect(gdRing?.bottom).toBe("0px");
  expect(gdRing?.photoInsideCard).toBe(true);
  expect(gdRing?.fallbackOutlineWidth).not.toBe("0px");
  expect(gdRing?.fallbackOutlineColor).toBe("rgb(119, 89, 31)");

  const ctHandle = await page.locator(".hv5-dispatch button.hv5-go").elementHandle();
  expect(await tabTo(page, ctHandle)).toBe(true);
  expect(await stretchRingColor(page, ".hv5-dispatch button.hv5-go")).toBe("rgb(119, 89, 31)");
  const ctRing = await ringWhileFocused(page, ".hv5-dispatch");
  expect(ctRing?.focused).toBe(true);
  expect(ctRing?.borderColor).toBe("rgb(119, 89, 31)");
  expect(ctRing?.boxShadow).toContain("rgb(253, 251, 243)");
  expect(ctRing?.boxShadow).toContain("rgb(119, 89, 31)");
  expect(ctRing?.offsetParentIsCard).toBe(true);
  expect(ctRing?.photoInsideCard).toBe(true);
  expect(ctRing?.fallbackOutlineWidth).not.toBe("0px");
});

test("B: seeded badge chip toggles its blurb and never opens the game; card taps still open it", async ({ browser }) => {
  // (a) Chip: independently tappable — tap toggles the blurb, game stays closed.
  const { context, page: badged } = await freshHome(browser, 1280, undefined, true);
  try {
    const card = badged.getByTestId("tour-stop-geodetective");
    await expect(card).toBeVisible();
    const chip = badged.getByTestId("badge-chip-clean-round");
    await expect(chip).toBeVisible();
    await expect(chip).toContainText("Clean Round");
    // With badges present the card has exactly two stops: chip + CTA.
    expect(await focusableCount(badged, '[data-testid="tour-stop-geodetective"]')).toBe(2);
    await expect(badged.getByTestId("badge-blurb-clean-round")).toHaveCount(0);
    await chip.click();
    await expect(badged.getByTestId("badge-blurb-clean-round")).toBeVisible();
    await expect(badged.getByTestId("badge-blurb-clean-round")).toHaveText(
      "A whole round without a single hint — nice figuring it out yourself!",
    );
    expect(await chip.getAttribute("aria-expanded")).toBe("true");
    // Tapping the chip did NOT open the game: picker and card still here.
    await expect(badged.getByTestId("home-heading")).toBeVisible();
    await expect(card).toBeVisible();
    // Second tap collapses the blurb, still no game.
    await chip.click();
    await expect(badged.getByTestId("badge-blurb-clean-round")).toHaveCount(0);
    expect(await chip.getAttribute("aria-expanded")).toBe("false");
    await expect(badged.getByTestId("home-heading")).toBeVisible();
  } finally {
    await context.close();
  }

  // (b) Card taps (picture, heading, corner inset) still open the game
  // with badges present — the badge row must not swallow card taps.
  for (const point of ["image", "heading", "corner"] as const) {
    const { context: ctx, page: fresh } = await freshHome(browser, 1280, undefined, true);
    try {
      const freshCard = fresh.getByTestId("tour-stop-geodetective");
      await expect(fresh.getByTestId("badge-chip-clean-round")).toBeVisible();
      await freshCard.scrollIntoViewIfNeeded();
      const pt = (await cardPoints(fresh, '[data-testid="tour-stop-geodetective"]'))[point];
      await fresh.mouse.click(pt.x, pt.y);
      await expect(freshCard).toHaveCount(0, { timeout: 20_000 });
      await expect(fresh.getByTestId("home-heading")).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  }
});

test("B: seeded badges — chip stop precedes the CTA stop, CTA stays one stop", async ({ browser }) => {
  const { context, page: badged } = await freshHome(browser, 1280, undefined, true);
  try {
    const card = badged.getByTestId("tour-stop-geodetective");
    await expect(card.getByTestId("earned-badges")).toBeVisible();
    expect(await focusableCount(badged, '[data-testid="tour-stop-geodetective"]')).toBe(2);

    const chipHandle = await badged.getByTestId("badge-chip-clean-round").elementHandle();
    expect(await tabTo(badged, chipHandle)).toBe(true);
    // The very next Tab lands on the CTA: chip precedes CTA.
    await badged.keyboard.press("Tab");
    const ctaFocused = await badged.evaluate(() => {
      const btn = document.querySelector(
        '[data-testid="tour-stop-geodetective"] button.hv5-go',
      );
      return document.activeElement === btn;
    });
    expect(ctaFocused).toBe(true);
    // The stop after the CTA has left the card: the CTA is one stop, not two.
    await badged.keyboard.press("Tab");
    const stillOnCard = await badged.evaluate(() => {
      const cardEl = document.querySelector('[data-testid="tour-stop-geodetective"]');
      return !!cardEl?.contains(document.activeElement);
    });
    expect(stillOnCard).toBe(false);
  } finally {
    await context.close();
  }
});

test("F: CTA accessible names carry the card name; articles labelled; due outline darkened", async ({ page, browser }) => {
  await gotoHome(page, 1280);
  // F2: accessible name prefixes the card name; visible text stays a
  // substring (2.5.3 Label in Name); emoji is aria-hidden, not in name.
  const gd = page.getByRole("button", { name: "GeoDetective: Solve a mystery" });
  await expect(gd).toBeVisible();
  expect(await gd.getAttribute("aria-label")).toBe("GeoDetective: Solve a mystery");
  expect(await gd.textContent()).toContain("Solve a mystery");
  expect(await gd.textContent()).not.toContain("GeoDetective");
  const ct = page.getByRole("button", { name: "Cold Trail: Start the trail" });
  await expect(ct).toBeVisible();
  expect(await ct.getAttribute("aria-label")).toBe("Cold Trail: Start the trail");
  expect(await ct.textContent()).toContain("Start the trail");
  // F4: articles reference their h2 ids again.
  expect(await page.getByTestId("tour-stop-geodetective").getAttribute("aria-labelledby")).toBe(
    "geodetective-title",
  );
  expect(await page.locator(".hv5-dispatch").getAttribute("aria-labelledby")).toBe("coldtrail-title");
  // F2 (Review) + F3 (due outline #8a6d2f) on a seeded due deck.
  const { context, page: fresh } = await freshHome(browser, 1280, deckSeed(0));
  try {
    const review = fresh.getByRole("button", { name: "Review my misses: Start review" });
    await expect(review).toBeVisible();
    expect(await review.getAttribute("aria-label")).toBe("Review my misses: Start review");
    expect(await review.textContent()).toContain("Start review");
    const outline = await fresh.evaluate(() => {
      const section = document.querySelector('[data-testid="tour-stop-review"]') as HTMLElement | null;
      if (!section) return "";
      const s = getComputedStyle(section);
      return `${s.outlineColor} ${s.outlineWidth} ${s.outlineStyle}`;
    });
    expect(outline).toBe("rgb(138, 109, 47) 3px solid");
  } finally {
    await context.close();
  }
});

type RectBox = { x: number; y: number; width: number; height: number };

/** Two boxes overlap only if they share more than ~0.5px in both axes
 *  (same epsilon idiom as mobile-home-overlap.spec.ts). */
function boxesOverlap(a: RectBox, b: RectBox): boolean {
  const eps = 0.5;
  return (
    a.x + eps < b.x + b.width - eps &&
    b.x + eps < a.x + a.width - eps &&
    a.y + eps < b.y + b.height - eps &&
    b.y + eps < a.y + a.height - eps
  );
}

/** Part 2 (manifest D9): ONE page.evaluate snapshots the cue, the
 *  illustration, and the card rects atomically — no scroll or layout
 *  can interleave between the reads (friend-challenge single-evaluate
 *  pattern). */
async function cueArtSnapshot(page: Page) {
  return page.evaluate(() => {
    const section = document.querySelector('[data-testid="tour-stop-review"]');
    const cue = section?.querySelector(".hv5-review-cue");
    const art = section?.querySelector(".hv5-art");
    const rect = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return { card: rect(section), cue: rect(cue), art: rect(art) };
  });
}

test("C: Review due → tap anywhere opens review, REVIEW → cue present", async ({ page, browser }) => {
  await seedDeckOn(page, deckSeed(0));
  await gotoHome(page, 1280);
  const section = page.getByTestId("tour-stop-review");
  await expect(section).toBeVisible();
  await expect(section.locator(".hv5-review-cue")).toHaveText("REVIEW →");
  await expect(page.getByRole("button", { name: "Review my misses: Start review" })).toBeVisible();
  // Part 1 cure (manifest D9): the count is 2, not 1 — with deck
  // total > 0 the card now also hosts the "Start over" reset opener
  // (CTA + opener). The opener sits in-flow in the text column, clear
  // of the cue's centre click point, so the tap-anywhere loop below
  // (heading / paragraph / cue / corner) still starts review.
  expect(await focusableCount(page, '[data-testid="tour-stop-review"]')).toBe(2);

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

test("C: Review due → REVIEW cue never overlaps the illustration (1280 + 1024)", async ({ browser }) => {
  // Manifest D9 contract: cue ∩ art is empty (0.5px epsilon) and both
  // are fully visible inside the card, at desktop widths including the
  // 1024px regime (769–1279) no other suite measures.
  for (const [width, height] of [[1280, 900], [1024, 768]] as const) {
    const { context, page: fresh } = await freshHome(browser, width, deckSeed(0));
    try {
      await fresh.setViewportSize({ width, height });
      const section = fresh.getByTestId("tour-stop-review");
      await expect(section).toBeVisible();
      await expect(section.locator(".hv5-review-cue")).toHaveText("REVIEW →");
      await section.scrollIntoViewIfNeeded();
      const snap = await cueArtSnapshot(fresh);
      expect(snap.cue, "REVIEW cue has a bounding box").not.toBeNull();
      expect(snap.art, "review illustration has a bounding box").not.toBeNull();
      expect(snap.card, "review card has a bounding box").not.toBeNull();
      const { cue, art, card } = snap as { cue: RectBox; art: RectBox; card: RectBox };
      expect(boxesOverlap(cue, art), "REVIEW cue overlaps review illustration").toBe(false);
      // Both fully visible: each box sits entirely inside the card box.
      for (const [name, box] of [["REVIEW cue", cue], ["review illustration", art]] as const) {
        expect(box.width, `${name} width > 0`).toBeGreaterThan(0);
        expect(box.height, `${name} height > 0`).toBeGreaterThan(0);
        expect(box.x, `${name} left edge inside card`).toBeGreaterThanOrEqual(card.x - 0.5);
        expect(box.y, `${name} top edge inside card`).toBeGreaterThanOrEqual(card.y - 0.5);
        expect(box.x + box.width, `${name} right edge inside card`).toBeLessThanOrEqual(
          card.x + card.width + 0.5,
        );
        expect(box.y + box.height, `${name} bottom edge inside card`).toBeLessThanOrEqual(
          card.y + card.height + 0.5,
        );
      }
    } finally {
      await context.close();
    }
  }
});

test("C: Review empty → not focusable, not clickable, no cue; caught-up → only the reset opener", async ({ page, browser }) => {
  // Empty deck: no entries at all.
  {
    const { context, page: fresh } = await freshHome(browser, 1280, { v: 1, entries: {} });
    try {
      const section = fresh.getByTestId("tour-stop-review");
      await expect(section).toBeVisible();
      await expect(section).toContainText("Miss a place and it'll land here for review.");
      await expect(fresh.getByRole("button", { name: "Review my misses: Start review" })).toHaveCount(0);
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
      await expect(fresh.getByRole("button", { name: "Review my misses: Start review" })).toHaveCount(0);
      await expect(section.locator(".hv5-review-cue")).toHaveCount(0);
      // Part 1 cure (manifest D10): the caught-up card DOES carry one
      // focusable element — the "Start over" reset opener, which
      // renders whenever deck total > 0 (due OR caught-up). There is
      // still no review CTA and no cue, and the card itself is not
      // clickable (the click assertion above is the empty-deck half).
      expect(await focusableCount(fresh, '[data-testid="tour-stop-review"]')).toBe(1);
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
