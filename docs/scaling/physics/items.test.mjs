// Checks docs/scaling/physics/items.json against contract I2
// (docs/scaling/contracts.md) and the owner rules for this branch.
// Run: node --test docs/scaling/physics/items.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(fs.readFileSync(path.join(here, "items.json"), "utf8"));
const spec = fs.readFileSync(path.join(here, "..", "physics-spec.md"), "utf8");
const sources = fs.readFileSync(path.join(here, "sources.md"), "utf8");

// Opening lines fetched 2026-11-10. See sources.md.
const VERIFIED = new Set([
  "3-PS2-1", "3-PS2-2", "3-PS2-3", "5-PS2-1",
  "4-PS3-1", "4-PS3-4", "1-PS4-1", "1-PS4-3",
  "MS-PS2-2", "MS-PS2-3", "MS-PS3-2", "MS-PS3-5", "MS-PS4-2",
  "HS-PS2-1", "HS-PS3-1",
  "6.RP.A.3b", "HSG.SRT.C.8", "HSA.CED.A.4",
]);

// Ids read from the math branches on 2026-11-10. Not on this branch.
const EXTERNAL = {
  "math-number:tables:facts": "7-10",
  "math-applied:measure:length-cm": "7-10",
  "math-applied:measure:longer-than": "7-10",
  "math-applied:measure:right-angle": "7-10",
  "math-applied:rates:one-step": "10-18",
  "math-applied:rates:constant-speed": "10-18",
  "math-applied:rates:rearrange": "10-18",
  "math-applied:trig:missing-side": "10-18",
};

const GROUPS = ["7-10", "10-18", "18+"];
const RANK = { "7-10": 0, "10-18": 1, "18+": 2 };
const ID_RE = /^physics:[a-z0-9-]+:[a-z0-9-]+$/;
const OBSERVABLE = /\b(identify|sort|predict|compute|measure|compare)\b/i;
const BANNED_7_10 = /\b(algebra|trigonometry|trigonometric|sine|cosine|tangent|equation|formula|speed|rate|interest|acceleration|joule)\b/i;
const LIVING = /\b(plant|animal|tree|flower|seed|insect|bird|fish|cell|ecosystem|body|organism|bacteria|species|habitat)\b/i;
const CONTESTED = /\b(religio|church|temple|mosque|god|myth|election|party|politic|gender|sexual)\w*/i;
const FAMILIES = [
  "push", "drop", "friction", "ramp", "arrive", "lever", "pulley",
  "wheel", "balance", "energy", "shadow", "mirror", "sound", "magnet",
];

const byId = new Map(items.map((i) => [i.id, i]));

function groupOf(id) {
  if (byId.has(id)) return byId.get(id).group;
  return EXTERNAL[id];
}

test("every item matches contract I2 exactly", () => {
  const keys = ["buildsOn", "group", "id", "objective", "standard", "useElsewhere", "why"];
  for (const i of items) {
    assert.deepEqual(Object.keys(i).sort(), keys, i.id);
    assert.match(i.id, ID_RE, i.id);
    assert.ok(GROUPS.includes(i.group), `${i.id}: group`);
    assert.ok(Array.isArray(i.buildsOn) && Array.isArray(i.useElsewhere), i.id);
    assert.ok(i.why.length > 20, `${i.id}: why`);
    assert.equal(i.useElsewhere.length, 1, `${i.id}: one use-it-elsewhere round`);
    if (i.standard === "UNVERIFIED") {
      assert.match(i.objective, /not ready to score/, i.id);
      assert.match(i.id, /:closed$/, i.id);
    } else {
      assert.equal(typeof i.standard, "object", i.id);
      assert.ok(VERIFIED.has(i.standard.code), `${i.id}: ${i.standard.code}`);
      assert.match(i.standard.source, /^https?:\/\//, i.id);
      assert.ok(sources.includes(i.standard.code), `${i.id}: sources missing code`);
      assert.ok(sources.includes(i.standard.source), `${i.id}: sources missing url`);
    }
  }
});

test("ids are unique and the count is the proposed 27", () => {
  assert.equal(byId.size, items.length);
  assert.equal(items.length, 27);
  assert.match(spec, /PROPOSED 27/);
});

test("objective has an observable verb and a shown-by", () => {
  for (const i of items) {
    assert.match(i.objective, /^After this, (a child|an adult) can /, i.id);
    assert.match(i.objective, OBSERVABLE, i.id);
    assert.match(i.objective, /shown by/, i.id);
    if (i.group === "18+") assert.match(i.objective, /^After this, an adult can /, i.id);
    else assert.match(i.objective, /^After this, a child can /, i.id);
  }
});

test("the 14 science families are present, and every group is served", () => {
  const units = new Set(items.map((i) => i.id.split(":")[1]));
  for (const f of FAMILIES) assert.ok(units.has(f), f);
  for (const g of GROUPS) assert.ok(items.some((i) => i.group === g), g);
});

test("7-10 has no algebra, trigonometry, or rate language, and does not build upward", () => {
  for (const i of items.filter((x) => x.group === "7-10")) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, BANNED_7_10, `${i.id}: ${text.match(BANNED_7_10)?.[0]}`);
    for (const b of i.buildsOn) {
      assert.equal(groupOf(b), "7-10", `${i.id} builds on ${b}`);
    }
  }
  assert.ok(items.some((i) => i.group === "10-18" && /trigonometric ratio/.test(i.objective)));
  assert.ok(items.some((i) => i.group === "10-18" && /unit rate/.test(i.objective)));
  assert.ok(items.some((i) => i.group === "18+" && /trigonometric ratio/.test(i.objective)));
});

test("buildsOn resolves, never climbs to a higher group, and has no cycle", () => {
  for (const i of items) {
    for (const b of i.buildsOn) {
      const g = groupOf(b);
      assert.ok(g, `${i.id}: buildsOn ${b} is unknown`);
      assert.ok(RANK[g] <= RANK[i.group], `${i.id} builds on higher group ${b}`);
    }
  }
  const state = new Map();
  const visit = (id, stack) => {
    if (!byId.has(id) || state.get(id) === 2) return;
    assert.notEqual(state.get(id), 1, `cycle: ${[...stack, id].join(" -> ")}`);
    state.set(id, 1);
    for (const b of byId.get(id).buildsOn) visit(b, [...stack, id]);
    state.set(id, 2);
  };
  for (const i of items) visit(i.id, []);
});

test("no living-things or contested wording, and the spec cites the standard", () => {
  for (const i of items) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, LIVING, i.id);
    assert.doesNotMatch(text, CONTESTED, i.id);
    assert.ok(spec.includes(i.id), `${i.id} missing from physics-spec.md`);
  }
  assert.match(spec, /K-12 STANDARD \(docs\/scaling\/k12-learning-design-standard\.md\)/);
  assert.match(sources, /not taught/);
});
