import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readNamesIndex } from "./audio-manifest.mjs";
import {
  CLUE_SPEEDS,
  FIXED_LINES,
  VOICES,
  answerText,
  casePlan,
  displayName,
  fixedLine,
  selectionNamePlan,
} from "./render-plan.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;
const clue137 = JSON.parse(readFileSync(`${ROOT}public/loop/clues/137.json`, "utf8"));
const clue387 = JSON.parse(readFileSync(`${ROOT}public/loop/clues/387.json`, "utf8"));

test("case plan: 5 Watson clue reads, verbatim text, staircase speeds", () => {
  const plan = casePlan(clue137, "Henderson, Nevada, United States", 137);
  assert.equal(plan.clues.length, 5);
  plan.clues.forEach((spec, i) => {
    assert.equal(spec.text, clue137.clues[i], "clue text must be verbatim from the clue file");
    assert.equal(spec.voice, VOICES.watson);
    assert.equal(spec.speed, CLUE_SPEEDS[i]);
    assert.equal(spec.gainDb, 0);
    assert.equal(spec.file, `case-137/clue-${i + 1}.mp3`);
  });
  assert.deepEqual([...CLUE_SPEEDS], [100, 97, 95, 92, 105]);
});

test("case plan: Holmes answer read mirrors the reveal format", () => {
  const plan = casePlan(clue137, "Henderson, Nevada, United States", 137);
  assert.equal(plan.answer.text, "Out of guesses. The answer was Henderson, Nevada, United States.");
  assert.equal(plan.answer.voice, VOICES.holmes);
  assert.equal(plan.answer.speed, 100);
  assert.equal(answerText("X"), "Out of guesses. The answer was X.");
});

test("display name: case 137 resolves to the game's Henderson string", () => {
  const rows = readNamesIndex(ROOT);
  const row = rows.find((r) => r.id === clue137.placeId);
  assert.ok(row, "Henderson must be in the names catalog");
  assert.equal(displayName(row), "Henderson, Nevada, United States");
});

test("display name: case 387 resolves to the game's Abu Dhabi string", () => {
  const rows = readNamesIndex(ROOT);
  const row = rows.find((r) => r.id === clue387.placeId);
  assert.ok(row, "Abu Dhabi must be in the names catalog");
  assert.equal(displayName(row), "Abu Dhabi, United Arab Emirates");
});

test("display name: region appended only when present", () => {
  assert.equal(displayName({ n: "canada", r: "" }), "Canada");
  assert.equal(displayName({ n: "sao paulo", r: "São Paulo, BR" }), "Sao Paulo, São Paulo, BR");
});

test("fixed lines: acks rotate verbatim, suspicion + hook are hushed", () => {
  const acks = FIXED_LINES.filter((l) => l.kind === "ack");
  assert.deepEqual(
    acks.map((l) => l.text),
    ["Right. Leave it with me.", "Very well, Watson.", "Noted, Watson.", "Ah... the game is afoot."],
  );
  for (const l of acks) assert.equal(l.voice, VOICES.holmes);
  const suspicion = fixedLine("suspicion");
  assert.equal(suspicion.text, "Hmm... it could be it.");
  assert.equal(suspicion.speed, 85);
  assert.equal(suspicion.gainDb, -5);
  const hook = fixedLine("hook-announcement");
  assert.equal(hook.speed, 85);
  assert.equal(hook.gainDb, -5);
  assert.equal(fixedLine("ask-next").text, "Watson. The next question.");
});

test("fixed lines: instructions are the game's own copy, split Holmes/Watson", () => {
  assert.equal(fixedLine("instructions-holmes").text, "Five guesses, one mystery place.");
  assert.equal(
    fixedLine("instructions-watson").text,
    "Each guess unlocks another clue — and tells you how far off you were, and in which direction.",
  );
  assert.equal(fixedLine("win-holmes").text, "You found it!");
  assert.equal(fixedLine("win-holmes").speed, 108);
  assert.equal(fixedLine("win-watson").text, "Case closed — the gold star marks the answer.");
});

test("fixed lines: decodes are templates; hook/giveaway flagged DRAFT, clue-local", () => {
  assert.equal(fixedLine("decode-geography").text, "Borders first. The rest follows.");
  assert.equal(fixedLine("decode-hook").speed, 104);
  assert.match(fixedLine("decode-hook").note, /DRAFT/);
  assert.match(fixedLine("decode-giveaway").note, /DRAFT/);
  // Cure pass: both reworded decodes are ONE sentence about their own
  // clue only — no cross-clue synthesis, no reference to earlier clues.
  assert.equal(fixedLine("decode-hook").text, "This is the clue to weigh most carefully.");
  assert.equal(fixedLine("decode-giveaway").text, "That settles it — with the giveaway in hand, you can trust your pin.");
  // The amazement fragment was cut (49 wpm vs its ≥165 wpm spec,
  // unreachable at maximum render speed) — it must not reappear.
  assert.equal(FIXED_LINES.some((l) => l.id === "amazement"), false);
  assert.equal(fixedLine("debrief-frame").text, "The land. The weather. The story. The hook. The giveaway.");
  assert.equal(fixedLine("debrief-close").text, "All of it — one place. Elementary.");
});

test("fixed lines: the case-open announcement is Watson, line #20 (PR B)", () => {
  const line = fixedLine("lets-find-clues");
  assert.equal(line.text, "Let's find some clues.");
  assert.equal(line.voice, VOICES.watson);
  assert.equal(line.speed, 106);
  assert.equal(line.file, "fixed/lets-find-clues.mp3");
  assert.equal(FIXED_LINES.length, 20);
});

test("selection name plan: bare display name, Holmes at speed 100", () => {
  const spec = selectionNamePlan({ id: "geonames:5505411", n: "henderson", r: "Nevada, United States", p: 285667 });
  assert.equal(spec.text, "Henderson, Nevada, United States");
  assert.equal(spec.voice, VOICES.holmes);
  assert.equal(spec.speed, 100);
  assert.equal(spec.file, "names/5505411.mp3");
  assert.equal(spec.geonameId, "5505411");
});
