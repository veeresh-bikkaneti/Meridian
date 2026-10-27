/**
 * #188 — Scout switched-notice lifecycle (source pin).
 *
 * The visible "You switched to … Your score is kept." notice
 * (`mapSwitchedNote`) is set by a manual in-game map flip and retired
 * by later flips (home flip, runtime switch). Session END must retire
 * it too: after an idle-kill or an End-game summary, a standing notice
 * would read stale beside the idle-ended notice — or carry into the
 * fresh session — because the score it says was kept is gone.
 *
 * This is React state wiring inside GameApp that needs a browser to
 * render end-to-end, so — in the repo's established source-pin style
 * (cf. game-app-lazy-boundary.test.ts) — this file pins the wiring;
 * the behavioral half is the Playwright pin in
 * tests/e2e/scout-notice-session-end.desktop.spec.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

/** The source between two markers (both must exist). */
function segment(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `segment start missing: ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end >= 0, `segment end missing: ${to}`);
  return src.slice(start, end);
}

describe("#188 switched notice is retired when the session ends", () => {
  it("killIdleSession clears mapSwitchedNote", () => {
    const kill = segment(
      gameAppSource,
      "const killIdleSession = useCallback(",
      "useEffect(() => {\n    // Observability boot",
    );
    assert.ok(
      kill.includes("setMapSwitchedNote(null);"),
      "killIdleSession must retire the switched notice (#188)",
    );
    assert.ok(
      kill.includes("setIdleEndedNote(true);"),
      "control: the idle-ended note still shows (only the stale switched notice goes)",
    );
  });

  it("the summary-done path clears mapSwitchedNote", () => {
    const done = segment(
      gameAppSource,
      "onSummaryDone={() => {",
      "onReplayed={() => {",
    );
    assert.ok(
      done.includes("setMapSwitchedNote(null);"),
      "the End-game summary-done path must retire the switched notice (#188)",
    );
  });

  it("the other summary exits (Play again, Review) clear it too", () => {
    const replayed = segment(
      gameAppSource,
      "onReplayed={() => {",
      "onReviewDeck={handleReviewDeck}",
    );
    assert.ok(
      replayed.includes("setMapSwitchedNote(null);"),
      "Play again starts a fresh session — it must not inherit the notice (#188)",
    );
    const review = segment(
      gameAppSource,
      "const handleReviewDeck = useCallback(",
      "const onTakeTour = useCallback(",
    );
    assert.ok(
      review.includes("setMapSwitchedNote(null);"),
      "the review session replaces the ended one — the notice must not resurface after it (#188)",
    );
  });

  it("control: a manual in-game flip still SETS the notice", () => {
    const manual = segment(
      gameAppSource,
      "const handleManualMapMode = useCallback(",
      "const handleHomeMapMode = useCallback(",
    );
    assert.ok(
      manual.includes("setMapSwitchedNote(mode);"),
      "the manual flip must still set the notice — #188 retires it at session end only",
    );
  });
});
