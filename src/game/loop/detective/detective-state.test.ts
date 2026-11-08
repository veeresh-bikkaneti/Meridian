import assert from "node:assert/strict";
import test from "node:test";

import {
  ackIdForAckCount,
  decodeIdForClue,
  initialDetectiveState,
  transition,
  viewForState,
  CELEBRATE_JUMP_MS,
  CLAP_HOLD_MS,
  HIGH_FIVE_HOLD_MS,
  HOOK_BEAT_MS,
  NOTE_MARK_MS,
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
    { type: "speechEnded" }, // read → decode-hook
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

test("ack rotation is by ack count, and decode types by clue position", () => {
  // Count-based selector (cure pass item 7): the first ack played in a
  // case is ack-1; the rotation then walks 2, 3, 4 and wraps to 1.
  // The old clue-index pin (clue 4 → ack-4, clue 5 → ack-1) encoded
  // the flaw: the Hook plays no ack, so ack-4 never played and ack-1
  // repeated on the Giveaway.
  assert.equal(ackIdForAckCount(0), "ack-1");
  assert.equal(ackIdForAckCount(1), "ack-2");
  assert.equal(ackIdForAckCount(2), "ack-3");
  assert.equal(ackIdForAckCount(3), "ack-4");
  assert.equal(ackIdForAckCount(4), "ack-1"); // rotation wraps after all four
  assert.equal(decodeIdForClue(1), "decode-geography");
  assert.equal(decodeIdForClue(2), "decode-climate");
  assert.equal(decodeIdForClue(3), "decode-history");
  assert.equal(decodeIdForClue(4), "decode-hook");
  assert.equal(decodeIdForClue(5), "decode-giveaway");

  // In-machine, from a FRESH case each time: the first ack is always
  // ack-1 (the E2E pins rely on this), whatever clue it follows.
  for (const [n, decode] of [
    [2, "decode-climate"],
    [3, "decode-history"],
    [5, "decode-giveaway"],
  ] as const) {
    const steps = run(normalClue(n));
    assert.deepEqual(speakIds(steps[2]!.effects), ["fixed:ack-1", `fixed:${decode}`]);
  }
});

test("full 5-clue case: acks rotate 1→2→3→4 with no repeat, ack-4 plays", () => {
  // One continuous case: clues 1–3 and 5 ack through the thinking
  // beat; the Hook (clue 4) plays no ack. Count rotation therefore
  // deals ack-1, ack-2, ack-3 and — on the Giveaway — ack-4.
  const steps = run([
    ...normalClue(1),
    ...normalClue(2),
    ...normalClue(3),
    ...hookClue(),
    ...normalClue(5),
  ]);
  const acks = steps
    .flatMap((s) => speakIds(s.effects))
    .filter((id) => id.startsWith("fixed:ack-"));
  assert.deepEqual(acks, ["fixed:ack-1", "fixed:ack-2", "fixed:ack-3", "fixed:ack-4"]);
  assert.equal(new Set(acks).size, acks.length, "no ack repeats before all four have played");
  assert.ok(acks.includes("fixed:ack-4"), "ack-4 plays at least once per full case");
});

test("Hook (clue 4): long beat → announce → read → decode-hook → search", () => {
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
  // Decode follows the read directly — no ack on the Hook, and no
  // amazement fragment (cut in the cure pass: unreachable pace spec).
  assert.deepEqual(speakIds(steps[3]!.effects), ["fixed:decode-hook"]);
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
      { type: "speechEnded" }, // selection read drains → NOTE_MARK (U8)
      { type: "beatElapsed" }, // miss beat over → ASK_NEXT
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
    { type: "speechEnded" }, // → NOTE_MARK
    { type: "beatElapsed" }, // → ASK_NEXT
    { type: "speechEnded" }, // → hook THINKING_BEAT
    { type: "beatElapsed" },
    { type: "speechEnded" }, // announce → read
    { type: "speechEnded" }, // read → decode
    { type: "speechEnded" }, // → search
  );
  // Giveaway.
  events.push(
    { type: "guessConfirmed", placeId: "geonames:105" },
    { type: "ringAnimationEnded" },
    { type: "clueUnlocked", clueIndex: 5 },
    { type: "speechEnded" }, // → NOTE_MARK
    { type: "beatElapsed" }, // → ASK_NEXT
    { type: "speechEnded" }, // → clue 5 read
    { type: "speechEnded" }, // read → thinking beat
    { type: "beatElapsed" },
    { type: "speechEnded" }, // ack/decode → search
  );
  // Winning pick: selection read, then the solve lands mid-read.
  events.push(
    { type: "guessConfirmed", placeId: "geonames:999" },
    { type: "caseSolved" },
    { type: "speechEnded" }, // selection drains → CELEBRATE (jump)
    { type: "speechEnded" }, // win lines drain mid-choreography (remembered)
    { type: "beatElapsed" }, // jump → high-five
    { type: "beatElapsed" }, // high-five → clap
    { type: "beatElapsed" }, // clap → settle; speech done → DEBRIEF
  );
  const steps = run(events);
  const phases = steps.map((s) => s.phase);
  // Every phase of the ladder was visited in order-bearing positions.
  for (const p of ["READING", "THINKING_BEAT", "SEARCH_IDLE", "SELECTION_READ", "NOTE_MARK", "ASK_NEXT", "CELEBRATE", "DEBRIEF"]) {
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
  // Debrief (U8): this script's caseSolved carried no answerPlaceId, so
  // the sequence is frame → close (the name line joins when an id is
  // present — covered by the dedicated U8 debrief tests below).
  assert.equal(last(steps).phase, "DEBRIEF");
  assert.deepEqual(speakIds(last(steps).effects), ["fixed:debrief-frame", "fixed:debrief-close"]);
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

test("sheetClosed after a drained selection read fires ASK_NEXT exactly once (via NOTE_MARK, U8)", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:42" },
    { type: "ringAnimationEnded" },
    { type: "speechEnded" }, // selection drains → SEARCH_IDLE (marker set)
    { type: "sheetOpened" },
    { type: "sheetClosed" }, // → NOTE_MARK (the miss beat)
    { type: "beatElapsed" }, // beat over → ASK_NEXT
    { type: "speechEnded" }, // ask drained → SEARCH_IDLE (ask spoken)
    { type: "clueUnlocked", clueIndex: 2 }, // straight to the read, no 2nd ask
  ]);
  // Steps: 0–3 clue 1, 4 guess, 5 ring end, 6 selection drain, 7 sheet
  // open, 8 sheet close, 9 beat, 10 ask drain, 11 next clue.
  assert.equal(steps[6]!.phase, "SEARCH_IDLE");
  assert.equal(viewForState(steps[7]!.state).hidden, true); // sheet open
  assert.equal(steps[8]!.phase, "NOTE_MARK");
  assert.equal(steps[9]!.phase, "ASK_NEXT");
  assert.deepEqual(speakIds(steps[9]!.effects), ["fixed:ask-next"]);
  assert.equal(steps[10]!.phase, "SEARCH_IDLE");
  assert.equal(steps[11]!.phase, "READING");
  assert.deepEqual(speakIds(steps[11]!.effects), ["clue:2"]);
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

test("fail path: answer read → pout, STICKY (U8 — no dwell, no auto-advance)", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:42" },
    { type: "caseFailed" }, // lands mid-selection-read → deferred
    { type: "speechEnded" }, // selection drains → FAIL_READ
    { type: "speechEnded" }, // answer drains → POUT
    { type: "beatElapsed" }, // U5's 1500 ms exit is gone: no-op now
    { type: "speechEnded" }, // stray drains are no-ops too
    { type: "beatElapsed" },
  ]);
  assert.equal(steps[steps.length - 5]!.phase, "FAIL_READ");
  assert.deepEqual(speakIds(steps[steps.length - 5]!.effects), ["answer"]);
  const pout = steps[steps.length - 4]!;
  assert.equal(pout.phase, "POUT");
  assert.deepEqual(dwells(pout.effects), []); // no dwell is ever armed
  assert.deepEqual(pout.effects, []);
  const poutView = viewForState(pout.state);
  assert.equal(poutView.holmes.pose, "pout");
  assert.equal(poutView.watson.pose, "pout");
  // Still pouting after every later beat/speech event.
  assert.equal(last(steps).phase, "POUT");
  assert.equal(viewForState(last(steps).state).holmes.pose, "pout");
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

/* ------------------------------------------------------------------ */
/* U7 — selection handoff, hardened + proven                           */
/* ------------------------------------------------------------------ */

/** Speak refs (not just ids) of one step, for identity assertions. */
function speakRefs(effects: DetectiveEffect[]) {
  return effects
    .filter((e) => e.type === "speak")
    .map((e) => (e as Extract<DetectiveEffect, { type: "speak" }>).ref);
}

/** Five picks on clue 1 (machine-level: each drains back to SEARCH_IDLE),
 * then the named ending. Returns every step. */
function fivePicksThen(end: "solved" | "failed"): Step[] {
  const events: DetectiveEvent[] = [...normalClue(1)];
  for (let i = 1; i <= 5; i++) {
    events.push(
      { type: "guessConfirmed", placeId: `geonames:${700 + i}` },
      { type: "ringAnimationEnded" },
      { type: "speechEnded" }, // selection read drains
    );
  }
  events.push(end === "solved" ? { type: "caseSolved" } : { type: "caseFailed" });
  if (end === "failed") events.push({ type: "speechEnded" }); // → POUT
  return run(events);
}

test("U7: every selection read enqueues the SAME single suspicion ref — picks 1..5, win or lose", () => {
  for (const end of ["solved", "failed"] as const) {
    const steps = fivePicksThen(end);
    const selections = steps.filter(
      (s) => s.phase === "SELECTION_READ" && s.effects.length > 0,
    );
    assert.equal(selections.length, 5, `${end}: five selection reads`);
    const suspicions = selections.map((s) => {
      const refs = speakRefs(s.effects);
      assert.equal(refs.length, 2, "name + suspicion, nothing else");
      assert.equal(refs[0]!.kind, "name");
      return refs[1]!;
    });
    // The suspicion ref is the identical fixed entry every time — the
    // answer-blindness of the line is this equality, not a comment.
    for (const ref of suspicions) {
      assert.deepEqual(ref, { kind: "fixed", id: "suspicion" });
      assert.deepEqual(ref, suspicions[0]);
    }
  }
});

test("U7: uncovered pick — machine effects are identical minus the name ref", () => {
  // The machine cannot know coverage (entry presence lives in the
  // manifest, player-side), so a covered and an uncovered pick produce
  // the same machine step; stripping the name ref leaves exactly the
  // one suspicion effect the player will actually sound.
  const covered = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:5506956" }, // Las Vegas: covered
  ]);
  const uncovered = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:424242" }, // no name entry
  ]);
  const a = last(covered);
  const b = last(uncovered);
  assert.equal(a.phase, b.phase);
  assert.deepEqual(viewForState(a.state), viewForState(b.state));
  const minusName = (effects: DetectiveEffect[]) =>
    speakRefs(effects).filter((r) => r.kind !== "name");
  assert.deepEqual(minusName(a.effects), minusName(b.effects));
  assert.deepEqual(minusName(a.effects), [{ kind: "fixed", id: "suspicion" }]);
});

test("U7: ask-next fires exactly once per unlock across a full 5-guess game — 4 total, never on the final clue", () => {
  const events: DetectiveEvent[] = [...normalClue(1)];
  // Guesses 1..3 bridge to clues 2..4 via the pending-clue path.
  for (const n of [2, 3, 4]) {
    events.push(
      { type: "guessConfirmed", placeId: `geonames:${800 + n}` },
      { type: "ringAnimationEnded" },
      { type: "clueUnlocked", clueIndex: n }, // mid-selection-read
      { type: "speechEnded" }, // selection drains → NOTE_MARK (U8)
      { type: "beatElapsed" }, // miss beat over → ASK_NEXT
      { type: "speechEnded" }, // ask drains → clue n starts
    );
    if (n === 4) {
      events.push(
        { type: "beatElapsed" }, // hook silence → announcement
        { type: "speechEnded" }, // announcement → read
        { type: "speechEnded" }, // read → decode
        { type: "speechEnded" }, // → search
      );
    } else {
      events.push(
        { type: "speechEnded" }, // read → thinking beat
        { type: "beatElapsed" }, // → ack + decode
        { type: "speechEnded" }, // → search
      );
    }
  }
  // Guess 4 bridges to the final clue.
  events.push(
    { type: "guessConfirmed", placeId: "geonames:805" },
    { type: "ringAnimationEnded" },
    { type: "clueUnlocked", clueIndex: 5 },
    { type: "speechEnded" }, // → NOTE_MARK
    { type: "beatElapsed" }, // → ASK_NEXT (4th and last)
    { type: "speechEnded" }, // → clue 5 read
    { type: "speechEnded" }, // read → thinking beat
    { type: "beatElapsed" }, // → ack + decode
    { type: "speechEnded" }, // → search
    // Guess 5 solves: selection read, solve lands mid-read, drain → CELEBRATE.
    { type: "guessConfirmed", placeId: "geonames:999" },
    { type: "caseSolved" },
    { type: "speechEnded" },
  );
  const steps = run(events);
  const asks = steps.filter((s) =>
    s.effects.some(
      (e) => e.type === "speak" && e.ref.kind === "fixed" && e.ref.id === "ask-next",
    ),
  );
  assert.equal(asks.length, 4);
  assert.equal(last(steps).phase, "CELEBRATE");
});

test("U7: sheet churn never duplicates ask-next (open/close/open after the ask was spoken)", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:42" },
    { type: "ringAnimationEnded" },
    { type: "speechEnded" }, // selection drains → SEARCH_IDLE (marker set)
    { type: "sheetOpened" },
    { type: "sheetClosed" }, // → NOTE_MARK (U8 miss beat)
    { type: "beatElapsed" }, // beat over → ASK_NEXT (the one ask)
    { type: "speechEnded" }, // ask drains → SEARCH_IDLE, askNextSpoken
    { type: "sheetOpened" }, // churn: reopen + close twice more
    { type: "sheetClosed" },
    { type: "sheetOpened" },
    { type: "sheetClosed" },
    { type: "clueUnlocked", clueIndex: 2 }, // straight to the read
  ]);
  const asks = steps.filter((s) =>
    s.effects.some(
      (e) => e.type === "speak" && e.ref.kind === "fixed" && e.ref.id === "ask-next",
    ),
  );
  assert.equal(asks.length, 1);
  assert.equal(last(steps).phase, "READING");
  assert.deepEqual(speakIds(last(steps).effects), ["clue:2"]);
});

test("U7: no ask-next on the final clue — the sheetClosed path is clue-gated", () => {
  const steps = run([
    ...normalClue(5),
    { type: "guessConfirmed", placeId: "geonames:42" },
    { type: "ringAnimationEnded" },
    { type: "speechEnded" }, // drains → SEARCH_IDLE (marker set, clue 5)
    { type: "sheetOpened" },
    { type: "sheetClosed" }, // must NOT fire ask-next: no clue 6 exists
  ]);
  assert.equal(last(steps).phase, "SEARCH_IDLE");
  assert.deepEqual(last(steps).effects, []);
  const asks = steps.filter((s) =>
    s.effects.some(
      (e) => e.type === "speak" && e.ref.kind === "fixed" && e.ref.id === "ask-next",
    ),
  );
  assert.equal(asks.length, 0);
});

/* ------------------------------------------------------------------ */
/* U8 — case open, miss beat, endings, debrief                         */
/* ------------------------------------------------------------------ */

test("U8 case open: a FRESH deal plays instructions-holmes → instructions-watson before clue 1", () => {
  const steps = run([
    { type: "caseOpened", freshDeal: true },
    { type: "clueUnlocked", clueIndex: 1 }, // arrives mid-duet → pends
    { type: "speechEnded" }, // Holmes's line drains → Watson's line
    { type: "speechEnded" }, // duet done → the pended clue starts
  ]);
  assert.equal(steps[0]!.phase, "CASE_OPEN");
  assert.deepEqual(speakIds(steps[0]!.effects), ["fixed:instructions-holmes"]);
  const holmesView = viewForState(steps[0]!.state);
  assert.equal(holmesView.holmes.pose, "ack"); // council Q4: Holmes, "ack", at station
  assert.equal(holmesView.holmes.placement, "station");
  assert.equal(holmesView.holmes.speaking, true);
  // The mid-duet unlock produced no effects and no phase change.
  assert.equal(steps[1]!.phase, "CASE_OPEN");
  assert.deepEqual(steps[1]!.effects, []);
  assert.equal(steps[1]!.state.pendingClue, 1);
  assert.deepEqual(speakIds(steps[2]!.effects), ["fixed:instructions-watson"]);
  const watsonView = viewForState(steps[2]!.state);
  assert.equal(watsonView.watson.speaking, true);
  assert.equal(watsonView.watson.placement, "station");
  assert.equal(steps[3]!.phase, "READING");
  assert.deepEqual(speakIds(steps[3]!.effects), ["clue:1"]);
});

test("U8 case open: a RESUMED case skips instructions entirely", () => {
  const steps = run([
    { type: "caseOpened", freshDeal: false },
    { type: "clueUnlocked", clueIndex: 3 }, // resumed mid-ladder
  ]);
  assert.deepEqual(steps[0]!.effects, []);
  assert.equal(steps[0]!.state.instructionsStep, "skipped");
  assert.equal(steps[1]!.phase, "READING");
  assert.deepEqual(speakIds(steps[1]!.effects), ["clue:3"]);
  // No caseOpened at all keeps the U5 behaviour (every older test's path).
  const legacy = run([{ type: "clueUnlocked", clueIndex: 1 }]);
  assert.equal(last(legacy).phase, "READING");
});

test("U8 case open: the duet can finish before clue 1 arrives — the ladder waits, then starts", () => {
  const steps = run([
    { type: "caseOpened", freshDeal: true },
    { type: "speechEnded" },
    { type: "speechEnded" }, // duet done, no clue yet
    { type: "clueUnlocked", clueIndex: 1 },
  ]);
  assert.equal(steps[2]!.phase, "CASE_OPEN");
  assert.equal(steps[2]!.state.instructionsStep, "done");
  assert.equal(steps[3]!.phase, "READING");
  assert.deepEqual(speakIds(steps[3]!.effects), ["clue:1"]);
});

test("U8 miss beat: NOTE_MARK — Watson marks at the station, Holmes searches at the dock, voiceless ~900 ms", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:42" },
    { type: "ringAnimationEnded" },
    { type: "clueUnlocked", clueIndex: 2 }, // mid-selection-read
    { type: "speechEnded" }, // selection drains → NOTE_MARK
    { type: "beatElapsed" }, // beat over → ASK_NEXT
  ]);
  const mark = steps[steps.length - 2]!;
  assert.equal(mark.phase, "NOTE_MARK");
  assert.deepEqual(dwells(mark.effects), [NOTE_MARK_MS]);
  assert.equal(NOTE_MARK_MS, 900);
  assert.deepEqual(speakIds(mark.effects), []); // NO speech in the beat
  const markView = viewForState(mark.state);
  assert.equal(markView.watson.pose, "notebook-mark");
  assert.equal(markView.watson.placement, "station");
  assert.equal(markView.holmes.pose, "search");
  assert.equal(markView.holmes.placement, "dock");
  assert.equal(last(steps).phase, "ASK_NEXT");
  assert.deepEqual(speakIds(last(steps).effects), ["fixed:ask-next"]);
});

/** Drive a solve (from SEARCH_IDLE on clue 1) into CELEBRATE. */
function solveSteps(answerPlaceId?: string | null): Step[] {
  return run([
    ...normalClue(1),
    { type: "caseSolved", answerPlaceId },
  ]);
}

test("U8 celebrate: dwell-chained jump → high-five → clap → settle; speech-last opens DEBRIEF from the settle", () => {
  const steps = run([
    ...normalClue(1),
    { type: "caseSolved", answerPlaceId: "geonames:5505411" },
    { type: "beatElapsed" }, // jump dwell over → high-five
    { type: "beatElapsed" }, // high-five hold over → clap
    { type: "beatElapsed" }, // clap hold over → settle (speech still playing)
    { type: "speechEnded" }, // win lines drain → DEBRIEF
  ]);
  const enter = steps[steps.length - 5]!;
  assert.equal(enter.phase, "CELEBRATE");
  assert.deepEqual(speakIds(enter.effects), ["fixed:win-holmes", "fixed:win-watson"]);
  assert.deepEqual(dwells(enter.effects), [CELEBRATE_JUMP_MS]);
  assert.equal(viewForState(enter.state).holmes.pose, "celebrate-jump");
  assert.equal(viewForState(enter.state).watson.pose, "celebrate-jump");

  const hiFive = steps[steps.length - 4]!;
  assert.equal(viewForState(hiFive.state).holmes.pose, "high-five");
  assert.equal(viewForState(hiFive.state).watson.pose, "high-five");
  assert.equal(viewForState(hiFive.state).holmes.placement, "station");
  assert.deepEqual(dwells(hiFive.effects), [HIGH_FIVE_HOLD_MS]);

  const clap = steps[steps.length - 3]!;
  assert.equal(viewForState(clap.state).holmes.pose, "clap");
  assert.equal(viewForState(clap.state).watson.pose, "clap");
  assert.deepEqual(dwells(clap.effects), [CLAP_HOLD_MS]);
  assert.equal(CLAP_HOLD_MS, 800);

  const settle = steps[steps.length - 2]!;
  assert.equal(settle.phase, "CELEBRATE"); // speech has not drained yet
  assert.equal(viewForState(settle.state).holmes.pose, "dock");
  assert.equal(viewForState(settle.state).watson.pose, "station-idle");

  const debrief = last(steps);
  assert.equal(debrief.phase, "DEBRIEF");
  assert.deepEqual(speakIds(debrief.effects), [
    "fixed:debrief-frame",
    "name:geonames:5505411",
    "fixed:debrief-close",
  ]);
});

test("U8 celebrate: speech-first — the win lines drain mid-choreography and DEBRIEF opens on the final beat", () => {
  const steps = run([
    ...normalClue(1),
    { type: "caseSolved", answerPlaceId: "geonames:5505411" },
    { type: "speechEnded" }, // drains during the jump → remembered, no phase change
    { type: "beatElapsed" }, // → high-five
    { type: "beatElapsed" }, // → clap
    { type: "beatElapsed" }, // clap over; speech done → DEBRIEF
  ]);
  assert.equal(steps[steps.length - 4]!.phase, "CELEBRATE");
  assert.equal(last(steps).phase, "DEBRIEF");
  assert.deepEqual(speakIds(last(steps).effects), [
    "fixed:debrief-frame",
    "name:geonames:5505411",
    "fixed:debrief-close",
  ]);
});

test("U8 debrief: frame → answer name → close; a missing id leaves frame → close; the drain settles to idle", () => {
  const withId = solveSteps("geonames:5505411");
  assert.equal(last(withId).state.answerPlaceId, "geonames:5505411"); // stored, unconsumed
  const noId = run([
    ...normalClue(1),
    { type: "caseSolved" },
    { type: "speechEnded" },
    { type: "beatElapsed" },
    { type: "beatElapsed" },
    { type: "beatElapsed" },
  ]);
  assert.equal(last(noId).phase, "DEBRIEF");
  assert.deepEqual(speakIds(last(noId).effects), ["fixed:debrief-frame", "fixed:debrief-close"]);
  // The debrief view: Holmes speaks at the station, Watson listens.
  const debriefView = viewForState(last(noId).state);
  assert.equal(debriefView.holmes.pose, "ack");
  assert.equal(debriefView.holmes.speaking, true);
  // Consumed on entry: the id never lingers past the debrief.
  assert.equal(last(noId).state.answerPlaceId, null);
  const settled = run([{ type: "speechEnded" }], last(noId).state);
  assert.equal(last(settled).phase, "CASE_OPEN");
});

test("U8 debrief: the answer id survives a mid-selection-read solve (pending path)", () => {
  const steps = run([
    ...normalClue(1),
    { type: "guessConfirmed", placeId: "geonames:5505411" },
    { type: "caseSolved", answerPlaceId: "geonames:5505411" }, // lands mid-read
    { type: "speechEnded" }, // selection drains → CELEBRATE
    { type: "speechEnded" }, // win lines drain (remembered)
    { type: "beatElapsed" },
    { type: "beatElapsed" },
    { type: "beatElapsed" }, // → DEBRIEF
  ]);
  assert.equal(last(steps).phase, "DEBRIEF");
  assert.deepEqual(speakIds(last(steps).effects), [
    "fixed:debrief-frame",
    "name:geonames:5505411",
    "fixed:debrief-close",
  ]);
});

test("U8 answer-blindness extension: answerPlaceId is IGNORED outside DEBRIEF — pre-solve streams are identical for any value", () => {
  const script = (answerPlaceId: string | null): Step[] =>
    run([
      ...normalClue(1),
      { type: "guessConfirmed", placeId: "geonames:5505411" },
      { type: "caseSolved", answerPlaceId },
      { type: "speechEnded" }, // → CELEBRATE
      { type: "beatElapsed" }, // → high-five
      { type: "beatElapsed" }, // → clap
      { type: "speechEnded" }, // (already drained — no-op guard)
    ]);
  const a = script("geonames:5505411");
  const b = script("geonames:323786"); // a different case's answer entirely
  const c = script(null);
  for (const [x, y] of [[a, b], [a, c]] as const) {
    assert.equal(x.length, y.length);
    for (let i = 0; i < x.length; i++) {
      assert.equal(x[i]!.phase, y[i]!.phase, `step ${i} phase identical`);
      assert.deepEqual(viewForState(x[i]!.state), viewForState(y[i]!.state), `step ${i} view identical`);
      assert.deepEqual(x[i]!.effects, y[i]!.effects, `step ${i} effects identical`);
    }
  }
  // The one permitted divergence appears only AT the debrief entry:
  // the clap beat (the win lines already drained in-script, so the
  // drain was recorded) opens DEBRIEF, and only its NAME ref differs.
  const fa = run([{ type: "beatElapsed" }], last(a).state);
  const fb = run([{ type: "beatElapsed" }], last(b).state);
  assert.equal(last(fa).phase, "DEBRIEF");
  assert.equal(last(fb).phase, "DEBRIEF");
  assert.deepEqual(speakIds(last(fa).effects), [
    "fixed:debrief-frame",
    "name:geonames:5505411",
    "fixed:debrief-close",
  ]);
  assert.deepEqual(speakIds(last(fb).effects), [
    "fixed:debrief-frame",
    "name:geonames:323786",
    "fixed:debrief-close",
  ]);
});

test("U8 pout exits: only a new case — clueUnlocked of a new case, or caseOpened — never a timer", () => {
  const lost = run([
    ...normalClue(1),
    { type: "caseFailed" },
    { type: "speechEnded" }, // → POUT
  ]);
  assert.equal(last(lost).phase, "POUT");
  // A new case's first clue restarts the ladder straight from POUT.
  const viaClue = run([{ type: "clueUnlocked", clueIndex: 1 }], last(lost).state);
  assert.equal(last(viaClue).phase, "READING");
  // A fresh caseOpened resets the pout and starts the duet.
  const viaOpen = run([{ type: "caseOpened", freshDeal: true }], last(lost).state);
  assert.equal(last(viaOpen).phase, "CASE_OPEN");
  assert.deepEqual(speakIds(last(viaOpen).effects), ["fixed:instructions-holmes"]);
  // A resumed caseOpened also clears the pout, silently.
  const viaResume = run([{ type: "caseOpened", freshDeal: false }], last(lost).state);
  assert.equal(last(viaResume).phase, "CASE_OPEN");
  assert.deepEqual(last(viaResume).effects, []);
});
