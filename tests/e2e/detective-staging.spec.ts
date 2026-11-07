import { test, expect, type BrowserContext, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  AuditTrail,
  collectAuditWindow,
  companionMode,
  currentPhase,
  currentPlacement,
  detectivePlays,
  fulfillFlagsStaging,
  installDetectiveRecorder,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * Detective staging gate (PR A, hostsStaging): the bench, the
 * makeover sizes, the entry walk, berth-to-berth walks — and the
 * owner's ZERO-OVERLAP LAW: neither figure ever overlaps clue-card
 * text (0 px²) in any state.
 *
 * Per-device gate (owner amendment, 2026-11-06): EVERY assertion
 * runs at 390 / 768 / 1280 — no width proxies another. The overlap
 * audit ports the staging mockup v2's position-sampling audit as
 * bounded COLLECTION WINDOWS: at each checkpoint (and across the
 * entry and berth walks) an in-page rAF collector measures every
 * figure's artwork box (station, dock, berth AND bench figures)
 * against every leaf text element inside the clue articles, once
 * per animation frame for the window's duration. (A permanent
 * background sampler was tried first and starved the renderer on
 * this VM — windows bound the cost to the moments that matter,
 * and per-frame reads ride the layout the browser already does.)
 *
 * The staging flag is flipped ON by route interception only
 * (detectivePair + hostsStaging); the committed flags.json is the
 * owner's own setting and is never relied on either way here.
 */

test.setTimeout(300_000);

/* The zero-overlap audit (collectAuditWindow / AuditTrail) is shared
 * from detective-u10.ts since PR B — the walk spec inherits the same
 * harness instead of duplicating it (PR A carried a local copy). */

/** Open the seam case WITHOUT the speech-unlock taps, so the bench
 * stage (CASE_OPEN, before the questions load) is still on screen. */
async function openCaseOnBench(page: Page, index: number) {
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
}

/** The u10 gesture-unlock loop: tap the heading until a detective
 * clip actually plays (a tap before the listener arms is missed). */
async function unlockSpeech(page: Page) {
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

async function showMap(page: Page) {
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="loop-map"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(700);
}

/**
 * Entry-walk sampler: ONE evaluate whose in-page rAF loop records
 * the Holmes wrapper's position path and poses for `ms`. (A
 * test-side loop of rapid evaluates starved on this VM — CDP
 * round-trips crawl once the walk starts; in-page sampling rides
 * the frame clock instead, the same pattern as the audit windows.)
 */
async function sampleEntryWalk(
  page: Page,
  ms: number,
): Promise<{ positions: { x: number; y: number }[]; sawWalk: boolean; gone: boolean }> {
  return page.evaluate(
    (dwell) =>
      new Promise((resolve) => {
        const positions: { x: number; y: number }[] = [];
        let sawWalk = false;
        const t0 = performance.now();
        const frame = () => {
          const wrapper = document.querySelector(
            '[data-testid="detective-holmes-wrapper"]',
          );
          if (wrapper) {
            const r = wrapper.getBoundingClientRect();
            const x = Math.round(r.left);
            const y = Math.round(r.top);
            const last = positions[positions.length - 1];
            if (!last || last.x !== x || last.y !== y) {
              positions.push({ x, y });
            }
            const pose =
              wrapper.querySelector("svg")?.getAttribute("data-pose") ??
              null;
            if (pose === "walk") sawWalk = true;
          }
          if (performance.now() - t0 < dwell) {
            requestAnimationFrame(frame);
          } else {
            resolve({
              positions,
              sawWalk,
              gone: !document.querySelector(
                '[data-testid="detective-bench"]',
              ),
            });
          }
        };
        requestAnimationFrame(frame);
      }),
    ms,
  );
}

/**
 * Hover-berth at a map point (companion pattern, extended): the
 * pause detector feeds on pointermove streams in the SEARCH
 * phases, so approach with steps, settle, and — while the phase
 * is a SEARCH phase and no berth has confirmed — re-nudge every
 * couple of seconds (a resting hand still micro-moves; each nudge
 * re-feeds the detector). Berthing EARLY in the case also matters:
 * the shipped FPS auto-kill feeds during SEARCH phases, and a
 * long idle wait on a loaded VM can latch it before the hover.
 */
async function berthAt(
  page: Page,
  point: { x: number; y: number },
  dockPos: { x: number; y: number },
  timeoutMs = 60_000,
) {
  // A berth counts only when he has actually LEFT the dock: the
  // pointer rested at the entry-tap point while the entry walk
  // ran, so a dock-adjacent pause can confirm a "berth" whose
  // position IS the dock — placement alone would return on it
  // while he never moves (measured at 768: distance stayed 0).
  const landed = async () => {
    if ((await currentPlacement(page)) !== "berth") return false;
    const p = await holmesWrapperPos(page);
    return p !== null && Math.hypot(p.x - dockPos.x, p.y - dockPos.y) > 40;
  };
  const deadline = Date.now() + timeoutMs;
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.mouse.move(point.x + 2, point.y + 1, { steps: 2 });
  // First give the 460 ms pause-confirm an undisturbed window,
  // checking at a fast cadence WITHOUT moving the pointer (any
  // move restarts the detector's stillness timer).
  const fastUntil = Date.now() + 6_000;
  while (Date.now() < fastUntil) {
    if (await landed()) return;
    await page.waitForTimeout(400);
  }
  while (Date.now() < deadline) {
    if (await landed()) return;
    const phase = await currentPhase(page);
    if (phase && phase.startsWith("SEARCH")) {
      await page.mouse.move(point.x + 1, point.y, { steps: 2 });
      await page.mouse.move(point.x, point.y, { steps: 2 });
    }
    await page.waitForTimeout(1_500);
  }
  throw new Error(
    `no berth within ${timeoutMs}ms (phase=${await currentPhase(page)}, companion=${await companionMode(page)})`,
  );
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

const WIDTHS = [
  { name: "phone 390", width: 390, height: 844 },
  { name: "tablet 768", width: 768, height: 1024 },
  { name: "desktop 1280", width: 1280, height: 950 },
] as const;

for (const w of WIDTHS) {
  test(`staging: bench -> rise -> entry walk -> berth walk, zero overlap (${w.name})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: w.width, height: w.height },
    });
    try {
      await serveBuiltArtifact(context);
      await installDetectiveRecorder(context, 3);
      const trail = new AuditTrail();
      const page = await context.newPage();
      await fulfillFlagsStaging(context);
      await openCaseOnBench(page, 137);

      /* -- BENCH: both seated, coffee in hand, watch glance ------ */
      const bench = page.getByTestId("detective-bench");
      await expect(bench).toHaveAttribute("data-staging-stage", "bench");
      const benchBox = await bench.boundingBox();
      expect(benchBox, "bench slot has real height").not.toBeNull();
      expect(benchBox!.height).toBeGreaterThan(100);
      expect(benchBox!.height).toBeLessThan(175);
      await expect(page.getByTestId("detective-coffee-holmes")).toBeVisible();
      await expect(page.getByTestId("detective-coffee-watson")).toBeVisible();
      await expect(page.getByTestId("detective-bench-board")).toBeVisible();
      // Sip cycles: present, animated, and NOT synchronized.
      const sips = await page.evaluate(() => {
        const read = (id: string) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { name: cs.animationName, duration: cs.animationDuration };
        };
        return {
          holmes: read("detective-coffee-holmes"),
          watson: read("detective-coffee-watson"),
        };
      });
      expect(sips.holmes?.name).toContain("detective-sip-holmes");
      expect(sips.watson?.name).toContain("detective-sip-watson");
      expect(sips.holmes?.duration).not.toBe(sips.watson?.duration);
      // Watch glance: Holmes's bench arm runs the watch loop.
      const watchName = await page.evaluate(() => {
        const arm = document.querySelector(
          '.detective-bench .detective-holmes [data-part="arm-front"]',
        );
        return arm ? getComputedStyle(arm).animationName : null;
      });
      expect(watchName).toContain("detective-bench-watch");
      // Bench figures are the bench size (~128 px).
      const benchHeights = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".detective-bench-figure svg")).map(
          (el) => Math.round(el.getBoundingClientRect().height),
        ),
      );
      expect(benchHeights.length).toBe(2);
      for (const h of benchHeights) {
        expect(h).toBeGreaterThanOrEqual(120);
        expect(h).toBeLessThanOrEqual(136);
      }
      await trail.collect(page, `bench @ ${w.name}`);

      /* -- RISE: questions load, board fades, cups stay behind --- */
      await unlockSpeech(page);
      await expect(bench).toHaveAttribute("data-staging-stage", "standing", {
        timeout: 60_000,
      });
      await expect(page.getByTestId("detective-coffee-holmes")).toHaveCount(0);
      await expect(
        page.getByTestId("detective-coffee-left-holmes"),
      ).toBeVisible();
      await expect(
        page.getByTestId("detective-coffee-left-watson"),
      ).toBeVisible();
      // The board fades over 0.45 s by design (detective.css); poll
      // until the fade completes rather than sampling mid-transition.
      // Cure C8: the fade lands on a 0.22 GHOST, not 0 — the ghost
      // stays under the left-behind cups so they rest on a visible
      // bench instead of floating over a fully faded board.
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const el = document.querySelector(
                '[data-testid="detective-bench-board"]',
              );
              return el
                ? Math.round(Number(getComputedStyle(el).opacity) * 100) / 100
                : -1;
            }),
          { timeout: 10_000 },
        )
        .toBe(0.22);
      // Watson alone at the gutter station, beside (never over) the card.
      const gutter = await page.evaluate(() => {
        const card = document.querySelector('article[aria-label^="Clue 1:"]');
        const watson = document.querySelector('[data-detective="watson"] svg');
        const station = document.querySelector(
          '[data-testid="detective-station"]',
        );
        if (!card || !watson || !station) return null;
        const cr = card.getBoundingClientRect();
        const wr = watson.getBoundingClientRect();
        return {
          cardRight: cr.right,
          watsonLeft: wr.left,
          watsonCount: station.querySelectorAll("[data-detective]").length,
          gutter: station.className.includes("detective-host-station-gutter"),
        };
      });
      expect(gutter?.gutter).toBe(true);
      expect(gutter?.watsonCount).toBe(1); // Watson-alone station sample
      expect(gutter!.watsonLeft).toBeGreaterThanOrEqual(gutter!.cardRight - 1);
      await trail.collect(page, `standing/reading @ ${w.name}`);

      /* -- ENTRY WALK: first map interaction --------------------- */
      // No idle wait first: the tap enters from any phase, and a
      // long SEARCH-phase wait feeds the FPS auto-kill tracker on
      // a loaded VM before the berth step needs the companion.
      await showMap(page);
      const heightBefore = (await bench.boundingBox())?.height ?? 0;
      expect(heightBefore).toBeGreaterThan(100);
      const mapBox = await page.getByTestId("loop-map").boundingBox();
      expect(mapBox).not.toBeNull();
      // Sample the entry IN PAGE while it runs (audit window and
      // walk sampler both start before the tap).
      const entryWindow = collectAuditWindow(page, 3_500);
      const entryWalk = sampleEntryWalk(page, 3_500);
      await page.mouse.move(mapBox!.x + 40, mapBox!.y + 40);
      await page.mouse.down();
      await page.mouse.up();
      await dismissSheetIfOpen(page);
      const entry = await entryWalk;
      // The slot collapsed to zero: the bench element is gone.
      await expect(page.getByTestId("detective-bench")).toHaveCount(0, {
        timeout: 30_000,
      });
      expect(entry.gone, "bench unmounted during the entry window").toBe(
        true,
      );
      // Not a teleport: he was SEEN walking (walk pose and/or a
      // multi-step transform path from the entry offset to the dock).
      const distinct = new Set(entry.positions.map((p) => `${p.x},${p.y}`));
      expect(
        entry.sawWalk || distinct.size >= 3,
        `entry must be a visible walk (walkPose=${entry.sawWalk}, distinct positions=${distinct.size})`,
      ).toBe(true);
      trail.absorb(await entryWindow, `entry @ ${w.name}`);

      /* -- BERTH-TO-BERTH WALK ----------------------------------- */
      // Berth EARLY (see berthAt): the entry tap + sheet dismiss
      // moved the machine on, but berthing lives in the SEARCH
      // phases and the hover loop rides out any read in between.
      // The companion must be LIVE: the shipped auto-kill (rolling
      // FPS on a loaded VM) latches Holmes dock-only for the
      // session — assert the precondition by name so a kill reads
      // as what it is, not as a staging failure.
      expect(
        await companionMode(page),
        "companion must be full (not auto-killed) for the berth walk",
      ).toBe("full");
      const dockPos = await holmesWrapperPos(page);
      expect(dockPos).not.toBeNull();
      const berthWindow = collectAuditWindow(page, 3_000);
      /* Berth-point geometry (cure C12, completed per Silo QA's
       * probe on the pre-cure tip): a berth point must sit within
       * BERTH_REMOTE_DISTANCE (320 px) of the dock centre, or the
       * solver lawfully answers "remote" and no berth can ever
       * land. Dock centre, map-relative, is (155, mapH-64)
       * (HOLMES_DOCK_X 120 + the 70x104 wrapper box). The old
       * shared point (0.72w, 0.30h) measures, on QA's probed map
       * boxes: 261.6 px at 390 (map 350x439 — legal, kept),
       * 480.7 px at 768 (map 728x532) and 464.4 px at 1280 (map
       * 728x494) — both remote, which is why the tablet/desktop
       * berth never landed pre-cure (the failure was geometry,
       * not environment). Tablet/desktop therefore use
       * (0.48w, 0.50h): 280.4 px at 768, 267.0 px at 1280 —
       * inside 320 with headroom, and ~270 px of displacement
       * from the dock, far over the >40 px a real walk must
       * prove. (An interim desktop-only point (0.45w, 0.35h)
       * measured 309.7 px — legal but ~10 px of margin; replaced
       * by this unified point.) */
      const berthPoint =
        w.width === 390
          ? {
              x: mapBox!.x + mapBox!.width * 0.72,
              y: mapBox!.y + mapBox!.height * 0.3,
            }
          : {
              x: mapBox!.x + mapBox!.width * 0.48,
              y: mapBox!.y + mapBox!.height * 0.5,
            };
      await berthAt(page, berthPoint, dockPos!);
      trail.absorb(await berthWindow, `berth @ ${w.name}`);

      /* -- MUTE TAP at three widths: full-width Holmes alias ----- */
      const mute = page.getByTestId("detective-holmes-mute");
      await expect(mute).toBeVisible();
      const muteBox = await mute.boundingBox();
      expect(muteBox!.width).toBeGreaterThanOrEqual(68); // full 70px alias, not the old 44px strip
      await mute.click({ position: { x: 60, y: 52 } }); // the restored rightmost strip owns its tap
      await expect(page.getByTestId("detective-muted-badge")).toBeVisible({
        timeout: 10_000,
      });
      // The one master key, canonical values (sfx.setSoundEnabled
      // writes "on"/"off" — the same values the sound spec pins).
      const soundKey = await page.evaluate(() =>
        localStorage.getItem("meridian.sound"),
      );
      expect(soundKey).toBe("off");
      await mute.click({ position: { x: 35, y: 52 } });
      await expect(page.getByTestId("detective-muted-badge")).toHaveCount(0, {
        timeout: 10_000,
      });
      expect(
        await page.evaluate(() => localStorage.getItem("meridian.sound")),
      ).toBe("on");
      await trail.collect(page, `mute @ ${w.name}`);
    } finally {
      await context.close();
    }
  });

  test(`staging reduced-motion: instant entry, no walk pose, zero overlap (${w.name})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: w.width, height: w.height },
      reducedMotion: "reduce",
    });
    try {
      await serveBuiltArtifact(context);
      await installDetectiveRecorder(context, 3);
      const trail = new AuditTrail();
      const page = await context.newPage();
      await fulfillFlagsStaging(context);
      await openCaseOnBench(page, 137);
      await unlockSpeech(page);
      await waitForSearchIdle(page, 120_000);
      await showMap(page);
      const mapBox = await page.getByTestId("loop-map").boundingBox();
      expect(mapBox).not.toBeNull();
      // The pose sampler spans the entry itself (started pre-tap).
      const reducedWalk = sampleEntryWalk(page, 2_500);
      await page.mouse.move(mapBox!.x + 40, mapBox!.y + 40);
      await page.mouse.down();
      await page.mouse.up();
      await dismissSheetIfOpen(page);
      // Cut walks: the slot is gone almost at once and Holmes is at
      // the dock WITHOUT ever taking the walk pose.
      await expect(page.getByTestId("detective-bench")).toHaveCount(0, {
        timeout: 5_000,
      });
      const reducedEntry = await reducedWalk;
      expect(reducedEntry.sawWalk).toBe(false);
      expect(await holmesWrapperPos(page)).not.toBeNull();
      await trail.collect(page, `reduced @ ${w.name}`);
    } finally {
      await context.close();
    }
  });
}

test("staging samples: Holmes-alone berth separation + FORCED anchor-null fallback (phone 390)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    const page = await context.newPage();
    await fulfillFlagsStaging(context);
    await openCaseOnBench(page, 137);
    await unlockSpeech(page);

    /* FORCED anchor-null sample: while Watson stands at the gutter
     * station, REMOVE the clue articles and force a re-measure
     * (resize). The host's anchor goes null and the station must
     * fall back to its anchor-null geometry (left 12, bottom 96)
     * with Watson and the chip pairwise clear. In PR C this
     * fallback was proven by arithmetic only; here it is staged. */
    await expect(page.getByTestId("detective-station")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("detective-bench")).toHaveAttribute(
      "data-staging-stage",
      "standing",
      { timeout: 30_000 },
    );
    await page.evaluate(() => {
      document
        .querySelectorAll('article[aria-label^="Clue"]')
        .forEach((el) => el.remove());
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(800);
    const fallback = await page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const station = document.querySelector('[data-testid="detective-station"]');
      return {
        stationLeft: station
          ? Math.round(station.getBoundingClientRect().left)
          : null,
        watson: box('[data-detective="watson"] svg'),
        chip: box('[data-testid="detective-sound-chip"]'),
      };
    });
    expect(fallback.stationLeft).toBe(12);
    expect(fallback.watson).not.toBeNull();
    expect(fallback.chip).not.toBeNull();
    {
      const ox =
        Math.min(fallback.watson!.right, fallback.chip!.right) -
        Math.max(fallback.watson!.left, fallback.chip!.left);
      const oy =
        Math.min(fallback.watson!.bottom, fallback.chip!.bottom) -
        Math.max(fallback.watson!.top, fallback.chip!.top);
      expect(ox > 0 && oy > 0 ? ox * oy : 0).toBe(0);
    }

    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    await page.mouse.move(mapBox!.x + 40, mapBox!.y + 40);
    await page.mouse.down();
    await page.mouse.up();
    await dismissSheetIfOpen(page);
    await expect(page.getByTestId("detective-bench")).toHaveCount(0, {
      timeout: 10_000,
    });
    expect(
      await companionMode(page),
      "companion must be full (not auto-killed) for the berth sample",
    ).toBe("full");

    /* Holmes-alone sample: at a berth Holmes stands ALONE (Watson
     * stays at the dock) — the reachable Holmes-alone geometry. (The
     * station chip-offset "Holmes alone" case in PR C's arithmetic
     * is unreachable from the machine's view table: every station
     * phase pairs Holmes with Watson or shows neither — verified in
     * detective-state.ts viewForState. The berth is the honest
     * sample.) Assert his full-width alias, Watson's replay box and
     * the map chip are pairwise disjoint. */
    const berthPoint = {
      x: mapBox!.x + mapBox!.width * 0.72,
      y: mapBox!.y + mapBox!.height * 0.3,
    };
    const dockPos = await holmesWrapperPos(page);
    expect(dockPos).not.toBeNull();
    await berthAt(page, berthPoint, dockPos!);
    const boxes = await page.evaluate(() => {
      const rect = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      return {
        mute: rect('[data-testid="detective-holmes-mute"]'),
        replay: rect('[data-testid="detective-watson-replay"]'),
        chip: rect('[data-testid="detective-sound-chip"]'),
      };
    });
    const overlap = (
      a: { left: number; top: number; right: number; bottom: number } | null,
      b: { left: number; top: number; right: number; bottom: number } | null,
    ) => {
      if (!a || !b) return -1;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    };
    expect(boxes.mute).not.toBeNull();
    expect(boxes.mute!.right - boxes.mute!.left).toBeGreaterThanOrEqual(68);
    expect(overlap(boxes.mute, boxes.replay)).toBe(0);
    expect(overlap(boxes.mute, boxes.chip)).toBe(0);
    expect(overlap(boxes.replay, boxes.chip)).toBe(0);

    // No closing audit window here by design: the anchor-null
    // step above REMOVED the clue articles, so there is no clue
    // text left to sample against. Figure-vs-text overlap at a
    // berth is audited in the per-width flow tests (berth window);
    // this test's own assertions are the pairwise box separations
    // and the forced fallback geometry.
  } finally {
    await context.close();
  }
});

/* ------------------------------------------------------------------ */
/* Cure round 1 (PR #361 panel): C11 page-level bench assertions +    */
/* C12 remote-first-entry. The panel's bench claim was reproduced    */
/* on the pre-cure tip at 1280 (2 Watson rigs on the page during      */
/* CASE_OPEN, the duet's speaking class on the STATION Watson, both   */
/* bench figures silent, bench Holmes the only Holmes and never      */
/* speaking). These tests pin the cured behaviour at all widths.     */
/* ------------------------------------------------------------------ */

for (const w of WIDTHS) {
  test(`staging cure C11: bench single-casting + duet from the bench + bench muted badge (${w.name})`, async ({
    browser,
  }) => {
    /* (a) Sound ON: exactly one Watson and one Holmes on the whole
     * page during CASE_OPEN/bench, and the duet's speaking figure
     * is the bench one. */
    const context = await browser.newContext({
      viewport: { width: w.width, height: w.height },
    });
    try {
      await serveBuiltArtifact(context);
      await installDetectiveRecorder(context, 3);
      const page = await context.newPage();
      await fulfillFlagsStaging(context);
      await openCaseOnBench(page, 137);
      const counts = () =>
        page.evaluate(() => ({
          watson: document.querySelectorAll('[data-detective="watson"]').length,
          holmes: document.querySelectorAll('[data-detective="holmes"]').length,
          chips: document.querySelectorAll('[data-testid="detective-sound-chip"]').length,
          stage: document
            .querySelector('[data-testid="detective-bench"]')
            ?.getAttribute("data-staging-stage"),
          phase: document
            .querySelector('[data-testid="detective-station"]')
            ?.getAttribute("data-phase"),
        }));
      const c0 = await counts();
      expect(c0.stage).toBe("bench");
      expect(c0.watson, "exactly ONE Watson on the page during bench").toBe(1);
      expect(c0.holmes, "exactly ONE Holmes on the page during bench").toBe(1);
      expect(c0.chips, "sound chip suppressed with the station cluster during bench").toBe(0);
      // The duet plays from the bench: poll the speaking rig and
      // record WHO speaks (bench figure only — no station figure
      // exists while the bench holds, per the counts above).
      await unlockSpeech(page);
      const speakers = new Set<string>();
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        const s = await page.evaluate(() => {
          const speaking = document.querySelector("svg.detective-speaking");
          if (!speaking) return null;
          const benchFigure = speaking.closest("[data-bench]");
          return {
            who: benchFigure?.getAttribute("data-bench") ?? "NOT-BENCH",
            stage: document
              .querySelector('[data-testid="detective-bench"]')
              ?.getAttribute("data-staging-stage"),
          };
        });
        if (s && s.stage === "bench") speakers.add(s.who);
        if (speakers.has("holmes") && speakers.has("watson")) break;
        const now = await counts();
        if (now.stage !== "bench") break;
        await page.waitForTimeout(150);
      }
      expect(
        [...speakers].every((who) => who === "holmes" || who === "watson"),
        `duet speaking figures must be bench figures only (saw: ${[...speakers].join(",") || "none"})`,
      ).toBe(true);
      /* PR B carry-in (d): the C11 duet assertion is strengthened
       * from "at least one speaker" to BOTH speakers — the duet is
       * a two-line exchange (Holmes's instruction, then Watson's),
       * and a bench that only ever showed one of them speaking
       * would pass the old assertion while failing the design. */
      expect(
        speakers.has("holmes"),
        `bench Holmes must visibly speak his duet line (saw: ${[...speakers].join(",") || "none"})`,
      ).toBe(true);
      expect(
        speakers.has("watson"),
        `bench Watson must visibly speak his duet line (saw: ${[...speakers].join(",") || "none"})`,
      ).toBe(true);
    } finally {
      await context.close();
    }

    /* (b) Toggle mute DURING the bench: the muted badge latches on
     * the bench slot, and no sound chip exists anywhere (no
     * duplication). The toggle path is used instead of a preset-off
     * boot for a measured reason: with sound preset off, the speech
     * player's off-mode queue drains in microtasks (the fallback
     * law — the ladder advances silently), so CASE_OPEN completes
     * before the bench ever paints and there is no bench window to
     * assert in (probed at 50 ms in-page sampling on the cured tip:
     * bench stage never appeared). Toggling during the bench is
     * deterministic: the mute fires the player's stopAll, which by
     * design never drains the queue, so CASE_OPEN — and the bench —
     * hold while muted. */
    const offContext = await browser.newContext({
      viewport: { width: w.width, height: w.height },
    });
    try {
      await serveBuiltArtifact(offContext);
      await installDetectiveRecorder(offContext, 3);
      const page = await offContext.newPage();
      await fulfillFlagsStaging(offContext);
      await openCaseOnBench(page, 137);
      const bench = page.getByTestId("detective-bench");
      await expect(bench).toHaveAttribute("data-staging-stage", "bench");
      await page.getByTestId("sound-toggle-loop").click();
      await expect(
        bench.getByTestId("detective-muted-badge"),
        "muted badge latched on the bench slot after toggling mute during bench",
      ).toBeVisible({ timeout: 10_000 });
      await expect(bench).toHaveAttribute("data-staging-stage", "bench");
      await expect(
        page.getByTestId("detective-sound-chip"),
        "no sound chip anywhere during bench (exactly-one-chip invariant)",
      ).toHaveCount(0);
      await expect(page.locator('[data-detective="watson"]')).toHaveCount(1);
      await expect(page.locator('[data-detective="holmes"]')).toHaveCount(1);
    } finally {
      await offContext.close();
    }
  });
}

test("staging cure C12: remote-first-entry lands Holmes AT the dock (desktop 1280)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    const page = await context.newPage();
    await fulfillFlagsStaging(context);
    await openCaseOnBench(page, 137);
    await unlockSpeech(page);
    await waitForSearchIdle(page, 120_000);
    await showMap(page);
    const mapBox = await page.getByTestId("loop-map").boundingBox();
    expect(mapBox).not.toBeNull();
    // Dock top-left is map-relative (120, height-116); its centre is
    // +(35, 52). The hover point sits >320 px from that centre, so
    // the berth solver answers "remote" — and as the FIRST map
    // interaction it is also Holmes's entry. Pre-cure, the remote
    // branch cleared the entry walk and stranded him at the entry
    // offset dock+(90,34); the cure lets the entry walk complete.
    const dockRel = { x: 120, y: Math.round(mapBox!.height) - 116 };
    const dockCentre = { x: dockRel.x + 35, y: dockRel.y + 52 };
    const point = {
      x: Math.round(mapBox!.x + mapBox!.width * 0.85),
      y: Math.round(mapBox!.y + mapBox!.height * 0.25),
    };
    const dist = Math.hypot(
      point.x - (mapBox!.x + dockCentre.x),
      point.y - (mapBox!.y + dockCentre.y),
    );
    expect(dist, "hover point must be remote (>320 px from dock centre)").toBeGreaterThan(320);
    /* The hover-pause trigger rides the companion's rAF watch:
     * if the shipped FPS auto-kill has latched (a loaded VM's
     * SwiftShader frames), no pause can ever confirm and the
     * bench simply never leaves — name that precondition like
     * the flow test's berth does, so a kill reads as an
     * environment result, not as an entry-ownership failure. */
    expect(
      await companionMode(page),
      "companion must be full (not auto-killed) for the hover entry",
    ).toBe("full");
    await page.mouse.move(point.x, point.y, { steps: 10 });
    await page.mouse.move(point.x + 2, point.y + 1, { steps: 2 });
    // Entry completes: bench gone, wrapper parked AT the dock —
    // not at dock+(90,34). Poll because the pause-confirm + 700 ms
    // entry walk take a few seconds on this VM.
    await expect(page.getByTestId("detective-bench")).toHaveCount(0, {
      timeout: 30_000,
    });
    /* Settle tolerance: the wrapper's rendered top-left can sit
     * 1 px off its style position (sub-pixel rounding) — observed
     * (121,379) vs the dock (120,378) on a run where Holmes WAS at
     * the dock. The invariant is "at the dock, not stranded at
     * dock+(90,34)": a <=2 px tolerance keeps 45x margin against
     * the 91 px defect while ignoring rounding. */
    await expect
      .poll(
        async () => {
          const p = await holmesWrapperPos(page);
          if (!p) return 9999;
          return Math.hypot(
            p.x - mapBox!.x - dockRel.x,
            p.y - mapBox!.y - dockRel.y,
          );
        },
        { timeout: 30_000 },
      )
      .toBeLessThanOrEqual(2);
  } finally {
    await context.close();
  }
});
