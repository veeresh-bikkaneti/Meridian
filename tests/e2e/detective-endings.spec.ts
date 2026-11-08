import { test, expect } from "playwright/test";
import { serveBuiltArtifact } from "./helpers";
import {
  assertSubsequence,
  collectAudioRequests,
  currentPhase,
  detectivePlays,
  entryByName,
  fulfillFlagsOn,
  guessByEntryId,
  installDetectiveRecorder,
  openSeamCase,
  waitForPhase,
  waitForSearchIdle,
  watchdogSeeks,
} from "./detective-u10";

/**
 * Detective endings gate (U10, BUILD-SCOPE §2.4): case 137 (Henderson)
 * played both ways on the real page.
 *
 * WIN in 2 — Las Vegas misses (the voiceless NOTE_MARK beat shows,
 * then Holmes asks for the next question), Henderson solves:
 * CELEBRATE is reached and the DEBRIEF speaks in its exact order —
 * debrief-frame → the answer's name read → debrief-close.
 *
 * FAIL in 5 — five distinct misses burn every guess: Holmes reads the
 * case's answer aloud (case-137/answer.mp3) and the pair POUTs —
 * sticky: the host phase stays POUT across a ≥3 s window.
 *
 * Order assertions run on the play() record and are cross-checked
 * against the network request log.
 */

test.setTimeout(420_000);

test.beforeEach(async ({ context }) => {
  await serveBuiltArtifact(context);
  await installDetectiveRecorder(context, 4);
});

/** Record the phase timeline (changes only) for NOTE_MARK / POUT
 * assertions. Returns a reader for the recorded phases. */
async function startPhaseLog(page: import("playwright/test").Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __phaseLog: Array<{ t: number; phase: string | null }> };
    w.__phaseLog = [];
    let last: string | null = "__init__";
    const iv = setInterval(() => {
      const el =
        document.querySelector('[data-testid="detective-host"]') ??
        document.querySelector('[data-testid="detective-station"]');
      const phase = el?.getAttribute("data-phase") ?? null;
      if (phase !== last) {
        last = phase;
        w.__phaseLog.push({ t: performance.now(), phase });
      }
    }, 40);
    void iv;
  });
  return async () =>
    page.evaluate(
      () =>
        (window as unknown as { __phaseLog: Array<{ t: number; phase: string | null }> })
          .__phaseLog,
    );
}

test("WIN in 2: NOTE_MARK + ask-next after the miss, CELEBRATE, debrief in order", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);
  const requests = collectAudioRequests(page);
  await openSeamCase(page, 137);
  const readPhaseLog = await startPhaseLog(page);
  await waitForSearchIdle(page);

  // Miss 1: Las Vegas.
  const lasVegas = entryByName("las vegas");
  await guessByEntryId(page, lasVegas.id, "las vegas");
  // The selection read plays (name → suspicion), then the NOTE_MARK
  // beat, then ask-next — sampled on the phase log + the play record.
  await waitForPhase(page, "NOTE_MARK", 60_000);
  await expect
    .poll(() => detectivePlays(page), { timeout: 60_000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringContaining("fixed/ask-next.mp3"),
      ]),
    );
  const playsAfterMiss = await detectivePlays(page);
  assertSubsequence(playsAfterMiss, [
    "names/5506956.mp3",
    "fixed/suspicion.mp3",
    "fixed/ask-next.mp3",
  ]);
  const phaseLog = await readPhaseLog();
  const phases = phaseLog.map((p) => p.phase);
  expect(phases).toContain("SELECTION_READ");
  expect(phases.indexOf("NOTE_MARK")).toBeGreaterThan(
    phases.indexOf("SELECTION_READ"),
  );
  console.log(
    `[endings WIN] miss beat observed: phases=${phases.filter(Boolean).join("→")}`,
  );

  // The ladder climbs to clue 2 and returns to the guessing phase.
  await waitForSearchIdle(page, 120_000);

  // Guess 2: Henderson — the solve. The case's answer is the Nevada
  // Henderson (geonames:5505411); pin its entry id explicitly rather
  // than trusting a name search to land on the right Henderson.
  await guessByEntryId(page, "geonames:5505411", "henderson");
  await waitForPhase(page, "CELEBRATE", 60_000);
  console.log("[endings WIN] CELEBRATE phase reached");

  // Debrief order: frame → the answer's name → close, after the win
  // lines. Asserted on the play record, cross-checked on the network.
  const debriefNeedles = [
    "fixed/debrief-frame.mp3",
    "names/5505411.mp3",
    "fixed/debrief-close.mp3",
  ];
  await expect
    .poll(() => detectivePlays(page), { timeout: 90_000 })
    .toEqual(
      expect.arrayContaining(
        debriefNeedles.map((n) => expect.stringContaining(n)),
      ),
    );
  const plays = await detectivePlays(page);
  const winIdx = assertSubsequence(plays, [
    "names/5505411.mp3",
    "fixed/suspicion.mp3",
    "fixed/win-holmes.mp3",
    "fixed/win-watson.mp3",
    ...debriefNeedles,
  ]);
  await expect
    .poll(() => requests.length, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(5);
  const netIdx = assertSubsequence(requests, debriefNeedles);
  console.log(
    `[endings WIN] win+debrief play idx=${winIdx.join(",")} debrief network idx=${netIdx.join(",")} watchdogSeeks=${await watchdogSeeks(page)}`,
  );
});

test("FAIL in 5: the answer is read aloud and POUT holds ≥3 s", async ({
  page,
  context,
}) => {
  await fulfillFlagsOn(context);
  const requests = collectAudioRequests(page);
  await openSeamCase(page, 137);
  const readPhaseLog = await startPhaseLog(page);
  await waitForSearchIdle(page);

  const misses: Array<[string, string]> = [
    ["las vegas", "geonames:5506956"],
    ["paris", ""],
    ["tokyo", ""],
    ["sydney", ""],
    ["cairo", ""],
  ];
  const used = new Set<string>();
  for (let i = 0; i < misses.length; i++) {
    const [name] = misses[i]!;
    const entry = entryByName(name);
    expect(used.has(entry.id)).toBe(false);
    used.add(entry.id);
    await guessByEntryId(page, entry.id, name);
    if (i < misses.length - 1) {
      await waitForSearchIdle(page, 150_000);
    }
  }

  // The fail read: Holmes reads the case's answer.
  await expect
    .poll(() => detectivePlays(page), { timeout: 90_000 })
    .toEqual(
      expect.arrayContaining([
        expect.stringContaining("case-137/answer.mp3"),
      ]),
    );
  expect(requests.some((u) => u.includes("case-137/answer.mp3"))).toBe(true);

  // POUT, sticky across a ≥3 s window: sample the phase every ~200 ms
  // for 3.2 s — every sample after POUT is reached must stay POUT.
  await waitForPhase(page, "POUT", 60_000);
  const samples: Array<string | null> = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 3200) {
    samples.push(await currentPhase(page));
    await page.waitForTimeout(200);
  }
  console.log(
    `[endings FAIL] POUT samples over 3.2 s: ${samples.length} samples, all POUT = ${samples.every((s) => s === "POUT")}`,
  );
  expect(samples.length).toBeGreaterThanOrEqual(10);
  expect(samples.every((s) => s === "POUT")).toBe(true);
  const phaseLog = await readPhaseLog();
  expect(phaseLog.map((p) => p.phase)).toContain("FAIL_READ");
  console.log(`[endings FAIL] watchdogSeeks=${await watchdogSeeks(page)}`);
});
