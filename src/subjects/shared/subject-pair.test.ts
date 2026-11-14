import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSubjectPairProps,
  lineForState,
  posesForState,
  SUBJECT_PAIR_LINES,
  SUBJECT_PAIR_PROP_KEYS,
  type SubjectPairState,
} from "./subject-pair.ts";

/**
 * The subject pair's gates: the props hold only the whitelisted keys
 * (no item, answer or evaluation), each state maps to its line or to
 * silence, and every line is a real `fixed` clip whose words match.
 */

const STATES: SubjectPairState[] = ["open", "wrong", "correct", "finished"];
const base = { caseIndex: 2, solved: false, wrongPick: false, lastCase: false };

test("props: exactly caseIndex and state, in order, for every input", () => {
  for (const solved of [false, true]) {
    for (const wrongPick of [false, true]) {
      for (const lastCase of [false, true]) {
        const props = buildSubjectPairProps({ ...base, solved, wrongPick, lastCase });
        assert.deepEqual(Object.keys(props), [...SUBJECT_PAIR_PROP_KEYS]);
        assert.equal(props.caseIndex, 2);
        assert.ok(STATES.includes(props.state));
      }
    }
  }
});

test("props: extra fields smuggled in at runtime never cross", () => {
  const smuggled = {
    ...base,
    item: { id: "math-number:groups:skip-count" },
    answer: "8",
    correct: "8",
    picked: "6",
    choices: ["6", "8"],
    evaluation: "wrong",
  } as unknown as Parameters<typeof buildSubjectPairProps>[0];
  const props = buildSubjectPairProps(smuggled);
  assert.deepEqual(Object.keys(props), [...SUBJECT_PAIR_PROP_KEYS]);
  const json = JSON.stringify(props);
  for (const leak of ["skip-count", '"8"', '"6"', "evaluation", "choices"]) {
    assert.ok(!json.includes(leak), `leaked ${leak}: ${json}`);
  }
});

test("props: the four states", () => {
  assert.equal(buildSubjectPairProps(base).state, "open");
  assert.equal(buildSubjectPairProps({ ...base, wrongPick: true }).state, "wrong");
  assert.equal(buildSubjectPairProps({ ...base, solved: true }).state, "correct");
  assert.equal(
    buildSubjectPairProps({ ...base, solved: true, lastCase: true }).state,
    "finished",
  );
  // Solved wins over a stale wrong pick.
  assert.equal(
    buildSubjectPairProps({ ...base, solved: true, wrongPick: true }).state,
    "correct",
  );
});

test("lines: each state maps to its clip or to silence", () => {
  assert.deepEqual(
    Object.fromEntries(STATES.map((s) => [s, lineForState(s)?.id ?? null])),
    { open: "lets-find-clues", wrong: null, correct: "win-holmes", finished: "win-holmes" },
  );
  assert.equal(lineForState("open")?.who, "watson");
  assert.equal(lineForState("correct")?.who, "holmes");
});

test("lines: every clip exists under the manifest's fixed set, words and speaker match", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../../public/audio/detective/manifest.json", import.meta.url), "utf8"),
  ) as {
    voices: { holmes: string; watson: string };
    fixed: Record<string, { text: string; voice: string; file: string; status?: string }>;
  };
  for (const line of Object.values(SUBJECT_PAIR_LINES)) {
    if (!line) continue;
    const entry = manifest.fixed[line.id];
    assert.ok(entry, `${line.id} is not in manifest.fixed`);
    assert.equal(entry.text, line.words, `${line.id} words`);
    assert.equal(entry.voice, manifest.voices[line.who], `${line.id} speaker`);
    assert.equal(entry.status, "ok", `${line.id} status`);
  }
});

test("lines: nothing GeoDetective-only, no numbers spoken", () => {
  for (const line of Object.values(SUBJECT_PAIR_LINES)) {
    if (!line) continue;
    assert.ok(!/^(instructions|decode|debrief|hook|win-watson)/.test(line.id), line.id);
    assert.ok(!/\d|map|guess|star|far|direction|place/i.test(line.words), line.words);
  }
});

test("poses: still poses only, never a walk; reduced motion skips the jump", () => {
  for (const s of STATES) {
    for (const reducedMotion of [false, true]) {
      for (const jumping of [false, true]) {
        const p = posesForState(s, { reducedMotion, jumping });
        assert.notEqual(p.holmes, "walk");
        assert.notEqual(p.watson, "walk");
        if (reducedMotion) {
          assert.notEqual(p.holmes, "celebrate-jump");
          assert.notEqual(p.watson, "celebrate-jump");
        }
      }
    }
  }
  assert.equal(posesForState("correct", { reducedMotion: true, jumping: true }).holmes, "high-five");
  assert.equal(posesForState("correct", { reducedMotion: false, jumping: true }).holmes, "celebrate-jump");
  assert.equal(posesForState("open", { reducedMotion: false, jumping: false }).celebrate, false);
});
