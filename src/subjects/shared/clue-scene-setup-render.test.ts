/**
 * Setup films are answer-blind (Nov 15 review). Renders every
 * subject item's clue scene in its setup phase and fails when the
 * drawing already carries the answer:
 *
 * - a drawn count (elements sharing a tag and class) equals a
 *   numeric answer of 3 or more;
 * - a drawn length ratio (marker positions measured from the
 *   leftmost marker) equals a numeric answer of 2 or more;
 * - for a size-comparison answer, two land shapes in one view
 *   differ in area by at least the ratio the answer asserts.
 *
 * Answer-derived parts belong to the solved phase only.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { captionText, type ClueSceneDescription } from "./clue-scene-types.ts";
import type { AnswerEntry } from "./answer.ts";
import { MATH_CLUE_SCENES } from "../math/scenes.ts";
import { MATH_ANSWERS } from "../math/answers.ts";
import { PHYSICS_CLUE_SCENES } from "../physics/scenes.ts";
import { PHYSICS_ANSWERS } from "../physics/answers.ts";
import { CHEMISTRY_CLUE_SCENES } from "../chemistry/scenes.ts";
import { CHEMISTRY_ANSWERS } from "../chemistry/answers.ts";
import { GENERAL_KNOWLEDGE_CLUE_SCENES } from "../general-knowledge/scenes.ts";
import { GENERAL_KNOWLEDGE_ANSWERS } from "../general-knowledge/answers.ts";
import { SOCIAL_STUDIES_CLUE_SCENES } from "../social-studies/scenes.ts";
import { SOCIAL_STUDIES_ANSWERS } from "../social-studies/answers.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** Size-comparison items: the area ratio the correct answer asserts.
 * Setup may not draw two lands this far apart in one view. */
const SIZE_TRUTH: Record<string, number> = {
  "social-studies:region:flat-map-area": 3,
};

/** Pilot and wave-1 scenes already on main whose setup shows every
 * given object, so counting the givens reaches the answer (packs of
 * pencils, the sandbox border's unit marks). Listed for the owner in
 * the replacement PR, not part of this chain. */
const KNOWN_ON_MAIN = new Set<string>([
  "math-number:tables:facts",
  "math-number:groups:equal-groups",
  "math-applied:measure:perimeter",
]);

type Render = (description: ClueSceneDescription) => string;

function loadRenderer(): Render {
  const out = join(mkdtempSync(join(tmpdir(), "clue-setup-")), "render.cjs");
  const result = buildSync({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { ClueScene } from "./ClueScene.tsx";
        export const render = (description) =>
          renderToStaticMarkup(createElement(ClueScene, { description, phase: "setup", reduced: true }));
      `,
      resolveDir: here,
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".css": "empty", ".mp3": "empty" },
    write: false,
    logLevel: "silent",
  });
  writeFileSync(out, result.outputFiles[0].text);
  const mod = createRequire(import.meta.url)(out) as { render: Render };
  return mod.render;
}

type Shape = { tag: string; cls: string; attrs: string };

function shapes(svg: string): Shape[] {
  const body = svg.slice(svg.indexOf("<svg"));
  const found: Shape[] = [];
  for (const m of body.matchAll(/<(rect|circle|ellipse|path|text|line|polygon)\b([^>]*)>/g)) {
    const cls = /class="([^"]*)"/.exec(m[2])?.[1] ?? "";
    found.push({ tag: m[1], cls, attrs: m[2] });
  }
  return found;
}

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.01);

/** Marker poles: vertical strokes (M x y L x y2), the flags a scene
 * plants along a line, and the scene's origin: the leftmost pole,
 * actor (translate) or round figure (cx). */
function markers(svg: string): { origin: number; poles: number[] } {
  const poles = new Set<number>();
  for (const m of svg.matchAll(/d="M(-?[\d.]+) -?[\d.]+ L(-?[\d.]+) -?[\d.]+"/g)) {
    if (Number(m[1]) === Number(m[2])) poles.add(Number(m[1]));
  }
  const xs = [...poles];
  for (const m of svg.matchAll(/translate\((-?[\d.]+)[ ,]/g)) xs.push(Number(m[1]));
  for (const m of svg.matchAll(/ cx="(-?[\d.]+)"/g)) xs.push(Number(m[1]));
  return { origin: Math.min(...xs), poles: [...poles].sort((a, b) => a - b) };
}

/** Bounding-box area of a filled land path (all its coordinates). */
function bboxArea(d: string): number {
  const nums = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

function leaks(id: string, svg: string, answer: AnswerEntry): string[] {
  const found: string[] = [];
  const all = shapes(svg);
  const v = answer.value;
  if (typeof v === "number" && v >= 3 && Number.isInteger(v)) {
    const counts = new Map<string, number>();
    for (const s of all) {
      if (!s.cls || s.tag === "text") continue;
      // Same tag, class and outline (path commands without numbers).
      const outline = (/ d="([^"]*)"/.exec(s.attrs)?.[1] ?? "").replace(/[^A-Za-z]/g, "");
      const key = `${s.tag}.${s.cls}${outline ? `[${outline}]` : ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, n] of counts) if (n === v) found.push(`${id}: setup draws ${n} × ${key}, the answer`);
  }
  if (typeof v === "number" && v >= 2) {
    const { origin: o, poles } = markers(svg);
    for (const a of poles) {
      for (const b of poles) {
        if (a <= o || b <= a) continue;
        const ratio = (b - o) / (a - o);
        if (near(ratio, v)) found.push(`${id}: setup markers at ${a} and ${b} (from ${o}) stand in ratio ${ratio.toFixed(2)}, the answer`);
      }
    }
  }
  const truth = SIZE_TRUTH[id];
  if (truth !== undefined) {
    const lands = all.filter((s) => s.tag === "path" && /\bcs-(stone|pack)\b/.test(s.cls));
    const areas = lands.map((s) => bboxArea(/ d="([^"]*)"/.exec(s.attrs)?.[1] ?? ""));
    for (const a of areas) {
      for (const b of areas) {
        if (a > 0 && b / a >= truth) found.push(`${id}: setup draws one land ${(b / a).toFixed(1)}× another, the answer's size truth`);
      }
    }
  }
  return found;
}

const SUBJECTS: Array<[string, Record<string, ClueSceneDescription>, Record<string, AnswerEntry>]> = [
  ["math", MATH_CLUE_SCENES, MATH_ANSWERS],
  ["physics", PHYSICS_CLUE_SCENES, PHYSICS_ANSWERS],
  ["chemistry", CHEMISTRY_CLUE_SCENES, CHEMISTRY_ANSWERS],
  ["general-knowledge", GENERAL_KNOWLEDGE_CLUE_SCENES, GENERAL_KNOWLEDGE_ANSWERS],
  ["social-studies", SOCIAL_STUDIES_CLUE_SCENES, SOCIAL_STUDIES_ANSWERS],
];

describe("clue scene setup films are answer-blind", () => {
  const render = loadRenderer();
  for (const [subject, scenes, answers] of SUBJECTS) {
    it(`${subject}: no setup film draws the answer`, () => {
      const problems: string[] = [];
      let rendered = 0;
      for (const [id, description] of Object.entries(scenes)) {
        const answer = answers[id];
        if (!answer || KNOWN_ON_MAIN.has(id)) continue;
        problems.push(...leaks(id, render(description), answer));
        rendered += 1;
      }
      assert.ok(rendered > 0, `${subject}: rendered no scenes`);
      assert.deepEqual(problems, []);
    });
  }
});

describe("clue scene captions", () => {
  it("keep no capital mid-sentence after the answer is spliced in", () => {
    const bad = /[a-z,] (The|About)\b/;
    const hits: string[] = [];
    for (const [, scenes] of SUBJECTS) {
      for (const [id, description] of Object.entries(scenes)) {
        for (const line of description.summary?.lines ?? []) {
          if (bad.test(captionText(line.text))) hits.push(`${id}: ${line.text}`);
        }
      }
    }
    assert.deepEqual(hits, []);
    assert.equal(captionText("so The valley road gets you home first!"), "so the valley road gets you home first!");
    assert.equal(captionText("Greenland sits near the pole. The map"), "Greenland sits near the pole. The map");
  });
});
