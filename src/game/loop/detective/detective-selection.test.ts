import assert from "node:assert/strict";
import test from "node:test";

import {
  initialDetectiveState,
  transition,
  type DetectiveEffect,
  type DetectiveEvent,
  type DetectiveState,
} from "./detective-state.ts";
import {
  createDetectiveSpeech,
  type DetectiveManifest,
  type DetectiveSpeaker,
} from "./detective-audio.ts";
import type { SpeakRef } from "./detective-state.ts";

/* Agent HERALD — selectionNamed: Holmes reads the player's own pick. */

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
const A = "geonames:323786";
const B = "geonames:2643743";

/* ---------------------------- state machine --------------------------- */

test("selection: at rest, a pick names the place and draws one ack — no guess spent", () => {
  const rest = lastOf(fold(CLUE1_AT_REST));
  assert.equal(rest.phase, "SEARCH_IDLE");
  const out = transition(rest.state, { type: "selectionNamed", placeId: A }, rng);
  assert.deepEqual(speakRefs(out.effects), [
    { kind: "name", placeId: A, selection: true },
    { kind: "fixed", id: "ack-2" },
  ]);
  assert.equal(out.view.phase, "SEARCH_IDLE");
  assert.equal(out.state.acksPlayed, rest.state.acksPlayed + 1, "one ack spent");
  assert.equal(out.state.guessesConfirmed, 0, "no guess spent");
});

test("selection: spends no guess, so it never arms the miss beat / ASK_NEXT and ringAnimating stays false", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "speechEnded" }, // the name read drained
    { type: "sheetOpened" },
    { type: "sheetClosed" }, // the search sheet cycles shut
  ]);
  for (const s of steps.slice(4)) {
    assert.equal(s.state.ringAnimating, false);
    assert.equal(s.state.selectionReadDone, false);
  }
  assert.equal(lastOf(steps).phase, "SEARCH_IDLE", "no NOTE_MARK, no ASK_NEXT");
  assert.deepEqual(ids(lastOf(steps).effects), []);
});

test("selection: dedup — re-naming the same place in one clue cycle is a no-op", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "selectionNamed", placeId: A },
  ]);
  assert.deepEqual(ids(steps[4]!.effects), [`name:${A}`, "fixed:ack-2"]);
  assert.deepEqual(steps[5]!.effects, []);
  assert.strictEqual(steps[5]!.state, steps[4]!.state);
});

test("selection: dedup keys on the LAST pick — A, B, A names A again", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "selectionNamed", placeId: B },
    { type: "selectionNamed", placeId: A },
  ]);
  assert.deepEqual(ids(steps[6]!.effects), [`name:${A}`, "fixed:ack-4"]);
});

test("selection: a new clue cycle re-opens the dedup key", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    ...[{ type: "clueUnlocked", clueIndex: 2 }, { type: "speechEnded" }, { type: "beatElapsed" }, { type: "speechEnded" }] as DetectiveEvent[],
    { type: "selectionNamed", placeId: A },
  ]);
  assert.deepEqual(ids(lastOf(steps).effects), [`name:${A}`, "fixed:ack-4"]);
});

test("selection: confirming the just-named place speaks nothing more — the queued name + ack is the line", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "guessConfirmed", placeId: A },
  ]);
  assert.deepEqual(ids(lastOf(steps).effects), []);
  assert.equal(lastOf(steps).phase, "SELECTION_READ");
  assert.equal(lastOf(steps).state.ringAnimating, true);
});

test("selection: confirming a DIFFERENT place than the one named speaks that name + the next ack", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "guessConfirmed", placeId: B },
  ]);
  assert.deepEqual(ids(lastOf(steps).effects), [`name:${B}`, "fixed:ack-3"]);
});

test("selection: a guess with no prior selection is the place name + the next ack", () => {
  const steps = fold([...CLUE1_AT_REST, { type: "guessConfirmed", placeId: A }]);
  assert.deepEqual(ids(lastOf(steps).effects), [`name:${A}`, "fixed:ack-2"]);
});

test("selection: after a guess, the same place can be named again (guesses-used moved the key)", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "selectionNamed", placeId: A },
    { type: "guessConfirmed", placeId: A },
    { type: "ringAnimationEnded" },
    { type: "speechEnded" }, // → SEARCH_IDLE (selectionReadDone)
    { type: "selectionNamed", placeId: A },
  ]);
  assert.deepEqual(ids(lastOf(steps).effects), [`name:${A}`, "fixed:ack-3"]);
});

test("selection: during Watson's question the pick cuts the read — name + ack, no overlap", () => {
  const steps = fold([
    { type: "clueUnlocked", clueIndex: 1 },
    { type: "selectionNamed", placeId: A },
  ]);
  const cut = lastOf(steps);
  assert.equal(cut.phase, "SEARCH_IDLE");
  assert.equal(cut.state.readingStep, "cut");
  assert.equal(cut.state.openTarget, 0);
  assert.equal(cut.effects[0]!.type, "stopSpeech");
  assert.deepEqual(ids(cut.effects), [`name:${A}`, "fixed:ack-1"]);
  const drained = transition(cut.state, { type: "speechEnded" }, rng);
  assert.equal(drained.view.phase, "SEARCH_IDLE");
  assert.deepEqual(ids(drained.effects), []);
});

test("selection: pending slot is depth-1, latest wins", () => {
  const steps = fold([
    { type: "clueUnlocked", clueIndex: 1 },
    { type: "speechEnded" }, // → THINKING_BEAT; Watson is not mid-question
    { type: "selectionNamed", placeId: A },
    { type: "selectionNamed", placeId: B },
    { type: "beatElapsed" },
    { type: "speechEnded" },
  ]);
  assert.deepEqual(ids(lastOf(steps).effects), [`name:${B}`, "fixed:ack-2"]);
  const all = steps.flatMap((s) => ids(s.effects));
  assert.ok(!all.includes(`name:${A}`), "the superseded read never speaks");
});

test("selection: a guess confirmation discards a pending read (and still names the pick itself)", () => {
  const rest = lastOf(fold(CLUE1_AT_REST)).state;
  // Pending forced via a live chain on clue 2, then the guess lands first.
  const live = fold(
    [
      { type: "clueUnlocked", clueIndex: 2 },
      { type: "speechEnded" }, // thinking beat — not a mid-question cut
      { type: "selectionNamed", placeId: A },
    ],
    rest,
  );
  assert.equal(lastOf(live).state.pendingSelection, A);
  // SEARCH_IDLE is needed for a guess; reach it by draining, with A pending
  // already flushed — so test the discard directly on a hand-built state.
  const resting: DetectiveState = { ...rest, pendingSelection: A, lastNamed: null };
  const out = transition(resting, { type: "guessConfirmed", placeId: A }, rng);
  assert.equal(out.state.pendingSelection, null);
  assert.deepEqual(ids(out.effects), [`name:${A}`, "fixed:ack-2"], "never named yet, so the guess names it");
});

test("selection: a clue unlock discards a pending read", () => {
  const steps = fold([
    { type: "clueUnlocked", clueIndex: 1 },
    { type: "speechEnded" }, // thinking beat, so the pick waits instead of cutting
    { type: "selectionNamed", placeId: A },
    { type: "clueUnlocked", clueIndex: 2 },
  ]);
  assert.equal(lastOf(steps).state.pendingSelection, null);
  assert.ok(!steps.flatMap((s) => ids(s.effects)).includes(`name:${A}`));
});

test("selection: a case ending discards a pending read (solved and failed)", () => {
  for (const end of [{ type: "caseSolved", answerPlaceId: "geonames:9" }, { type: "caseFailed" }] as DetectiveEvent[]) {
    const steps = fold([
      { type: "clueUnlocked", clueIndex: 1 },
      { type: "speechEnded" }, // thinking beat, so the pick waits instead of cutting
      { type: "selectionNamed", placeId: A },
      end,
    ]);
    assert.equal(lastOf(steps).state.pendingSelection, null, end.type);
    assert.ok(!steps.flatMap((s) => ids(s.effects)).includes(`name:${A}`), end.type);
  }
});

test("selection: during a guess read, a celebration or a pout nothing is named", () => {
  const steps = fold([
    ...CLUE1_AT_REST,
    { type: "guessConfirmed", placeId: A },
    { type: "selectionNamed", placeId: B },
  ]);
  assert.deepEqual(lastOf(steps).effects, []);
  const fail = fold([{ type: "caseFailed" }, { type: "selectionNamed", placeId: B }]);
  assert.deepEqual(lastOf(fail).effects, []);
});

test("selection: payload is the player's pick only — a different pick changes only the echoed id", () => {
  const rest = lastOf(fold(CLUE1_AT_REST)).state;
  const a = transition(rest, { type: "selectionNamed", placeId: A }, rng);
  const b = transition(rest, { type: "selectionNamed", placeId: B }, rng);
  assert.equal(a.view.phase, b.view.phase);
  assert.deepEqual(a.view, b.view);
  assert.deepEqual(
    speakRefs(a.effects).map((r) => ({ ...r, placeId: "x" })),
    speakRefs(b.effects).map((r) => ({ ...r, placeId: "x" })),
  );
});

/* ------------------------------ speech player ------------------------- */

const MANIFEST: DetectiveManifest = {
  v: 1,
  voices: { holmes: "h", watson: "w" },
  fixed: {
    "ack-1": { file: "fixed/ack-1.mp3", voice: "h" },
    suspicion: { file: "fixed/suspicion.mp3", voice: "h" },
  },
  cases: {
    "387": { clues: [{ file: "case-387/clue-1.mp3", voice: "w" }], answer: null },
  },
  names: {
    "323786": { file: "names/323786.mp3", voice: "h" },
    "2643743": { file: "names/2643743.mp3", voice: "h" },
  },
};
const tick = () => new Promise((r) => setTimeout(r, 5));

function harness(mode: "auto" | "tap" | "off" = "auto", over: { soundOn?: () => boolean; canAutoPlay?: () => boolean; gate?: () => Promise<void> } = {}) {
  const played: string[] = [];
  const speaking: Array<DetectiveSpeaker | null> = [];
  const player = createDetectiveSpeech({
    caseIndex: 387,
    speechMode: mode,
    loadManifest: async () => MANIFEST,
    playClip: async (clip) => {
      played.push(clip.url);
      if (over.gate) await over.gate();
    },
    isSoundOn: over.soundOn ?? (() => true),
    canAutoPlay: over.canAutoPlay ?? (() => true),
    onSpeakingChange: (w) => speaking.push(w),
  });
  return { player, played, speaking };
}
const NAME_A: SpeakRef = { kind: "name", placeId: A, selection: true };
const NAME_B: SpeakRef = { kind: "name", placeId: B, selection: true };

test("player: auto mode plays a selection read", async () => {
  const { player, played } = harness("auto");
  player.enqueue(NAME_A);
  await tick();
  assert.deepEqual(played, ["/audio/detective/names/323786.mp3"]);
  player.dispose();
});

test("player: tap mode — the selection read plays while a tap-mode clue ack does not", async () => {
  const { player, played } = harness("tap");
  player.enqueue({ kind: "clue", clueIndex: 1 });
  player.enqueue({ kind: "fixed", id: "ack-1" });
  await tick();
  assert.deepEqual(played, [], "tap-mode clue chain stays held for Listen");
  player.enqueue(NAME_A);
  await tick();
  assert.deepEqual(played, ["/audio/detective/names/323786.mp3"], "selection read plays");
  assert.deepEqual(
    player.heldRefs().map((r) => r.kind),
    ["clue", "fixed"],
    "the selection read is not part of the held clue chain",
  );
  player.dispose();
});

test("player: tap mode — sound off still silences the selection read", async () => {
  const { player, played } = harness("tap", { soundOn: () => false });
  player.enqueue(NAME_A);
  await tick();
  assert.deepEqual(played, []);
  player.dispose();
});

test("player: off mode silences the selection read", async () => {
  const { player, played } = harness("off");
  player.enqueue(NAME_A);
  await tick();
  assert.deepEqual(played, []);
  player.dispose();
});

test("player: a selection read never interrupts a playing clip — it waits its turn", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let first = true;
  const { player, played } = harness("auto", {
    gate: async () => {
      if (first) {
        first = false;
        await gate;
      }
    },
  });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"]);
  player.enqueue(NAME_A);
  await tick();
  assert.deepEqual(played, ["/audio/detective/case-387/clue-1.mp3"], "clip still in flight, name not started");
  release();
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/names/323786.mp3",
  ]);
  player.dispose();
});

test("player: queued selection reads are latest-wins (depth 1)", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let first = true;
  const { player, played } = harness("auto", {
    gate: async () => {
      if (first) {
        first = false;
        await gate;
      }
    },
  });
  player.enqueue({ kind: "clue", clueIndex: 1 });
  await tick();
  player.enqueue(NAME_A);
  player.enqueue(NAME_B);
  release();
  await tick();
  assert.deepEqual(played, [
    "/audio/detective/case-387/clue-1.mp3",
    "/audio/detective/names/2643743.mp3",
  ]);
  player.dispose();
});

test("player: a name with no clip falls back silent — no stall, then the queue moves on", async () => {
  const { player, played, speaking } = harness("auto");
  player.enqueue({ kind: "name", placeId: "geonames:0000001", selection: true });
  player.enqueue({ kind: "fixed", id: "suspicion" });
  await tick();
  assert.deepEqual(played, ["/audio/detective/fixed/suspicion.mp3"]);
  assert.equal(speaking[speaking.length - 1], null);
  player.dispose();
});
