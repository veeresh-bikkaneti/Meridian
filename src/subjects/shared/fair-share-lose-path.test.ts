/**
 * L1 lose path (feat/fair-share-lose-path) — "same film, same
 * voice" on ONE item: a wrong pick on `math-number:division:
 * fair-share` (Math, ages 7-10) shows the answer-first line and
 * then plays the item's existing act-3 narrated solved summary,
 * exactly as the win path plays it. Every other item's wrong
 * pick is unchanged.
 *
 * AMENDED by feat/lose-path-all-items (the gate flip, stacked on
 * the pilot): the gate no longer names this one item — it is a
 * property of having a solved summary, so the sibling items
 * below are now ON the path too (pinned in
 * lose-path-all-items.test.ts). This suite keeps pinning the
 * pilot item's own behaviour unchanged: same line, same summary,
 * same win path, same answer-blindness. The two gate tests that
 * asserted the old one-item truth table are amended and marked
 * as such inline; no other test here changes.
 *
 * There is no DOM test infra in this repo, so — the clue-scene
 * precedent — the gate itself is pinned as a pure function
 * (imported and exercised directly), the wiring is pinned in the
 * component sources, and the Playwright spec
 * (tests/e2e/math-fair-share-lose-path.spec.ts) plus the built-
 * artifact walk prove the behaviour end to end.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clueSceneFor, showsSummaryOnWrong } from "../math/scenes.ts";

/** The pilot item this suite pins (the gate no longer names it). */
const LOSE_SUMMARY_ITEM_ID = "math-number:division:fair-share";
import { MATH_ANSWERS } from "../math/answers.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

const subjectCase = read(join(here, "SubjectCase.tsx"));
const mathCase = read(join(here, "..", "math", "MathCase.tsx"));
const clueScene = read(join(here, "ClueScene.tsx"));

/** A named region of a source file, from a marker to the next marker. */
function region(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `region start exists: ${from}`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `region end exists: ${to}`);
  return source.slice(start, end);
}

describe("the lose-path gate and the pilot item", () => {
  it("fair-share at ages 7-10 is on the path", () => {
    assert.equal(showsSummaryOnWrong("math-number:division:fair-share", "7-10"), true);
  });

  it("(b) AMENDED by the gate flip: a wrong pick on a sibling pilot item now reveals too", () => {
    // The other two pilot items, plus the item dealt right after
    // fair-share and every other 7-10 scene item: each carries a
    // solved summary, so the generalised gate puts each on the
    // path. (The pilot's version of this test asserted false for
    // each; the flip is exactly that change.)
    for (const id of [
      "math-number:groups:skip-count",
      "math-number:tables:facts",
      "math-number:division:unknown-factor",
      "math-number:groups:equal-groups",
      "math-number:tables:buses",
      "math-number:division:remainders",
      "math-number:division:big-quotients",
    ]) {
      assert.equal(showsSummaryOnWrong(id, "7-10"), true, `${id} must reveal on a wrong pick`);
    }
  });

  it("fair-share in any other band stays off the path", () => {
    assert.equal(showsSummaryOnWrong("math-number:division:fair-share", "10-18"), false);
    assert.equal(showsSummaryOnWrong("math-number:division:fair-share", "18+"), false);
  });

  it("the gate reuses the item's existing summary — no new authoring", () => {
    const description = clueSceneFor(LOSE_SUMMARY_ITEM_ID);
    assert.ok(description, "fair-share carries a scene description");
    assert.equal(description.kind, "fair-share");
    assert.ok(description.summary, "and its act-3 summary already exists");
    assert.equal(description.summary.clip, "fair-share.mp3");
    assert.equal(MATH_ANSWERS[LOSE_SUMMARY_ITEM_ID]?.correct, "3");
    assert.equal(
      description.summary.lines[description.summary.lines.length - 1]?.text,
      "Every friend has 3 snacks, and the plate is empty. Sharing one by one keeps it fair!",
    );
  });
});

describe("(a) a wrong pick on fair-share reveals the answer line, then the summary", () => {
  it("MathCase passes the gate as the case's loseReveal hook", () => {
    assert.ok(mathCase.includes("loseReveal={(item, band) => showsSummaryOnWrong(item.id, band)}"));
  });

  it("the reveal is set only on the wrong-answer path, on the entry question", () => {
    const onWrong = region(subjectCase, "const onWrong = (value: string, key: string) => {", "const pick =");
    assert.ok(onWrong.includes("setPicked(value);"), "the pick still stands as feedback");
    assert.ok(
      onWrong.includes('if (phase === "main" && loseReveal) {'),
      "the reveal is gated on the entry question and the subject passing its hook at all (widened 2026-11-19: every item reveals)",
    );
    assert.ok(onWrong.includes("setLoseRevealed(true);"));
    const onCorrect = region(subjectCase, "const onCorrect = () => {", "// Shared wrong-answer path");
    assert.ok(!onCorrect.includes("LoseRevealed"), "a correct pick never touches the reveal");
  });

  it("the answer line states the answer first, in the win path's own shape", () => {
    const lose = region(
      subjectCase,
      'data-testid={`${subjectId}-lose-reveal`}',
      ") : (\n          <AnswerCard",
    );
    assert.ok(lose.includes('data-testid={`${subjectId}-lose-answer`}'));
    assert.ok(
      lose.includes("The answer is <strong>{answer.correct}</strong> — here's how."),
      "the line is built from the item's own correct answer, so fair-share reads: The answer is 3 — here's how.",
    );
    assert.ok(
      lose.includes("resultExtra ? resultExtra(item, reduced, band) : null"),
      "the summary's full script stands as text in the reveal, as in the result section",
    );
    assert.ok(lose.includes("onClick={nextCase}"), "the player can move on from the reveal");
    assert.ok(!lose.includes("You got it!"), "the reveal never claims a win");
    assert.ok(!lose.includes("onCelebrate"), "the reveal never celebrates");
  });

  it("the scene performs the solved beat on the reveal — the same act 3 as a win", () => {
    assert.ok(
      subjectCase.includes(
        'const scenePhase: "setup" | "solved" =\n    solved || (loseRevealed && supportHeard) ? "solved" : "setup";',
      ),
      "once the supportive line has been heard, the reveal puts the scene in its solved phase, so ClueScene's act 3 starts",
    );
    // ClueScene itself is untouched: its act 3 still starts only in
    // the solved phase, through the platform audio port (which claims
    // the one-voice channel), honouring the read-aloud preference
    // and reduced motion.
    assert.ok(clueScene.includes('if (!sum || phase !== "solved") return;'));
    assert.ok(clueScene.includes("useVoice("));
    assert.ok(clueScene.includes("getReadAloudPref()"));
  });

  it("further picks are inert once the reveal is up, and the next case resets it", () => {
    assert.ok(subjectCase.includes("if (solved || loseRevealed) return;"));
    const nextCase = region(subjectCase, "const nextCase = () => {", "return (");
    assert.ok(nextCase.includes("setLoseRevealed(false);"));
  });
});

describe("(b) a wrong pick on an item with no summary behaves exactly as today", () => {
  it("the answer card still renders for an unrevealed wrong pick, with its try-again line", () => {
    // The ternary order: solved result, else the lose reveal, else
    // the answer card — an item off the path never leaves the card.
    const solvedAt = subjectCase.indexOf('aria-label="You solved it"');
    const loseAt = subjectCase.indexOf('data-testid={`${subjectId}-lose-reveal`}');
    const cardAt = subjectCase.indexOf("<AnswerCard", loseAt);
    assert.ok(solvedAt >= 0 && loseAt > solvedAt && cardAt > loseAt, "solved, reveal, card — in that order");
    assert.ok(subjectCase.includes("picked={picked}"), "the card still receives the wrong pick as feedback");
  });

  it("the detective host still sees a wrong pick, never a solve, on the reveal", () => {
    assert.ok(subjectCase.includes("wrongPick: picked !== null && !solved"));
    assert.ok(subjectCase.includes("finished: solved && index === items.length - 1"));
  });
});

describe("(c) a right pick on fair-share is unchanged", () => {
  it("the solved result keeps its exact win copy — and the lose line cannot double it", () => {
    const solvedSection = region(
      subjectCase,
      'aria-label="You solved it"',
      'data-testid={`${subjectId}-lose-reveal`}',
    );
    assert.ok(solvedSection.includes("🎯 You got it!"));
    assert.ok(
      solvedSection.includes("The answer is <strong>{answer.correct}</strong>. {answer.derivation}"),
      "the win path already states the answer, with the derivation",
    );
    assert.ok(!solvedSection.includes("here's how"), "the win section carries no lose line");
    // The two sections are branches of one ternary, so a solved
    // case can never render the lose line alongside its own.
    assert.ok(subjectCase.includes(") : loseRevealed ? ("), "the reveal is the solved branch's sibling, never its child");
  });
});

describe("answer-blindness before the choice is unchanged", () => {
  it("nothing in the reveal renders before a pick", () => {
    // The reveal state starts false, is set only inside onWrong,
    // and the reveal section exists only in the post-pick ternary
    // branch — the setup render path is byte-for-byte the old one.
    assert.ok(subjectCase.includes("const [loseRevealed, setLoseRevealed] = useState(false);"));
    assert.equal(subjectCase.split("setLoseRevealed(true)").length - 1, 1, "exactly one setter call site");
    const setup = region(subjectCase, "{lead ? lead(item, reduced) : null}", "{solved ? (");
    assert.ok(!setup.includes("lose"), "the pre-pick render path names nothing of the reveal");
    assert.ok(setup.includes("scene(item, scenePhase, reduced, band)"));
  });
});
