import { test, expect } from "playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveBuiltArtifact } from "./helpers";
import {
  companionMode,
  fulfillFlagsOn,
  installDetectiveRecorder,
  openSeamCase,
  waitForSearchIdle,
  watchdogSeeks,
} from "./detective-u10";

/**
 * K5 SWAP TEST (U10, BUILD-SCOPE §2.3/§5) — the answer-blindness proof.
 *
 * An IDENTICAL scripted pointer trace (same map-relative coordinates,
 * same step counts, same stimulus timing) is replayed on two core
 * cases whose answers differ:
 *   case 137 → Henderson, Nevada (geonames:5505411)
 *   case 100 → Kashipur, India   (geonames:1267579)
 * Case 100's answer sits on another continent from the trace endpoint,
 * and the test asserts in-page that neither case's answer projects
 * near the trace's end region. Holmes's placement + pose timeline is
 * sampled per frame (data attributes + wrapper rect, map-relative).
 * After alignment the placement sequence must be IDENTICAL in every
 * bucket, the pose sequence identical except a ≤1-bucket shift of
 * the walk→think transition, and the berth destination identical;
 * transit positions are compared on a 20 px grid with a 1-cell
 * allowance (see the verdict block at the assertion for why).
 *
 * Alignment + bucketing (the honest jitter handling): absolute clocks
 * differ between runs (the pause-confirm timer chain fires within a
 * ~120 ms retry window), so both timelines are aligned at the first
 * frame where Holmes leaves the dock/search state — the berth itself
 * is the sync event — and bucketed to 100 ms from there. The bucket
 * width and grid are stated here and in the gate report, per the
 * brief.
 */

test.setTimeout(300_000);

interface SwapSample {
  dt: number;
  placement: string | null;
  pose: string | null;
  /** data-companion at sample time ("full" | "dock" | "killed"). */
  mode?: string | null;
  x: number;
  y: number;
  mx?: number;
  my?: number;
  mw?: number;
  mh?: number;
  scrollY?: number;
}

function cluePlaceId(index: number): string {
  const clue = JSON.parse(
    readFileSync(path.resolve(`dist/client/loop/clues/${index}.json`), "utf8"),
  ) as { placeId: string };
  return clue.placeId;
}

async function runTrace(page: import("playwright/test").Page, caseIndex: number) {
  await openSeamCase(page, caseIndex);
  await waitForSearchIdle(page);
  // Render-settle gate: the auto-kill judges FPS only during SEARCH
  // phases, over any ≥1 s window — starting the trace while the
  // intro camera or tile burst still drags this VM's software
  // renderer under 45 FPS lets the latch, not the pointer, decide
  // the run. Wait on a MEASURED condition: a 500 ms rAF window at
  // ≥50 FPS. (On a real device the companion berths long before
  // this matters; this gate exists because SwiftShader is not one.)
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              let n = 0;
              const t0 = performance.now();
              const step = () => {
                n++;
                if (performance.now() - t0 < 500) requestAnimationFrame(step);
                else resolve((n * 1000) / (performance.now() - t0));
              };
              requestAnimationFrame(step);
            }),
          { timeout: 30_000 },
        ),
    )
    .toBeGreaterThanOrEqual(50);
  if ((await companionMode(page)) === "killed") {
    throw new Error("auto-kill latched before the trace began");
  }
  const map = page.getByTestId("loop-map");
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  expect(box).not.toBeNull();

  // Neither answer may sit under the trace's end region: project both
  // cases' targets on THIS case's map and measure the endpoint's
  // distance to each projection (where the projection is on-screen).
  const targets = [137, 100].map((i) => {
    const clue = JSON.parse(
      readFileSync(path.resolve(`dist/client/loop/clues/${i}.json`), "utf8"),
    ) as { target: { lon: number; lat: number } };
    return clue.target;
  });
  const endFrac = { fx: 0.4, fy: 0.6 };
  const projDists = await page.evaluate(
    ([targetsArg, end]) => {
      const el = document.querySelector('[data-testid="loop-map"]') as unknown as {
        __loopMap: { project(p: [number, number]): { x: number; y: number } };
        getBoundingClientRect(): DOMRect;
      };
      const rect = el.getBoundingClientRect();
      const endPx = { x: rect.width * end.fx, y: rect.height * end.fy };
      return (targetsArg as Array<{ lon: number; lat: number }>).map((t) => {
        const p = el.__loopMap.project([t.lon, t.lat]);
        return Math.hypot(p.x - endPx.x, p.y - endPx.y);
      });
    },
    [targets, endFrac] as const,
  );

  // Per-frame sampler: placement + pose + wrapper rect (map-relative).
  await page.evaluate(() => {
    const w = window as unknown as { __swap: SwapSample[]; __swapT0: number };
    w.__swap = [];
    w.__swapT0 = performance.now();
    const loop = () => {
      const wrapper = document.querySelector('[data-testid="detective-holmes-wrapper"]');
      const host = document.querySelector('[data-testid="detective-host"]');
      const mapEl = document.querySelector('[data-testid="loop-map"]');
      if (wrapper && mapEl) {
        const r = wrapper.getBoundingClientRect();
        const m = mapEl.getBoundingClientRect();
        w.__swap.push({
          dt: performance.now() - w.__swapT0,
          placement: host?.getAttribute("data-holmes-placement") ?? null,
          pose: wrapper.querySelector("[data-pose]")?.getAttribute("data-pose") ?? null,
          mode: host?.getAttribute("data-companion") ?? null,
          x: r.left - m.left,
          y: r.top - m.top,
          mx: m.left,
          my: m.top,
          mw: m.width,
          mh: m.height,
          scrollY: window.scrollY,
        } as SwapSample);
      }
      if (performance.now() - w.__swapT0 < 30_000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  // THE TRACE — identical in both runs (map-relative fractions, same
  // steps, same stimulus dwells).
  const at = (fx: number, fy: number) => ({ x: box!.x + box!.width * fx, y: box!.y + box!.height * fy });
  const p0 = at(0.18, 0.8);
  const p1 = at(0.3, 0.68);
  const end = at(endFrac.fx, endFrac.fy);
  await page.mouse.move(p0.x, p0.y, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.move(p1.x, p1.y, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.move(end.x + 2, end.y + 1, { steps: 2 });
  // The thinking pause: hold still while he berths, walks, and settles.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const last = (window as unknown as { __swap: SwapSample[] }).__swap.at(-1);
          return last ? `${last.placement}/${last.pose}` : "none";
        }),
      { timeout: 20_000 },
    )
    .toBe("berth/berth-think");
  // Settle window: keep sampling the held berth.
  await page.waitForTimeout(1200);
  const samples = await page.evaluate(
    () => (window as unknown as { __swap: SwapSample[] }).__swap,
  );
  return {
    samples,
    projDists,
    watchdog: await watchdogSeeks(page),
    killed: samples.some((s) => s.mode === "killed"),
  };
}

/**
 * One case run in a fully isolated context (own storage, own
 * serving): a swap proof must not inherit the other run's persisted
 * game state. The host's auto-kill console lines are captured — a
 * run the auto-kill latched is INVALID as K5 evidence (the latch is
 * an FPS/long-task judgement of the software renderer, not of the
 * case), and the caller re-runs it, counting every invalidation.
 */
async function runCase(
  browser: import("playwright/test").Browser,
  caseIndex: number,
) {
  const context = await browser.newContext({
    viewport: { width: 800, height: 700 },
  });
  await serveBuiltArtifact(context);
  await installDetectiveRecorder(context, 4);
  await fulfillFlagsOn(context);
  const page = await context.newPage();
  const killLines: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("auto-killed")) killLines.push(msg.text());
  });
  try {
    const run = await runTrace(page, caseIndex);
    return { ...run, killLines };
  } catch (err) {
    // Keep the kill evidence attached to the failure: a berth wait
    // that times out BECAUSE the kill latched must say so.
    if (killLines.length > 0) {
      throw new Error(
        `run invalidated by auto-kill: ${killLines.join(" | ")} (inner: ${err instanceof Error ? err.message.split("\n")[0] : String(err)})`,
      );
    }
    throw err;
  } finally {
    await context.close();
  }
}

interface ComparableRow {
  bucket: number;
  placement: string | null;
  pose: string | null;
  gx: number;
  gy: number;
}

/** Align at the first non-dock/search frame (the berth), then bucket
 * to 100 ms; positions on a 20 px grid. */
function comparableSamples(samples: SwapSample[]): ComparableRow[] {
  const startIdx = samples.findIndex(
    (s) => !(s.placement === "dock" && s.pose === "search"),
  );
  if (startIdx === -1) throw new Error("trace never left the dock/search state");
  const t0 = samples[startIdx]!.dt;
  const byBucket = new Map<number, SwapSample>();
  for (const s of samples.slice(startIdx)) {
    byBucket.set(Math.floor((s.dt - t0) / 100), s);
  }
  const rows: ComparableRow[] = [];
  const maxBucket = Math.max(...byBucket.keys());
  for (let b = 0; b <= Math.min(maxBucket, 25); b++) {
    const s = byBucket.get(b);
    if (!s) continue;
    rows.push({
      bucket: b,
      placement: s.placement,
      pose: s.pose,
      gx: Math.round(s.x / 20),
      gy: Math.round(s.y / 20),
    });
  }
  return rows;
}

test("K5 swap: identical trace, swapped answer — identical Holmes timeline", async ({
  browser,
}) => {
  test.setTimeout(600_000);
  // The answers genuinely differ (the swap is real, not a re-run).
  expect(cluePlaceId(137)).toBe("geonames:5505411"); // Henderson
  expect(cluePlaceId(100)).toBe("geonames:1267579"); // Kashipur
  expect(cluePlaceId(137)).not.toBe(cluePlaceId(100));

  // A run whose session the auto-kill latched (FPS <45 or ≥3 long
  // tasks >100 ms in 10 s, judged on this VM's software renderer) is
  // invalid evidence and is re-run in a fresh context — bounded at
  // 3 attempts per case, every invalidation logged with its console
  // kill line. The verdict below rests only on unkilled runs.
  const cleanRun = async (caseIndex: number) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const run = await runCase(browser, caseIndex);
        if (!run.killed && run.killLines.length === 0) {
          console.log(
            `[K5] case ${caseIndex}: clean run on attempt ${attempt} (${run.samples.length} frames, watchdogSeeks=${run.watchdog})`,
          );
          return run;
        }
        console.log(
          `[K5] case ${caseIndex} attempt ${attempt} INVALIDATED by auto-kill: ${run.killLines.join(" | ") || "mode=killed in samples"}`,
        );
      } catch (err) {
        console.log(
          `[K5] case ${caseIndex} attempt ${attempt} errored: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
        );
        if (attempt === 3) throw err;
      }
    }
    throw new Error(
      `case ${caseIndex}: auto-kill invalidated all 3 attempts — no clean K5 evidence on this renderer`,
    );
  };

  const run137 = await cleanRun(137);
  console.log(
    `[K5] case 137: answer-projection distances to endpoint = ${run137.projDists.map((d) => d.toFixed(0)).join("/")} px`,
  );
  // On-screen projections must not sit under the endpoint. (A
  // projection thousands of px away is an off-screen answer — the
  // strongest form of "not under the trace".)
  for (const d of run137.projDists) expect(d).toBeGreaterThan(80);

  const run100 = await cleanRun(100);
  console.log(
    `[K5] case 100: answer-projection distances to endpoint = ${run100.projDists.map((d) => d.toFixed(0)).join("/")} px`,
  );
  for (const d of run100.projDists) expect(d).toBeGreaterThan(80);

  // Diagnostic: dump any raw-sample teleport (for the gate report if
  // the comparison ever needs its context).
  for (const [label, run] of [
    ["137", run137],
    ["100", run100],
  ] as const) {
    for (let i = 1; i < run.samples.length; i++) {
      const p = run.samples[i - 1]!;
      const c = run.samples[i]!;
      if (Math.abs(c.x - p.x) > 40 || Math.abs(c.y - p.y) > 40) {
        console.log(
          `[K5-diag] case ${label} teleport at dt=${c.dt.toFixed(0)}: (${p.x.toFixed(0)},${p.y.toFixed(0)}) -> (${c.x.toFixed(0)},${c.y.toFixed(0)}); map (${p.mx?.toFixed(0)},${p.my?.toFixed(0)} ${p.mw?.toFixed(0)}x${p.mh?.toFixed(0)} scrollY=${p.scrollY}) -> (${c.mx?.toFixed(0)},${c.my?.toFixed(0)} ${c.mw?.toFixed(0)}x${c.mh?.toFixed(0)} scrollY=${c.scrollY})`,
        );
      }
    }
  }

  const a = comparableSamples(run137.samples);
  const b = comparableSamples(run100.samples);
  const fmt = (rows: ComparableRow[]) =>
    rows.map((r) => `${r.bucket}|${r.placement}|${r.pose}|${r.gx}|${r.gy}`).join(" ; ");
  console.log(`[K5] comparable rows: 137=${a.length} 100=${b.length}`);
  console.log(`[K5] 137: ${fmt(a)}`);
  console.log(`[K5] 100: ${fmt(b)}`);
  expect(b.length).toBe(a.length);
  // THE PROOF, stated precisely:
  // - placement: IDENTICAL in every 100 ms bucket (behaviour is a
  //   function of the pointer trace only);
  // - pose: the same sequence (walk… → berth-think…) with the same
  //   destination; the walk→think TRANSITION bucket may differ by
  //   ≤1 — walk duration is continuous in distance (260 px/s), and
  //   the two pages' walk lengths differ by sub-cell amounts (the
  //   cases' clue cards differ in height, shifting the dock the walk
  //   starts from), so a ~650 ms walk can lawfully end either side
  //   of a 100 ms bucket edge. Observed on the cured build: the
  //   transition landed in bucket 6 (case 137) vs 7 (case 100).
  //   Every other bucket's pose must match exactly.
  // - destination cell: IDENTICAL (the berth he walks to is the same);
  // - transit cells: within 1 grid cell (20 px) per bucket, for the
  //   layout reason above. Any answer-driven difference would show
  //   up as a different pose sequence, placement, or destination —
  //   none does.
  const tA = a.findIndex((r) => r.pose === "berth-think");
  const tB = b.findIndex((r) => r.pose === "berth-think");
  expect(tA).toBeGreaterThan(0);
  expect(tB).toBeGreaterThan(0);
  expect(Math.abs(tA - tB)).toBeLessThanOrEqual(1);
  const straddle = Math.min(tA, tB);
  let maxCellDev = 0;
  for (let i = 0; i < a.length; i++) {
    expect(b[i]!.placement).toBe(a[i]!.placement);
    if (i !== straddle) expect(b[i]!.pose).toBe(a[i]!.pose);
    maxCellDev = Math.max(
      maxCellDev,
      Math.abs(b[i]!.gx - a[i]!.gx),
      Math.abs(b[i]!.gy - a[i]!.gy),
    );
    expect(Math.abs(b[i]!.gx - a[i]!.gx)).toBeLessThanOrEqual(1);
    expect(Math.abs(b[i]!.gy - a[i]!.gy)).toBeLessThanOrEqual(1);
  }
  const lastA = a[a.length - 1]!;
  const lastB = b[b.length - 1]!;
  expect({ gx: lastB.gx, gy: lastB.gy }).toEqual({ gx: lastA.gx, gy: lastA.gy });
  console.log(
    `[K5] verdict: placement identical in all ${a.length} buckets; pose sequences identical (walk→think transition bucket ${tA} vs ${tB}, Δ≤1 allowed); destination identical; max transit deviation ${maxCellDev} cell (≤1 allowed, 20 px grid)`,
  );
});
