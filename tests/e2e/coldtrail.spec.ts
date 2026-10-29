import { test, expect } from "playwright/test";
import {
  serveBuiltArtifact,
  sourceFeatures,
  startGlobeRun,
  commitHit,
  dismissTileOverlayIfPresent,
  clickNextPlace,
  readPhase,
  NO_IDLE,
} from "./helpers";

/**
 * Cold Trail vertical-slice deploy-gate E2E (WS1 "Every Place Findable").
 *
 * New flow: "Place ring on map" enters placement mode (crosshair + hint, no
 * ring yet) → tapping the map plants an ephemeral draft ring → "Yes, keep
 * it" locks the PLAYER-chosen center → repeat ×3 → tap the map for the
 * interception guess → confirm → score reveal. Pre-reveal, the map renders
 * only player-chosen coordinates (witness dots at locked player centers,
 * never at the true anchors — see the placement.test.ts I1 unit test for
 * the coordinate-level assertion).
 *
 * The built Pages artifact is served from disk (see helpers.ts); Esri tiles
 * are stubbed, so ring painting is not asserted — the flow is.
 */

const BASE = "http://127.0.0.1:4123/Meridian/";

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

/** Open Cold Trail from the editions menu. */
async function openColdTrail(page: import("playwright/test").Page) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  // All three witness reports render.
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/** Place + lock one ring: button → map tap → "Yes, keep it". */
async function placeAndLockRing(
  page: import("playwright/test").Page,
  tap: { x: number; y: number },
) {
  await page.getByTestId("place-ring-btn").first().click();
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");
  await page.getByTestId("loop-map").click({ position: tap });
  // Draft planted: the adjusting copy appears and the confirm button enables.
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("confirm-ring-btn").click();
}

test("region context: every sighting names its continent + country", async ({ page }) => {
  await openColdTrail(page);
  // All three witness reports render a Region line: continent · country,
  // with subdivision only for large countries (granularity rule).
  const regions = page.getByTestId("sighting-region");
  await expect(regions).toHaveCount(3);
  for (const line of await regions.allTextContents()) {
    expect(line).toMatch(/^🌍 Region: [^·]+ · [^·]+/);
  }
  // Case #1 is deterministic: Umraniye resolves to Asia · Türkiye (no
  // subdivision — Türkiye is not in the large-country set).
  await expect(regions.first()).toContainText("🌍 Region: Asia · Türkiye");

  // Anti-leak, black-box: finish the case, read the revealed hideout name,
  // and confirm no region line ever named it (region is witness-side only).
  await placeAndLockRing(page, { x: 300, y: 250 });
  await placeAndLockRing(page, { x: 315, y: 240 });
  await placeAndLockRing(page, { x: 285, y: 265 });
  await page.getByTestId("loop-map").click({ position: { x: 350, y: 280 } });
  await page.getByTestId("intercept-confirm-btn").click();
  const reveal = page.getByTestId("coldtrail-reveal");
  await expect(reveal).toContainText("The trail led to", { timeout: 10_000 });
  const hideoutName = (await reveal.textContent())
    ?.match(/The trail led to ([^.]+)/)?.[1]
    ?.trim();
  expect(hideoutName).toBeTruthy();
  for (const line of await regions.allTextContents()) {
    expect(line.toLowerCase()).not.toContain(hideoutName!.toLowerCase());
  }
});

test("full slice: place 3 rings → tap → confirm → score reveal", async ({ page }) => {
  await openColdTrail(page);

  // Tapping the map before any ring is placed raises the hint, not the sheet.
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
  await expect(page.getByTestId("intercept-confirm")).toHaveCount(0);
  await expect(page.getByTestId("map-hint")).toContainText("Place all 3 rings first");

  // Ring 1: place → tap → the draft renders as a preview (dashed) ring.
  // Taps are clustered so the three rings genuinely triple-overlap
  // (disjoint rings are covered by the dedicated disjoint test below).
  await page.getByTestId("place-ring-btn").first().click();
  await page.getByTestId("loop-map").click({ position: { x: 300, y: 250 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  // minFeatures=2 (preview ring + its km label): waits out the passive-
  // effect repaint so the assertion can't race the paint.
  const ringFeatures = await sourceFeatures(page, "loop-rings", 2);
  const previews = ringFeatures.filter((f) => f.properties.preview === true);
  expect(previews.length).toBeGreaterThan(0);
  // Lock ring 1.
  await page.getByTestId("confirm-ring-btn").click();
  await expect(page.getByTestId("map-hint")).toContainText("Ring 1 locked");
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);

  // Rings 2 and 3 (clustered with ring 1 for genuine triple-overlap).
  await placeAndLockRing(page, { x: 315, y: 240 });
  await placeAndLockRing(page, { x: 285, y: 265 });
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(0);

  // All three locked: the status line invites the interception tap.
  // (Scoped to the hint live region: the map section shows the same
  // sentence as plain text, which getByText would match twice.)
  await expect(page.getByTestId("map-hint")).toContainText("All 3 rings are down");

  // F11 overlap lens: all 3 locked → the triple-intersection paints.
  const overlapFeatures = await sourceFeatures(page, "loop-overlap", 1);
  expect(overlapFeatures.length).toBeGreaterThan(0);
  // One-time pulse pings at the overlap centroid, then goes away.
  await expect(page.locator(".ct-overlap-pulse")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator(".ct-overlap-pulse")).toHaveCount(0, { timeout: 10_000 });

  // Tap the map: the intercept confirm sheet opens.
  await page.getByTestId("loop-map").click({ position: { x: 350, y: 280 } });
  await expect(page.getByTestId("intercept-confirm")).toBeVisible({ timeout: 10_000 });

  // Confirm: the score reveal names the hideout and the km miss.
  await page.getByTestId("intercept-confirm-btn").click();
  const reveal = page.getByTestId("coldtrail-reveal");
  await expect(reveal).toBeVisible({ timeout: 10_000 });
  await expect(reveal).toContainText("The trail led to");
  await expect(reveal).toContainText("km");

  // Next case deals a fresh case (rings reset).
  await page.getByTestId("next-case-btn").click();
  await expect(page.getByTestId("sighting-card")).toHaveCount(3);
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(3);
  await expect(page.getByTestId("coldtrail-reveal")).toHaveCount(0);
});

test("Escape cancels placement mode without locking", async ({ page }) => {
  await openColdTrail(page);

  await page.getByTestId("place-ring-btn").first().click();
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map-hint")).toContainText("Placement canceled");
  // Back to idle: all three cards offer "Place ring on map" again.
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(3);
  await expect(page.getByTestId("confirm-ring-btn")).toHaveCount(0);
  // Focus returns to the card's Place button (WCAG 2.4.3) — the rAF-deferred
  // focus must land on the committed idle tree, not <body>.
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-testid") === "place-ring-btn",
    { timeout: 5_000 },
  );
});

test("keyboard-only: Enter plants the first draft ring, arrows nudge it", async ({ page }) => {
  await openColdTrail(page);

  // Arm placement via keyboard: focus the Place button, press Enter.
  await page.getByTestId("place-ring-btn").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");
  // Focus moves to the map (WCAG 2.4.3).
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("data-testid") === "loop-map",
    { timeout: 5_000 },
  );

  // No draft yet: Enter plants it at the map center (P0 fix — keyboard
  // users could never plant the first ring before this).
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("map-hint")).toContainText("Ring planted");

  // Arrows nudge the planted draft: the hint announces the move.
  await page.keyboard.press("ArrowUp");
  await expect(page.getByTestId("map-hint")).toContainText("Ring moved north", { timeout: 10_000 });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("map-hint")).toContainText("Ring moved", { timeout: 10_000 });

  // The draft renders as a preview ring (dashed = not locked yet).
  const ringFeatures = await sourceFeatures(page, "loop-rings", 2);
  const previews = ringFeatures.filter((f) => f.properties.preview === true);
  expect(previews.length).toBeGreaterThan(0);

  // Lock it via keyboard: tab to "Yes, keep it" and press Enter.
  await page.getByTestId("confirm-ring-btn").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("map-hint")).toContainText("Ring 1 locked");
});

test("switching cards mid-placement discards the draft", async ({ page }) => {
  await openColdTrail(page);

  // Start placing ring 1 and plant a draft.
  await page.getByTestId("place-ring-btn").first().click();
  await page.getByTestId("loop-map").click({ position: { x: 200, y: 200 } });
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });

  // Tap another card's Place button: implicit switch (draft discarded).
  await page.getByTestId("place-ring-btn").nth(1).click();
  await expect(page.getByTestId("map-hint")).toContainText("Your ring draft was set aside");
  // Card 1 is back to idle and card 3 never left it (2 Place buttons); the
  // placing card shows "✖ Cancel placement" instead (approved state
  // machine: the placing card never shows a Place button). No ring locked.
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);
  await expect(page.getByTestId("cancel-placement-btn")).toHaveCount(1);
  await expect(page.getByTestId("confirm-ring-btn")).toHaveCount(0);
});

test("Move re-locks a ring at the new spot", async ({ page }) => {
  await openColdTrail(page);

  await placeAndLockRing(page, { x: 200, y: 200 });
  await expect(page.getByTestId("move-ring-btn")).toBeVisible();

  // Move re-enters adjusting with the draft at the locked center.
  await page.getByTestId("move-ring-btn").click();
  await expect(page.getByTestId("confirm-ring-btn")).toBeVisible({ timeout: 10_000 });
  // Tap-to-move re-positions, then re-lock.
  await page.getByTestId("loop-map").click({ position: { x: 320, y: 220 } });
  await page.getByTestId("confirm-ring-btn").click();
  // Still exactly one ring locked — Move never duplicates or unlocks.
  await expect(page.getByTestId("place-ring-btn")).toHaveCount(2);
  await expect(page.getByTestId("move-ring-btn")).toHaveCount(1);
});

test("anti-leak: pre-reveal marks are witness dots at player centers only", async ({ page }) => {
  await openColdTrail(page);

  await placeAndLockRing(page, { x: 200, y: 200 });
  await placeAndLockRing(page, { x: 300, y: 250 });
  await placeAndLockRing(page, { x: 400, y: 300 });

  const markFeatures = await sourceFeatures(page, "loop-marks", 3);
  const witnesses = markFeatures.filter((f) => f.properties.kind === "witness");
  const xs = markFeatures.filter((f) => f.properties.kind === "x");
  // Three locked rings → three witness dots at the player centers; the
  // interception "x" only exists post-reveal.
  expect(witnesses).toHaveLength(3);
  expect(xs).toHaveLength(0);

  // The coordinate-level assertion (no rendered coordinate equals any true
  // anchor) is the placement.test.ts I1 unit test; here we pin the layer
  // wiring: no solid-ring feature is secretly a draft, no extra marks.
  // minFeatures=6 (3 locked rings + 3 km labels): waits out the paint.
  const ringFeatures = await sourceFeatures(page, "loop-rings", 6);
  expect(ringFeatures.filter((f) => f.properties.preview === true)).toHaveLength(0);
});

test("paid informant tightens one ring for a star", async ({ page }) => {
  await openColdTrail(page);
  const stars = page.getByTestId("coldtrail-stars");
  await expect(stars).toContainText("⭐ 2");

  await placeAndLockRing(page, { x: 200, y: 200 });
  await page.getByTestId("informant-btn").first().click();
  await expect(stars).toContainText("⭐ 1");
  await expect(page.getByTestId("map-hint")).toContainText("Guide tightened");
});

test("placement mode: map canvas shows crosshair cursor", async ({ page }) => {
  await openColdTrail(page);

  await page.getByTestId("place-ring-btn").first().click();
  await expect(page.getByTestId("map-hint")).toContainText("Tap where you think the ring goes");

  // The crosshair must be on MapLibre's canvas element itself:
  // a container-level cursor class is defeated by .maplibregl-canvas's
  // own cursor rule (grab).
  const cursor = await page
    .getByTestId("loop-map")
    .locator("canvas")
    .evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("crosshair");

  // Leaving placement restores the default cursor.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map-hint")).not.toContainText("Tap where you think the ring goes");
  const cursorAfter = await page
    .getByTestId("loop-map")
    .locator("canvas")
    .evaluate((el) => getComputedStyle(el).cursor);
  expect(cursorAfter).not.toBe("crosshair");
});

test("disjoint rings: no centroid dot, hint says they don't cross", async ({ page }) => {
  await openColdTrail(page);

  // Plant 3 rings far apart so they share no common area. Positions stay
  // well inside the map viewport.
  await placeAndLockRing(page, { x: 80, y: 120 });
  await placeAndLockRing(page, { x: 300, y: 120 });
  await placeAndLockRing(page, { x: 190, y: 280 });

  // Honest copy: no "tap where they cross" when there is no crossing.
  await expect(page.getByTestId("map-hint")).toContainText("don't cross");

  // Wait for the paint (3 witness dots are painted in the same pass).
  const markFeatures = await sourceFeatures(page, "loop-marks", 3);
  expect(markFeatures.filter((f) => f.properties.kind === "witness")).toHaveLength(3);

  // No centroid dot and no polygon for disjoint rings — a marker at the
  // centroid would read as a fake "answer" point.
  const overlapFeatures = await sourceFeatures(page, "loop-overlap", 0);
  expect(overlapFeatures.filter((f) => f.properties.kind === "overlap-centroid")).toHaveLength(0);
  expect(overlapFeatures.filter((f) => f.properties.kind === "overlap")).toHaveLength(0);

  // No pulse fires at a fake center either.
  await expect(page.locator(".ct-overlap-pulse")).toHaveCount(0);
});

test("desktop layout (1280x900): sightings column beside the map at scroll 0 (B-1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openColdTrail(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  const sightings = await page.locator(".ct-sightings").boundingBox();
  const map = await page.locator(".ct-map").boundingBox();
  const firstCard = await page.getByTestId("sighting-card").first().boundingBox();
  expect(sightings, ".ct-sightings must have a layout box").not.toBeNull();
  expect(map, ".ct-map must have a layout box").not.toBeNull();
  expect(firstCard, "first sighting card must have a layout box").not.toBeNull();
  // Geometry record for the B-1 fix evidence (printed to the run log).
  console.log(
    `B1-GEOMETRY sightings={x:${sightings!.x},y:${sightings!.y},w:${sightings!.width},h:${sightings!.height}} ` +
      `map={x:${map!.x},y:${map!.y},w:${map!.width},h:${map!.height},bottom:${map!.y + map!.height}} ` +
      `firstCard={y:${firstCard!.y},bottom:${firstCard!.y + firstCard!.height}}`,
  );
  // Same grid row: the sightings column starts above the map's bottom edge.
  // Pre-fix B-1 measured sightings y=745.5 vs map bottom 721.5 — the whole
  // column dropped into row 2 below the map, zero clue cards at load.
  expect(sightings!.y).toBeLessThan(map!.y + map!.height);
  // Side by side: the sightings column (grid column 1) ends at or before
  // the map column (grid column 2) begins.
  expect(sightings!.x + sightings!.width).toBeLessThanOrEqual(map!.x + 1);
  // At least one clue card is visible in the first viewport at scroll 0.
  expect(firstCard!.y).toBeLessThan(900);
  expect(firstCard!.y + firstCard!.height).toBeGreaterThan(0);
});

/**
 * Mode End game (manifest 2026-10-28-endgame-editions, rulings R1/R5):
 * Cold Trail gains an "End game" button in its header (plus its own in
 * the !caseData error return, covered by the unit source-pin only — that
 * branch is unseedable, see the manifest). Ending from a mode ends the
 * session, shows the reused session summary, clears ONLY the open flag
 * (the case blob is byte-identical afterwards), and never calls endRun.
 * The leave test at the end is a GUARD: it passes before the fix.
 * NOTE: no Cold Trail "Resume" label exists — blob equality is the
 * resume assertion, not a label.
 */

/** Session totals + ended flag from sessionStorage. */
async function endgameSession(page: import("playwright/test").Page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("meridian.session");
    return raw ? (JSON.parse(raw) as { totalScore: number; ended: boolean }) : null;
  });
}

/** Raw Cold Trail store blob from localStorage. */
async function coldtrailBlob(page: import("playwright/test").Page) {
  return page.evaluate(() => localStorage.getItem("meridian.coldtrail.v2"));
}

/**
 * Intersection area of two buttons, measured in a SINGLE page.evaluate()
 * call (two sequential boundingBox() calls are not atomic).
 */
async function singleEvaluateOverlap(
  page: import("playwright/test").Page,
  first: import("playwright/test").Locator,
  second: import("playwright/test").Locator,
): Promise<number> {
  const h1 = await first.elementHandle();
  const h2 = await second.elementHandle();
  return page.evaluate(([a, b]) => {
    if (!a || !b) return -1;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const w = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
    const h = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
    return w * h;
  }, [h1, h2]);
}

/**
 * Mode entry after globe seeding, for the tests that read the session
 * afterwards. openColdTrail's goto reloads the app, which (a) drops the
 * seed boot's ?idle-ms (the 2-minute watchdog then kills the session
 * during this VM's slow mode leg — unrelated to the feature) and (b)
 * restores the paused classic run instead of home. So instead: click
 * the home card straight from the seed's home screen — no reload.
 */
async function openColdTrailSeeded(page: import("playwright/test").Page) {
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("sighting-card")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.getByTestId("loop-map")).toBeVisible({ timeout: 30_000 });
}

/** Seed a live classic session with a banked globe total, then leave. */
async function seedBankedSession(page: import("playwright/test").Page): Promise<number> {
  await startGlobeRun(page, NO_IDLE);
  await dismissTileOverlayIfPresent(page);
  // Suppress the once-per-lifetime first-win Parade modal (repo pattern:
  // game-sfx / reset-history pre-seed this key) so the seeded hit can
  // advance past the story card like any later win.
  await page.evaluate(() => localStorage.setItem("meridian.firstWinCelebrated", "1"));
  await commitHit(page);
  const banked = (await endgameSession(page))?.totalScore ?? -1;
  expect(banked).toBeGreaterThan(0);
  // Advance past the story card first (proven session-score pattern):
  // leaving straight from the story phase leaves the celebration overlay
  // over the Editions button and the click never lands.
  await clickNextPlace(page);
  await expect.poll(() => readPhase(page), { timeout: 20_000 }).toBe("aim");
  await page.getByRole("button", { name: "Editions" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  return banked;
}

test("endgame: End game visible without scrolling, 44px, clear of All games", async ({ page }) => {
  test.setTimeout(180_000);
  await openColdTrail(page);
  const endGame = page.getByRole("button", { name: "End game" });
  await expect(endGame).toBeVisible({ timeout: 15_000 });
  const box = await endGame.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const vp = page.viewportSize();
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp!.height);
  // Separate control, not a relabel of "All games".
  await expect(page.getByRole("button", { name: "All games" })).toBeVisible();
  const overlap = await singleEvaluateOverlap(
    page,
    endGame,
    page.getByRole("button", { name: "All games" }),
  );
  expect(overlap).toBe(0);
});

test("endgame: activation ends session and shows session summary", async ({ page }) => {
  test.setTimeout(240_000);
  const banked = await seedBankedSession(page);
  await openColdTrailSeeded(page);
  await placeAndLockRing(page, { x: 300, y: 250 });
  // Mode play must NOT change the session total (session banks classic only).
  expect((await endgameSession(page))?.totalScore).toBe(banked);
  const before = await coldtrailBlob(page);
  expect(before).not.toBeNull();

  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator("p.text-5xl")).toContainText(banked.toLocaleString("en-US"));
  expect((await endgameSession(page))?.ended).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("meridian.coldtrail.open"))).toBeNull();
  expect(await coldtrailBlob(page)).toBe(before);
});

test("endgame: mode-only End game shows honest 0/0 summary", async ({ page }) => {
  test.setTimeout(180_000);
  await openColdTrail(page);
  await placeAndLockRing(page, { x: 300, y: 250 });
  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  expect((await endgameSession(page))?.ended).toBe(true);
  await expect(dialog.locator("p.text-5xl")).toHaveText("0");
  const placesRow = dialog.locator("div", { hasText: "Places played" }).last();
  await expect(placesRow).toContainText("0");
  const eyebrow = await dialog.locator("p.uppercase").first().textContent();
  expect((eyebrow ?? "").trim().length).toBeGreaterThan(0);
});

test("endgame: Done then return resumes the in-progress case", async ({ page }) => {
  test.setTimeout(240_000);
  await openColdTrail(page);
  await placeAndLockRing(page, { x: 300, y: 250 });
  const before = await coldtrailBlob(page);
  const beforeParsed = JSON.parse(before!) as { caseIndex: number; current: { ringsPlaced: boolean[] } };
  expect(beforeParsed.current.ringsPlaced[0]).toBe(true);
  await page.getByRole("button", { name: "End game" }).click();
  const dialog = page.getByRole("dialog", { name: "Game summary" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Cold Trail: Start the trail" })).toBeVisible();
  await page.getByRole("button", { name: "Cold Trail: Start the trail" }).click();
  await expect(page.getByTestId("coldtrail-screen")).toBeVisible({ timeout: 30_000 });
  const after = await coldtrailBlob(page);
  expect(after).toBe(before);
  const afterParsed = JSON.parse(after!) as { caseIndex: number; current: { ringsPlaced: boolean[] } };
  expect(afterParsed.caseIndex).toBe(beforeParsed.caseIndex);
  expect(afterParsed.current.ringsPlaced[0]).toBe(true);
});

test("endgame: all-games leave still works and does NOT end session", async ({ page }) => {
  // GUARD: passes before the fix; must NOT be counted as RED.
  test.setTimeout(240_000);
  const banked = await seedBankedSession(page);
  await openColdTrailSeeded(page);
  await page.getByRole("button", { name: "All games" }).click();
  await expect(page.getByRole("button", { name: "Play the globe" })).toBeVisible();
  const session = await endgameSession(page);
  expect(session?.totalScore).toBe(banked);
  expect(session?.ended).toBe(false);
});
