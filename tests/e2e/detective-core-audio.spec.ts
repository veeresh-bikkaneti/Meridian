import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  assertSubsequence,
  collectAudioRequests,
  detectivePlays,
  entryByName,
  fulfillFlagsOn,
  guessByEntryId,
  installDetectiveRecorder,
  openSeamCase,
  waitForPhase,
  waitForSearchIdle,
} from "./detective-u10";

/**
 * U11 — core-deck clue reads, proven by ears, not DOM (closes FG-3).
 *
 * Before U11, the 387 core-deck cases ("All cases") had EMPTY clue
 * entries in the audio manifest: the renders were never made (Phase A
 * covered the Capitals pack only), so Watson performed the full
 * visual ritual over silent clue reads and tap-Watson replayed only
 * the ack + decode — the clue itself resolved to null and was
 * skipped silently. Case 137 (the seam case every other detective
 * spec uses) was the ONE core case with renders, which is why the
 * shipped specs never caught the silence. This spec therefore runs
 * on case 5 — an ordinary core case, rendered only by U11.
 *
 * - (a) Every clue clip of the case is FETCHED (HTTP 200 on the
 *   network layer) and PLAYBACK STARTS (the harness play() record),
 *   in clue order, as each clue unlocks across four wrong guesses.
 * - (b) Tap-Watson repeats the CLUE — the first clip of the replay
 *   is the clue read itself, not an ack or a decode.
 * - (c) Early-solve negative (the owner's flush rule): solving at
 *   guess 2 flushes the speech queue — no clue clip fires after the
 *   solve. (Win/celebration fixed lines are allowed; clue reads are
 *   not.)
 *
 * Speech is observed on the harness's play() record and the network
 * layer (detective-u10.ts), never on DOM state alone.
 */

test.setTimeout(600_000);

const CASE = 5; // Beersheba, Israel — core deck, U11-rendered.
const CLUES = [1, 2, 3, 4, 5].map((n) => `case-${CASE}/clue-${n}.mp3`);
const WRONG = ["las vegas", "denver", "austin", "phoenix"];

async function detectiveOnly(page: import("playwright/test").Page): Promise<string[]> {
  return (await detectivePlays(page)).filter((u) => u.includes("/audio/detective/"));
}

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
});

test("(a) core case: all five clue clips are fetched (HTTP 200) and play, in order", async ({
  page,
  context,
}) => {
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  const requests = collectAudioRequests(page);
  const statuses = new Map<string, number>();
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/audio/detective/") && u.endsWith(".mp3")) {
      statuses.set(u, res.status());
    }
  });

  await openSeamCase(page, CASE);
  await waitForSearchIdle(page);

  // Clue 1 was read at case open.
  let plays = await detectiveOnly(page);
  expect(plays.some((u) => u.includes(CLUES[0])), "clue 1 played at case open").toBe(true);

  // Each wrong guess unlocks the next clue, whose read must follow.
  for (let g = 0; g < WRONG.length; g++) {
    const name = WRONG[g];
    await guessByEntryId(page, entryByName(name).id, name);
    await waitForSearchIdle(page, 180_000);
    plays = await detectiveOnly(page);
    expect(
      plays.some((u) => u.includes(CLUES[g + 1])),
      `clue ${g + 2} played after wrong guess ${g + 1} (${name})`,
    ).toBe(true);
  }

  // All five clue reads played, in clue order (acks/decodes interleave).
  plays = await detectiveOnly(page);
  const order = assertSubsequence(plays, CLUES);
  console.log(`[core-audio-a] clue plays at record indexes ${order.join(", ")}`);

  // Every clue clip was actually fetched over the network with a 200.
  for (const clue of CLUES) {
    const hit = [...statuses.entries()].find(([u]) => u.includes(clue));
    expect(hit, `${clue} was requested`).toBeTruthy();
    expect(hit![1], `${clue} answered HTTP 200`).toBe(200);
    expect(
      requests.some((u) => u.includes(clue)),
      `${clue} appears in the request log`,
    ).toBe(true);
  }
  console.log("[core-audio-a] all five core clue clips fetched (200) and played in order");
});

test("(b) core case: tap-Watson repeats the clue itself, not the ack or decode", async ({
  page,
  context,
}) => {
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  await openSeamCase(page, CASE);
  await waitForSearchIdle(page);

  const before = await detectiveOnly(page);
  expect(before.some((u) => u.includes(CLUES[0]))).toBe(true);

  const watsonBtn = page
    .getByTestId("loop-map")
    .getByTestId("detective-watson-replay");
  await expect(watsonBtn).toHaveCount(1, { timeout: 30_000 });
  await watsonBtn.click();

  // The replay restarts the held sequence from its first item — the
  // clue read. Before U11 this position in the record was the ack,
  // because the clue resolved to null and was skipped.
  await expect
    .poll(async () => (await detectiveOnly(page)).length, { timeout: 30_000 })
    .toBeGreaterThan(before.length);
  const after = await detectiveOnly(page);
  const firstReplayed = after[before.length];
  expect(
    firstReplayed.includes(CLUES[0]),
    `replay starts with the clue read (got ${firstReplayed})`,
  ).toBe(true);
  console.log(`[core-audio-b] tap-Watson replay started with ${CLUES[0]}`);
});

test("(c) core case: solving at guess 2 flushes the queue — no clue audio fires after the solve", async ({
  page,
  context,
}) => {
  await installDetectiveRecorder(context, 3);
  await fulfillFlagsOn(context);
  await openSeamCase(page, CASE);
  await waitForSearchIdle(page);

  // Guess 1 wrong: clue 2 unlocks and is read.
  await guessByEntryId(page, entryByName("las vegas").id, "las vegas");
  await waitForSearchIdle(page, 180_000);
  let plays = await detectiveOnly(page);
  expect(plays.some((u) => u.includes(CLUES[1]))).toBe(true);

  // Guess 2 solves the case (Beersheba).
  const answer = entryByName("beersheba");
  await guessByEntryId(page, answer.id, "beersheba");
  await waitForPhase(page, "CELEBRATE", 60_000);
  const atSolve = (await detectiveOnly(page)).length;

  // Give any wrongly-queued clue time to fire, then check the record:
  // nothing after the solve may be a clue read of this case.
  await page.waitForTimeout(8_000);
  plays = await detectiveOnly(page);
  const afterSolve = plays.slice(atSolve);
  const leaked = afterSolve.filter((u) => u.includes(`case-${CASE}/clue-`));
  expect(leaked, `no clue audio after the solve (leaked: ${leaked.join(", ")})`).toEqual([]);
  console.log(
    `[core-audio-c] solve at guess 2: ${afterSolve.length} clip(s) after the solve, none of them clue reads`,
  );
});
