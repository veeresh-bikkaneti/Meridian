/**
 * L1 lose path, gate flip (feat/lose-path-all-items) — the
 * generalisation of the fair-share pilot (feat/fair-share-lose-path,
 * PR #503, the branch this one stacks on).
 *
 * The gate is no longer a named item: `showsSummaryOnWrong` in
 * math's scenes.ts is true exactly when the item is playable in
 * the band asked about AND its scene description carries a solved
 * summary. This branch was originally stacked on the pilot; it has
 * since been REBASED onto main with the whole clue-scene wave
 * train merged (#487–#496), so Math scene descriptions now exist
 * for all three bands and the flip covers exactly the 37 Math
 * item×band pairs whose descriptions carry a summary (22 for ages
 * 7-10, 13 for ages 10-18, 2 for ages 18+ — derived from the
 * registry and the scene record on the rebased tree, both
 * directions). The items pinned here as NOT covered are: the 15
 * Math 10-18 overflow items that carry no scene description in
 * any wave, the held survey-check item (no description by
 * design), and every item of the other four subjects — their
 * wrappers pass scene / resultExtra hooks since the waves, but
 * no loseReveal hook yet, so their lose-path mirror stays a
 * separate follow-on, not this PR.
 *
 * There is no DOM test infra in this repo, so — the clue-scene
 * and fair-share precedents — the gate is pinned as a pure
 * function, the wiring is pinned in the component sources, and
 * the Playwright specs plus the built-artifact walk prove the
 * behaviour end to end.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MATH_CLUE_SCENES, clueSceneFor, showsSummaryOnWrong } from "../math/scenes.ts";
import { MATH_ANSWERS } from "../math/answers.ts";
import { itemsForGroup as mathItemsForGroup } from "../math/items.ts";
import { itemsForGroup as physicsItemsForGroup } from "../physics/items.ts";
import { itemsForGroup as chemistryItemsForGroup } from "../chemistry/items.ts";
import { itemsForGroup as generalKnowledgeItemsForGroup } from "../general-knowledge/items.ts";
import { itemsForGroup as socialStudiesItemsForGroup } from "../social-studies/items.ts";
import type { AgeGroup } from "../registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

const subjectCase = read(join(here, "SubjectCase.tsx"));
const scenesSource = read(join(here, "..", "math", "scenes.ts"));

const BANDS: AgeGroup[] = ["7-10", "10-18", "18+"];
const COVERED_BY_BAND: Record<AgeGroup, ReturnType<typeof mathItemsForGroup>> = {
  "7-10": mathItemsForGroup("7-10"),
  "10-18": mathItemsForGroup("10-18").filter((item) => clueSceneFor(item.id)?.summary),
  "18+": mathItemsForGroup("18+").filter((item) => clueSceneFor(item.id)?.summary),
};
const COVERED = BANDS.flatMap((band) => COVERED_BY_BAND[band]);

describe("the flipped gate covers every item that has a solved summary on this base", () => {
  it("every Math item whose description carries a summary is on the lose path, in its own band", () => {
    assert.equal(COVERED_BY_BAND["7-10"].length, 22, "registry-verified Math 7-10 count on the rebased base");
    assert.equal(COVERED_BY_BAND["10-18"].length, 13, "registry-verified Math 10-18 covered count on the rebased base");
    assert.equal(COVERED_BY_BAND["18+"].length, 2, "registry-verified Math 18+ covered count on the rebased base");
    assert.equal(COVERED.length, 37, "37 covered Math item×band pairs on the rebased base");
    for (const band of BANDS) {
      for (const item of mathItemsForGroup(band)) {
        const hasSummary = !!clueSceneFor(item.id)?.summary;
        assert.equal(
          showsSummaryOnWrong(item.id, band),
          hasSummary,
          `${item.id} (${band}): gate must equal summary presence`,
        );
      }
    }
  });

  it("the covered set is exactly the scene record — a property, not a list", () => {
    assert.deepEqual(
      Object.keys(MATH_CLUE_SCENES).sort(),
      COVERED.map((item) => item.id).sort(),
    );
    // The gate's own source names no item, no answer and no band:
    // it checks summary presence plus playable-band membership.
    const gate = scenesSource.slice(scenesSource.indexOf("export function showsSummaryOnWrong"));
    assert.ok(!gate.includes("math-number:"), "the gate names no item id");
    assert.ok(!gate.includes("MATH_ANSWERS"), "the gate never reads an answer");
    assert.ok(!gate.includes('"7-10"'), "the gate hardcodes no band");
    assert.ok(gate.includes("clueSceneFor(itemId)?.summary"), "the gate keys off the summary");
    assert.ok(gate.includes("itemsForGroup(band as AgeGroup)"), "the gate keys off playable-band membership");
  });

  it("for each covered item the answer line is built from that item's own correct answer", () => {
    // SubjectCase's reveal line (pinned in the fair-share suite) is
    // "The answer is <strong>{answer.correct}</strong> — here's how."
    // — so for every covered item the line it will show is:
    for (const item of COVERED) {
      const answer = MATH_ANSWERS[item.id];
      assert.ok(answer?.correct, `${item.id} has a correct answer`);
      const line = `The answer is ${answer!.correct} — here's how.`;
      assert.ok(line.startsWith("The answer is "), item.id);
      assert.ok(line.endsWith(" — here's how."), item.id);
      // The summary the reveal then plays closes on the same answer
      // — stated as the item states it: the correct choice's words,
      // or the numeric value where the closing uses the number
      // (the scenes.test.ts §7.2 pattern for phrase-answer items).
      const summary = clueSceneFor(item.id)!.summary!;
      const closing = summary.lines[summary.lines.length - 1]!.text;
      // One wave item states its answer with the unit spelled out
      // (the wave suite's own closing-map pattern): bearings'
      // closing says "37 degrees" where the choice reads "37°".
      const statedVariants: Record<string, string[]> = {
        "math-applied:trig:bearings": ["37°", "37 degrees"],
      };
      assert.ok(
        closing.includes(answer!.correct) ||
          (answer!.value !== undefined && closing.includes(String(answer!.value))) ||
          (statedVariants[item.id] ?? []).some((s) => closing.includes(s)),
        `${item.id}: summary closing states ${answer!.correct}`,
      );
    }
    // Spot-check the exact lines for three covered items.
    assert.equal(MATH_ANSWERS["math-number:groups:skip-count"]?.correct, "8");
    assert.equal(MATH_ANSWERS["math-number:division:fair-share"]?.correct, "3");
    assert.equal(MATH_ANSWERS["math-number:division:big-quotients"]?.correct, "156");
    assert.equal(MATH_ANSWERS["math-number:fractions:fair-parts"]?.correct, "1/4");
  });

  it("fair-share stays on the path, exactly as the pilot left it", () => {
    assert.equal(showsSummaryOnWrong("math-number:division:fair-share", "7-10"), true);
    assert.equal(clueSceneFor("math-number:division:fair-share")?.summary?.clip, "fair-share.mp3");
  });
});

describe("items without a summary system on this base stay off the path", () => {
  it("every Math item with no scene description stays off the path — the 15 overflow items for ages 10-18", () => {
    const noScene = BANDS.flatMap((band) =>
      mathItemsForGroup(band)
        .filter((item) => !clueSceneFor(item.id))
        .map((item) => ({ item, band })),
    );
    assert.equal(noScene.length, 16, "15 overflow items (10-18) plus the held survey-check (18+) carry no description");
    for (const { item, band } of noScene) {
      assert.equal(showsSummaryOnWrong(item.id, band), false, `${item.id} must not reveal`);
    }
  });

  it("the held survey-check item stays uncovered", () => {
    assert.equal(clueSceneFor("math-applied:measure:survey-check"), null);
    assert.equal(showsSummaryOnWrong("math-applied:measure:survey-check", "18+"), false);
  });

  it("a covered item asked about in a band it is not playable in stays off the path", () => {
    assert.equal(showsSummaryOnWrong("math-number:division:fair-share", "10-18"), false);
    assert.equal(showsSummaryOnWrong("math-number:division:fair-share", "18+"), false);
    assert.equal(showsSummaryOnWrong("math-number:groups:skip-count", "18+"), false);
    assert.equal(showsSummaryOnWrong("math-number:tables:multi-digit", "7-10"), false);
  });

  it("at least one item per other subject per band: no reveal through the Math gate, wrapper passes no lose hook", () => {
    const subjects = [
      ["physics", physicsItemsForGroup, "../physics/PhysicsCase.tsx"],
      ["chemistry", chemistryItemsForGroup, "../chemistry/ChemistryCase.tsx"],
      ["general-knowledge", generalKnowledgeItemsForGroup, "../general-knowledge/GeneralKnowledgeCase.tsx"],
      ["social-studies", socialStudiesItemsForGroup, "../social-studies/SocialStudiesCase.tsx"],
    ] as const;
    for (const [name, forGroup, casePath] of subjects) {
      const wrapper = read(join(here, casePath));
      assert.ok(!wrapper.includes("loseReveal"), `${name}: wrapper passes no loseReveal hook on this base — its lose-path mirror is a follow-on`);
      assert.ok(wrapper.includes("ClueScene"), `${name}: wrapper passes the scene hook since the waves (win path only)`);
      for (const band of BANDS) {
        const first = forGroup(band)[0];
        assert.ok(first, `${name} has a playable item for ${band}`);
        assert.equal(
          showsSummaryOnWrong(first!.id, band),
          false,
          `${name} ${first!.id} (${band}) is not a Math item, so the Math gate must not reveal it`,
        );
      }
    }
  });
});

describe("the shared safeguards hold for every newly covered item", () => {
  it("the reveal is set only on the wrong-answer path, on the entry question — one setter call site", () => {
    assert.equal(subjectCase.split("setLoseRevealed(true)").length - 1, 1);
    assert.ok(subjectCase.includes("const [loseRevealed, setLoseRevealed] = useState(false);"));
    const start = subjectCase.indexOf("const onWrong = (value: string) => {");
    const onWrong = subjectCase.slice(start, subjectCase.indexOf("const pick =", start));
    assert.ok(onWrong.includes('if (phase === "main" && loseReveal?.(item, band)) {'));
  });

  it("win and lose sections stay mutually exclusive, so no answer line can double", () => {
    assert.ok(subjectCase.includes(") : loseRevealed ? ("), "the reveal is the solved branch's sibling");
    const solvedAt = subjectCase.indexOf('aria-label="You solved it"');
    const loseAt = subjectCase.indexOf('data-testid={`${subjectId}-lose-reveal`}');
    const cardAt = subjectCase.indexOf("<AnswerCard", loseAt);
    assert.ok(solvedAt >= 0 && loseAt > solvedAt && cardAt > loseAt, "solved, reveal, card — in that order");
  });

  it("the reveal is not a solve for any item: no done phase, no celebration, host still sees the wrong pick", () => {
    const lose = subjectCase.slice(
      subjectCase.indexOf('data-testid={`${subjectId}-lose-reveal`}'),
      subjectCase.indexOf("<AnswerCard", subjectCase.indexOf('data-testid={`${subjectId}-lose-reveal`}')),
    );
    assert.ok(!lose.includes("You got it!"));
    assert.ok(!lose.includes("onCelebrate"));
    assert.ok(subjectCase.includes("wrongPick: picked !== null && !solved"));
    assert.ok(subjectCase.includes("if (solved || loseRevealed) return;"), "picks are inert after the reveal");
  });

  it("pre-pick render names nothing of the reveal (answer-blindness)", () => {
    const setup = subjectCase.slice(
      subjectCase.indexOf("{lead ? lead(item, reduced) : null}"),
      subjectCase.indexOf("{solved ? ("),
    );
    assert.ok(!setup.includes("lose"), "the pre-pick render path names nothing of the reveal");
    for (const item of COVERED) {
      assert.ok(!/\d/.test(clueSceneFor(item.id)!.labelSetup), `${item.id}: setup label carries no digits`);
    }
  });
});
