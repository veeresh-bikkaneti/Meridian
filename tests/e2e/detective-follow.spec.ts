import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  currentPhase,
  currentPlacement,
  detectivePlays,
  entryByName,
  followTier,
  fulfillFlagsFollow,
  fulfillFlagsFollowOff,
  guessByEntryId,
  installDetectiveRecorder,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * PB-1 (owner restatement 2026-11-07): HOLMES FOLLOWS THE POINTER
 * across the whole page and STAYS with it.
 *
 * (a) travel to the pointer neighbourhood — mouse at 1280/768,
 *     touch at 390 — with clue-text overlap sampled at 0 px;
 * (b) planted: after parking he NEVER returns to the bench/dock
 *     corner (the owner's "big bug") — sampled through parks and
 *     through travel between two points;
 * (c) planted during scroll and pinch (no chase, no jump);
 * (d) speech lock: a selection read holds him still;
 * (e) burst: the place-confirm sheet hides him, dismissal rejoins
 *     him at the last sensed pointer position;
 * (f) kill-switch: holmesFollow OFF reads tier PAUSE_BERTH — fast
 *     sweeps are ignored, a hover-pause berths him and he holds.
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

async function showMap(page: Page) {
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="loop-map"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(700);
}

type Rect = { x: number; y: number; w: number; h: number };

async function holmesRect(page: Page): Promise<Rect | null> {
  return page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="detective-holmes-wrapper"]',
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
}

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Overlap (px²) between Holmes and any clue/question surface.
 * Visibility-aware (F1 land, parent adjudication 2026-11-09):
 * a figure the host has withdrawn from paint covers no text, so
 * it contributes no overlap. That means the hidden class, or
 * computed visibility hidden, or computed opacity 0 — any one of
 * them means nothing is painted. A painted figure is still
 * measured exactly as before, and any painted overlap still
 * fails at 0 px². */
async function clueOverlap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="detective-holmes-wrapper"]',
    );
    if (!el) return 0;
    if (el.classList.contains("detective-host-holmes-hidden")) return 0;
    const cs = window.getComputedStyle(el);
    if (cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) {
      return 0;
    }
    const h = el.getBoundingClientRect();
    let worst = 0;
    const targets = document.querySelectorAll(
      'article[aria-label^="Clue"], [data-testid="detective-station"], [data-testid="detective-bench"]',
    );
    targets.forEach((t) => {
      const r = t.getBoundingClientRect();
      const ox = Math.max(
        0,
        Math.min(h.right, r.right) - Math.max(h.left, r.left),
      );
      const oy = Math.max(
        0,
        Math.min(h.bottom, r.bottom) - Math.max(h.top, r.top),
      );
      worst = Math.max(worst, ox * oy);
    });
    return worst;
  });
}

/** Poll until Holmes's centre is within `within` px of the point
 * and placement reads berth \u2014 and he has SETTLED there: two
 * matching samples at least 900 ms apart whose centres agree
 * within 2 px. (Cure round 5, diagnosis A/B: arrival alone fires
 * mid-glide \u2014 the walk takes up to ~800 ms after the telegraph \u2014
 * and a mid-glide rect used as a planted baseline manufactures
 * "drift" equal to the rest of the glide. Round 6: the window
 * is 900 ms, not 250 ms \u2014 a camera-idle re-solve ~120 ms after
 * landing nudged him 12 px inside the shorter window; a settle
 * claim must outlast it. The 200 px / berth conditions are
 * unchanged; settling is now part of "arrived".) */
async function waitArrived(
  page: Page,
  point: { x: number; y: number },
  within = 200,
  timeoutMs = 45_000,
): Promise<Rect> {
  const deadline = Date.now() + timeoutMs;
  let last: Rect | null = null;
  let candidate: Rect | null = null;
  let candidateAt = 0;
  while (Date.now() < deadline) {
    last = await holmesRect(page);
    // Owner test-design law (2026-11-08), negative 3: the zero
    // clue-overlap law is sampled DURING the walk, not only at
    // the park \u2014 every poll of this loop is a travel sample.
    if (last) {
      expect(
        await clueOverlap(page),
        "clue overlap during travel",
      ).toBe(0);
    }
    let matches = false;
    if (last && (await currentPlacement(page)) === "berth") {
      const c = centre(last);
      matches = Math.hypot(c.x - point.x, c.y - point.y) <= within;
    }
    if (matches && last) {
      if (candidate && Date.now() - candidateAt >= 900) {
        const a = centre(candidate);
        const b = centre(last);
        if (Math.hypot(a.x - b.x, a.y - b.y) <= 2) return last;
        candidate = last;
        candidateAt = Date.now();
      } else if (!candidate) {
        candidate = last;
        candidateAt = Date.now();
      }
    } else {
      candidate = null;
    }
    await page.waitForTimeout(300);
  }
  throw new Error(
    `Holmes never arrived near (${Math.round(point.x)},${Math.round(point.y)}): rect=${JSON.stringify(last)} placement=${await currentPlacement(page)} phase=${await currentPhase(page)} tier=${await followTier(page)}`,
  );
}

/** One atomic planted sample: Holmes's rect, whether he is
 * withdrawn from paint (hidden class, computed visibility hidden,
 * or opacity 0 — the same tests `clueOverlap` uses), the painted
 * overlap (visibility-aware, so a withdrawn figure reads 0), the
 * plain geometric overlap (ignoring visibility), and the geometric
 * overlap of the segment ANCHOR against the clue rects as they lie
 * right now. The anchor figure matters when a scroll has moved a
 * clue card under the spot he was planted at: that spot can become
 * illegal after he was lawfully placed there, and only a fresh
 * measurement against the current rects can show it. */
type PlantState = {
  rect: Rect | null;
  hidden: boolean;
  paintedOverlap: number;
  geometricOverlap: number;
  anchorOverlap: number;
};

async function plantState(page: Page, anchor: Rect): Promise<PlantState> {
  return page.evaluate((a) => {
    const el = document.querySelector(
      '[data-testid="detective-holmes-wrapper"]',
    );
    if (!el) {
      return {
        rect: null,
        hidden: false,
        paintedOverlap: 0,
        geometricOverlap: 0,
        anchorOverlap: 0,
      };
    }
    const cs = window.getComputedStyle(el);
    const hidden =
      el.classList.contains("detective-host-holmes-hidden") ||
      cs.visibility === "hidden" ||
      parseFloat(cs.opacity) === 0;
    const r = el.getBoundingClientRect();
    const targets = document.querySelectorAll(
      'article[aria-label^="Clue"], [data-testid="detective-station"], [data-testid="detective-bench"]',
    );
    const overlapOf = (box: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }) => {
      let worst = 0;
      targets.forEach((t) => {
        const tr = t.getBoundingClientRect();
        const ox = Math.max(
          0,
          Math.min(box.right, tr.right) - Math.max(box.left, tr.left),
        );
        const oy = Math.max(
          0,
          Math.min(box.bottom, tr.bottom) - Math.max(box.top, tr.top),
        );
        worst = Math.max(worst, ox * oy);
      });
      return worst;
    };
    const geometricOverlap = overlapOf(r);
    return {
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      hidden,
      paintedOverlap: hidden ? 0 : geometricOverlap,
      geometricOverlap,
      anchorOverlap: overlapOf({
        left: a.x,
        right: a.x + a.w,
        top: a.y,
        bottom: a.y + a.h,
      }),
    };
  }, anchor);
}

/** Sample for `ms`: Holmes must stay within `slack` px of `from`,
 * and (when `dock` given) never come within 30 px of the dock.
 *
 * Segment-aware (F1 reland, parent adjudication 2026-11-09): the
 * stability pin and the zero-overlap pin cannot both hold when the
 * planted spot itself becomes illegal mid-window — a clue card
 * scrolled under his berth, say — because legality has priority
 * and a lawful re-place MUST move him. So the window is tracked in
 * segments. Within a segment the rules are exactly as before:
 * drift at most `slack` px from the segment anchor and zero
 * painted clue overlap at every poll; the 8 px slack is never
 * widened. A segment may end only on evidence of a lawful
 * re-place, checked at the poll where movement beyond `slack` is
 * first seen: (a) he was hidden at the transition (this poll's
 * sample, or the one just before it, reads withdrawn from paint),
 * or (b) the pre-move anchor is illegal against the clue rects as
 * they lie now (geometric overlap > 0) and the post-move position
 * is legal (geometric overlap 0). On a lawful break the new
 * position must settle (stable across two polls, geometrically
 * legal) before it becomes the next segment's anchor, and the
 * break is logged with its evidence. Any other movement beyond
 * `slack` fails with the same drift assertions as before. The
 * dock guard applies to every sample, in every segment. */
async function assertPlanted(
  page: Page,
  from: Rect,
  ms: number,
  dock?: Rect,
  slack = 8,
): Promise<void> {
  const deadline = Date.now() + ms;
  let anchor: Rect = from;
  let segment = 1;
  let prevHidden = false;
  const checkDock = (r: Rect) => {
    if (dock) {
      expect(
        Math.hypot(r.x - dock.x, r.y - dock.y),
        "planted: drifted back toward the dock corner",
      ).toBeGreaterThan(30);
    }
  };
  const failDrift = (r: Rect) => {
    expect(
      Math.abs(r.x - anchor.x),
      "planted: x drifted",
    ).toBeLessThanOrEqual(slack);
    expect(
      Math.abs(r.y - anchor.y),
      "planted: y drifted",
    ).toBeLessThanOrEqual(slack);
  };
  while (Date.now() < deadline) {
    const s = await plantState(page, anchor);
    expect(s.rect, "Holmes must stay mounted while planted").not.toBeNull();
    const r = s.rect!;
    if (Math.abs(r.x - anchor.x) <= slack && Math.abs(r.y - anchor.y) <= slack) {
      checkDock(r);
      expect(s.paintedOverlap, "clue overlap while planted").toBe(0);
      prevHidden = s.hidden;
      await page.waitForTimeout(250);
      continue;
    }
    // Movement beyond the slack: lawful re-place or failure.
    const clauseA = s.hidden || prevHidden;
    const clauseB = s.anchorOverlap > 0 && s.geometricOverlap === 0;
    if (!clauseA && !clauseB) {
      failDrift(r);
      // failDrift throws on the drifted axis; this guards the
      // (impossible) case where both axes are within slack.
      throw new Error("planted: moved without lawful re-place evidence");
    }
    const clause = clauseA
      ? "(a) hidden at the transition"
      : "(b) pre-move position illegal, post-move position legal";
    // The re-place must settle before it earns a new anchor: poll
    // until two samples 250 ms apart agree within 2 px on a
    // geometrically legal spot. Painted overlap and the dock
    // guard are asserted on every settle sample too, so a lawful
    // break never smuggles him over clue text or to the dock.
    let candidate: Rect = r;
    let settled: PlantState | null = null;
    while (Date.now() < deadline && !settled) {
      await page.waitForTimeout(250);
      const s2 = await plantState(page, anchor);
      expect(
        s2.rect,
        "Holmes must stay mounted while planted",
      ).not.toBeNull();
      checkDock(s2.rect!);
      expect(s2.paintedOverlap, "clue overlap while planted").toBe(0);
      if (
        Math.abs(s2.rect!.x - candidate.x) <= 2 &&
        Math.abs(s2.rect!.y - candidate.y) <= 2 &&
        s2.geometricOverlap === 0
      ) {
        settled = s2;
      } else {
        candidate = s2.rect!;
      }
    }
    if (!settled) {
      // No settled legal landing inside the window: the movement
      // is judged against the old anchor, exactly as before.
      failDrift(candidate);
      throw new Error(
        "planted: lawful re-place evidence seen but he never settled",
      );
    }
    const evidence =
      `[assertPlanted] segment ${segment} break: clause ${clause}; ` +
      `pre=${JSON.stringify(anchor)} post=${JSON.stringify(settled.rect)}; ` +
      `anchorOverlap=${s.anchorOverlap} postOverlap=${settled.geometricOverlap}; ` +
      `hiddenAtTransition=${s.hidden} hiddenAtPrevPoll=${prevHidden}`;
    console.log(evidence);
    test.info().annotations.push({
      type: "segment-break",
      description: evidence,
    });
    anchor = settled.rect!;
    segment += 1;
    prevHidden = settled.hidden;
  }
}

async function mapPoint(
  page: Page,
  fx: number,
  fy: number,
): Promise<{ x: number; y: number }> {
  const mb = await page.getByTestId("loop-map").boundingBox();
  expect(mb).not.toBeNull();
  return { x: mb!.x + mb!.width * fx, y: mb!.y + mb!.height * fy };
}

/** Explicit entry step (cure round 2): with follow OFF, entry is
 * the player's first MAP interaction by design (#361 — the staging
 * specs gate entry itself). A small pan drag on the map (~14 px,
 * pointerdown -> move -> up, no place selection) IS that first
 * interaction, so specs whose subject is post-entry behaviour run
 * it explicitly before reading any settled wrapper rect. */
async function enterViaMapDrag(page: Page): Promise<void> {
  const start = await mapPoint(page, 0.5, 0.5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 14, start.y, { steps: 3 });
  await page.mouse.up();
}

test("follow (a)+(b): mouse travel, planted park, no dock return (1280)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsFollow(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    // Tier read polls 30 s (cure round 6): FG-5 re-qualification
    // latency on software-rendered runners, as in detective-berth;
    // the asserted value is unchanged.
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAGE_FOLLOW");
    // Cure A4: this is the SETTLED rect, not necessarily the dock —
    // after the cured idle wait Holmes may already be berthed where
    // the unlock dwell left him. It is still a valid no-return
    // reference for assertPlanted's >30 px guard: he must never
    // drift back toward the spot he was settled at before travelling.
    const settled = await holmesRect(page);
    expect(settled).not.toBeNull();

    const p1 = await mapPoint(page, 0.66, 0.3);
    await page.mouse.move(p1.x, p1.y, { steps: 10 });
    const landed1 = await waitArrived(page, p1);
    await assertPlanted(page, landed1, 5_000, settled!);

    // Travel to a second point: he must go THERE, not via the dock.
    const p2 = await mapPoint(page, 0.4, 0.62);
    await page.mouse.move(p2.x, p2.y, { steps: 12 });
    const travelDeadline = Date.now() + 30_000;
    let landed2: Rect | null = null;
    // Round 7 (diagnosis Q3): arrival at p2 must mean SETTLED, as
    // in waitArrived \u2014 the first berth+within-200 sample can be
    // his p1 berth (184 px from p2, inside the 200 band) while the
    // p2 glide has not even landed, and baselining assertPlanted
    // on it read the lawful glide as "drift". The travel guards
    // below (never through the settled corner, zero overlap) run
    // on every sample exactly as before; a candidate must now
    // also hold within 2 px across 900 ms to count as landed.
    let candidate2: Rect | null = null;
    let candidate2At = 0;
    while (Date.now() < travelDeadline && !landed2) {
      const r = await holmesRect(page);
      if (r) {
        expect(
          Math.hypot(r.x - settled!.x, r.y - settled!.y),
          "travel passed through the settled corner",
        ).toBeGreaterThan(30);
        expect(await clueOverlap(page)).toBe(0);
        const c = centre(r);
        const matches =
          (await currentPlacement(page)) === "berth" &&
          Math.hypot(c.x - p2.x, c.y - p2.y) <= 200;
        if (matches) {
          if (candidate2 && Date.now() - candidate2At >= 900) {
            const a = centre(candidate2);
            if (Math.hypot(a.x - c.x, a.y - c.y) <= 2) landed2 = r;
            else {
              candidate2 = r;
              candidate2At = Date.now();
            }
          } else if (!candidate2) {
            candidate2 = r;
            candidate2At = Date.now();
          }
        } else {
          candidate2 = null;
        }
      }
      await page.waitForTimeout(200);
    }
    expect(landed2, "Holmes never arrived at the second point").not.toBeNull();
    await assertPlanted(page, landed2!, 3_000, settled!);
  } finally {
    await context.close();
  }
});

test("follow (a): mouse travel at tablet width (768)", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsFollow(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    // Tier read polls 30 s (cure round 6): FG-5 re-qualification
    // latency on software-rendered runners, as in detective-berth;
    // the asserted value is unchanged.
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAGE_FOLLOW");
    const settled = await holmesRect(page); // settled rect (Cure A4) — may be a berth, not the dock
    const p1 = await mapPoint(page, 0.6, 0.32);
    await page.mouse.move(p1.x, p1.y, { steps: 10 });
    const landed = await waitArrived(page, p1);
    await assertPlanted(page, landed, 3_000, settled!);
  } finally {
    await context.close();
  }
});

test("follow (a): touch travel + planted after finger lifts (390)", async ({
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
    await fulfillFlagsFollow(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    // Tier read polls 30 s (cure round 6): FG-5 re-qualification
    // latency on software-rendered runners, as in detective-berth;
    // the asserted value is unchanged.
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAGE_FOLLOW");
    const settled = await holmesRect(page); // settled rect (Cure A4) — may be a berth, not the dock
    const p1 = await mapPoint(page, 0.62, 0.3);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: p1.x, y: p1.y, id: 1 }],
    });
    try {
      for (const [jx, jy] of [
        [1, 0],
        [0, 1],
        [-1, 1],
        [1, -1],
        [0, 0],
        [1, 1],
      ] as const) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: p1.x + jx, y: p1.y + jy, id: 1 }],
        });
        await page.waitForTimeout(300);
      }
      const landed = await waitArrived(page, p1);
      // Planted while the finger is DOWN: the held pause is the
      // planted state (cure round 5, diagnosis C). Lifting in
      // place is a tap on the map \u2014 the place-confirm sheet
      // opens and the host unmounts under it by design \u2014 so the
      // mounted/planted claim is sampled before the lift.
      await assertPlanted(page, landed, 3_000, settled!);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      // The lift was a tap: if the confirm sheet opened, dismiss
      // it \u2014 burst-return rejoins him at the same berth, and he
      // must STILL be planted there (the owner's core complaint:
      // finger gone, he STAYS).
      const notThisOne = page.getByRole("button", { name: "Not this one" });
      const sheetOpened = await notThisOne
        .waitFor({ state: "visible", timeout: 2_500 })
        .then(() => true)
        .catch(() => false);
      if (sheetOpened) {
        await notThisOne.click();
        // Burst-return completion reads on PLACEMENT, not phase
        // (round 6 run): he rejoins as a berth at the last
        // pointer while the phase sits in SEARCH_AREA \u2014 the
        // dismiss tap's own pause \u2014 so polling for SEARCH_IDLE
        // times out on a healthy return.
        await expect
          .poll(() => currentPlacement(page), { timeout: 30_000 })
          .toBe("berth");
      }
      await assertPlanted(page, landed, 2_000, settled!);
    } finally {
      await cdp
        .send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        .catch(() => undefined);
    }
  } finally {
    await context.close();
  }
});

test("follow (c): planted during scroll and pinch (1280)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsFollow(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const p1 = await mapPoint(page, 0.6, 0.35);
    await page.mouse.move(p1.x, p1.y, { steps: 10 });
    const landed = await waitArrived(page, p1);

    // Scroll the page hard: the fixed overlay must not chase it.
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(120);
    const afterScroll = await holmesRect(page);
    expect(afterScroll).not.toBeNull();
    expect(Math.abs(afterScroll!.x - landed.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(afterScroll!.y - landed.y)).toBeLessThanOrEqual(8);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(400);

    // Pinch (two-finger converge via CDP): still planted.
    await showMap(page);
    const cdp = await context.newCDPSession(page);
    const cx = p1.x;
    const cy = p1.y;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: cx - 90, y: cy, id: 1 },
        { x: cx + 90, y: cy, id: 2 },
      ],
    });
    for (const d of [70, 50, 30]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - d, y: cy, id: 1 },
          { x: cx + d, y: cy, id: 2 },
        ],
      });
      await page.waitForTimeout(200);
      expect(
        await holmesRect(page),
        "Holmes must stay mounted through the pinch",
      ).not.toBeNull();
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const afterPinch = await holmesRect(page);
    expect(afterPinch).not.toBeNull();
    expect(
      Math.hypot(afterPinch!.x - landed.x, afterPinch!.y - landed.y),
      "pinch moved the planted Holmes",
    ).toBeLessThanOrEqual(24);
    // Tier read polls 30 s (cure round 6): FG-5 re-qualification
    // latency on software-rendered runners, as in detective-berth;
    // the asserted value is unchanged.
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAGE_FOLLOW");
  } finally {
    await context.close();
  }
});

test("follow (d): speech lock — a selection read holds him still (1280)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsFollow(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const p1 = await mapPoint(page, 0.62, 0.3);
    await page.mouse.move(p1.x, p1.y, { steps: 10 });
    const landed = await waitArrived(page, p1);

    const entry = entryByName("las vegas");
    const guessPromise = guessByEntryId(page, entry.id, "las vegas");
    // The read starts; sweep the mouse far away mid-read.
    await expect
      .poll(() => currentPhase(page), { timeout: 30_000 })
      .toMatch(/SELECTION_READ|REVEAL/);
    // Cure round 5 (diagnosis A(d)): the planted baseline is his
    // SETTLED position once the read has begun \u2014 the guess
    // interaction above swept the pointer across the page and he
    // lawfully followed it during SEARCH_AREA, so the pre-guess
    // berth is a position he legitimately left. During the read
    // itself he must not move at all.
    let readBase = await holmesRect(page);
    for (let i = 0; i < 10 && readBase; i++) {
      await page.waitForTimeout(300);
      const again = await holmesRect(page);
      if (
        again &&
        Math.abs(again.x - readBase.x) <= 2 &&
        Math.abs(again.y - readBase.y) <= 2
      ) {
        readBase = again;
        break;
      }
      readBase = again;
    }
    expect(readBase, "Holmes must be mounted during the read").not.toBeNull();
    const far = await mapPoint(page, 0.2, 0.75);
    await page.mouse.move(far.x, far.y, { steps: 6 });
    await assertPlanted(page, readBase!, 1_500);
    await guessPromise;
    // Back in SEARCH: follow resumes to the new hover point.
    await expect
      .poll(() => currentPhase(page), { timeout: 60_000 })
      .toBe("SEARCH_IDLE");
    await page.mouse.move(far.x, far.y, { steps: 4 });
    await waitArrived(page, far, 220);
  } finally {
    await context.close();
  }
});

test("follow (e): sheet burst — hides, then rejoins at last pointer (768)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    await fulfillFlagsFollow(context);
    const page = await context.newPage();
    await openStagingCase(page, 137);
    await waitForSearchIdle(page);
    await showMap(page);
    const p1 = await mapPoint(page, 0.6, 0.3);
    await page.mouse.move(p1.x, p1.y, { steps: 10 });
    await waitArrived(page, p1);

    // Tap a place on the map: the confirm sheet opens, pair hidden.
    const tap = await mapPoint(page, 0.45, 0.5);
    await page.mouse.click(tap.x, tap.y);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Not this one" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
    // He rejoins near the tap — the last sensed pointer position.
    await waitArrived(page, tap, 240);
  } finally {
    await context.close();
  }
});

test("follow OFF (f): PAUSE_BERTH tier — sweeps ignored, pause berths + holds (1280)", async ({
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
    // The drag is a pan/entry gesture only — it must not change
    // the tier this spec gates.
    await enterViaMapDrag(page);
    await waitForSearchIdle(page);
    // Tier read polls 30 s (cure round 6, as above).
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAUSE_BERTH");
    // Cure A4: the SETTLED rect after the cured idle wait — it may
    // be a dwell berth, not the dock. The sweep comparison below is
    // a no-move check against wherever he was settled, which is
    // exactly what it proves either way.
    const settled = await holmesRect(page);
    expect(settled).not.toBeNull();

    // Fast sweep across the map: no chase in the berth tier.
    const a = await mapPoint(page, 0.15, 0.3);
    const b = await mapPoint(page, 0.85, 0.6);
    await page.mouse.move(a.x, a.y);
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.move(a.x, a.y + 60, { steps: 4 });
    // Keep the sweep moving for the same 600 ms window instead of
    // parking at its end point: a pointer parked for 600 ms is a
    // lawful thinking pause in this tier (the desktop pause law
    // confirms at 350 ms), so Holmes would berth toward the parked
    // point and that lawful glide would read as hold drift below.
    // Sweeping between the two end points keeps this a sweep for
    // the whole window, and the read lands right after a move.
    const sweepUntil = Date.now() + 600;
    let sweepToB = true;
    while (Date.now() < sweepUntil) {
      const target = sweepToB ? b : a;
      await page.mouse.move(target.x, target.y + (sweepToB ? 0 : 60), {
        steps: 2,
      });
      sweepToB = !sweepToB;
      await page.waitForTimeout(50);
    }
    const afterSweep = await holmesRect(page);
    expect(Math.abs(afterSweep!.x - settled!.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(afterSweep!.y - settled!.y)).toBeLessThanOrEqual(8);

    // A real hover-pause berths him near the pause, and he holds.
    const p1 = await mapPoint(page, 0.58, 0.34);
    await page.mouse.move(p1.x, p1.y, { steps: 8 });
    const landed = await waitArrived(page, p1);
    await assertPlanted(page, landed, 3_000);
    // Tier read polls 30 s (cure round 6, as above).
    await expect
      .poll(() => followTier(page), { timeout: 30_000 })
      .toBe("PAUSE_BERTH");
  } finally {
    await context.close();
  }
});
