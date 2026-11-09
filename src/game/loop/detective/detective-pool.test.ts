import assert from "node:assert/strict";
import test from "node:test";

import {
  ACK_POOL_IDS,
  ACK_POOL_SIZE,
  ackCandidates,
  drawAckId,
  initialDetectiveState,
  transition,
  type DetectiveEffect,
  type DetectiveState,
} from "./detective-state.ts";

/* Agent HERALD — the random ack pool picker. */

function ackOf(effects: DetectiveEffect[]): string {
  const e = effects.find(
    (x) => x.type === "speak" && x.ref.kind === "fixed" && x.ref.id.startsWith("ack-"),
  ) as Extract<DetectiveEffect, { type: "speak" }> | undefined;
  assert.ok(e, "an ack was spoken");
  return (e.ref as { id: string }).id;
}

/** A state sitting in THINKING_BEAT, ready for the ack to be drawn. */
function atBeat(over: Partial<DetectiveState>): DetectiveState {
  return {
    ...initialDetectiveState(),
    phase: "THINKING_BEAT",
    readingStep: "ack-decode",
    clueIndex: 1,
    ...over,
  };
}

test("pool: 10 lines, unique ids", () => {
  assert.equal(ACK_POOL_SIZE, 10);
  assert.equal(ACK_POOL_IDS.length, 10);
  assert.equal(new Set(ACK_POOL_IDS).size, 10);
});

test("pool: suspicion is never part of the ack pool (one single clip)", () => {
  assert.ok(!ACK_POOL_IDS.includes("suspicion"));
  for (const id of ACK_POOL_IDS) assert.ok(id.startsWith("ack-"));
});

test("pool: candidates are the pool minus the played-set; exhausted → full pool", () => {
  assert.deepEqual(ackCandidates([]), ACK_POOL_IDS);
  assert.deepEqual(
    ackCandidates(["ack-1", "ack-5"]),
    ACK_POOL_IDS.filter((id) => id !== "ack-1" && id !== "ack-5"),
  );
  assert.deepEqual(ackCandidates(ACK_POOL_IDS), ACK_POOL_IDS);
});

test("pool: the draw is state-independent — same played-set, same candidates and same pick, whatever the guesses, clue or last pick", () => {
  const played = ["ack-2", "ack-7"];
  const variants: DetectiveState[] = [
    atBeat({ acksUsed: played }),
    atBeat({ acksUsed: played, clueIndex: 3, guessesConfirmed: 4 }),
    atBeat({
      acksUsed: played,
      clueIndex: 2,
      guessesConfirmed: 2,
      lastNamed: { placeId: "geonames:1", guesses: 2, clue: 2 },
      pendingSelection: "geonames:2",
    }),
    atBeat({ acksUsed: played, clueIndex: 5, selectionReadDone: true, lastPausePoint: { x: 1, y: 2 } }),
  ];
  for (const r of [0, 0.25, 0.5, 0.99]) {
    const picks = variants.map((s) => ackOf(transition(s, { type: "beatElapsed" }, () => r).effects));
    assert.equal(new Set(picks).size, 1, `rng ${r}: one pick across all states, got ${picks}`);
    assert.ok(!played.includes(picks[0]!), "a played line is never re-offered");
  }
  // And the candidate set is a pure function of the played-set.
  assert.deepEqual(ackCandidates(played), ackCandidates([...played]));
});

test("pool: rng 0 and rng just-below-1 reach the first and last candidates (bounds are safe)", () => {
  assert.equal(drawAckId([], () => 0), ACK_POOL_IDS[0]);
  assert.equal(drawAckId([], () => 0.9999999), ACK_POOL_IDS[ACK_POOL_IDS.length - 1]);
  // A misbehaving rng cannot index out of range.
  assert.equal(drawAckId([], () => 1), ACK_POOL_IDS[ACK_POOL_IDS.length - 1]);
  assert.equal(drawAckId([], () => -1), ACK_POOL_IDS[0]);
});

test("pool: no repeat inside a case — a full 10-draw never repeats, for any rng", () => {
  for (const seed of [0, 0.1, 0.5, 0.9]) {
    let played: string[] = [];
    let r = seed;
    for (let i = 0; i < ACK_POOL_SIZE; i++) {
      r = (r * 7919 + 0.137) % 1;
      const id = drawAckId(played, () => r);
      assert.ok(!played.includes(id), `seed ${seed} draw ${i}: ${id} repeated`);
      played = [...played, id];
    }
    assert.equal(new Set(played).size, ACK_POOL_SIZE);
  }
});

test("pool: in-machine, a whole case of four acks never repeats and records the played-set", () => {
  let state: DetectiveState = initialDetectiveState();
  let r = 0.3;
  const rng = () => (r = (r * 31 + 0.17) % 1);
  const acks: string[] = [];
  for (const clue of [1, 2, 3, 5]) {
    state = transition(state, { type: "clueUnlocked", clueIndex: clue }, rng).state;
    state = transition(state, { type: "speechEnded" }, rng).state;
    const beat = transition(state, { type: "beatElapsed" }, rng);
    acks.push(ackOf(beat.effects));
    state = transition(beat.state, { type: "speechEnded" }, rng).state;
  }
  assert.equal(new Set(acks).size, 4);
  assert.deepEqual(state.acksUsed, acks);
  assert.equal(state.acksPlayed, 4);
});

test("pool: suspicion on a guess is the single fixed clip, regardless of the ack pool", () => {
  const s = { ...initialDetectiveState(), phase: "SEARCH_IDLE" as const, clueIndex: 1, acksUsed: ["ack-1"] };
  const out = transition(s, { type: "guessConfirmed", placeId: "geonames:5" });
  const ids = out.effects
    .filter((e) => e.type === "speak")
    .map((e) => JSON.stringify((e as Extract<DetectiveEffect, { type: "speak" }>).ref));
  assert.deepEqual(ids, [
    JSON.stringify({ kind: "name", placeId: "geonames:5" }),
    JSON.stringify({ kind: "fixed", id: "suspicion" }),
  ]);
});
