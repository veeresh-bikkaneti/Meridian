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
      subjectCase.includes('scene(item, solved ? "solved" : "setup", reduced, band)'),
      "the scene hook receives the item, the flow-derived phase, reduced and the band",
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
