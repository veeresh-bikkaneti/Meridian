import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  companionMode,
  currentPhase,
  currentPlacement,
  fulfillFlagsStaging,
  installDetectiveRecorder,
  detectivePlays,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * Detective REAL-BERTH gate (berth cure, 2026-11-07).
 *
 * The shipped gates preconditioned on companionMode === "full" and
 * read an FG-5 auto-kill latch as an environment result — so a
 * latched build passed by construction while Holmes never berthed
 * in production (DIAGNOSIS-bench-at-close.md, defect 2). This spec
 * does the opposite: it never treats "killed" as a pass, and a berth
 * counts only as a MEASURED ARRIVAL —
 *
 *   - Holmes's wrapper leaves the dock (displacement > 40 px, the
 *     staging spec's own rule), AND
 *   - placement reads "berth", AND
 *   - the wrapper's centre lands within the berth law's reach of
 *     the pause point: centre distance in [56, 320] px (the ARRIVAL
 *     band: 56 is BERTH_EDGE_MIN, not a centre minimum — the solver's
 *     centre minimums are 64 px desktop / 96 px touch — and 320 px is
 *     the remote cutoff) and strictly ABOVE the point.
 *
 * Cases: mouse pause at 1280, touch pause (CDP, finger held with
 * micro-jitter) at 390, and the post-throttle RECOVERY case at 1280:
 * CPU-throttle in SEARCH until the kill latch provably fires, prove
 * a pause then produces no berth, unthrottle, prove the companion
 * re-qualifies (mode returns to "full" + the re-qualified console
 * line), then prove a real berth lands.
 */

test.setTimeout(420_000);

/** Open the seam case WITH staging on (the staging spec's pattern):
 * u10's openSeamCase waits for the station element, which the bench
 * stage suppresses whole (cure C1) — with staging on, the case opens
 * on the bench and speech unlocks from there. */
async function openStagingCase(page: Page, index: number): Promise<void> {
  await page.goto(`http://127.0.0.1:4123/Meridian/?loop-puzzle=${index}`);
  await page
    .getByRole("button", { name: "GeoDetective: Solve a mystery" })
    .click();
  await expect(
    page.getByRole("article", { name: /Clue 1:/ }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("detective-bench")).toBeVisible({
    timeout: 20_000,
  });
  const heading = page.getByRole("heading", { name: "GeoDetective" });
  const count = async () =>
    (await detectivePlays(page)).filter((u) =>
      u.includes("/audio/detective/"),
    ).length;
  for (let attempt = 0; attempt < 8; attempt++) {
    await heading.click();
    try {
      await expect.poll(count, { timeout: 4_000 }).toBeGreaterThan(0);
      return;
    } catch {
      /* tap again — the tap may land before the listener arms */
    }
  }
  throw new Error("speech never unlocked after 8 verified gesture taps");
}

async function holmesWrapperPos(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="detective-holmes-wrapper"]',
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top) };
  });
}

/** A map tap can open the place-confirm sheet, which hides the
 * host whole (wrapper unmounted) until dismissed — the staging
 * spec's pattern. */
async function dismissSheetIfOpen(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page
      .getByRole("button", { name: "Not this one" })
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function waitForDock(page: Page) {
  let pos: { x: number; y: number } | null = null;
  await expect
    .poll(
      async () => {
        pos = await holmesWrapperPos(page);
        return pos !== null;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return pos!;
}

async function showMap(page: Page) {
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="loop-map"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(700);
}

/** Berth point per the staging spec's cure-C12 geometry: within the
 * 320 px remote cutoff of the dock centre (155, mapH-64 map-relative)
 * at both widths used here. */
function berthPointFor(
  width: number,
  mb: { x: number; y: number; width: number; height: number },
) {
  return width === 390
    ? { x: mb.x + mb.width * 0.72, y: mb.y + mb.height * 0.3 }
    : { x: mb.x + mb.width * 0.48, y: mb.y + mb.height * 0.5 };
}

type Landed = { x: number; y: number; distFromDock: number; centreDist: number };

/** The measured-arrival check shared by every case in this spec. */
async function checkLanded(
  page: Page,
  point: { x: number; y: number },
  dockPos: { x: number; y: number },
): Promise<Landed | null> {
  if ((await currentPlacement(page)) !== "berth") return null;
  const p = await holmesWrapperPos(page);
  if (!p) return null;
  const distFromDock = Math.hypot(p.x - dockPos.x, p.y - dockPos.y);
  if (distFromDock <= 40) return null;
  // Wrapper box is 70x104 (HOLMES_BOX): centre from its top-left.
  const centre = { x: p.x + 35, y: p.y + 52 };
  const centreDist = Math.hypot(centre.x - point.x, centre.y - point.y);
  if (centreDist < 56 || centreDist > 320) return null;
  if (centre.y >= point.y) return null; // berth law: above the point
  return { ...p, distFromDock, centreDist };
}

/** Mouse hover-berth with the staging spec's nudge discipline, but
 * no companion precondition: a kill mid-attempt is waited out via
 * re-qualification, never read as a pass. */
async function berthAtMouse(
  page: Page,
  point: { x: number; y: number },
  dockPos: { x: number; y: number },
  timeoutMs = 120_000,
): Promise<Landed> {
  const deadline = Date.now() + timeoutMs;
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.move(point.x + 2, point.y + 1, { steps: 2 });
  const fastUntil = Date.now() + 6_000;
  while (Date.now() < fastUntil) {
    const landed = await checkLanded(page, point, dockPos);
    if (landed) return landed;
    await page.waitForTimeout(400);
  }
  while (Date.now() < deadline) {
    const landed = await checkLanded(page, point, dockPos);
    if (landed) return landed;
    const phase = await currentPhase(page);
    if (phase && phase.startsWith("SEARCH")) {
      await page.mouse.move(point.x + 1, point.y, { steps: 2 });
      await page.mouse.move(point.x, point.y, { steps: 2 });
    }
    await page.waitForTimeout(1_500);
  }
  throw new Error(
    `no REAL berth within ${timeoutMs}ms (phase=${await currentPhase(page)}, companion=${await companionMode(page)}, placement=${await currentPlacement(page)})`,
  );
}

test("real berth: mouse pause lands Holmes at the pause point (desktop 1280)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsStaging(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    // First map interaction enters Holmes; the dock is read after.
    await page.mouse.move(mapBox!.x + 40, mapBox!.y + 40);
    await page.mouse.down();
    await page.mouse.up();
    await dismissSheetIfOpen(page);
    const dockPos = await waitForDock(page);
    const point = berthPointFor(1280, mapBox!);
    const landed = await berthAtMouse(page, point, dockPos);
    console.log(
      `[berth mouse 1280] dock=(${dockPos!.x},${dockPos!.y}) point=(${Math.round(point.x)},${Math.round(point.y)}) landed=(${landed.x},${landed.y}) distFromDock=${Math.round(landed.distFromDock)}px centreDist=${Math.round(landed.centreDist)}px companion=${await companionMode(page)}`,
    );
  } finally {
    await context.close();
  }
});

test("real berth: touch pause lands Holmes at the pause point (phone 390)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsStaging(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    // The touch pause is the FIRST map interaction, as in production
    // and in the diagnosis trace: entry + berth chain from it. The
    // dock reference is the dock's own geometry (HOLMES_DOCK_X 120,
    // DOCK_INSET 12, HOLMES_BOX 104 map-relative). The wrapper's
    // first dock sighting in the loop below is logged against it for
    // comparison (a few px of scroll settling sit between the map
    // box measure and the sighting; the >40 px displacement rule
    // dwarfs either reading). The diagnosis trace measured the same
    // dock at (141,527) on a 350x439 map.
    const dockPos = {
      x: Math.round(mapBox!.x + 120),
      y: Math.round(mapBox!.y + mapBox!.height - 12 - 104),
    };
    const point = berthPointFor(390, mapBox!);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    let landed: Landed | null = null;
    let dockSighting: { x: number; y: number } | null = null;
    const deadline = Date.now() + 90_000;
    try {
      while (Date.now() < deadline && !landed) {
        // Finger micro-jitter, the diagnosis/K2 pattern (a perfectly
        // still touch emits nothing for the detector to feed on).
        for (const [jx, jy] of [
          [1, 0],
          [0, 1],
          [-1, 1],
          [1, -1],
          [0, 0],
        ] as const) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: point.x + jx, y: point.y + jy, id: 1 }],
          });
          await page.waitForTimeout(350);
          if (!dockSighting && (await currentPlacement(page)) === "dock") {
            dockSighting = await holmesWrapperPos(page);
          }
          landed = await checkLanded(page, point, dockPos);
          if (landed) break;
        }
      }
    } finally {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    if (dockSighting) {
      console.log(
        `[berth touch 390] dock sighting=(${dockSighting.x},${dockSighting.y}) vs geometric dock=(${dockPos.x},${dockPos.y})`,
      );
    }
    expect(
      landed,
      `touch pause must produce a REAL berth (phase=${await currentPhase(page)}, companion=${await companionMode(page)}, placement=${await currentPlacement(page)})`,
    ).not.toBeNull();
    console.log(
      `[berth touch 390] point=(${Math.round(point.x)},${Math.round(point.y)}) landed=(${landed!.x},${landed!.y}) distFromDock=${Math.round(landed!.distFromDock)}px centreDist=${Math.round(landed!.centreDist)}px`,
    );
  } finally {
    await context.close();
  }
});

test("real berth: post-throttle recovery — kill latches, re-qualifies, berths (desktop 1280)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  const logs: string[] = [];
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsStaging(context);
    const page = await context.newPage();
    page.on("console", (m) => logs.push(m.text()));
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    await page.mouse.move(mapBox!.x + 40, mapBox!.y + 40);
    await page.mouse.down();
    await page.mouse.up();
    await dismissSheetIfOpen(page);
    const dockPos = await waitForDock(page);
    const point = berthPointFor(1280, mapBox!);

    /* -- Throttle in SEARCH until the FG-5 latch provably fires --- */
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
    await expect
      .poll(() => companionMode(page), { timeout: 120_000 })
      .toBe("killed");
    console.log(
      `[berth recovery] latch fired under throttle: ${logs.filter((l) => l.includes("auto-killed")).join(" | ") || "(kill line not captured)"}`,
    );

    /* -- While killed, a pause attempt produces NO berth ---------- */
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.waitForTimeout(3_000);
    expect(
      await currentPlacement(page),
      "a killed companion must not berth — the latch is real, not a throttle no-op",
    ).not.toBe("berth");

    /* -- Unthrottle: the companion must RE-QUALIFY ------------------ */
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await expect
      .poll(() => companionMode(page), { timeout: 180_000 })
      .toBe("full");
    expect(
      logs.some((l) => l.includes("re-qualified")),
      "the re-qualified console line proves the recovery path ran",
    ).toBe(true);
    console.log("[berth recovery] companion re-qualified after unthrottle");

    /* -- And now a pause produces a REAL berth --------------------- */
    const landed = await berthAtMouse(page, point, dockPos);
    console.log(
      `[berth recovery] landed=(${landed.x},${landed.y}) distFromDock=${Math.round(landed.distFromDock)}px centreDist=${Math.round(landed.centreDist)}px`,
    );
  } finally {
    await context.close();
  }
});
