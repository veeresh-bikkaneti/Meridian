import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  companionMode,
  currentPhase,
  currentPlacement,
  followTier,
  fulfillFlagsFollowOff,
  installDetectiveRecorder,
  detectivePlays,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * Detective PAUSE-BERTH gate — REWRITTEN for PB-1 (2026-11-07).
 *
 * The old spec gated the berth ENGINE: a 320 px remote cutoff, an
 * above-the-point anchor rule, and dock-return on cancel/kill. The
 * owner restatement deleted that model: Holmes follows the pointer
 * across the whole page and stays with it (detective-follow.spec.ts
 * gates that model). What survives of the berth is the TIER beneath
 * follow — holmesFollow OFF, a stepped-down device, or degraded
 * input — where a genuine pause still berths Holmes NEAR the pause
 * and he holds there. This spec gates exactly that, with the flag
 * intercepted OFF:
 *
 *   - a pause FAR from the dock (> 320 px — the remote rule is
 *     gone) still berths, anywhere on the page;
 *   - the landing is the pause NEIGHBOURHOOD (no above-the-point
 *     anchor rule survives);
 *   - a touch pause at 390 berths the same way;
 *   - the FG-5 kill still steps the tier to DOCK_ONLY (no berth
 *     while killed), and re-qualification restores the berth tier —
 *     the #362 recovery contract, restated in tier terms.
 */

test.setTimeout(420_000);

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
      /* tap again */
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

async function showMap(page: Page) {
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="loop-map"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(700);
}

/** Explicit entry step (cure round 2): with follow OFF, entry is
 * the player's first MAP interaction by design (#361 — the staging
 * specs gate entry itself). A small pan drag on the map (~14 px,
 * pointerdown -> move -> up, no place selection) IS that first
 * interaction, so specs whose subject is post-entry behaviour run
 * it explicitly before reading any settled wrapper position.
 * (The touch test below runs the same step as a CDP touch drag.) */
async function enterViaMapDrag(page: Page): Promise<void> {
  const mb = await page.getByTestId("loop-map").boundingBox();
  expect(mb).not.toBeNull();
  const start = { x: mb!.x + mb!.width * 0.5, y: mb!.y + mb!.height * 0.5 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 14, start.y, { steps: 3 });
  await page.mouse.up();
}

/** A berth counts only as a MEASURED ARRIVAL: placement "berth",
 * wrapper displaced > 40 px from its start, centre within 220 px
 * of the pause point (the follow neighbourhood). */
async function checkLanded(
  page: Page,
  point: { x: number; y: number },
  startPos: { x: number; y: number },
): Promise<{ x: number; y: number } | null> {
  if ((await currentPlacement(page)) !== "berth") return null;
  const p = await holmesWrapperPos(page);
  if (!p) return null;
  if (Math.hypot(p.x - startPos.x, p.y - startPos.y) <= 40) return null;
  const centre = { x: p.x + 52, y: p.y + 52 };
  if (Math.hypot(centre.x - point.x, centre.y - point.y) > 220) return null;
  return p;
}

async function berthAtMouse(
  page: Page,
  point: { x: number; y: number },
  startPos: { x: number; y: number },
  timeoutMs = 90_000,
): Promise<{ x: number; y: number }> {
  const deadline = Date.now() + timeoutMs;
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.move(point.x + 2, point.y + 1, { steps: 2 });
  while (Date.now() < deadline) {
    const landed = await checkLanded(page, point, startPos);
    if (landed) return landed;
    const phase = await currentPhase(page);
    if (phase && phase.startsWith("SEARCH")) {
      await page.mouse.move(point.x + 1, point.y, { steps: 2 });
      await page.mouse.move(point.x, point.y, { steps: 2 });
    }
    await page.waitForTimeout(1_200);
  }
  throw new Error(
    `no berth within ${timeoutMs}ms (phase=${await currentPhase(page)}, companion=${await companionMode(page)}, placement=${await currentPlacement(page)}, tier=${await followTier(page)})`,
  );
}

test("pause-berth tier: a FAR pause berths in its neighbourhood and holds (1280, follow OFF)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsFollowOff(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    // Ordering rule (cure round 4): tier and wrapper-rect reads
    // require entry — followTier() reads the follow root, which
    // exists only once Holmes has entered the map, so any such
    // read before an entry interaction returns null by
    // construction. Entry is the FIRST map interaction: the
    // entry drag runs immediately after showMap, before every
    // tier/rect read below, and the second idle wait re-settles
    // him post-entry.
    await enterViaMapDrag(page);
    await waitForSearchIdle(page);
    // Round 7 (diagnosis Q1): log the runner's sustained frame
    // rate beside the poll \u2014 below the 55 fps re-qualify floor
    // a DOCK_ONLY latch is a capability wall, not a latency, and
    // the log line is what tells the panel which one a red run
    // was. The poll and its asserted value are unchanged.
    const sustainedFps = await page.evaluate(
      () =>
        new Promise<number>((res) => {
          let frames = 0;
          const start = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - start < 2_000)
              requestAnimationFrame(tick);
            else
              res(
                Math.round(
                  (frames * 1000) / (performance.now() - start),
                ),
              );
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(
      `[berth-tier FAR] sustained fps before tier poll: ${sustainedFps}`,
    );
    // The tier read polls (30 s, the same bound the kill/recovery
    // test below uses for its DOCK_ONLY read): the FG-5 latch is
    // pre-existing law (#356/#362, untouched by PB-1) and on a
    // software-rendered runner its re-qualification \u2014 a clean 5 s
    // window at \u226555 FPS after any kill during the opening \u2014 can
    // land after the idle wait settles. The assertion is unchanged
    // (the tier must BE PAUSE_BERTH before the pause stimulus);
    // the poll only waits out the latch's own recovery latency.
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAUSE_BERTH");
    // Cure A4: the SETTLED position after the cured idle wait —
    // it may be a dwell berth, not the dock. checkLanded's >40 px
    // displacement-from-start still works from a settled berth:
    // this test's pause point is far (>320 px) from wherever he
    // settled.
    const settledPos = await holmesWrapperPos(page);
    expect(settledPos).not.toBeNull();
    const mb = await page.getByTestId("loop-map").boundingBox();
    expect(mb).not.toBeNull();
    // Far corner of the map — well beyond the deleted 320 px remote
    // cutoff from the dock, and BELOW-RIGHT of it: the old anchor
    // rule (strictly above the point) is gone too.
    const point = { x: mb!.x + mb!.width * 0.82, y: mb!.y + mb!.height * 0.78 };
    expect(
      Math.hypot(point.x - settledPos!.x, point.y - settledPos!.y),
    ).toBeGreaterThan(320);
    const landed = await berthAtMouse(page, point, settledPos!);
    console.log(
      `[berth-tier 1280] far point=(${Math.round(point.x)},${Math.round(point.y)}) landed=(${landed.x},${landed.y})`,
    );
    // Holds: no drift home over 3 s.
    await page.waitForTimeout(3_000);
    const held = await checkLanded(page, point, settledPos!);
    expect(held, "the berth must hold, not drift home").not.toBeNull();
  } finally {
    await context.close();
  }
});

test("pause-berth tier: touch pause berths near the finger (390, follow OFF)", async ({
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
    await fulfillFlagsFollowOff(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const mb = await page.getByTestId("loop-map").boundingBox();
    expect(mb).not.toBeNull();
    const cdp = await context.newCDPSession(page);
    // Ordering rule (cure round 4), touch form of the same step:
    // tier and wrapper-rect reads require entry — followTier()
    // reads the follow root, which exists only once Holmes has
    // entered the map, so any such read before an entry
    // interaction returns null by construction. Entry is the
    // FIRST map interaction: this small CDP touch drag on the
    // map (~14 px, see enterViaMapDrag) runs immediately after
    // showMap, before every tier/rect read below, and the idle
    // wait after it re-settles him post-entry. It is kept small
    // and on the map; the touch-pause stimulus below is
    // unchanged.
    const dragStart = {
      x: mb!.x + mb!.width * 0.5,
      y: mb!.y + mb!.height * 0.5,
    };
    // The entry drag must read as a PAN, never a tap: a single
    // 14 px CDP touch move sits inside the map's tap
    // discrimination and selected a place \u2014 the confirm sheet
    // opened and the idle wait below could never settle (cure
    // round 5; failure screenshot showed the sheet over "Libya").
    // The drag is therefore stepped: 4 moves \u00d7 16 px with real
    // time between them \u2014 unambiguously a pan by distance and
    // duration. The test's subject is unchanged.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: dragStart.x, y: dragStart.y, id: 1 }],
    });
    for (let step = 1; step <= 4; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: dragStart.x + step * 16, y: dragStart.y, id: 1 },
        ],
      });
      await page.waitForTimeout(50);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await waitForSearchIdle(page);
    // Tier read polls, as in the FAR test above (FG-5 recovery
    // latency on software-rendered runners; assertion unchanged).
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAUSE_BERTH");
    // Cure A4: settled position, as in the FAR test above.
    const settledPos = await holmesWrapperPos(page);
    expect(settledPos).not.toBeNull();
    const point = { x: mb!.x + mb!.width * 0.7, y: mb!.y + mb!.height * 0.32 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    let landed: { x: number; y: number } | null = null;
    const deadline = Date.now() + 90_000;
    try {
      while (Date.now() < deadline && !landed) {
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
          landed = await checkLanded(page, point, settledPos!);
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
      `touch pause must berth (phase=${await currentPhase(page)}, placement=${await currentPlacement(page)}, tier=${await followTier(page)})`,
    ).not.toBeNull();
    console.log(
      `[berth-tier 390] point=(${Math.round(point.x)},${Math.round(point.y)}) landed=(${landed!.x},${landed!.y})`,
    );
  } finally {
    await context.close();
  }
});

test("pause-berth tier: kill steps down to DOCK_ONLY, re-qualify restores the berth (1280, follow OFF)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  const logs: string[] = [];
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsFollowOff(context);
    const page = await context.newPage();
    page.on("console", (m) => logs.push(m.text()));
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    // Cure round 2 — explicit entry (see enterViaMapDrag): this
    // test reads a wrapper position (startPos) before its first
    // stimulus, so it takes the same entry step as the FAR/touch
    // tests above before reading it.
    await enterViaMapDrag(page);
    await waitForSearchIdle(page);
    const startPos = await holmesWrapperPos(page);
    expect(startPos).not.toBeNull();
    const mb = await page.getByTestId("loop-map").boundingBox();
    expect(mb).not.toBeNull();
    const point = { x: mb!.x + mb!.width * 0.5, y: mb!.y + mb!.height * 0.45 };

    /* Throttle in SEARCH until the FG-5 latch fires: the tier must
     * step DOWN to DOCK_ONLY (companion "killed" reads as the
     * DOCK_ONLY tier floor). */
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
    await expect
      .poll(() => companionMode(page), { timeout: 120_000 })
      .toBe("killed");
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("DOCK_ONLY");
    console.log(
      `[berth-tier recovery] latch fired under throttle: ${logs.filter((l) => l.includes("auto-killed")).join(" | ") || "(kill line not captured)"}`,
    );

    /* While killed, a pause attempt produces NO berth. */
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.waitForTimeout(3_000);
    expect(
      await currentPlacement(page),
      "a killed companion must not berth",
    ).not.toBe("berth");

    /* Unthrottle: re-qualification restores the PAUSE_BERTH tier. */
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await expect
      .poll(() => companionMode(page), { timeout: 180_000 })
      .toBe("full");
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAUSE_BERTH");
    expect(
      logs.some((l) => l.includes("re-qualified")),
      "the re-qualified console line proves the recovery path ran",
    ).toBe(true);
    console.log("[berth-tier recovery] tier restored to PAUSE_BERTH");

    /* And now a pause produces a REAL berth again. The travel
     * baseline is re-read HERE, after recovery: startPos was the
     * pre-kill entry berth, and this test's pause point sits
     * ~25 px from that entry point, so a lawful landing beside
     * it can never clear the >40 px displacement check against
     * the stale baseline (round-9 trace: landing 25.06 px from
     * startPos, held for 65 identical reads while the check
     * timed out). From the recovered position — the dock perch
     * the kill pinned him to — the same check measures the real
     * post-recovery travel. The assertion itself is unchanged. */
    const recoveredPos = await holmesWrapperPos(page);
    expect(recoveredPos).not.toBeNull();
    const landed = await berthAtMouse(page, point, recoveredPos!);
    console.log(
      `[berth-tier recovery] landed=(${landed.x},${landed.y})`,
    );
  } finally {
    await context.close();
  }
});
