/**
 * TD-15.1 — when the lose reveal appears, focus moves to that panel
 * and the answer is spoken once.
 *
 * The visible support line and answer line stay plain text. One
 * sr-only status region is the announcer (the designated-announcer
 * idea: a second live region on the same sentence would speak it
 * twice). The win section is left alone.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const subjectCase = readFileSync(join(here, "SubjectCase.tsx"), "utf8");

function losePanel(): string {
  const marker = 'data-testid={`${subjectId}-lose-reveal`}';
  const at = subjectCase.indexOf(marker);
  const start = subjectCase.lastIndexOf("<section", at);
  const end = subjectCase.indexOf("</section>", at);
  assert.ok(start >= 0 && end > start, "lose reveal section exists");
  return subjectCase.slice(start, end);
}

describe("TD-15.1 lose reveal is focused and announced once", () => {
  it("focus moves to the reveal panel when it shows, without scrolling", () => {
    const panel = losePanel();
    assert.ok(panel.includes("ref={loseRevealRef}"), "the reveal panel is the focus target");
    assert.ok(panel.includes("tabIndex={-1}"), "the panel can take focus without joining the tab order");
    assert.ok(
      panel.includes('aria-label="The answer, and how it solves"'),
      "the panel keeps its existing name",
    );
    const readRef = subjectCase.indexOf("const el = loseRevealRef.current;");
    assert.ok(readRef >= 0, "an effect reads the reveal panel");
    const effect = subjectCase.slice(readRef - 80, readRef + 220);
    assert.ok(effect.includes("if (!loseRevealed) return;"), "focus moves only once the reveal is showing");
    assert.ok(
      effect.includes("el.focus({ preventScroll: true })"),
      "focus lands with preventScroll so the page does not jump",
    );
    assert.ok(effect.includes("}, [loseRevealed]);"), "the move runs when the reveal flips on");
    // Arrival focus on the case heading stays a mount-only effect.
    assert.ok(subjectCase.includes("headingRef.current"));
    assert.ok(subjectCase.includes("}, []);"), "the heading focus effect still runs only on arrival");
  });

  it("the answer is one live announcement, and the visible lines are not a second one", () => {
    assert.equal(
      subjectCase.split('role="status"').length - 1,
      1,
      "one status region in the case, not two",
    );
    assert.equal(subjectCase.split("aria-live").length - 1, 0, "role=status is the only live channel");
    const answerSentence = "The answer is ${answer.correct} — here's how.";
    assert.equal(
      subjectCase.split(answerSentence).length - 1,
      1,
      "the announcement is the answer sentence, once",
    );
    const announcerAt = subjectCase.indexOf('data-testid={`${subjectId}-lose-announcer`}');
    assert.ok(announcerAt >= 0, "the announcer has a stable test id");
    const announcer = subjectCase.slice(announcerAt - 180, announcerAt + 280);
    assert.ok(announcer.includes('role="status"'), "the announcer is the status region");
    assert.ok(announcer.includes("sr-only"), "the announcer is not visible chrome");
    assert.ok(
      announcer.includes("loseRevealed ?"),
      "the announcer stays empty until the reveal",
    );
    assert.ok(announcer.includes(answerSentence), "that one region carries the answer");
    assert.ok(announcer.includes("LOSE_SUPPORT_LINE"), "the same announcement includes the support line");

    const panel = losePanel();
    const answerP = panel.slice(
      panel.indexOf('data-testid={`${subjectId}-lose-answer`}'),
      panel.indexOf("</p>", panel.indexOf('data-testid={`${subjectId}-lose-answer`}')),
    );
    assert.ok(!answerP.includes("role="), "visible answer line is not a live region");
    assert.ok(!answerP.includes("aria-live"), "visible answer line is not a live region");
    const supportP = panel.slice(
      panel.indexOf('data-testid={`${subjectId}-lose-support`}'),
      panel.indexOf("</p>", panel.indexOf('data-testid={`${subjectId}-lose-support`}')),
    );
    assert.ok(!supportP.includes("role="), "visible support line is not a live region");
    assert.ok(panel.includes("{LOSE_SUPPORT_LINE}"), "visible support copy stays");
    assert.ok(panel.includes("here's how."), "visible answer copy stays");
  });

  it("the win path does not gain this announcer", () => {
    const loseMarker = subjectCase.indexOf('data-testid={`${subjectId}-lose-reveal`}');
    const solved = subjectCase.slice(
      subjectCase.indexOf('aria-label="You solved it"'),
      subjectCase.lastIndexOf("<section", loseMarker),
    );
    assert.ok(!solved.includes('role="status"'));
    assert.ok(!solved.includes("lose-announcer"));
    assert.ok(!solved.includes("loseRevealRef"));
    assert.ok(solved.includes("You got it!"));
  });
});
