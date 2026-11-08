import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";

// Module resolution for `@/` imports + `.tsx` transpile, mirroring
// read-aloud-button.test.ts. Components are imported dynamically AFTER
// register() so the hook is in place when their specifiers resolve.
import { register } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const HOOKS_SOURCE = [
  "import { statSync } from 'node:fs';",
  "import { fileURLToPath, pathToFileURL } from 'node:url';",
  "import { dirname, resolve as resolvePath } from 'node:path';",
  "const ROOT = " + JSON.stringify(REPO_ROOT) + ";",
  "const TS_URL = pathToFileURL(resolvePath(ROOT, 'node_modules/typescript/lib/typescript.js')).href;",
  "const PROBE_EXTS = ['', '.ts', '.tsx'];",
  "function isFile(p) { try { return statSync(p).isFile(); } catch (e) { return false; } }",
  "export async function resolve(specifier, context, nextResolve) {",
  "  if (specifier.startsWith('@/')) {",
  "    const base = resolvePath(ROOT, 'src', specifier.slice(2));",
  "    for (const ext of PROBE_EXTS) {",
  "      const cand = base + ext;",
  "      if (isFile(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };",
  "    }",
  "  }",
  "  return nextResolve(specifier, context);",
  "}",
  "export async function load(url, context, nextLoad) {",
  "  if (url.endsWith('.tsx')) {",
  "    const { readFileSync } = await import('node:fs');",
  "    const ts = await import(TS_URL);",
  "    const out = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {",
  "      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },",
  "    });",
  "    return { format: 'module', source: out.outputText, shortCircuit: true };",
  "  }",
  "  return nextLoad(url, context);",
  "}",
].join("\n");

register("data:text/javascript," + encodeURIComponent(HOOKS_SOURCE));

const { HolmesRig, WatsonRig, HOLMES_POSES, WATSON_POSES, HIGH_FIVE_CONTACT, CELEBRATE_LAYOUT } =
  (await import("./DetectivePair.tsx")) as typeof import("./DetectivePair.tsx");

function renderHolmes(pose: (typeof HOLMES_POSES)[number], facing: "left" | "right", speaking = false) {
  return renderToString(createElement(HolmesRig, { pose, facing, speaking }));
}

function renderWatson(pose: (typeof WATSON_POSES)[number], facing: "left" | "right", speaking = false) {
  return renderToString(createElement(WatsonRig, { pose, facing, speaking }));
}

test("pose enums are exactly the U5 contract sets", () => {
  assert.deepEqual([...HOLMES_POSES], [
    "dock",
    "walk",
    "search",
    "berth-think",
    "ack",
    "announce",
    "gaze-up",
    "card-look",
    "celebrate-jump",
    "high-five",
    "clap",
    "pout",
  ]);
  assert.deepEqual([...WATSON_POSES], [
    "walk",
    "read",
    "think",
    "station-idle",
    "notebook-mark",
    "gasp",
    "celebrate-jump",
    "high-five",
    "clap",
    "pout",
  ]);
});

test("every Holmes pose renders to a non-empty SVG, both facings", () => {
  for (const pose of HOLMES_POSES) {
    for (const facing of ["left", "right"] as const) {
      const html = renderHolmes(pose, facing);
      assert.ok(html.startsWith("<svg"), `${pose}/${facing} renders an svg`);
      assert.ok(html.includes(`detective-pose-${pose}`), `${pose} carries its pose class`);
      assert.ok(html.includes('aria-hidden="true"'), `${pose} is decorative`);
      assert.ok(html.includes("#a52a21"), `${pose} keeps the brick-red coat base`);
      assert.ok(html.includes("#b45a1b"), `${pose} keeps the rust deerstalker`);
    }
  }
});

test("every Watson pose renders to a non-empty SVG, both facings", () => {
  for (const pose of WATSON_POSES) {
    for (const facing of ["left", "right"] as const) {
      const html = renderWatson(pose, facing);
      assert.ok(html.startsWith("<svg"), `${pose}/${facing} renders an svg`);
      assert.ok(html.includes(`detective-pose-${pose}`), `${pose} carries its pose class`);
      assert.ok(html.includes('aria-hidden="true"'), `${pose} is decorative`);
      assert.ok(html.includes("#27408b"), `${pose} keeps the royal-blue coat base`);
      assert.ok(html.includes("#1d2f57"), `${pose} keeps the navy bowler`);
      assert.ok(html.includes("#c9a227"), `${pose} keeps the gold tie`);
    }
  }
});

test("facing flips via transform, never by duplicating art", () => {
  assert.ok(renderHolmes("dock", "left").includes("scale(-1 1)"), "Holmes left flips");
  assert.ok(!renderHolmes("dock", "right").includes("scale(-1 1)"), "Holmes right is base art");
  assert.ok(renderWatson("read", "right").includes("scale(-1 1)"), "Watson right flips (base art profiles left)");
  assert.ok(!renderWatson("read", "left").includes("scale(-1 1)"), "Watson left is base art");
});

test("no pipe anywhere, and no banned colours sneak back", () => {
  const all = [
    ...HOLMES_POSES.map((p) => renderHolmes(p, "right")),
    ...WATSON_POSES.map((p) => renderWatson(p, "right")),
  ].join("\n");
  assert.ok(!/pipe/i.test(all), "no pipe substring in any pose");
  // The pre-approval palette: Holmes teal family, Watson browns as coat.
  for (const banned of ["#0f766e", "#134e4a", "#5f4b32", "#6b543a", "#7a6248"]) {
    assert.ok(!all.toLowerCase().includes(banned), `banned colour ${banned} absent`);
  }
});

test("identity props survive: glass, notebook, clue card, hats", () => {
  assert.ok(renderHolmes("search", "right").includes('data-part="glass"'), "Holmes searches with the glass");
  assert.ok(renderWatson("read", "right").includes('data-part="clue-card"'), "Watson reads a clue card");
  assert.ok(renderWatson("station-idle", "right").includes('data-part="notebook"'), "Watson keeps his notebook");
  assert.ok(renderWatson("station-idle", "right").includes('data-part="pencil"'), "idle Watson has his pencil");
});

test("glass hand-off: Holmes is glassless in the celebration poses, Watson holds it in his jump", () => {
  for (const pose of ["celebrate-jump", "high-five", "clap"] as const) {
    assert.ok(!renderHolmes(pose, "right").includes('data-part="glass"'), `Holmes ${pose}: glass handed off`);
  }
  assert.ok(
    renderWatson("celebrate-jump", "right").includes('data-part="glass"'),
    "Watson celebrate-jump holds the handed-off glass",
  );
});

test("speaking flaps the mouth via the speaking class only", () => {
  assert.ok(renderHolmes("ack", "right", true).includes("detective-speaking"), "Holmes speaking class");
  assert.ok(renderWatson("read", "right", true).includes("detective-speaking"), "Watson speaking class");
  assert.ok(!renderWatson("read", "right", false).includes("detective-speaking"), "silent Watson has no flap class");
});

test("high-five contact constants exist and match the drawn hands", () => {
  assert.equal(typeof HIGH_FIVE_CONTACT.holmes.x, "number");
  assert.equal(typeof HIGH_FIVE_CONTACT.holmes.y, "number");
  assert.equal(typeof HIGH_FIVE_CONTACT.watson.x, "number");
  assert.equal(typeof HIGH_FIVE_CONTACT.watson.y, "number");
  const holmes = renderHolmes("high-five", "right");
  assert.ok(
    holmes.includes(`cx="${HIGH_FIVE_CONTACT.holmes.x}"`) && holmes.includes(`cy="${HIGH_FIVE_CONTACT.holmes.y}"`),
    "Holmes raised hand is drawn at the exported contact point",
  );
  const watson = renderWatson("high-five", "right");
  assert.ok(
    watson.includes(`cx="${HIGH_FIVE_CONTACT.watson.x}"`) && watson.includes(`cy="${HIGH_FIVE_CONTACT.watson.y}"`),
    "Watson raised hand is drawn at the exported contact point",
  );
});

test("size budget: both rigs' SVG markup is at most 15 KB gz combined", () => {
  const combined =
    renderHolmes("dock", "right") + renderWatson("station-idle", "right");
  const gz = gzipSync(combined).length;
  assert.ok(gz <= 15 * 1024, `combined gz ${gz} B exceeds the 15 KB budget`);
});

test("U8 celebrate layout: CELEBRATE_LAYOUT offset makes the two contact anchors coincide exactly", () => {
  const { holmesContactPx, watsonContactPx, watsonOffsetPx } = CELEBRATE_LAYOUT;
  // Watson placed at watsonOffsetPx: his contact lands on Holmes's.
  const placedWatson = {
    x: watsonOffsetPx.x + watsonContactPx.x,
    y: watsonOffsetPx.y + watsonContactPx.y,
  };
  assert.ok(Math.abs(placedWatson.x - holmesContactPx.x) < 1e-9, "anchors coincide on x");
  assert.ok(Math.abs(placedWatson.y - holmesContactPx.y) < 1e-9, "anchors coincide on y");
  // And the rendered numbers are the hand-computed ones (104 px rigs):
  // Holmes 99×104/178 ≈ 57.8, 25×104/178 ≈ 14.6; Watson 15×104/140 ≈ 11.1, 21×104/140 = 15.6.
  assert.ok(Math.abs(holmesContactPx.x - 57.84) < 0.05);
  assert.ok(Math.abs(holmesContactPx.y - 14.61) < 0.05);
  assert.ok(Math.abs(watsonOffsetPx.x - 46.7) < 0.05);
  assert.ok(Math.abs(watsonOffsetPx.y - -0.99) < 0.05);
});
