import { test, expect } from "playwright/test";
import type { Locator, Page } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";

/**
 * Film error-path E2E (PR #350 panel-cure round, 2026-11-04).
 *
 * The round-1 pins for the error latch were source-strings only
 * and no E2E ever injected a video error. This spec does, using
 * page routes that abort the GeoDetective film request (route
 * registered after serveBuiltArtifact, so it wins; "allow" falls
 * back to the artifact handler). GeoDetective is the deliberate
 * target: its media is CONSTANT across bands, which is exactly
 * the slot class the panel's B2 block was about.
 *
 * Test 1 — retry + off-screen pause of the CURRENT element:
 *   (a) the film request fails ONCE → the one bounded retry
 *       succeeds → the film mounts and plays (exactly 2 requests);
 *   (c) after that retry REMOUNT, scrolling the slot off-screen
 *       pauses the CURRENT video element. On the round-1 tip the
 *       threshold-0 observer had captured the pre-retry element,
 *       so the remounted film kept playing off-screen and this
 *       test fails at the paused assertion (panel B1).
 *
 * Test 2 — a latched constant-media slot revives on band switch:
 *   (b) the film request fails ALWAYS → the slot latches to the
 *       still → switch band 11–13 → 8–10 with the route now
 *       allowing → the SAME slot revives and plays. On the round-1 tip the latch reset was keyed
 *       only on media change, so the slot stays latched and this
 *       test fails at the revival (panel B2); on unmodified main
 *       it fails too (the latch never reset there at all — and
 *       the band-naming toast assertion trips even earlier).
 *
 * Gate solving / settings flow follow band-switch-in-session.
 *
 * Test 3 — a remount that happens BEFORE the slot first
 *   intersects (panel round-2 BLOCK): the Journal film's first
 *   request fails while the slot is parked below the fold,
 *   inside the 200px lazy margin but not intersecting. The retry
 *   remounts the element; the pause observer must deliver to
 *   the NEW element. On the voted tip the pause effect's deps
 *   were [gated, near], so the remount never re-ran it and
 *   IntersectionObserver delivered nothing without a threshold
 *   crossing — in a browser that starts off-screen films (the
 *   autoplay this component is built around), the remounted
 *   film would loop off-screen indefinitely. The cure adds
 *   `attempt` + `media.videoUrl` to the deps, so the effect
 *   re-observes and the new observer's initial delivery pauses
 *   the new element.
 *   Witness note: THIS Chromium defers off-screen autoplay —
 *   a below-fold film sits paused at t=0 even with no observer
 *   at all (probe-verified on the voted build), so a paused-
 *   state assertion cannot tell the tips apart here. The test
 *   therefore witnesses the DELIVERY itself: a pause() call
 *   landing on the current element after the remount (calls
 *   are recorded by an init script). The final paused-state
 *   assertions still run — they are the user-facing invariant.
 *   The first failure is delayed 2.5 s so the ORIGINAL
 *   observer's initial delivery is spent on the first element
 *   before the remount; without the delay that delivery can
 *   land on the new element and mask the bug on the voted tip.
 *
 * Test 4 — the same shape on LockedTileFilm (the Frontend
 *   seat's behavioural-coverage gap): the locked film fails
 *   once while the tile is parked below the fold; the delivery
 *   must reach the remounted element. LockedTileFilm's cure
 *   adds `attempt` to the pause effect's deps.
 */

test.setTimeout(300_000);

const PROFILE_KEY = "meridian.ageProfile.v1";
const GEO_FILM_ROUTE = "**/*geodetective-film*.mp4";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ version: 1, flags: { pwaUpdateToast: true, learningOutcomes: true } }),
      contentType: "application/json; charset=utf-8",
    });
  });
});

/** Solve the grown-up gate in the UI and land on the age picker. */
async function solveGate(page: Page): Promise<void> {
  const gate = page.getByTestId("grownup-gate");
  await expect(gate).toBeVisible({ timeout: 20_000 });
  const question = await page.locator(".agep-question").textContent();
  const m = question?.match(/What is (\d+) × (\d+)\?/);
  expect(m, "gate question shape").not.toBeNull();
  const answer = String(Number(m![1]) * Number(m![2]));
  await page.getByTestId("gate-answer").click();
  for (const d of answer) await page.keyboard.press(d);
  await page.getByTestId("gate-check").click();
  await expect(page.getByTestId("age-picker")).toBeVisible({ timeout: 20_000 });
}

/** Open the settings from the home footer link and solve the gate. */
async function openSettings(page: Page): Promise<void> {
  const footerLink = page.getByTestId("grownups-link");
  await footerLink.scrollIntoViewIfNeeded();
  await footerLink.click();
  await solveGate(page);
}

/** Establish an ACTIVE 11–13 profile through the real UI (first save). */
async function firstSetGeoDetective(page: Page): Promise<void> {
  await openSettings(page);
  const picker = page.getByTestId("age-picker");
  const cards = picker.locator(".agep-card");
  await cards.nth(2).click();
  await page.getByTestId("agep-save").click();
  await expect(page.getByTestId("agep-toast")).toHaveText("Saved — enjoy the trail. 🌿");
  await expect(picker).not.toBeVisible();
}

/** Pick a band card, Save, confirm the switch, assert the band-naming toast. */
async function switchBand(page: Page, cardIndex: number, expectedToast: string): Promise<void> {
  const picker = page.getByTestId("age-picker");
  const cards = picker.locator(".agep-card");
  await expect(cards).toHaveCount(3);
  await cards.nth(cardIndex).click();
  await expect(cards.nth(cardIndex)).toHaveClass(/agep-card-checked/);
  await page.getByTestId("agep-save").click();
  await expect(page.getByTestId("agep-confirm-change")).toBeVisible();
  await page.getByTestId("agep-confirm-switch").click();
  const toast = page.getByTestId("agep-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText(expectedToast);
  await expect(picker).not.toBeVisible();
}

/** Scroll a card-film slot into view and wait for its <video> to mount. */
async function mountFilm(page: Page, testId: string): Promise<Locator> {
  const film = page.getByTestId(testId);
  await film.scrollIntoViewIfNeeded();
  const video = film.locator("video");
  await expect(video).toBeVisible({ timeout: 20_000 });
  return video;
}

/** The film is actually playing: not paused, and currentTime advances. */
async function expectPlaying(video: Locator): Promise<void> {
  await expect
    .poll(() => video.evaluate((v) => v.paused), { timeout: 20_000 })
    .toBe(false);
  const t1 = await video.evaluate((v) => v.currentTime);
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(t1);
}

/** Establish an ACTIVE Little Explorer (5–7) profile through the real UI (first save). */
async function firstSetLittleExplorer(page: Page): Promise<void> {
  await openSettings(page);
  const picker = page.getByTestId("age-picker");
  const cards = picker.locator(".agep-card");
  await cards.nth(0).click();
  await page.getByTestId("agep-save").click();
  await expect(page.getByTestId("agep-toast")).toHaveText("Saved — enjoy the trail. 🌿");
  await expect(picker).not.toBeVisible();
}

/**
 * Park a film slot just below the fold: inside the 200px
 * lazy-mount margin (so the film mounts and its error/retry
 * sequence runs) but NOT intersecting the viewport (so no
 * threshold crossing ever fires for it). Fails loudly if the
 * slot cannot be parked in that window — a mis-parked slot
 * would silently stop testing the round-2 BLOCK.
 */
async function parkBelowFold(page: Page, testId: string): Promise<Locator> {
  const slot = page.getByTestId(testId);
  await slot.evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - window.innerHeight - 120));
  });
  const pos = await slot.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, innerHeight: window.innerHeight };
  });
  expect(pos.top, "slot must sit below the fold (not intersecting)").toBeGreaterThanOrEqual(pos.innerHeight);
  expect(pos.top, "slot must sit inside the 200px lazy-mount margin").toBeLessThan(pos.innerHeight + 200);
  return slot;
}

/** The remounted film is paused off-screen, and stays paused (its clock is frozen). */
async function expectPausedOffScreen(video: Locator): Promise<void> {
  await expect
    .poll(() => video.evaluate((v) => v.paused), { timeout: 20_000 })
    .toBe(true);
  const t1 = await video.evaluate((v) => v.currentTime);
  await video.page().waitForTimeout(700);
  const t2 = await video.evaluate((v) => v.currentTime);
  expect(t2, "a paused film's clock does not advance").toBe(t1);
}

/**
 * Record every play()/pause() CALL the app makes, with the
 * element it landed on (init script, runs before the app).
 * This Chromium defers off-screen autoplay, so a remounted
 * film's paused STATE looks identical on both tips — the
 * discriminating witness for the round-2 BLOCK is whether a
 * pause() call ever reaches the remounted element (tests 3–4).
 */
async function recordMediaCalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: Array<{ kind: string; el: HTMLMediaElement }> = [];
    (window as unknown as { __filmCalls: typeof calls }).__filmCalls = calls;
    const origPlay = HTMLMediaElement.prototype.play;
    const origPause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: []) {
      calls.push({ kind: "play", el: this });
      return origPlay.apply(this, args);
    };
    HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
      calls.push({ kind: "pause", el: this });
      return origPause.apply(this);
    };
  });
}

/** A pause() call landed on THIS (remounted) element — the re-observation delivery reached it. */
async function expectPauseCallOn(video: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        video.evaluate((v) => {
          const calls = (window as unknown as { __filmCalls?: Array<{ kind: string; el: HTMLMediaElement }> })
            .__filmCalls;
          return !!calls && calls.some((c) => c.kind === "pause" && c.el === v);
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

test("film error path: one failed load retries and plays; the remounted film pauses off-screen", async ({
  page,
  context,
}) => {
  // Fail the GeoDetective film's FIRST request; allow the rest
  // through to the built artifact.
  let geoRequests = 0;
  await context.route(GEO_FILM_ROUTE, async (route) => {
    geoRequests += 1;
    if (geoRequests === 1) await route.abort("failed");
    else await route.fallback();
  });

  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate((key) => window.localStorage.getItem(key), PROFILE_KEY)).toBeNull();

  // (a) First load fails, the bounded retry succeeds, film plays.
  const video = await mountFilm(page, "card-film-geodetective");
  expect(await video.getAttribute("src")).toContain("geodetective-film");
  await expectPlaying(video);
  expect(geoRequests, "exactly one retry was needed").toBe(2);

  // (c) Scroll the slot fully off-screen: the CURRENT (remounted)
  // element must pause — the observer resolves it at event time.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() => video.evaluate((v) => v.paused), { timeout: 20_000 })
    .toBe(true);
});

test("film error path: a latched constant-media slot revives on band switch", async ({
  page,
  context,
}) => {
  // Fail the GeoDetective film ALWAYS until the switch flips this.
  let geoBlocked = true;
  let geoRequests = 0;
  await context.route(GEO_FILM_ROUTE, async (route) => {
    geoRequests += 1;
    if (geoBlocked) await route.abort("failed");
    else await route.fallback();
  });

  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  // Establish an active 11–13 profile through the real UI while
  // the film keeps failing.
  await firstSetGeoDetective(page);

  // The slot latches to the still: the film was attempted (at
  // least one intercepted request), then the slot settles on the
  // STILL image with no video element. (Request COUNT is not the
  // latch witness: a same-URL retry re-request can be cache-served
  // without hitting route interception — the slot's settled state
  // is. The still's URL is what distinguishes latched from the
  // pre-mount poster phase.)
  const slot = page.getByTestId("card-film-geodetective");
  await slot.scrollIntoViewIfNeeded();
  await expect.poll(() => geoRequests, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  await expect(slot.locator("video")).toHaveCount(0, { timeout: 20_000 });
  await expect(slot.locator("img")).toBeVisible();
  await expect
    .poll(() => slot.locator("img").getAttribute("src"), { timeout: 20_000 })
    .toContain("geodetective-still");

  // Allow the film again and switch band 11–13 → 8–10. The media
  // does NOT change (GeoDetective is constant across bands) — the
  // band change itself must revive the slot.
  geoBlocked = false;
  await openSettings(page);
  await switchBand(page, 1, "Saved — Trail Scout (ages 8–10) ✅");

  const video = await mountFilm(page, "card-film-geodetective");
  expect(await video.getAttribute("src")).toContain("geodetective-film");
  await expectPlaying(video);
});

test("film error path: a retry remount before the slot first intersects stays paused off-screen (CardFilm)", async ({
  page,
  context,
}) => {
  await recordMediaCalls(page);
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  // Precondition: the Journal slot has not mounted its film yet
  // (it starts far below the fold, outside the lazy margin).
  const slot = page.getByTestId("card-film-journal");
  await expect(slot.locator("video")).toHaveCount(0);

  // Fail the Journal film's FIRST request; allow the retry
  // through to the built artifact. Registered after the artifact
  // handler (and after the precondition), so it wins. The first
  // failure is DELAYED 2.5 s on purpose: the pause observer's
  // initial delivery must fire against the first element (and
  // pause it, still loading) BEFORE the error remounts it —
  // that ordering is what strands the remounted element on the
  // voted tip. An instant abort races the delivery and the
  // callback resolves the new element instead, masking the bug.
  let journalRequests = 0;
  await context.route("**/*journal-film*.mp4", async (route) => {
    journalRequests += 1;
    if (journalRequests === 1) {
      await new Promise((r) => setTimeout(r, 2500));
      await route.abort("failed");
    } else await route.fallback();
  });

  // Park the slot inside the lazy margin but below the fold:
  // the film mounts, the first load errors, the retry remounts —
  // all before the slot ever intersects.
  await parkBelowFold(page, "card-film-journal");
  const video = slot.locator("video");
  await expect(video).toHaveCount(1, { timeout: 20_000 });
  await expect.poll(() => journalRequests, { timeout: 20_000 }).toBe(2);

  // The round-2 BLOCK witness: a pause() call must land on the
  // REMOUNTED element (the cure's re-observation delivery). On
  // the voted tip no delivery ever reaches it — no threshold
  // crossing happens — and this poll times out.
  await expectPauseCallOn(video);

  // And the user-facing invariant: the film is paused, clock frozen.
  await expectPausedOffScreen(video);
});

test("film error path: a retry remount before the tile first intersects stays paused off-screen (LockedTileFilm)", async ({
  page,
  context,
}) => {
  await recordMediaCalls(page);
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("home-heading")).toBeVisible({ timeout: 20_000 });

  // Establish the 5–7 band through the real UI: the locked tile
  // replaces the GeoDetective card. (The settings flow leaves
  // the page scrolled to the footer, far from the tile, so the
  // locked film has not mounted yet.)
  await firstSetLittleExplorer(page);
  const slot = page.getByTestId("locked-tile-film");
  await expect(slot.locator("video")).toHaveCount(0);

  // A short viewport guarantees the tile can be parked below
  // the fold (it sits high on the page).
  const size = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.setViewportSize({ width: size.width, height: 360 });
  await expect(slot.locator("video")).toHaveCount(0);

  // Fail the locked film's FIRST request; allow the retry. The
  // first failure is delayed 2.5 s for the same ordering reason
  // as the CardFilm variant above: the pause observer's initial
  // delivery must land on the first element before the remount.
  let lockedRequests = 0;
  await context.route("**/*geodetective-locked-film*.mp4", async (route) => {
    lockedRequests += 1;
    if (lockedRequests === 1) {
      await new Promise((r) => setTimeout(r, 2500));
      await route.abort("failed");
    } else await route.fallback();
  });

  await parkBelowFold(page, "locked-tile-film");
  const video = slot.locator("video");
  await expect(video).toHaveCount(1, { timeout: 20_000 });
  await expect.poll(() => lockedRequests, { timeout: 20_000 }).toBe(2);

  // Same witness as the CardFilm variant: the re-observation
  // delivery must reach the remounted element with a pause().
  await expectPauseCallOn(video);
  await expectPausedOffScreen(video);
});
