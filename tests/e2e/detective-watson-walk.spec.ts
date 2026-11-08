import { test, expect, type Page } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  AuditTrail,
  assertSubsequence,
  collectAuditWindow,
  currentPhase,
  detectivePlays,
  entryByName,
  fulfillFlagsStaging,
  fulfillFlagsWalk,
  guessByEntryId,
  installDetectiveRecorder,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * Detective Watson-walk gate (PR B, watsonWalk): the WALKING state,
 * arrival-gated clue reads, the case-open announcement, silent
 * clue-2+ walks, instant station replay, sheet-open cancellation,
 * reduced-motion instant placement, and the owner's ZERO-OVERLAP
 * LAW (0 px² of figure over clue text in every sampled state).
 *
 * Per-device gate (owner amendment, 2026-11-06): EVERY assertion
 * runs at 390 / 768 / 1280 — no width proxies another. The overlap
 * audit is the shared harness in detective-u10.ts (the staging
 * mockup v2 sampling audit, inherited — not duplicated).
 *
 * The walk flag is flipped ON by route interception only
 * (detectivePair + hostsStaging + watsonWalk); the committed
 * flags.json is never relied on either way. Case 137 is the seam
 * case with full rendered audio, so arrival gating is observable
 * directly on the play record: while Watson walks, the clue clip
 * must NOT have started; it starts only after arrival.
 */

test.setTimeout(300_000);

const ANNOUNCE = "fixed/lets-find-clues.mp3";
const CLUE1 = "case-137/clue-1.mp3";
const CLUE2 = "case-137/clue-2.mp3";

type WalkSample = {
  walk: string | null;
  pose: string | null;
  top: number | null;
  plays: string[];
};

async function detectiveOnly(page: Page): Promise<string[]> {
  return (await detectivePlays(page)).filter((u) =>
    u.includes("/audio/detective/"),
  );
}

function countIn(list: string[], needle: string): number {
  return list.filter((u) => u.includes(needle)).length;
}

/** Open the seam case WITHOUT the speech-unlock taps, so the bench
 * stage (CASE_OPEN) is still on screen (the staging pattern). */
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

/** Start the in-page walk recorder: every 30 ms it samples the
 * station's walk state, Watson's pose + painted top, and the
 * detective play record — so the test can prove what had (and had
 * NOT) started while Watson was mid-walk. */
async function startWalkTrace(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __walkTrace: WalkSample[];
      __walkTimer: ReturnType<typeof setInterval>;
    };
    w.__walkTrace = [];
    w.__walkTimer = setInterval(() => {
      const st = document.querySelector('[data-testid="detective-station"]');
      const svg = document.querySelector('[data-detective="watson"] svg');
      const plays = (
        (window as unknown as { __detectivePlays: string[] })
          .__detectivePlays ?? []
      )
        .filter((u) => u.includes("/audio/detective/"))
        .map((u) => u.split("/").slice(-2).join("/"));
      w.__walkTrace.push({
        walk: st?.getAttribute("data-watson-walk") ?? null,
        pose: svg?.getAttribute("data-pose") ?? null,
        top: svg ? Math.round(svg.getBoundingClientRect().top) : null,
        plays,
      });
    }, 30);
  });
}

async function stopWalkTrace(page: Page): Promise<WalkSample[]> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __walkTrace: WalkSample[];
      __walkTimer: ReturnType<typeof setInterval>;
    };
    clearInterval(w.__walkTimer);
    return w.__walkTrace;
  });
}

/** The walk assertions shared by the case-open and clue-2 walks:
 * a real visible walk (state + walk pose + a multi-step path), and
 * the clue clip NOT started in any mid-walk sample. */
function assertWalked(
  trace: WalkSample[],
  clueFile: string,
  label: string,
) {
  const walking = trace.filter((s) => s.walk === "walking");
  expect(
    walking.length,
    `${label}: the WALKING state must be observed (trace: ${trace.length} samples)`,
  ).toBeGreaterThan(3);
  expect(
    walking.some((s) => s.pose === "walk"),
    `${label}: Watson must take the walk pose mid-walk`,
  ).toBe(true);
  const tops = new Set(
    walking.map((s) => s.top).filter((t) => t !== null),
  );
  expect(
    tops.size,
    `${label}: the walk must be a multi-step path, not a teleport (distinct tops: ${[...tops].join(",")})`,
  ).toBeGreaterThanOrEqual(3);
  /* The no-early-release check covers every walking sample EXCEPT
   * the final one — the arrival-boundary sample. arriveWatson sets
   * the walk state to idle and enqueues the held read in the same
   * handler (state first, enqueue second); the player's play() is
   * synchronous while React's commit of data-watson-walk="idle" to
   * the DOM is not, so the boundary sample can legitimately record
   * the clip a frame before the attribute flips. Every sample
   * before the boundary is unambiguously mid-walk and must be
   * clue-free — that is the release gate this spec exists to pin.
   * (Observed once under VM contention: clue-2 present in exactly
   * the boundary sample at phone 390.) */
  for (const s of walking.slice(0, -1)) {
    expect(
      s.plays.some((u) => u.includes(clueFile)),
      `${label}: ${clueFile} must NOT start before walk-arrival`,
    ).toBe(false);
  }
  return walking;
}

const WIDTHS = [
  { name: "phone 390", width: 390, height: 844 },
  { name: "tablet 768", width: 768, height: 1024 },
  { name: "desktop 1280", width: 1280, height: 950 },
] as const;

for (const w of WIDTHS) {
  test(`watson walk: case-open announcement + arrival-gated reads + silent clue-2 walk + instant replay, zero overlap (${w.name})`, async ({
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
      await fulfillFlagsWalk(context);
      await openCaseOnBench(page, 137);
      await trail.collect(page, `bench @ ${w.name}`);

      /* -- CASE-OPEN WALK: announcement during, read on arrival -- */
      await startWalkTrace(page);
      const walkWindow = collectAuditWindow(page, 9_000);
      await unlockSpeech(page);
      await waitForSearchIdle(page, 120_000);
      const trace1 = await stopWalkTrace(page);
      const walking1 = assertWalked(trace1, CLUE1, `case-open walk @ ${w.name}`);
      // The announcement played DURING the case-open walk.
      const lastWalk1 = walking1[walking1.length - 1]!;
      expect(
        lastWalk1.plays.some((u) => u.includes(ANNOUNCE)),
        `case-open walk @ ${w.name}: "Let's find some clues" must play during the walk`,
      ).toBe(true);
      trail.absorb(await walkWindow, `case-open walk @ ${w.name}`);
      const plays1 = await detectiveOnly(page);
      // Full order: duet -> announcement -> clue 1 read -> ack -> decode.
      assertSubsequence(
        plays1.map((u) => u.split("/").slice(-2).join("/")),
        [
          "fixed/instructions-holmes.mp3",
          "fixed/instructions-watson.mp3",
          ANNOUNCE,
          CLUE1,
          "fixed/ack-1.mp3",
          "fixed/decode-geography.mp3",
        ],
      );
      expect(countIn(plays1, ANNOUNCE)).toBe(1);
      await trail.collect(page, `search after clue 1 @ ${w.name}`);

      /* -- CLUE 2 WALK: silent, read on arrival -------------------- */
      await startWalkTrace(page);
      const lasVegas = entryByName("las vegas");
      await guessByEntryId(page, lasVegas.id, "las vegas");
      /* The audit window opens when the clue-2 READING begins (the
       * walk starts in the same dispatch), NOT across the guess
       * itself — for a measured, walk-independent reason: at guess
       * commit the guesses list's FLIP animation (LoopScreen's
       * useAutoAnimate) slides the whole clue column up through the
       * bench slot for ~200 ms, a pre-existing transient reproduced
       * with watsonWalk OFF (probe log in the PR's evidence; the
       * bench figure and the cards are both LoopScreen layout there,
       * not pair placements). The pair-state windows in this spec
       * scope to the pair's own states, as the mockup audit did. */
      await expect
        .poll(() => currentPhase(page), { timeout: 60_000 })
        .toBe("READING");
      const clue2Window = collectAuditWindow(page, 3_500);
      await waitForSearchIdle(page, 120_000);
      const trace2 = await stopWalkTrace(page);
      assertWalked(trace2, CLUE2, `clue-2 walk @ ${w.name}`);
      trail.absorb(await clue2Window, `clue-2 walk @ ${w.name}`);
      const plays2 = await detectiveOnly(page);
      expect(
        countIn(plays2, ANNOUNCE),
        `clue-2 walk @ ${w.name}: no second announcement (clue 2+ walks are silent)`,
      ).toBe(1);
      expect(countIn(plays2, CLUE2)).toBe(1);

      /* -- REPLAY AT THE STATION: instant, no re-walk -------------- */
      // Watson is at the map dock in SEARCH_IDLE; his replay control
      // replays the held clue-2 chain at once. (The station form of
      // the same rule — replay while he stands at a card — is the
      // shipped Unit A behaviour; what PR B adds is that a replay
      // never starts a walk.)
      await startWalkTrace(page);
      const acksBefore = countIn(await detectiveOnly(page), "fixed/ack-");
      await page.getByTestId("detective-watson-replay").click();
      await expect
        .poll(
          async () => countIn(await detectiveOnly(page), "fixed/ack-"),
          { timeout: 15_000 },
        )
        .toBeGreaterThan(acksBefore);
      const trace3 = await stopWalkTrace(page);
      expect(
        trace3.some((s) => s.walk === "walking"),
        `replay @ ${w.name}: a replay must never start a walk`,
      ).toBe(false);
      await trail.collect(page, `replay @ ${w.name}`);
    } finally {
      await context.close();
    }
  });

  test(`watson walk reduced-motion: instant placement + immediate read, zero overlap (${w.name})`, async ({
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
      await fulfillFlagsWalk(context);
      await openCaseOnBench(page, 137);
      await startWalkTrace(page);
      await unlockSpeech(page);
      await waitForSearchIdle(page, 120_000);
      const trace = await stopWalkTrace(page);
      expect(
        trace.some((s) => s.walk === "walking"),
        `reduced @ ${w.name}: reduced motion must never walk (instant placement)`,
      ).toBe(false);
      const plays = await detectiveOnly(page);
      // The read was NOT gated: clue 1 played, and no announcement
      // exists in this mode (it rides the walk that never happens).
      expect(countIn(plays, CLUE1)).toBe(1);
      expect(countIn(plays, ANNOUNCE)).toBe(0);
      await trail.collect(page, `reduced @ ${w.name}`);
    } finally {
      await context.close();
    }
  });
}

test("watson walk: sheet opens mid-walk — walk cancels, held read never fires late (phone 390)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    await serveBuiltArtifact(context);
    await installDetectiveRecorder(context, 3);
    const page = await context.newPage();
    await fulfillFlagsWalk(context);
    await openCaseOnBench(page, 137);

    /* Pre-stage the sheet: fill the guess search and hold the option
     * unclicked while the duet plays, so ONE click lands the sheet
     * inside the 800 ms case-open walk window. */
    await unlockSpeech(page);
    const lasVegas = entryByName("las vegas");
    const box = page.getByRole("combobox", { name: "Search the map" });
    await box.click();
    await box.fill("las vegas");
    const option = page.locator(
      `li[role="option"][data-entry-id="${lasVegas.id}"]`,
    );
    await expect(option).toBeVisible({ timeout: 30_000 });

    /* Wait for the walk to start on the page's own frame clock,
     * then click the option in the same breath. */
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const check = () => {
            const st = document.querySelector(
              '[data-testid="detective-station"]',
            );
            if (st?.getAttribute("data-watson-walk") === "walking") {
              resolve();
              return;
            }
            requestAnimationFrame(check);
          };
          check();
        }),
    );
    await option.click();
    await expect(page.getByRole("dialog")).toBeVisible({
      timeout: 15_000,
    });
    // The pair is absent while the sheet owns the screen.
    await expect(page.getByTestId("detective-station")).toHaveCount(0);
    // While the sheet is open, the dropped read's chain must NOT
    // advance: no ack, no decode — the ladder waits, silently.
    await page.waitForTimeout(2_500);
    const duringSheet = await detectiveOnly(page);
    expect(countIn(duringSheet, "fixed/ack-")).toBe(0);
    expect(countIn(duringSheet, "fixed/decode-")).toBe(0);
    expect(
      countIn(duringSheet, CLUE1),
      "the held clue read must never fire late (it was dropped, not delayed)",
    ).toBe(0);

    /* Dismiss: the ladder advances past the skipped read (the
     * deferred drain) — ack + decode play in the open and the case
     * reaches the guessing phase without ever playing clue 1. */
    await page.getByRole("button", { name: "Not this one" }).click();
    await waitForSearchIdle(page, 120_000);
    const after = await detectiveOnly(page);
    expect(countIn(after, CLUE1)).toBe(0);
    expect(countIn(after, "fixed/ack-1.mp3")).toBe(1);
    expect(await currentPhase(page)).toBe("SEARCH_IDLE");
  } finally {
    await context.close();
  }
});

test("watson walk kill-switch: watsonWalk off = teleport + read at reveal, no announcement (phone 390)", async ({
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
    await startWalkTrace(page);
    await unlockSpeech(page);
    await waitForSearchIdle(page, 120_000);
    const trace = await stopWalkTrace(page);
    expect(
      trace.every((s) => s.walk === null || s.walk === "off"),
      "with watsonWalk off the station must report walk off (PR A behaviour)",
    ).toBe(true);
    const plays = await detectiveOnly(page);
    expect(countIn(plays, ANNOUNCE)).toBe(0);
    expect(countIn(plays, CLUE1)).toBe(1);
  } finally {
    await context.close();
  }
});
