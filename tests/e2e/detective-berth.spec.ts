import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  companionMode,
  currentPhase,
  currentPlacement,
  fulfillFlagsStaging,
  installDetectiveRecorder,
  openSeamCase,
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
 *     the pause point: centre distance in [56, 320] px (the solver's
 *     legal band: ≥64 px centre minimum on desktop / ≥96 dp touch,
 *     ≤320 px remote cutoff) and strictly ABOVE the point.
 *
 * Cases: mouse pause at 1280, touch pause (CDP, finger held with
 * micro-jitter) at 390, and the post-throttle RECOVERY case at 1280:
 * CPU-throttle in SEARCH until the kill latch provably fires, prove
 * a pause then produces no berth, unthrottle, prove the companion
 * re-qualifies (mode returns to "full" + the re-qualified console
 * line), then prove a real berth lands.
 */

test.setTimeout(420_000);

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
    await openSeamCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    // First map interaction enters Holmes; the dock is read after.
    await page.mouse.move(mapBox!.x + 40, mapBox!.y + 40);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(1_200);
    const dockPos = await holmesWrapperPos(page);
    expect(dockPos, "Holmes wrapper at the dock after entry").not.toBeNull();
    const point = berthPointFor(1280, mapBox!);
    const landed = await berthAtMouse(page, point, dockPos!);
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
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsStaging(context);
    const page = await context.newPage();
    await openSeamCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    const dockPos = await holmesWrapperPos(page);
    // Holmes may not have entered yet on touch (no map interaction
    // so far): the touch pause itself is the first interaction and
    // the entry + berth chain runs from it, as in production.
    const point = berthPointFor(390, mapBox!);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    let landed: Landed | null = null;
    const deadline = Date.now() + 120_000;
    let dock = dockPos;
    try {
      while (Date.now() < deadline) {
        // Finger micro-jitter, as in the K2 touch grid (a perfectly
        // still touch emits nothing for the detector to feed on).
        for (const [jx, jy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: point.x + jx, y: point.y + jy, id: 1 }],
          });
          await page.waitForTimeout(220);
        }
        if (!dock) dock = await holmesWrapperPos(page);
        if (dock) {
          landed = await checkLanded(page, point, dock);
          if (landed) break;
        }
      }
    } finally {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
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
    await openSeamCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    await page.mouse.move(mapBox!.x + 40, mapBox!.y + 40);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(1_200);
    const dockPos = await holmesWrapperPos(page);
    expect(dockPos).not.toBeNull();
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
    const landed = await berthAtMouse(page, point, dockPos!);
    console.log(
      `[berth recovery] landed=(${landed.x},${landed.y}) distFromDock=${Math.round(landed.distFromDock)}px centreDist=${Math.round(landed.centreDist)}px`,
    );
  } finally {
    await context.close();
  }
});
