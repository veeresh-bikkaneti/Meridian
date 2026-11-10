import assert from "node:assert/strict";
import test from "node:test";

import {
  initialDetectiveState,
  transition,
  type DetectiveEffect,
  type DetectiveEvent,
  type DetectiveState,
} from "./detective-state.ts";
import type { SpeakRef } from "./detective-state.ts";

/* Follow-up cure — a guess confirmed while the pick read is audibly
 * in flight must keep its spoken reaction.
 *
 * The defect (PR 2a merge-up E2E, watson-walk phone 390, twice
 * identical): the guess helper clicks the search option — which,
 * since the selection cure, fires selectionNamed and starts the pick
 * read at once — and clicks "Guess this place" immediately after.
 * guessConfirmed IS handled (speakSelection never changes the phase,
 * so the machine sits in SEARCH_IDLE while the ~1-2 s name clip
 * plays), but it emits the guess read — suspicion only, the pick was
 * just named — into the SAME player queue, behind the name clip.
 * The clue the guess unlocks then lands in SELECTION_READ while the
 * pick read is audibly in flight. The player fires speechEnded ONCE
 * per queue drain, not per clip, so the pick read and the guess
 * read cannot be two ladder steps: any model that waits for a
 * second drain — or for a later sheet cycle, when the confirm has
 * already closed the sheet — strands the clue with no trigger left
 * to start it, and the guess's chain never runs.
 *
 * The cure marks the unlock as a deferred guess's payload:
 * clueUnlocked stores the clue in pendingClue AND the guess marker
 * in pendingGuessConfirm beside it, and the single drain runs the
 * ordinary bridge (miss beat → ask-next → clue) off pendingClue.
 * The suspicion is spoken exactly once — by guessConfirmed, into
 * that queue at confirm time; the bridge speaks the plain ask,
 * never a second suspicion. A GUESS read in flight keeps today's
 * behaviour untouched (pendingClue only, no marker; its own drain
 * opens the miss beat directly). A case ending still wins over the
 * deferred guess — pendingEnd at the drain, or the ending's direct
 * entry once the bridge stands — and clears the marker, so no
 * guess speech fires after the case closes.
 */

const rng = () => 0;

function fold(events: DetectiveEvent[], start = initialDetectiveState()) {
  let state = start;
  const steps: Array<{ state: DetectiveState; effects: DetectiveEffect[]; phase: string }> = [];
  for (const e of events) {
    const out = transition(state, e, rng);
    state = out.state;
    steps.push({ state, effects: out.effects, phase: out.view.phase });
  }
  return steps;
}
const lastOf = <T,>(a: T[]): T => a[a.length - 1]!;

function speakRefs(effects: DetectiveEffect[]): SpeakRef[] {
  return effects
    .filter((e) => e.type === "speak")
    .map((e) => (e as Extract<DetectiveEffect, { type: "speak" }>).ref);
}
function ids(effects: DetectiveEffect[]): string[] {
  return speakRefs(effects).map((r) =>
    r.kind === "name" ? `name:${r.placeId}` : r.kind === "fixed" ? `fixed:${r.id}` : r.kind,
  );
}

const CLUE1_AT_REST: DetectiveEvent[] = [
  { type: "clueUnlocked", clueIndex: 1 },
  { type: "speechEnded" },
  { type: "beatElapsed" },
  { type: "speechEnded" }, // → SEARCH_IDLE
];
const A = "geonames:5506956"; // Las Vegas — the failing spec's guess.

test("deferred guess: the single queue drain runs the shipped bridge off the pair", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A }, // pick read fires (name, selection)
    { type: "guessConfirmed", placeId: A }, // guess read queued (suspicion only)
    { type: "clueUnlocked", clueIndex: 2 }, // the guess's clue lands mid-reads
  ]);
  const armed = lastOf(steps);
  assert.equal(armed.phase, "SELECTION_READ");
  assert.equal(
    armed.state.pendingGuessConfirm,
    2,
    "the marker records the guess this pending clue belongs to",
  );
  assert.equal(
    armed.state.pendingClue,
    2,
    "pendingClue carries the bridge payload (the marker/payload pair)",
  );
  // The pick was named exactly once — by the pick read itself.
  assert.deepEqual(ids(steps[CLUE1_AT_REST.length]!.effects), [`name:${A}`]);
  // The confirm spoke the guess read's suspicion into the same queue,
  // behind the name clip (dedup: the just-named pick is not re-named).
  assert.deepEqual(ids(steps[CLUE1_AT_REST.length + 1]!.effects), ["fixed:suspicion"]);
  // The ONE queue drain (name clip + guess read) opens the miss beat
  // directly — settling at rest here would strand the clue: the
  // confirm's sheet cycle has already closed and no second drain
  // will ever fire.
  const drained = transition(armed.state, { type: "speechEnded" }, rng);
  assert.equal(drained.view.phase, "NOTE_MARK", "the drain runs the bridge");
  assert.deepEqual(ids(drained.effects), [], "the miss beat itself is voiceless");
  assert.equal(drained.state.pendingGuessConfirm, 2, "the marker stands through the bridge");
});

test("deferred guess: the bridge asks — never a second suspicion — then starts the clue", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "guessConfirmed", placeId: A },
    { type: "clueUnlocked", clueIndex: 2 },
    { type: "speechEnded" }, // the single drain → NOTE_MARK
  ]);
  const beat = lastOf(steps);
  assert.equal(beat.phase, "NOTE_MARK", "the bridge stands after the single drain");
  // The beat elapses → ASK_NEXT speaks the plain ask. The guess
  // read's suspicion already played (guessConfirmed spoke it into
  // the drain); speaking it here would play the reaction twice.
  const ask = transition(beat.state, { type: "beatElapsed" }, rng);
  assert.equal(ask.view.phase, "ASK_NEXT");
  assert.deepEqual(ids(ask.effects), ["fixed:ask-next"]);
  assert.equal(ask.state.pendingGuessConfirm, 2, "standing through the bridge");
  assert.equal(ask.state.pendingClue, 2, "untouched: the clue starts on the ask's drain");
  // The ask drains → the clue starts (the marker path: no second ask).
  const clue = transition(ask.state, { type: "speechEnded" }, rng);
  assert.equal(clue.view.phase, "READING");
  assert.deepEqual(ids(clue.effects), ["clue"]);
  assert.equal(clue.state.pendingGuessConfirm, null, "the clue start clears the marker");
  // Across the whole flow the name was read once and the suspicion once.
  const all = [
    ...steps.flatMap((s) => ids(s.effects)),
    ...ids(ask.effects),
    ...ids(clue.effects),
  ];
  assert.equal(all.filter((x) => x === `name:${A}`).length, 1, "the pick is named once");
  assert.equal(
    all.filter((x) => x === "fixed:suspicion").length,
    1,
    "the guess reaction plays once",
  );
});

test("deferred guess: a guess read already in flight keeps the shipped bridge (no deferral)", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "guessConfirmed", placeId: A }, // no pick read: the guess read is the in-flight read
    { type: "clueUnlocked", clueIndex: 2 },
  ]);
  const inFlight = lastOf(steps);
  assert.equal(inFlight.phase, "SELECTION_READ");
  assert.equal(inFlight.state.pendingClue, 2);
  assert.equal(inFlight.state.pendingGuessConfirm, null, "no marker: the drain bridges directly");
  const drained = transition(inFlight.state, { type: "speechEnded" }, rng);
  assert.equal(drained.view.phase, "NOTE_MARK", "the guess read's drain opens the miss beat");
});

test("deferred guess: a solve arriving while the guess bridge stands still wins — no guess read into a closed case", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "guessConfirmed", placeId: A },
    { type: "clueUnlocked", clueIndex: 2 },
    { type: "speechEnded" }, // the single drain → the bridge stands in NOTE_MARK
    { type: "caseSolved", answerPlaceId: A },
  ]);
  const solved = lastOf(steps);
  assert.equal(solved.phase, "CELEBRATE");
  assert.equal(solved.state.pendingGuessConfirm, null, "the ending clears the guess marker");
  // No later event resurrects the guess read.
  const after = transition(solved.state, { type: "sheetClosed" }, rng);
  assert.ok(!ids(after.effects).includes("fixed:suspicion"));
});

test("deferred guess: a fail arriving while the guess bridge stands still wins", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "guessConfirmed", placeId: A },
    { type: "clueUnlocked", clueIndex: 2 },
    { type: "speechEnded" }, // the single drain → the bridge stands in NOTE_MARK
    { type: "caseFailed" },
  ]);
  const failed = lastOf(steps);
  assert.equal(failed.phase, "FAIL_READ");
  assert.equal(failed.state.pendingGuessConfirm, null);
});

test("deferred guess: a solve landing mid-reads still defers via pendingEnd and wins at the drain", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "guessConfirmed", placeId: A },
    { type: "clueUnlocked", clueIndex: 2 },
    { type: "caseSolved", answerPlaceId: A }, // machine is in SELECTION_READ (guess read)
  ]);
  const deferred = lastOf(steps);
  assert.equal(deferred.state.pendingEnd, "solved");
  assert.equal(deferred.phase, "SELECTION_READ");
  const drained = transition(deferred.state, { type: "speechEnded" }, rng);
  assert.equal(drained.view.phase, "CELEBRATE", "the ending wins over the pending clue");
  assert.equal(drained.state.pendingGuessConfirm, null);
});
