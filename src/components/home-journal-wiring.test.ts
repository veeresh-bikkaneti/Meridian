/**
 * Item 42 (PR #522): the journal rotation must pause while the journal
 * is on screen — the wiring in game-app.tsx.
 *
 * home-journal.test.ts pins the pure blocker logic
 * (shouldApplySetChange honours journalOnScreen). This test pins the
 * other half: game-app.tsx actually FEEDS that blocker from an
 * IntersectionObserver over the teaser card and the journal section,
 * and recomputes the moment both leave the screen so a deferred entry
 * can land. Reverting the game-app.tsx wiring (the observer effect or
 * the blockers line) turns this test red; before it existed, that
 * revert turned nothing red.
 *
 * Same source-pinning style as home-journal-heading.test.ts (this
 * repo has no React-render harness).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameApp = readFileSync(join(here, "game-app.tsx"), "utf8");

describe("journal on-screen wiring (item 42)", () => {
  it("the rotation's blockers read the on-screen ref fresh at every recompute", () => {
    assert.ok(
      gameApp.includes("journalOnScreen: journalOnScreenRef.current,"),
      "createJournalRotation blockers include journalOnScreen from the ref",
    );
  });

  it("an IntersectionObserver watches the teaser card and the journal section", () => {
    assert.ok(gameApp.includes("new IntersectionObserver("), "observer is constructed");
    assert.ok(
      gameApp.includes('document.querySelector(\'[data-testid="journal-card"]\')'),
      "teaser card is a watched target",
    );
    assert.ok(
      gameApp.includes('document.getElementById("home-journal")'),
      "journal section is a watched target",
    );
    assert.ok(
      gameApp.includes("journalOnScreenRef.current = visible.size > 0;"),
      "the ref tracks whether either target is on screen",
    );
  });

  it("leaving the screen recomputes immediately instead of waiting for the tick", () => {
    assert.ok(
      gameApp.includes("if (wasOnScreen && !journalOnScreenRef.current) journalRotation.recompute();"),
      "the on-screen → off-screen edge calls journalRotation.recompute()",
    );
  });
});
