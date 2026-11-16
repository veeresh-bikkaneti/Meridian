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
const gkCase = read(join(here, "..", "general-knowledge", "GeneralKnowledgeCase.tsx"));
const physicsCase = read(join(here, "..", "physics", "PhysicsCase.tsx"));
const chemistryCase = read(join(here, "..", "chemistry", "ChemistryCase.tsx"));
const socialStudiesCase = read(join(here, "..", "social-studies", "SocialStudiesCase.tsx"));
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

  it("the math case gates the scenes to ages 7-10, 10-18 and 18+ with a description", () => {
    assert.ok(mathCase.includes('if (band !== "7-10" && band !== "10-18" && band !== "18+") return null;'));
    assert.ok(mathCase.includes("clueSceneFor(item.id)"));
    assert.ok(mathCase.includes("<ClueScene"));
  });

  it("the general-knowledge case gates the scenes to ages 7-10, 10-18 and 18+ with a description", () => {
    assert.ok(gkCase.includes('if (band !== "7-10" && band !== "10-18" && band !== "18+") return null;'));
    assert.ok(gkCase.includes("clueSceneFor(item.id)"));
    assert.ok(gkCase.includes("<ClueScene"));
    assert.ok(gkCase.includes("resultExtra={"), "general knowledge passes the hook");
    assert.ok(gkCase.includes("ClueSummaryText"), "as the summary's standing text");
  });

  it("the physics case gates the scenes to ages 7-10, 10-18 and 18+ with a description", () => {
    assert.ok(physicsCase.includes('if (band !== "7-10" && band !== "10-18" && band !== "18+") return null;'));
    assert.ok(physicsCase.includes("clueSceneFor(item.id)"));
    assert.ok(physicsCase.includes("<ClueScene"));
    assert.ok(physicsCase.includes("resultExtra={"), "physics passes the hook");
    assert.ok(physicsCase.includes("ClueSummaryText"), "as the summary's standing text");
  });

  it("the social-studies case gates the scenes to ages 7-10, 10-18 and 18+ with a description", () => {
    assert.ok(socialStudiesCase.includes('if (band !== "7-10" && band !== "10-18" && band !== "18+") return null;'));
    assert.ok(socialStudiesCase.includes("clueSceneFor(item.id)"));
    assert.ok(socialStudiesCase.includes("<ClueScene"));
    assert.ok(socialStudiesCase.includes("resultExtra={"), "social studies passes the hook");
    assert.ok(socialStudiesCase.includes("ClueSummaryText"), "as the summary's standing text");
  });

  it("the chemistry case gates the scenes to ages 7-10, 10-18 and 18+ with a description", () => {
    assert.ok(chemistryCase.includes('if (band !== "7-10" && band !== "10-18" && band !== "18+") return null;'));
    assert.ok(chemistryCase.includes("clueSceneFor(item.id)"));
    assert.ok(chemistryCase.includes("<ClueScene"));
    assert.ok(chemistryCase.includes("resultExtra={"), "chemistry passes the hook");
    assert.ok(chemistryCase.includes("ClueSummaryText"), "as the summary's standing text");
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
    // The one other sanctioned use (feat/fair-share-lose-path,
    // generalised by feat/lose-path-all-items): the
    // lose-reveal section renders the same standing text after a
    // wrong pick on a lose-path item — also post-pick only.
    const loseAt = subjectCase.indexOf('data-testid={`${subjectId}-lose-reveal`}');
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

describe("wave 2 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-2 kind", () => {
    for (const kind of [
      "array-grid",
      "scale-line",
      "percent-bar",
      "map-scale",
      "fraction-bar",
      "fraction-measure",
      "rate-bars",
      "journey-line",
      "spend-then-group",
      "bearing-diagram",
    ]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-2 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "ArrayGridScene"],
      [kindsA, "ScaleLineScene"],
      [kindsA, "PercentBarScene"],
      [kindsB, "MapScaleScene"],
      [kindsB, "FractionBarScene"],
      [kindsB, "FractionMeasureScene"],
      [kindsC, "RateBarsScene"],
      [kindsC, "JourneyLineScene"],
      [kindsC, "SpendThenGroupScene"],
      [kindsC, "BearingDiagramScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("chunk-share renders many shares on its compact plate grid", () => {
    assert.ok(kindsC.includes("description.shares > 8"), "the compact branch exists");
    assert.ok(kindsC.includes("platePos"), "one plate per share");
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

describe("wave 3 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-3 kind", () => {
    for (const kind of ["share-bar", "timeline-line", "tower-measure"]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-3 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "ShareBarScene"],
      [kindsB, "TimelineLineScene"],
      [kindsC, "TowerMeasureScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("split-product renders many rows on its compact branch", () => {
    assert.ok(kindsC.includes("rows > 8"), "the compact branch exists");
    assert.ok(kindsC.includes("compact"), "compact bars keep every row in frame");
  });
});

describe("wave 4 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-4 kind", () => {
    for (const kind of ["push-duel", "tile-steps", "slide-stop", "cup-shove", "seesaw-lift"]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-4 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "PushDuelScene"],
      [kindsA, "TileStepsScene"],
      [kindsB, "SlideStopScene"],
      [kindsB, "CupShoveScene"],
      [kindsC, "SeesawLiftScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("tile-steps reuses one hopper for the single box and both race carts", () => {
    assert.ok(kindsA.includes("rivalTilesPerStep === undefined"), "the single-box branch exists");
    assert.ok(kindsA.includes("cs-counter-step"), "landed hops fade as the next hop takes over");
  });
});

describe("wave 5 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-5 kind", () => {
    for (const kind of ["magnet-pair", "drop-fall", "wind-up", "light-path"]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-5 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "MagnetPairScene"],
      [kindsA, "WindUpScene"],
      [kindsB, "DropFallScene"],
      [kindsC, "LightPathScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("light-path reuses one renderer for the card and no-card items", () => {
    assert.ok(kindsC.includes("withCard"), "the card is the kind's own data");
    assert.ok(kindsC.includes("phase === \"setup\""), "the setup film draws no ray path");
  });
});

describe("wave 6 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-6 kind", () => {
    for (const kind of ["rate-race", "slope-pair", "same-push", "hill-carts", "sound-path", "energy-ledger"]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-6 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "RateRaceScene"],
      [kindsA, "SamePushScene"],
      [kindsB, "SlopePairScene"],
      [kindsB, "HillCartsScene"],
      [kindsB, "SoundPathScene"],
      [kindsC, "EnergyLedgerScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("the wave-6 reuse variants are data branches, not new kinds", () => {
    assert.ok(kindsA.includes("twoPairs"), "magnet-pair carries the two-pair variant data");
    assert.ok(kindsB.includes("stopsDead"), "cup-shove carries the stops-dead variant data");
    assert.ok(kindsC.includes("threeMaterials"), "light-path carries the three-materials variant data");
  });
});

describe("wave 7 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-7 kind", () => {
    for (const kind of [
      "melt-freeze",
      "bend-test",
      "magnet-sort",
      "rebuild-pieces",
      "salt-melt",
      "dissolve",
      "particle-states",
      "water-cycle",
    ]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-7 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "MeltFreezeScene"],
      [kindsA, "BendTestScene"],
      [kindsB, "MagnetSortScene"],
      [kindsB, "RebuildPiecesScene"],
      [kindsC, "SaltMeltScene"],
      [kindsC, "DissolveScene"],
      [kindsC, "ParticleStatesScene"],
      [kindsC, "WaterCycleScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("the wave-7 reuse variants are data branches, not new kinds", () => {
    assert.ok(kindsA.includes("description.freeze"), "melt-freeze carries the freeze direction data");
    assert.ok(kindsC.includes("threeBlocks"), "dissolve carries the three-blocks variant data");
  });
});

describe("wave 8 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-8 kind", () => {
    for (const kind of [
      "scale-balance",
      "bubble-reaction",
      "rust-change",
      "glow-rate",
      "atom-tally",
      "column-cousins",
    ]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-8 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "ScaleBalanceScene"],
      [kindsA, "BubbleReactionScene"],
      [kindsB, "RustChangeScene"],
      [kindsB, "GlowRateScene"],
      [kindsC, "AtomTallyScene"],
      [kindsC, "ColumnCousinsScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });
});

describe("wave 9 kinds", () => {
  const kindsA = read(join(here, "clue-scene-kinds-a.tsx"));
  const kindsB = read(join(here, "clue-scene-kinds-b.tsx"));
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-9 kind", () => {
    for (const kind of [
      "compass-walk",
      "density-towns",
      "two-roads",
      "zone-clocks",
      "globe-vs-map",
      "great-circle",
      "cost-compare",
    ]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-9 kind accepts the summary pacing prop", () => {
    for (const [source, name] of [
      [kindsA, "CompassWalkScene"],
      [kindsA, "DensityTownsScene"],
      [kindsB, "TwoRoadsScene"],
      [kindsB, "ZoneClocksScene"],
      [kindsC, "GlobeVsMapScene"],
      [kindsC, "GreatCircleScene"],
      [kindsC, "CostCompareScene"],
    ] as const) {
      assert.ok(source.includes(`function ${name}(`), `${name} exists`);
      assert.ok(source.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("the wave-9 reuse variants are data branches, not new kinds", () => {
    assert.ok(kindsA.includes("secondRows"), "array-grid carries the two-fields variant data");
    assert.ok(kindsB.includes("segmentPx"), "map-scale carries the narrow-segment variant data");
  });
});

describe("wave 10 kinds", () => {
  const kindsC = read(join(here, "clue-scene-kinds-c.tsx"));

  it("the renderer dispatches every wave-10 kind", () => {
    for (const kind of ["stack-drops", "angle-sight", "flow-counter"]) {
      assert.ok(scene.includes(`case "${kind}":`), `SceneArt dispatches ${kind}`);
      assert.ok(scene.includes(`"${kind}":`), `SUMMARY_STAGGER paces ${kind}`);
    }
  });

  it("every wave-10 kind accepts the summary pacing prop", () => {
    for (const name of ["StackDropsScene", "AngleSightScene", "FlowCounterScene"] as const) {
      assert.ok(kindsC.includes(`function ${name}(`), `${name} exists`);
      assert.ok(kindsC.includes("stepDelay"), `${name} accepts stepDelay`);
    }
  });

  it("the wave-10 reuses are existing kinds, not forks", () => {
    assert.ok(kindsC.includes("function GreatCircleScene("), "great-circle stays the shared kind");
    assert.ok(kindsC.includes("function JourneyLineScene("), "journey-line stays the shared kind");
  });
});
