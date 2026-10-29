/**
 * Mode End game (GeoDetective / Cold Trail) — source pins, same style as
 * game-app-lazy-boundary.test.ts: game-app.tsx is a large component with
 * no unit-render harness in this repo, so the wiring is pinned by reading
 * the source. Runtime behaviour is walked end-to-end by the Playwright
 * specs in tests/e2e/geodetective.spec.ts, coldtrail.spec.ts, and
 * mode-endgame.mobile.spec.ts.
 *
 * Contract (manifest 2026-10-28-endgame-editions, rulings R1/R2/R4/R5):
 * ending from a mode ends the session via the existing session-end path,
 * clears ONLY the mode open flag (the case store is never touched, so the
 * case resumes on return), never calls endRun (it requires a Run), and
 * shows the reused RunSummaryCard from a GameApp-level modeSummary state
 * with Play again omitted.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");
const loopSource = readFileSync(
  join(here, "../game/loop/LoopScreen.tsx"),
  "utf8",
);
const trailSource = readFileSync(
  join(here, "../game/coldtrail/TrailScreen.tsx"),
  "utf8",
);
const summarySource = readFileSync(join(here, "run-summary.tsx"), "utf8");

/** The source between two markers; "" when either marker is absent. */
function segment(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  if (start < 0) return "";
  const end = src.indexOf(to, start + from.length);
  if (end < 0) return "";
  return src.slice(start, end);
}

/**
 * A mode End game button: a shared Button whose onClick is onEndGame and
 * whose accessible name is "End game". Returns the opening tags matched.
 */
function endGameButtons(src: string): string[] {
  const matches = [...src.matchAll(/<Button[^>]*onClick=\{onEndGame\}[^>]*>\s*End game\s*<\/Button>/g)];
  return matches.map((m) => m[0]);
}

describe("mode End game — GameApp branches pass onEndGame", () => {
  it("loop branch passes onEndGame to LoopScreen", () => {
    const branch = segment(gameAppSource, "if (loopOpen)", "if (coldTrailOpen)");
    assert.ok(branch.includes("<LoopScreen"), "loop branch must render LoopScreen");
    assert.ok(branch.includes("onEndGame"), "LoopScreen branch must pass onEndGame");
  });

  it("cold trail branch passes onEndGame to TrailScreen", () => {
    const branch = segment(gameAppSource, "if (coldTrailOpen)", "if (starting)");
    assert.ok(branch.includes("<TrailScreen"), "trail branch must render TrailScreen");
    assert.ok(branch.includes("onEndGame"), "TrailScreen branch must pass onEndGame");
  });
});

describe("mode End game — mode screens render the control", () => {
  it("LoopScreen renders an End game control invoking onEndGame", () => {
    assert.ok(
      loopSource.includes("onEndGame: () => void;"),
      "LoopScreen props must gain onEndGame",
    );
    const buttons = endGameButtons(loopSource);
    assert.ok(buttons.length >= 1, "LoopScreen must render an End game button invoking onEndGame");
    assert.ok(
      buttons.some((b) => b.includes("min-h-[44px]")),
      "LoopScreen End game button must be min-h-[44px]",
    );
  });

  it("TrailScreen renders an End game control invoking onEndGame", () => {
    assert.ok(
      trailSource.includes("onEndGame: () => void"),
      "TrailScreen props must gain onEndGame",
    );
    const buttons = endGameButtons(trailSource);
    assert.ok(buttons.length >= 1, "TrailScreen must render an End game button invoking onEndGame");
    assert.ok(
      buttons.some((b) => b.includes("min-h-[44px]")),
      "TrailScreen End game button must be min-h-[44px]",
    );
    // The leave control is not relabeled: it stays "← All games".
    assert.ok(trailSource.includes("← All games"), "TrailScreen leave control must stay ← All games");
  });

  it("TrailScreen error return renders an End game control", () => {
    const errorReturn = segment(trailSource, "if (!caseData)", "const ringsPlacedCount");
    assert.ok(
      endGameButtons(errorReturn).length >= 1,
      "TrailScreen error return must render an End game control (error return has only ← Back)",
    );
  });
});

describe("mode End game — handler semantics (R1)", () => {
  /** The parameterized mode End game handler body. */
  const handler = segment(gameAppSource, "const handleModeEndGame", "}, [handleEndGame]);");

  it("mode End game never calls endRun", () => {
    assert.ok(handler.length > 0, "mode End game must not call endRun");
    assert.ok(!/\bendRun\s*\(/.test(handler), "mode End game must not call endRun");
  });

  it("loop End game clears only the open flag", () => {
    assert.ok(handler.includes("writeLoopOpen(false)"), "loop End game must writeLoopOpen(false)");
    assert.ok(!handler.includes("clearLoopStore"), "loop End game must not clear the loop store");
    assert.ok(!handler.includes("meridian.loop.v2"), "loop End game must not touch meridian.loop.v2");
  });

  it("cold trail End game clears only the open flag", () => {
    assert.ok(handler.includes("writeColdTrailOpen(false)"), "cold trail End game must writeColdTrailOpen(false)");
    assert.ok(!handler.includes("clearColdtrailStore"), "cold trail End game must not clear the cold trail store");
    assert.ok(
      !handler.includes("meridian.coldtrail.v2"),
      "cold trail End game must not touch meridian.coldtrail.v2",
    );
  });
});

describe("mode End game — accessibility cure (panel BLOCK 1, cycle 4)", () => {
  it("mode End game announces the totals on the persistent announcer", () => {
    const handler = segment(gameAppSource, "const handleModeEndGame", "const handleModeSummaryDone");
    assert.ok(handler.length > 0, "mode End game handler must exist");
    assert.ok(
      handler.includes("setMapModeAnnouncement"),
      "mode End game must set the persistent mapModeAnnouncer (Play's live region unmounts with run === null)",
    );
    assert.ok(handler.includes("Game over."), "mode announcement must mirror classic's Game-over format");
    assert.ok(handler.includes("placesPlayed"), "mode announcement must carry places played");
    assert.ok(handler.includes("totalScore"), "mode announcement must carry the total score");
  });

  it("mode summary mount moves focus inside the dialog, classic untouched", () => {
    const effect = segment(gameAppSource, "Mode-only summary mount focus", "}, [modeSummary]);");
    assert.ok(effect.length > 0, "a mode-only summary-mount focus effect must exist");
    assert.ok(effect.includes("if (!modeSummary) return;"), "focus effect must run only for mode summaries");
    assert.ok(effect.includes('summary-done'), "mode summary mount focus must land on Done inside the dialog");
    assert.ok(effect.includes("preventScroll"), "mode summary mount focus must not scroll the page");
    // Classic summaries pass nothing new: the card's own focus fallback is
    // untouched, and no autofocus prop is added to RunSummaryCard.
    assert.ok(!summarySource.includes("autoFocus"), "classic summaries must gain no autofocus");
  });

  it("mode summary captures dateKey at End game time, not render time", () => {
    const handler = segment(gameAppSource, "const handleModeEndGame", "const handleModeSummaryDone");
    assert.ok(handler.includes("trailDate()"), "mode End game must capture dateKey via trailDate()");
    assert.ok(handler.includes("dateKey"), "mode End game must store the captured dateKey on the summary");
    const branch = segment(gameAppSource, "if (modeSummary)", "if (loopOpen)");
    assert.ok(
      branch.includes("dateKey={modeSummary.dateKey}"),
      "mode summary must pass the captured modeSummary.dateKey, not trailDate() at render time",
    );
  });
});

describe("mode End game — GameApp-level summary branch (R1/R2/R4)", () => {
  it("mode summary state lives in GameApp, branch outranks home", () => {
    const gameAppStart = gameAppSource.indexOf("export function GameApp()");
    const decl = gameAppSource.indexOf(
      "const [modeSummary, setModeSummary] = useState<(SessionSummary & { dateKey: string }) | null>(null);",
    );
    const playStart = gameAppSource.indexOf("function Play({");
    assert.ok(gameAppStart >= 0 && decl > gameAppStart, "modeSummary state must live in GameApp");
    assert.ok(playStart < 0 || decl < playStart, "modeSummary state must not live in PlayLoaded");
    const runBranch = gameAppSource.indexOf("if (run)");
    const summaryBranch = gameAppSource.indexOf("if (modeSummary)");
    const loopBranch = gameAppSource.indexOf("if (loopOpen)");
    assert.ok(
      runBranch >= 0 && summaryBranch > runBranch && summaryBranch < loopBranch,
      "summary must render with run === null",
    );
    const branch = segment(gameAppSource, "if (modeSummary)", "if (loopOpen)");
    assert.ok(branch.includes("<RunSummaryCard"), "mode summary branch must reuse RunSummaryCard");
  });

  it("mode summary Done clears the summary without clearing case stores", () => {
    const done = segment(gameAppSource, "const handleModeSummaryDone", "}, [replaceSession]);");
    assert.ok(done.includes("setModeSummary(null)"), "mode Done must setModeSummary(null)");
    assert.ok(done.includes("setStartError(null)"), "mode Done must setStartError(null)");
    assert.ok(
      done.includes("landHomeFocusRef.current = true"),
      "mode Done must land focus on the home heading (landHomeFocus pattern applies cleanly here)",
    );
    assert.ok(!done.includes("clearLoopStore"), "mode Done must not clear the loop store");
    assert.ok(!done.includes("clearColdtrailStore"), "mode Done must not clear the cold trail store");
  });

  it("mode summary omits Play again, pins fallback props", () => {
    const branch = segment(gameAppSource, "if (modeSummary)", "if (loopOpen)");
    assert.ok(branch.includes("showPlayAgain={false}"), "mode summary must pass showPlayAgain={false}");
    assert.ok(branch.includes("onPlayAgain={"), "mode summary must pass onPlayAgain (required by type)");
    assert.ok(branch.includes("required by type"), "mode summary onPlayAgain must carry the noop comment");
    assert.ok(branch.includes("modeSummary.regions"), "mode summary must derive regionName from summary.regions");
    assert.ok(branch.includes('"Meridian"'), 'mode summary regionName must fall back to "Meridian"');
    assert.ok(
      branch.includes("dateKey={modeSummary.dateKey}"),
      "mode summary dateKey must be the value captured at End game time (see accessibility-cure test)",
    );
    assert.ok(branch.includes("challengeUrl={null}"), "mode summary must pass challengeUrl={null}");
    assert.ok(branch.includes("growth={null}"), "mode summary must pass growth={null}");
    assert.ok(!branch.includes("onReview"), "mode summary must omit onReview");
    // Card side: optional prop defaults to classic behavior; focus falls
    // back to Done (which gains a data-testid) when Play again is hidden.
    assert.ok(summarySource.includes("showPlayAgain"), "RunSummaryCard must gain a showPlayAgain prop");
    assert.ok(
      summarySource.includes("showPlayAgain = true"),
      "RunSummaryCard showPlayAgain must default to true (classic unchanged)",
    );
    assert.ok(summarySource.includes('data-testid="summary-done"'), "Done button must gain a data-testid");
    const focus = segment(summarySource, "const focusPlayAgain", "};");
    assert.ok(focus.includes("play-again"), "focus fallback must try Play again first");
    assert.ok(focus.includes("summary-done"), "focus fallback must fall back to Done");
  });
});
