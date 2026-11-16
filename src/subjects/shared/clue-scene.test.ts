/**
 * ClueScene (feat/clue-scene-pilot) — source pins in the repo's
 * style (no React-render harness; the visual behaviour is covered
 * against the built app). The pins that matter:
 *
 * - Answer-blindness is structural: SubjectCase hands the scene
 *   hook the item, a phase derived from its own flow state, the
 *   reduced-motion flag and the band — never the answer — and
 *   ClueScene's props are exactly { description, phase, reduced }.
 * - Reduced motion renders the still frame (data-still + the CSS
 *   that freezes every animation and keeps only the final tick).
 * - The film pauses off screen and when the tab hides, has a
 *   Replay button, and the SVG is labelled for the phase shown.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

const scene = read(join(here, "ClueScene.tsx"));
const subjectCase = read(join(here, "SubjectCase.tsx"));
const mathCase = read(join(here, "..", "math", "MathCase.tsx"));
const styles = read(join(here, "..", "..", "styles.css"));

describe("clue scene wiring", () => {
  it("SubjectCase passes only the phase, never the answer", () => {
    assert.ok(
      subjectCase.includes("scene(item, scenePhase, reduced, band)"),
      "the scene hook receives the item, the flow-derived phase, reduced and the band",
    );
    assert.ok(
      subjectCase.includes('const scenePhase: "setup" | "solved" = solved || loseRevealed ? "solved" : "setup";'),
      "the phase is solved once the case is done or a lose-path wrong pick has revealed the summary",
    );
    assert.ok(
      subjectCase.includes('phase: "setup" | "solved"'),
      "the hook's phase type is the two-phase contract",
    );
  });

  it("ClueScene's props are exactly description, phase and reduced", () => {
    const start = scene.indexOf("export function ClueScene({");
    const end = scene.indexOf("}) {", start);
    const props = scene.slice(start, end);
    assert.ok(props.includes("description,"));
    assert.ok(props.includes("phase,"));
    assert.ok(props.includes("reduced,"));
    for (const banned of ["answer", "correct", "picked", "choice"]) {
      assert.ok(!props.toLowerCase().includes(banned), `props must not carry ${banned}`);
    }
  });

  it("the math case gates the pilot to ages 7-10 with a description", () => {
    assert.ok(mathCase.includes('if (band !== "7-10") return null;'));
    assert.ok(mathCase.includes("clueSceneFor(item.id)"));
    assert.ok(mathCase.includes("<ClueScene"));
  });

  it("reduced motion renders the still frame of the current phase", () => {
    assert.ok(scene.includes('data-still={reduced ? "true" : undefined}'));
    assert.ok(
      styles.includes('.clue-scene[data-still="true"] svg *'),
      "the still frame freezes every scene animation",
    );
    assert.ok(
      styles.includes('.clue-scene[data-still="true"] .cs-draw'),
      "the still frame forces the draw-on strokes drawn (they rest undrawn)",
    );
    assert.ok(styles.includes(".clue-scene[data-still=\"true\"] .cs-tick-final"));
    // The Replay control is not offered when nothing can move.
    assert.ok(scene.includes("{!reduced ? ("));
  });

  it("the film pauses off screen and when the tab is hidden", () => {
    assert.ok(scene.includes("new IntersectionObserver"));
    assert.ok(scene.includes('document.addEventListener("visibilitychange"'));
    assert.ok(styles.includes('.clue-scene[data-paused="true"] svg *'));
  });

  it("the SVG is labelled for the phase, and the film can replay", () => {
    assert.ok(scene.includes('role="img"'));
    assert.ok(scene.includes('phase === "setup" ? description.labelSetup : description.labelSolved'));
    assert.ok(scene.includes("Replay the film"));
    assert.ok(scene.includes('data-testid="clue-scene"'));
  });
});

describe("clue scene summary (act 3)", () => {
  it("the summary is read only in the solved phase", () => {
    // The one render-path read of the summary data is phase-gated,
    // and the performance itself refuses to start pre-solve — so
    // no script line, caption or clip reference renders in setup.
    assert.ok(scene.includes('phase === "solved" ? description.summary : undefined'));
    assert.ok(scene.includes('if (!sum || phase !== "solved") return;'));
    assert.ok(scene.includes('data-testid="clue-scene-caption"'));
    assert.ok(scene.includes('data-testid="clue-summary-play"'));
  });

  it("the narration plays only through the shared voice channel", () => {
    assert.ok(scene.includes('claimVoice('), "the summary claims the voice channel");
    assert.ok(scene.includes('"clue-summary"'), "under its own owner name");
    assert.ok(scene.includes("audio/subjects/"), "clips ship under public/audio/subjects/");
    assert.ok(scene.includes("isSoundEnabled()"), "the sound toggle gates the voice");
  });

  it("autoplay respects the kid's read-aloud choice", () => {
    assert.ok(scene.includes("getReadAloudPref()"));
    assert.ok(
      scene.includes('pref !== "sometimes" && pref !== "never"'),
      "sometimes/never are tap-to-play: no automatic narration",
    );
  });

  it("autoplay never fires under reduced motion", () => {
    assert.ok(
      scene.includes('description.summary && !reduced && pref !== "sometimes"'),
      "reduced motion: the summary waits for the Hear button",
    );
    assert.ok(
      scene.includes("setCaptionStep(finished && sum ? sum.lines.length - 1 : -1)"),
      "a natural finish leaves the closing caption standing",
    );
  });

  it("the full script stands in the result section, via the post-solve hook only", () => {
    const resultAt = subjectCase.indexOf('aria-label="You solved it"');
    const extraAt = subjectCase.indexOf("resultExtra ? resultExtra(item, reduced, band) : null");
    assert.ok(resultAt >= 0, "the result section exists");
    assert.ok(extraAt > resultAt, "resultExtra renders first inside the solved result section");
    // The one other sanctioned use (feat/fair-share-lose-path): the
    // lose-reveal section renders the same standing text after a
    // wrong pick on the one lose-path item — also post-pick only.
    const loseAt = subjectCase.indexOf('data-testid={`${testIdPrefix}-lose-reveal`}');
    const loseExtraAt = subjectCase.indexOf(
      "resultExtra ? resultExtra(item, reduced, band) : null",
      extraAt + 1,
    );
    assert.ok(loseAt > extraAt, "the lose-reveal section follows the solved section in source");
    assert.ok(loseExtraAt > loseAt, "the lose reveal's standing text renders inside its section");
    assert.ok(mathCase.includes("resultExtra={"), "math passes the hook");
    assert.ok(mathCase.includes("ClueSummaryText"), "as the summary's standing text");
    assert.ok(scene.includes('data-testid="clue-summary-text"'));
  });
});

describe("wave 1 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every kind, pilot and wave 1", () => {
    for (const kind of [
      "coin-groups",
      "pencil-packs",
      "fair-share",
      "bus-boarding",
      "pack-boxes",
      "place-value",
      "place-compare",
      "rounding-line",
      "digit-shift",
      "split-product",
      "chunk-share",
    ]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-1 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "BusBoardingScene"],
      [kindsA, "PackBoxesScene"],
      [kindsB, "PlaceValueScene"],
      [kindsB, "PlaceCompareScene"],
      [kindsB, "DigitShiftScene"],
      [kindsC, "RoundingLineScene"],
      [kindsC, "SplitProductScene"],
      [kindsC, "ChunkShareScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("the wave-1 kinds' styles ride in the same stylesheet", () => {
    for (const cls of [".cs-bus", ".cs-grow", ".cs-dim", ".cs-counter", ".cs-stone", ".cs-bar"]) {
      assert.ok(styles.includes(cls), `styles carry ${cls}`);
    }
    // Chunk-share's intermediate counters must stay hidden in the
    // still frame (they rest faded only while animations run).
    assert.ok(
      styles.includes('.clue-scene[data-still="true"] .cs-counter-step'),
      "the still frame hides the intermediate chunk counters",
    );
  });
});
