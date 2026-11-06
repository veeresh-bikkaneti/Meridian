import assert from "node:assert/strict";
import test from "node:test";

import {
  ackIdForClue,
  decodeIdForClue,
  initialDetectiveState,
  transition,
  viewForState,
  HOOK_BEAT_MS,
  POUT_BEAT_MS,
  THINKING_BEAT_MS,
  type DetectiveEffect,
  type DetectiveEvent,
  type DetectiveState,
} from "./detective-state.ts";

/* Scripted driver: fold events through the machine, keeping every step. */
interface Step {
  state: DetectiveState;
  effects: DetectiveEffect[];
  phase: string;
}
function run(events: DetectiveEvent[], start = initialDetectiveState()): Step[] {
  const steps: Step[] = [];
  let state = start;
  for (const event of events) {
    const out = transition(state, event);
    state = out.state;
    steps.push({ state, effects: out.effects, phase: out.view.phase });
  }
  return steps;
}
function last(steps: Step[]): Step {
  return steps[steps.length - 1]!;
}
function speakIds(effects: DetectiveEffect[]): string[] {
  return effects
    .filter((e) => e.type === "speak")
    .map((e) => {
      const ref = (e as Extract<DetectiveEffect, { type: "speak" }>).ref;
      switch (ref.kind) {
        case "clue":
          return `clue:${ref.clueIndex}`;
        case "fixed":
          return `fixed:${ref.id}`;
        case "name":
          return `name:${ref.placeId}`;
        case "answer":
          return "answer";
        case "debrief":
          return "debrief";
      }
    });
}
function dwells(effects: DetectiveEffect[]): number[] {
  return effects
    .filter((e) => e.type === "dwell")
    .map((e) => (e as Extract<DetectiveEffect, { type: "dwell" }>).beatMs);
}

/** Drive one normal clue from unlock to SEARCH_IDLE. */
function normalClue(n: number): DetectiveEvent[] {
  return [
    { type: "clueUnlocked", clueIndex: n },
    { type: "speechEnded" }, // read drained → thinking beat
    { type: "beatElapsed" }, // beat over → ack + decode
    { type: "speechEnded" }, // ack/decode drained → search
  ];
}
/** Drive the Hook clue (n=4) from unlock to SEARCH_IDLE. */
function hookClue(): DetectiveEvent[] {
  return [
    { type: "clueUnlocked", clueIndex: 4 },
    { type: "beatElapsed" }, // long silence over → announcement
    { type: "speechEnded" }, // announcement → Watson reads
    { type: "speechEnded" }, // read → decode-hook + amazement
    { type: "speechEnded" }, // drained → search
  ];
}

/* ------------------------------------------------------------------ */

test("initial view: CASE_OPEN, both at the station, not hidden", () => {
  const view = viewForState(initialDetectiveState());
  assert.equal(view.phase, "CASE_OPEN");
  assert.equal(view.holmes.placement, "station");
  assert.equal(view.watson.placement, "station");
  assert.equal(view.watson.pose, "station-idle");
  assert.equal(view.hidden, false);
});

test("OFF: disabled machine hides the pair and ignores every event", () => {
  const off = initialDetectiveState({ enabled: false });
  assert.equal(viewForState(off).hidden, true);
  const steps = run([{ type: "clueUnlocked", clueIndex: 1 }], off);
  assert.equal(last(steps).phase, "OFF");
  assert.deepEqual(last(steps).effects, []);
});

test("clue 1: read → 600ms thinking beat → ack-1 + decode-geography → dock search", () => {
  const steps = run(normalClue(1));
  assert.equal(steps[0]!.phase, "READING");
  assert.deepEqual(speakIds(steps[0]!.effects), ["clue:1"]);
  const readView = viewForState(steps[0]!.state);
  assert.equal(readView.watson.pose, "read");
  assert.equal(readView.watson.speaking, true);
  assert.equal(readView.watson.placement, "station");
  assert.equal(readView.holmes.placement, "station");

  assert.equal(steps[1]!.phase, "THINKING_BEAT");
  assert.deepEqual(dwells(steps[1]!.effects), [THINKING_BEAT_MS]);
  assert.equal(THINKING_BEAT_MS, 600);
  assert.deepEqual(speakIds(steps[1]!.effects), []);

  assert.equal(steps[2]!.phase, "READING");
  assert.deepEqual(speakIds(steps[2]!.effects), ["fixed:ack-1", "fixed:decode-geography"]);
  const ackView = viewForState(steps[2]!.state);
  assert.equal(ackView.holmes.pose, "ack");
  assert.equal(ackView.holmes.speaking, true);

  assert.equal(steps[3]!.phase, "SEARCH_IDLE");
  const searchView = viewForState(steps[3]!.state);
  assert.equal(searchView.holmes.placement, "dock");
  assert.equal(searchView.holmes.pose, "search");
  assert.equal(searchView.watson.placement, "dock");
});

test("ack rotation and decode types by clue position", () => {
  assert.equal(ackIdForClue(1), "ack-1");
  assert.equal(ackIdForClue(2), "ack-2");
  assert.equal(ackIdForClue(3), "ack-3");
  assert.equal(ackIdForClue(4), "ack-4");
  assert.equal(ackIdForClue(5), "ack-1"); // rotation wraps: (5-1) % 4 = 0
  assert.equal(decodeIdForClue(1), "decode-geography");
  assert.equal(decodeIdForClue(2), "decode-climate");
  assert.equal(decodeIdForClue(3), "decode-history");
  assert.equal(decodeIdForClue(4), "decode-hook");
  assert.equal(decodeIdForClue(5), "decode-giveaway");

  // In-machine: clues 2, 3, 5 ack + decode pairs.
  for (const [n, ack, decode] of [
    [2, "ack-2", "decode-climate"],
    [3, "ack-3", "decode-history"],
    [5, "ack-1", "decode-giveaway"],
  ] as const) {
    const steps = run(normalClue(n));
    assert.deepEqual(speakIds(steps[2]!.effects), [`fixed:${ack}`, `fixed:${decode}`]);
  }
});

test("Hook (clue 4): long beat → announce → read → decode-hook → amazement → search", () => {
  const steps = run(hookClue());
  // Silence BEFORE the announcement (800–1200ms), no speech yet.
  assert.equal(steps[0]!.phase, "THINKING_BEAT");
  assert.deepEqual(dwells(steps[0]!.effects), [HOOK_BEAT_MS]);
  assert.ok(HOOK_BEAT_MS >= 800 && HOOK_BEAT_MS <= 1200);
  assert.deepEqual(speakIds(steps[0]!.effects), []);
  // Announcement: Holmes solo, announce pose, Watson only reacts.
  assert.equal(steps[1]!.phase, "READING");
  assert.deepEqual(speakIds(steps[1]!.effects), ["fixed:hook-announcement"]);
  const announceView = viewForState(steps[1]!.state);
  assert.equal(announceView.holmes.pose, "announce");
  assert.equal(announceView.holmes.speaking, true);
  assert.equal(announceView.watson.pose, "gasp");
  assert.equal(announceView.watson.speaking, false);
  // Then Watson reads.
  assert.deepEqual(speakIds(steps[2]!.effects), ["clue:4"]);
  assert.equal(viewForState(steps[2]!.state).watson.pose, "read");
  // Decode follows the read directly — no ack on the Hook — plus the
  // one amazement fragment, in that order.
  assert.deepEqual(speakIds(steps[3]!.effects), ["fixed:decode-hook", "fixed:amazement"]);
  assert.equal(steps[4]!.phase, "SEARCH_IDLE");
  assert.equal(viewForState(steps[4]!.state).holmes.placement, "dock");
});

test("full ladder: open → 5 clues with selection reads → solve → debrief", () => {
  const events: DetectiveEvent[] = [];
  // Clue 1 from case open.
  events.push(...normalClue(1));
  for (const n of [2, 3]) {
    events.push(
      { type: "guessConfirmed", placeId: `geonames:${100 + n}` },
      { type: "ringAnimationEnded" },
      { type: "clueUnlocked", clueIndex: n }, // arrives mid-selection-read
      { type: "speechEnded" }, // selection read drains → ASK_NEXT
      { type: "speechEnded" }, // ask drained → next clue starts
      { type: "speechEnded" }, // read → thinking beat
      { type: "beatElapsed" },
      { type: "speechEnded" }, // ack/decode → search
    );
  }
  // Hook clue via the same bridge.
  events.push(
    { type: "guessConfirmed", placeId: "geonames:104" },
    { type: "ringAnimationEnded" },
    { type: "clueUnlocked", clueIndex: 4 },
    { type: "speechEnded" }, // → ASK_NEXT
    { type: "speechEnded" }, // → hook THINKING_BEAT
    { type: "beatElapsed" },
    { type: "speechEnded" }, // announce → read
    { type: "speechEnded" }, // read → decode + amazement
    { type: "speechEnded" }, // → search
  );
  // Giveaway.
  events.push(
    { type: "guessConfirmed", placeId: "geonames:105" },
    { type: "ringAnimationEnded" },
    { type: "clueUnlocked", clueIndex: 5 },
    { type: "speechEnded" },
    { type: "speechEnded" },
    { type: "speechEnded" },
    { type: "beatElapsed" },
    { type: "speechEnded" },
  );
  // Winning pick: selection read, then the solve lands mid-read.
  events.push(
    { type: "guessConfirmed", placeId: "geonames:999" },
    { type: "caseSolved" },
    { type: "speechEnded" }, // selection drains → CELEBRATE
    { type: "speechEnded" }, // win lines drain → DEBRIEF
  );
  const steps = run(events);
  const phases = steps.map((s) => s.phase);
  // Every phase of the ladder was visited in order-bearing positions.
  for (const p of ["READING", "THINKING_BEAT", "SEARCH_IDLE", "SELECTION_READ", "ASK_NEXT", "CELEBRATE", "DEBRIEF"]) {
    assert.ok(phases.includes(p), `ladder visits ${p}`);
  }
  // Selection reads spoke the player's own pick + the suspicion line.
  const selectionSteps = steps.filter((s) => s.phase === "SELECTION_READ" && s.effects.length > 0);
  assert.ok(selectionSteps.length >= 4);
  for (const s of selectionSteps) {
    const ids = speakIds(s.effects);
    assert.equal(ids.length, 2);
    assert.ok(ids[0]!.startsWith("name:geonames:"));
    assert.equal(ids[1], "fixed:suspicion");
  }
  // Ask-next bridges each unlock.
  const askSteps = steps.filter((s) => s.effects.some((e) => e.type === "speak" && e.ref.kind === "fixed" && e.ref.id === "ask-next"));
  assert.equal(askSteps.length, 4);
  // Celebration: win lines in Holmes → Watson order, jump poses.
  const celebrate = steps.find((s) => s.phase === "CELEBRATE" && s.effects.length > 0)!;
  assert.deepEqual(speakIds(celebrate.effects), ["fixed:win-holmes", "fixed:win-watson"]);
  const celebrateView = viewForState(celebrate.state);
  assert.equal(celebrateView.holmes.pose, "celebrate-jump");
  assert.equal(celebrateView.watson.pose, "celebrate-jump");
  // Debrief: entered on the win lines' speechEnded, poses only (U8 TODO).
  assert.equal(last(steps).phase, "DEBRIEF");
  assert.deepEqual(speakIds(last(steps).effects), []);
});

test("selection read: guessConfirmed speaks name + suspicion; rings hide the pair", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:42" },
  ]);
  const sel = last(steps);
  assert.equal(sel.phase, "SELECTION_READ");
  assert.deepEqual(speakIds(sel.effects), ["name:geonames:42", "fixed:suspicion"]);
  assert.equal(viewForState(sel.state).hidden, true); // ringAnimating
  const after = run([{ type: "ringAnimationEnded" }], sel.state);
  assert.equal(viewForState(last(after).state).hidden, false);
  assert.equal(last(after).phase, "SELECTION_READ");
});

test("sheetClosed after a drained selection read fires ASK_NEXT exactly once", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:42" },
    { type: "ringAnimationEnded" },
    { type: "speechEnded" }, // selection drains → SEARCH_IDLE (marker set)
    { type: "sheetOpened" },
    { type: "sheetClosed" }, // → ASK_NEXT
    { type: "speechEnded" }, // ask drained → SEARCH_IDLE (ask spoken)
    { type: "clueUnlocked", clueIndex: 2 }, // straight to the read, no 2nd ask
  ]);
  // Steps: 0–3 clue 1, 4 guess, 5 ring end, 6 selection drain, 7 sheet
  // open, 8 sheet close, 9 ask drain, 10 next clue.
  assert.equal(steps[6]!.phase, "SEARCH_IDLE");
  assert.equal(viewForState(steps[7]!.state).hidden, true); // sheet open
  assert.equal(steps[8]!.phase, "ASK_NEXT");
  assert.deepEqual(speakIds(steps[8]!.effects), ["fixed:ask-next"]);
  assert.equal(steps[9]!.phase, "SEARCH_IDLE");
  assert.equal(steps[10]!.phase, "READING");
  assert.deepEqual(speakIds(steps[10]!.effects), ["clue:2"]);
});

test("a sheet cycle during ordinary searching never fires ask-next", () => {
  const steps = run([
    ...normalClue(1),
    { type: "sheetOpened" },
    { type: "sheetClosed" },
  ]);
  assert.equal(last(steps).phase, "SEARCH_IDLE");
  assert.deepEqual(last(steps).effects, []);
  assert.equal(viewForState(last(steps).state).hidden, false);
});

test("external speech hides the pair without changing phase", () => {
  const steps = run([
    ...normalClue(1),
    { type: "externalSpeechStarted" },
    { type: "externalSpeechEnded" },
  ]);
  assert.equal(viewForState(steps[steps.length - 2]!.state).hidden, true);
  assert.equal(last(steps).phase, "SEARCH_IDLE");
  assert.equal(viewForState(last(steps).state).hidden, false);
});

test("fail path: answer read → pout (timed dwell) → case-open idle", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:42" },
    { type: "caseFailed" }, // lands mid-selection-read → deferred
    { type: "speechEnded" }, // selection drains → FAIL_READ
    { type: "speechEnded" }, // answer drains → POUT
    { type: "beatElapsed" }, // pout held → idle
  ]);
  assert.equal(steps[steps.length - 3]!.phase, "FAIL_READ");
  assert.deepEqual(speakIds(steps[steps.length - 3]!.effects), ["answer"]);
  const pout = steps[steps.length - 2]!;
  assert.equal(pout.phase, "POUT");
  assert.deepEqual(dwells(pout.effects), [POUT_BEAT_MS]);
  const poutView = viewForState(pout.state);
  assert.equal(poutView.holmes.pose, "pout");
  assert.equal(poutView.watson.pose, "pout");
  assert.equal(last(steps).phase, "CASE_OPEN");
});

test("caseFailed from SEARCH goes straight to FAIL_READ", () => {
  const steps = run([...normalClue(1), { type: "caseFailed" }]);
  assert.equal(last(steps).phase, "FAIL_READ");
  assert.deepEqual(speakIds(last(steps).effects), ["answer"]);
});

test("pointer: pause → SEARCH_AREA (berth placement, U6); move/gesture cancel", () => {
  const steps = run([
    ...normalClue(1),
    { type: "pointerPaused", point: { x: 120, y: 200 } },
    { type: "pointerMoved" },
    { type: "pointerPaused", point: { x: 40, y: 60 } },
    { type: "gestureStarted" },
  ]);
  assert.equal(steps[4]!.phase, "SEARCH_AREA");
  const areaView = viewForState(steps[4]!.state);
  assert.equal(areaView.holmes.placement, "berth"); // U6: host solver resolves pixels
  assert.equal(areaView.holmes.pose, "berth-think");
  assert.deepEqual(steps[4]!.state.lastPausePoint, { x: 120, y: 200 });
  assert.equal(steps[5]!.phase, "SEARCH_IDLE");
  assert.equal(steps[6]!.phase, "SEARCH_AREA");
  assert.equal(steps[7]!.phase, "SEARCH_IDLE");
  assert.equal(steps[7]!.state.lastPausePoint, null);
});

test("stray events are no-ops: speechEnded in SEARCH, beatElapsed in READING, bad clue indexes", () => {
  const searching = run(normalClue(1));
  const s1 = transition(last(searching).state, { type: "speechEnded" });
  assert.equal(s1.view.phase, "SEARCH_IDLE");
  assert.deepEqual(s1.effects, []);
  const reading = run([{ type: "clueUnlocked", clueIndex: 1 }]);
  const s2 = transition(last(reading).state, { type: "beatElapsed" });
  assert.equal(s2.view.phase, "READING");
  for (const bad of [0, 6, 2.5, -1]) {
    const s = transition(last(searching).state, { type: "clueUnlocked", clueIndex: bad });
    assert.equal(s.view.phase, "SEARCH_IDLE");
    assert.deepEqual(s.effects, []);
  }
});

test("answer-blindness: swapping the pick changes ONLY the name ref", () => {
  const script = (placeId: string): DetectiveEvent[] => [
    ...normalClue(1),
    { type: "guessConfirmed", placeId },
    { type: "ringAnimationEnded" },
    { type: "speechEnded" },
  ];
  const a = run(script("geonames:111"));
  const b = run(script("geonames:222"));
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i]!.phase, b[i]!.phase, `step ${i} phase identical`);
    assert.deepEqual(
      viewForState(a[i]!.state).holmes,
      viewForState(b[i]!.state).holmes,
    );
    assert.deepEqual(
      viewForState(a[i]!.state).watson,
      viewForState(b[i]!.state).watson,
    );
    const ea = speakIds(a[i]!.effects);
    const eb = speakIds(b[i]!.effects);
    if (ea.some((x) => x.startsWith("name:"))) {
      // The one permitted difference: the echoed pick id in the name ref.
      assert.deepEqual(ea.slice(1), eb.slice(1));
    } else {
      assert.deepEqual(ea, eb);
    }
  }
  // The machine's state carries no evaluation-shaped fields at all.
  const stateKeys = Object.keys(last(a).state).sort();
  for (const forbidden of ["target", "evaluation", "distance", "correct", "distKm", "guesses", "puzzle"]) {
    assert.ok(!stateKeys.includes(forbidden), `state has no ${forbidden}`);
  }
});
