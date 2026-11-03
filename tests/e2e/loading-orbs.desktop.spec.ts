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
 * 2. Reduced motion: the globe path renders the static disc with NO orb.
 *    The GeoDetective card (a governed film since feat/home-card-films)
 *    renders its still directly with NO orb and NO video fetch.
 * 3. Grown-ups art film (feat/smooth-cards Part 2 redo, 2026-11-03):
 *    the .hv5-art slots left LazyHomeImage for the CardFilm system,
 *    so no orb exists there anymore. With the film held at a gate,
 *    the poster fills the slot and no orb appears; on release the
 *    film mounts. (The orb-on-card-image test this replaces covered
 *    the grown-ups LazyHomeImage still, removed by that redo.)
 * 4. Journal-entry image orb shows, then clears on load (the dynamic
 *    journalImageUrl site, not only the static card images).
 * 5. Film error path: aborting the Cold Trail .mp4 lands the card on
 *    its still, with NO new fallback UI invented.
 * 6. No orb on maps or in the storyteller/home story area.
 * 7. Banner check: the Journal .hv5-art slot (a full-bleed banner
 *    since the 2026-11-03 rework; the radial blob mask it carried
 *    as a corner illustration is removed) hosts the Journal film
 *    slot — poster first, film after the gate — and still never
 *    an orb.
 *
 * No hard sleeps anywhere: every wait is an assertion on element state
 * (visible / detached / count) or a test-held route gate released by the
 * test itself once the pre-release state has been asserted.
 */

test.setTimeout(240_000);

const APP_URL = "http://127.0.0.1:4123/Meridian/";
const EVIDENCE = "review-orb-evidence/test-auto/masked-blob-journal-card-film.png";

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

test("reduced motion: static disc with no orb; GeoDetective film card shows its still, no video fetch", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    await setupContext(context);
    const mp4Requests: string[] = [];
    context.on("request", (req) => {
      if (req.url().endsWith(".mp4")) mp4Requests.push(req.url());
    });
    const page = await context.newPage();
    await gotoHome(page, 1280);
    // Globe path: static disc, never an orb.
    await expect(page.locator(".hv5-globe-fallback")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".hv5-globe-orb")).toHaveCount(0);
    // Film card path: the still renders directly — no video element,
    // no loading orb (the film component has no orb), and the still
    // actually decodes.
    const card = page.getByTestId("tour-stop-geodetective");
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("video")).toHaveCount(0);
    await expect(card.locator(".hv5-lazy-orb")).toHaveCount(0);
    const film = card.getByTestId("card-film-geodetective");
    await expect(film).toBeVisible();
    const img = film.locator("img");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const src = (await img.getAttribute("src")) ?? "";
    expect(src).toContain("geodetective-still");
    // Zero video fetch under reduced motion: no .mp4 was requested.
    expect(mp4Requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("grown-ups art film: poster fills the slot, no orb, film follows on release", async ({ page, context }) => {
  const gate = makeGate();
  await setupContext(context);
  await delayRoute(context, (url) => url.href.includes("grownups-film") && url.pathname.endsWith(".mp4"), gate);
  await gotoHome(page, 1280);
  const card = page.getByTestId("grownups-card");
  await card.scrollIntoViewIfNeeded();
  // The art slot is a governed film now (CardFilm): there is no
  // loading orb on it at any point — the poster fills the slot
  // while the film is held, exactly as on the two game cards.
  await expect(card.locator(".hv5-lazy-orb")).toHaveCount(0);
  const film = card.getByTestId("card-film-grownups");
  await expect(film).toBeVisible();
  gate.release();
  const video = film.locator("video");
  await expect(video).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).readyState), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(2);
  await expect(card.locator(".hv5-lazy-orb")).toHaveCount(0);
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

test("film error lands Cold Trail on its still and no fallback UI appears", async ({ page, context }) => {
  await setupContext(context);
  // Abort the Cold Trail film: the error path must swap the card to
  // its still and invent nothing (no alert, no error copy, no
  // replacement element beyond the still itself).
  await context.route(
    (url) => url.href.includes("coldtrail-film") && url.pathname.endsWith(".mp4"),
    async (route) => {
      await route.abort();
    },
  );
  await gotoHome(page, 1280);
  const card = page.locator(".hv5-dispatch");
  await card.scrollIntoViewIfNeeded();
  // The film gives up and the still takes the slot.
  const film = card.getByTestId("card-film-coldtrail");
  const img = film.locator("img");
  await expect(img).toBeVisible({ timeout: 20_000 });
  expect(((await img.getAttribute("src")) ?? "")).toContain("coldtrail-still");
  await expect(card.locator('[role="alert"]')).toHaveCount(0);
  const cardText = (await card.textContent()) ?? "";
  expect(cardText).not.toMatch(/couldn.t load|failed to load|image unavailable/i);
  // The card itself survives the dead film; its CTA is still present.
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

test("banner slot: the Journal .hv5-art banner hosts the Journal film, never an orb", async ({
  page,
  context,
}) => {
  const gate = makeGate();
  await setupContext(context);
  await delayRoute(context, (url) => url.href.includes("journal-film") && url.pathname.endsWith(".mp4"), gate);
  await gotoHome(page, 1280);
  const card = page.getByTestId("journal-card");
  const wrapper = card.locator(".hv5-art");
  await expect(wrapper).toHaveCount(1);
  // Rework pin (2026-11-03): the wrapper is a full-bleed banner,
  // so the radial blob mask the corner illustration carried is
  // gone — the computed mask is none, and the banner spans the
  // card's full width at its top.
  const mask = await wrapper.evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.maskImage || cs.webkitMaskImage || "";
  });
  expect(mask).toBe("none");
  const bannerBox = await wrapper.boundingBox();
  const cardBox = await card.boundingBox();
  expect(Math.abs(bannerBox!.width - (cardBox!.width - 2))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(bannerBox!.y - (cardBox!.y + 1))).toBeLessThanOrEqual(1.5);
  // Before the card nears the viewport, the film slot inside the
  // banner wrapper shows the film's poster — and no orb exists in
  // the wrapper at any point (the orb this test used to pin left
  // with LazyHomeImage in the Part 2 redo).
  const film = card.getByTestId("card-film-journal");
  const poster = film.locator("img");
  await expect(poster).toHaveCount(1);
  expect(((await poster.getAttribute("src")) ?? "")).toContain("journal-poster");
  await expect(wrapper.locator(".hv5-lazy-orb")).toHaveCount(0);
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: EVIDENCE });
  gate.release();
  await expect(film.locator("video")).toBeVisible({ timeout: 20_000 });
  await expect(wrapper.locator(".hv5-lazy-orb")).toHaveCount(0);
});
