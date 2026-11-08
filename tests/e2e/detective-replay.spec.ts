import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  collectAudioRequests,
  detectivePlays,
  fulfillFlagsOn,
  installDetectiveRecorder,
  openSeamCase,
  waitForSearchIdle,
  watchdogSeeks,
} from "./detective-u10";

/**
 * Tap-Watson replay gate (Unit A, fold-in to PR #355): tapping Watson
 * at his station asks him to repeat the current clue.
 *
 * - (a) In AUTO speech mode (this spec never forces tap mode — the
 *   default profile in this harness auto-plays, exactly as the
 *   stations spec proves), a tap on Watson's figure at his clue-card
 *   station — where he now stands through the guessing phases too
 *   (station cure, 2026-11-08) — replays the current clue's full
 *   sequence (read → ack → decode)
 *   from the top; keyboard activation of the same control replays it
 *   again. The control is a real button ≥44×44 px with the owner's
 *   aria-label, NOT inside any aria-hidden cluster, carrying the ↻
 *   cue badge.
 * - (b) Taps elsewhere on the screen (the heading, the clue card) do
 *   NOT replay anything.
 * - (c) A tap DURING an in-progress read restarts the read from item
 *   1: the clue clip plays again from the top, and the ladder then
 *   continues (ack → decode) exactly once. Playback is slowed to
 *   0.25× here, and the test proves the read is in flight at tap
 *   time (no ack/decode on the record yet) before it taps.
 *
 * Speech is observed on the harness's play() record (the player's own
 * queue order — see detective-u10.ts), cross-checked in (a) on the
 * network log's first-pass counts. The flag is flipped on by route
 * interception only — the committed flags.json stays false. This spec
 * uses the shared test-fixture context (no browser.newContext), so no
 * CONTEXT_FILES entry is needed.
 */

test.setTimeout(240_000);

const CLUE = "case-137/clue-1.mp3";
const ACK = "fixed/ack-1.mp3";
const DECODE = "fixed/decode-geography.mp3";
const CHAIN = [CLUE, ACK, DECODE];

async function detectiveOnly(page: import("playwright/test").Page): Promise<string[]> {
  return (await detectivePlays(page)).filter((u) => u.includes("/audio/detective/"));
}

function countIn(list: string[], needle: string): number {
  return list.filter((u) => u.includes(needle)).length;
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("(a) tap on Watson replays the current clue sequence in auto mode", async ({
  page,
  context,
}) => {
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  const requests = collectAudioRequests(page);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);
  await expect
    .poll(() => page.evaluate(() =>
      document.querySelector('[data-testid="detective-host"]')?.getAttribute("data-speech-mode"),
    ), { timeout: 15_000 })
    .toBe("auto");

  const before = await detectiveOnly(page);
  for (const needle of CHAIN) {
    expect(countIn(before, needle), `first pass played ${needle}`).toBe(1);
  }
  // The network log saw the same first pass (the stations pattern).
  for (const needle of CHAIN) {
    expect(countIn(requests, needle), `network saw ${needle}`).toBeGreaterThanOrEqual(1);
  }

  // --- the control: a real, labelled, ≥44×44 button over Watson,
  //     outside every aria-hidden cluster, with the ↻ cue badge ---
  // Settle first: at the READING→SEARCH handoff the pair's figures
  // coexist briefly (a pre-existing mount overlap — the U10 harness
  // polls through the same window), so wait until exactly one
  // replay control remains. In SEARCH_IDLE that control is the
  // STATION form: Watson holds the clue-card station through the
  // guessing phases (station cure, 2026-11-08), so the button is
  // page-scoped — it no longer lives inside the map.
  await expect(page.getByTestId("detective-watson-replay")).toHaveCount(1, {
    timeout: 30_000,
  });
  const btn = page.getByTestId("detective-watson-replay");
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await expect(btn).toHaveAttribute("aria-label", "Ask Watson to repeat this clue");
  const geo = await btn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      inAriaHidden: el.closest('[aria-hidden="true"]') !== null,
      badge: el.querySelector(".detective-watson-replay-badge") !== null,
    };
  });
  expect(geo.w).toBeGreaterThanOrEqual(44);
  expect(geo.h).toBeGreaterThanOrEqual(44);
  expect(geo.inAriaHidden).toBe(false);
  expect(geo.badge).toBe(true);

  // --- pointer tap on Watson's figure (the button covers it) ---
  await btn.click();
  await expect
    .poll(async () => countIn(await detectiveOnly(page), CLUE), { timeout: 60_000 })
    .toBe(2);
  await expect
    .poll(async () => countIn(await detectiveOnly(page), DECODE), { timeout: 60_000 })
    .toBe(2);
  const afterTap = await detectiveOnly(page);
  for (const needle of CHAIN) {
    expect(countIn(afterTap, needle), `replay played ${needle}`).toBe(2);
  }
  // …and the replay's three clips are the tail of the record, in
  // chain order (read → ack → decode, from the top).
  const tail = afterTap.slice(-3).map((u) => CHAIN.findIndex((n) => u.includes(n)));
  expect(tail).toEqual([0, 1, 2]);
  console.log(
    `[replay-a] pointer tap replayed the chain; watchdogSeeks=${await watchdogSeeks(page)}`,
  );

  // --- keyboard activation runs the same replay path ---
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => countIn(await detectiveOnly(page), CLUE), { timeout: 60_000 })
    .toBe(3);
  await expect
    .poll(async () => countIn(await detectiveOnly(page), DECODE), { timeout: 60_000 })
    .toBe(3);
  console.log("[replay-a] keyboard activation replayed the chain again");
});

test("(b) taps elsewhere on the screen do NOT replay", async ({
  page,
  context,
}) => {
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);
  await waitForSearchIdle(page);

  const before = await detectiveOnly(page);
  // Elsewhere #1: the GeoDetective heading (the harness's own gesture
  // tap point — it must stay a no-op for replay).
  await page.getByRole("heading", { name: "GeoDetective" }).click();
  // Elsewhere #2: the clue card itself, beside Watson's station.
  await page.getByRole("article", { name: /Clue 1:/ }).click();
  await page.waitForTimeout(2500);

  const after = await detectiveOnly(page);
  expect(after.length).toBe(before.length);
  for (const needle of CHAIN) {
    expect(countIn(after, needle), `no replay of ${needle}`).toBe(
      countIn(before, needle),
    );
  }
  console.log(
    `[replay-b] elsewhere taps replayed nothing (plays ${before.length} → ${after.length})`,
  );
});

test("(c) tap during an in-progress read restarts it from item 1", async ({
  page,
  context,
}) => {
  // Slow playback (0.25×): the clue read is genuinely in flight —
  // and provably so — at tap time.
  await installDetectiveRecorder(context, 0.25);
  await fulfillFlagsOn(context);
  await openSeamCase(page, 137);

  // Bring the clue card (and Watson's station, anchored to it) into
  // the viewport NOW, while the case-open duet is still playing: the
  // station button sits below the fold, and a Playwright click that
  // has to scroll-and-chase the re-anchoring button burns longer
  // than the read window (observed in this gate's first runs — the
  // tap landed after the chain drained and merely replayed it).
  await page.getByRole("article", { name: /Clue 1:/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Wait until Watson's clue-1 read has STARTED (its play() is on the
  // record). At 0.25× it runs for many seconds from here.
  await expect
    .poll(async () => countIn(await detectiveOnly(page), CLUE), { timeout: 120_000 })
    .toBe(1);
  // PROOF the read is still in flight: the ladder has not advanced —
  // no ack, no decode yet. (If a slow VM ever ate the whole window,
  // this fails loudly as a flake instead of passing falsely on a
  // post-read replay.)
  const inFlight = await detectiveOnly(page);
  expect(countIn(inFlight, ACK)).toBe(0);
  expect(countIn(inFlight, DECODE)).toBe(0);

  // Watson is at the clue-card station (READING) — tap him there,
  // with a direct mouse tap on his settled box.
  const btn = page.getByTestId("detective-watson-replay");
  await expect(btn).toHaveCount(1, { timeout: 15_000 });
  const box = await btn.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  // The read restarts from item 1: clue-1 plays a second time…
  await expect
    .poll(async () => countIn(await detectiveOnly(page), CLUE), { timeout: 60_000 })
    .toBe(2);
  // …and DECISIVELY, it restarted mid-read: at the moment the second
  // read starts, the original chain still has not advanced — the ack
  // exists nowhere on the record. (A post-drain replay would show
  // the completed ack + decode BEFORE the second clue.)
  const atRestart = await detectiveOnly(page);
  expect(countIn(atRestart, ACK)).toBe(0);
  expect(countIn(atRestart, DECODE)).toBe(0);

  // …and the ladder continues exactly once from there: ack → decode
  // follow the restarted read (no duplicated chain, no stall).
  await expect
    .poll(async () => countIn(await detectiveOnly(page), DECODE), { timeout: 120_000 })
    .toBe(1);
  await waitForSearchIdle(page);
  const plays = await detectiveOnly(page);
  const firstClue = plays.findIndex((u) => u.includes(CLUE));
  const secondClue = plays.findIndex((u, i) => i > firstClue && u.includes(CLUE));
  const ack = plays.findIndex((u, i) => i > secondClue && u.includes(ACK));
  const decode = plays.findIndex((u, i) => i > secondClue && u.includes(DECODE));
  expect(firstClue).toBeGreaterThanOrEqual(0);
  expect(secondClue).toBeGreaterThan(firstClue);
  expect(ack).toBeGreaterThan(secondClue);
  expect(decode).toBeGreaterThan(ack);
  expect(countIn(plays, ACK)).toBe(1);
  expect(countIn(plays, DECODE)).toBe(1);
  console.log(
    `[replay-c] restart order clue@${firstClue} → clue@${secondClue} → ack@${ack} → decode@${decode}; watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});
