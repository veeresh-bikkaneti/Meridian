import { test, expect } from "playwright/test";
import type { Browser, BrowserContext, Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";

/**
 * Loading-orbs runtime-path E2E (built Pages artifact, base /Meridian/).
 *
 * Covers feat/loading-orbs (commit 1ccc1fb) against the rebuilt artifact:
 * 1. Globe orb shows, then crossfades once the texture lands (1280 and
 *    390 — at 390 the globe zone sits below the fold behind the
 *    IntersectionObserver gate, so the zone is scrolled into view first).
 * 2. Reduced motion: the globe path renders the static disc with NO orb,
 *    and a card-image overlay renders a STATIC ring (no running
 *    animation) until load, then clears.
 * 3. Card-image orb shows, then clears on load (response delayed through
 *    a test-held gate so the orb is observable, then released).
 * 4. Journal-entry image orb shows, then clears on load (the dynamic
 *    journalImageUrl site, not only the static card images).
 * 5. Orb clears on image error, with NO new fallback UI invented.
 * 6. No orb on maps or in the storyteller/home story area.
 * 7. Masked-blob check: a screenshot of a card-image orb rendering
 *    inside the masked .hv5-art blob shape.
 *
 * No hard sleeps anywhere: every wait is an assertion on element state
 * (visible / detached / count) or a test-held route gate released by the
 * test itself once the pre-release state has been asserted.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const EVIDENCE = "review-orb-evidence/test-auto/masked-blob-journal-card-orb.png";

/** A gate the test holds closed, then releases once the held state is asserted. */
function makeGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function setupContext(context: BrowserContext) {
  await serveBuiltArtifact(context);
}

/** Hold every request matching `match` at the gate, then fall through to the disk server. */
async function delayRoute(
  context: BrowserContext,
  match: (url: URL) => boolean,
  gate: { promise: Promise<void> },
) {
  await context.route(match, async (route) => {
    await gate.promise;
    await route.fallback();
  });
}

async function gotoHome(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(APP_URL);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
}

async function globeZone(page: Page) {
  const zone = page.locator(".hv5-globe-zone");
  await zone.scrollIntoViewIfNeeded();
  return zone;
}

test("globe orb shows then crossfades on textured ready (1280)", async ({ page, context }) => {
  const gate = makeGate();
  await setupContext(context);
  await delayRoute(context, (url) => url.href.includes("globe-texture") && url.pathname.endsWith(".webp"), gate);
  await gotoHome(page, 1280);
  const zone = await globeZone(page);
  const mount = zone.locator(".hv5-globe-mount");
  await expect(mount).toBeVisible();
  // Texture held: the orb must be present over the mount.
  await expect(mount.locator(".hv5-globe-orb")).toBeVisible();
  gate.release();
  // Texture lands: the orb crossfades out (transitionend unmounts it).
  await expect(mount.locator(".hv5-globe-orb")).toHaveCount(0, { timeout: 20_000 });
  await expect(mount.locator("canvas")).toBeVisible();
});

test("globe orb shows then crossfades on textured ready (390, scrolled into view)", async ({
  page,
  context,
}) => {
  const gate = makeGate();
  await setupContext(context);
  await delayRoute(context, (url) => url.href.includes("globe-texture") && url.pathname.endsWith(".webp"), gate);
  await gotoHome(page, 390);
  // Below the fold behind the IntersectionObserver gate: scroll first.
  const zone = await globeZone(page);
  const mount = zone.locator(".hv5-globe-mount");
  await expect(mount).toBeVisible();
  await expect(mount.locator(".hv5-globe-orb")).toBeVisible();
  gate.release();
  await expect(mount.locator(".hv5-globe-orb")).toHaveCount(0, { timeout: 20_000 });
  await expect(mount.locator("canvas")).toBeVisible();
});

test("reduced motion: static disc with no orb; card overlay is a static ring, then clears", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const gate = makeGate();
    await setupContext(context);
    await delayRoute(context, (url) => url.href.includes("desert-ruins") && url.pathname.endsWith(".webp"), gate);
    const page = await context.newPage();
    await gotoHome(page, 1280);
    // Globe path: static disc, never an orb.
    await expect(page.locator(".hv5-globe-fallback")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".hv5-globe-orb")).toHaveCount(0);
    // Card path: GeoDetective image held — the overlay renders a STATIC ring.
    const card = page.getByTestId("tour-stop-geodetective");
    await card.scrollIntoViewIfNeeded();
    const orb = card.locator(".hv5-lazy-orb");
    await expect(orb).toBeVisible();
    const spinner = orb.locator(".meridian-spinner");
    await expect(spinner).toBeVisible();
    const anim = await spinner.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, running: el.getAnimations().length };
    });
    expect(anim.name).toBe("none");
    expect(anim.running).toBe(0);
    gate.release();
    await expect(card.locator(".hv5-lazy-orb")).toHaveCount(0, { timeout: 20_000 });
    const img = card.locator(".hv5-lazy-img img");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test("card-image orb shows then clears on load", async ({ page, context }) => {
  const gate = makeGate();
  await setupContext(context);
  await delayRoute(context, (url) => url.href.includes("desert-ruins") && url.pathname.endsWith(".webp"), gate);
  await gotoHome(page, 1280);
  const card = page.getByTestId("tour-stop-geodetective");
  await card.scrollIntoViewIfNeeded();
  const orb = card.locator(".hv5-lazy-orb");
  await expect(orb).toBeVisible();
  gate.release();
  await expect(card.locator(".hv5-lazy-orb")).toHaveCount(0, { timeout: 20_000 });
  const img = card.locator(".hv5-lazy-img img");
  await expect(img).toBeVisible();
  expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("journal-entry image orb shows then clears on load", async ({ page, context }) => {
  const gate = makeGate();
  await setupContext(context);
  await delayRoute(context, (url) => url.href.includes("/images/journal/") && url.pathname.endsWith(".webp"), gate);
  await gotoHome(page, 1280);
  const journal = page.locator("#home-journal");
  await journal.scrollIntoViewIfNeeded();
  const notes = journal.locator('[data-testid="journal-note"]');
  await expect(notes.first()).toBeVisible();
  const count = await notes.count();
  expect(count).toBeGreaterThan(0);
  // Held journal art: the first entry's orb is observable.
  await expect(notes.first().locator(".hv5-lazy-orb")).toBeVisible();
  gate.release();
  // Every entry orb clears and every entry image decodes.
  await expect(journal.locator(".hv5-lazy-orb")).toHaveCount(0, { timeout: 20_000 });
  for (let i = 0; i < count; i++) {
    const img = notes.nth(i).locator("figure.hv5-entry-art img");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});

test("orb clears on image error and no fallback UI appears", async ({ page, context }) => {
  await setupContext(context);
  // Abort the Cold Trail art: the error path must clear the orb and
  // invent nothing (no alert, no error copy, no replacement element).
  await context.route(
    (url) => url.href.includes("patagonia") && url.pathname.endsWith(".webp"),
    async (route) => {
      await route.abort();
    },
  );
  await gotoHome(page, 1280);
  const card = page.locator(".hv5-dispatch");
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".hv5-lazy-orb")).toHaveCount(0, { timeout: 20_000 });
  await expect(card.locator('[role="alert"]')).toHaveCount(0);
  const cardText = (await card.textContent()) ?? "";
  expect(cardText).not.toMatch(/couldn.t load|failed to load|image unavailable/i);
  // The card itself survives the dead image; its CTA is still present.
  await expect(card.locator("button.hv5-go")).toBeVisible();
});

test("no orb on maps or in the storyteller/home story area", async ({ page, context }) => {
  await setupContext(context);
  await gotoHome(page, 1280);
  // Storyteller/home story area: no orb-overlay elements inside it.
  const story = page.locator(".hv5-storyteller");
  await expect(story.first()).toBeVisible({ timeout: 20_000 });
  await expect(story.locator(".hv5-globe-orb, .hv5-lazy-orb")).toHaveCount(0);
  // Open an edition to a map screen: maps keep their pill/dialog
  // behavior and carry no orb overlays.
  await page.getByRole("button", { name: "Play the globe" }).click();
  await expect(page.locator(".satellite-map")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".satellite-map .hv5-globe-orb, .satellite-map .hv5-lazy-orb")).toHaveCount(0);
  await expect(page.locator(".hv5-globe-orb, .hv5-lazy-orb")).toHaveCount(0);
});

test("masked blob: card-image orb renders inside the masked .hv5-art shape", async ({
  page,
  context,
}) => {
  const gate = makeGate();
  await setupContext(context);
  await delayRoute(context, (url) => url.href.includes("journal-tree") && url.pathname.endsWith(".webp"), gate);
  await gotoHome(page, 1280);
  const card = page.getByTestId("journal-card");
  await card.scrollIntoViewIfNeeded();
  const wrapper = card.locator(".hv5-art");
  await expect(wrapper).toHaveCount(1);
  // The wrapper carries the radial blob mask (masked .hv5-art shape).
  const mask = await wrapper.evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.maskImage || cs.webkitMaskImage || "";
  });
  expect(mask).toContain("radial-gradient");
  // Screenshot the held state FIRST so the evidence exists even though the
  // visibility assertion below fails (see report: wrapper is 0-height
  // while the art is held, so the DOM-present orb paints nothing).
  await card.screenshot({ path: EVIDENCE });
  // With the art held, the orb is visible inside that masked wrapper.
  await expect(wrapper.locator(".hv5-lazy-orb")).toBeVisible();
  gate.release();
  await expect(card.locator(".hv5-lazy-orb")).toHaveCount(0, { timeout: 20_000 });
});
