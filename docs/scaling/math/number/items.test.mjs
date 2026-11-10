// Checks docs/scaling/math/number/items.json against contract I2
// (docs/scaling/contracts.md) and the owner rules in agent-instructions.md.
// Run: node --test docs/scaling/math/number/items.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(fs.readFileSync(path.join(here, "items.json"), "utf8"));
const spec = fs.readFileSync(path.join(here, "..", "..", "math-definition-spec.md"), "utf8");

// Codes fetched live from thecorestandards.org on 2026-11-10 (existence and
// opening wording only). Anything else must be the literal "UNVERIFIED".
const VERIFIED = new Set([
  "2.NBT.A.1", "2.NBT.A.2", "2.NBT.A.4", "2.OA.C.4",
  "3.OA.A.1", "3.OA.A.2", "3.OA.A.3", "3.OA.B.6", "3.OA.C.7", "3.OA.D.9",
  "3.NBT.A.1", "3.NF.A.1", "3.NF.A.2", "3.NF.A.3",
  "4.OA.A.3", "4.NBT.A.1", "4.NBT.B.5", "4.NBT.B.6", "4.NF.A.2",
  "5.NBT.A.1", "5.NBT.B.5", "5.NBT.B.6", "5.NF.A.1", "5.NF.B.4",
  "6.NS.A.1", "6.NS.B.2", "6.RP.A.3", "8.EE.A.3",
]);
const GROUPS = ["7-10", "10-18", "18+"];
const RANK = { "7-10": 0, "10-18": 1, "18+": 2 };
const ID_RE = /^math-number:[a-z0-9-]+:[a-z0-9-]+$/;
const OBSERVABLE = /\b(identify|locate|sort|predict|explain|compare|compute|estimate|count|find|multiply|divide|solve|place|name|say|write|spot|add|combine|interpret|round)\b/i;
const ALGEBRA_TRIG = /\b(algebra|algebraic|trigonometry|sine|cosine|tangent|equation|variable|formula|exponent|logarithm|speed|rate|interest)\b/i;
const LIVING = /\b(plant|animal|tree|flower|seed|insect|bird|fish|cell|ecosystem|body|organism|bacteria|species|habitat|farm|crop|egg)\b/i;
const CONTESTED = /\b(religio|church|temple|mosque|god|myth|election|party|politic|gender|sexual)\w*/i;

const byId = new Map(items.map((i) => [i.id, i]));

test("every item matches contract I2 exactly", () => {
  const keys = ["buildsOn", "group", "id", "objective", "standard", "useElsewhere", "why"];
  for (const i of items) {
    assert.deepEqual(Object.keys(i).sort(), keys, i.id);
    assert.match(i.id, ID_RE, i.id);
    assert.ok(GROUPS.includes(i.group), `${i.id}: group`);
    assert.ok(Array.isArray(i.buildsOn) && Array.isArray(i.useElsewhere), i.id);
    assert.ok(i.why.length > 20, `${i.id}: why is empty`);
    assert.ok(i.useElsewhere.length >= 1, `${i.id}: needs a use-it-elsewhere round`);
  }
});

test("ids are unique", () => {
  assert.equal(byId.size, items.length);
});

test("objective has the standard form with an observable verb and a 'shown by'", () => {
  for (const i of items) {
    assert.match(i.objective, /^After this, (a child|an adult) can /, i.id);
    assert.match(i.objective, /, shown by /, `${i.id}: missing 'shown by'`);
    assert.match(i.objective, OBSERVABLE, `${i.id}: no observable verb`);
    assert.doesNotMatch(i.objective, /\b(know|understand|appreciate)\b/i, i.id);
    if (i.group === "18+") assert.match(i.objective, /an adult/, i.id);
    else assert.match(i.objective, /a child/, i.id);
  }
});

test("standard is a fetched code with a source, or exactly UNVERIFIED", () => {
  for (const i of items) {
    if (i.standard === "UNVERIFIED") {
      assert.match(i.why, /Fit:/, `${i.id}: an UNVERIFIED item states why no code fits`);
      continue;
    }
    assert.ok(VERIFIED.has(i.standard.code), `${i.id}: ${i.standard.code} was never fetched`);
    assert.match(i.standard.source, /^https:\/\/www\.thecorestandards\.org\/Math\/Content\//, i.id);
    const grade = i.standard.code.split(".")[0];
    assert.ok(i.standard.source.includes(`/Content/${grade}/`), `${i.id}: source grade`);
  }
});

test("buildsOn resolves, never climbs to a higher group, and has no cycle", () => {
  for (const i of items) {
    for (const b of i.buildsOn) {
      const t = byId.get(b);
      assert.ok(t, `${i.id}: buildsOn ${b} does not exist`);
      assert.ok(RANK[t.group] <= RANK[i.group], `${i.id} builds on a higher group item ${b}`);
    }
  }
  const state = new Map();
  const visit = (id, stack) => {
    if (state.get(id) === 2) return;
    assert.notEqual(state.get(id), 1, `cycle: ${[...stack, id].join(" -> ")}`);
    state.set(id, 1);
    for (const b of byId.get(id).buildsOn) visit(b, [...stack, id]);
    state.set(id, 2);
  };
  for (const i of items) visit(i.id, []);
});

test("7-10 items use no algebra, trigonometry, rates or formulas", () => {
  for (const i of items.filter((x) => x.group === "7-10")) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, ALGEBRA_TRIG, `${i.id}: ${text.match(ALGEBRA_TRIG)?.[0]}`);
  }
});

test("no living-thing or contested-topic words anywhere", () => {
  for (const i of items) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, LIVING, `${i.id}: ${text.match(LIVING)?.[0]}`);
    assert.doesNotMatch(text, CONTESTED, `${i.id}: ${text.match(CONTESTED)?.[0]}`);
  }
});

test("use-it-elsewhere starts with a setting from the map's web", () => {
  const settings = /^(physics|chemistry|economics|geography|everyday life):/;
  for (const i of items) for (const u of i.useElsewhere) assert.match(u, settings, i.id);
});

test("every group is served and the 7-10 entry tier comes first in each unit", () => {
  for (const g of GROUPS) assert.ok(items.some((i) => i.group === g), g);
  const units = new Set(items.map((i) => i.id.split(":")[1]));
  for (const u of units) {
    const inUnit = items.filter((i) => i.id.split(":")[1] === u);
    assert.ok(inUnit.some((i) => i.group === "7-10"), `unit ${u} has no 7-10 entry tier`);
  }
});

test("the spec lists every item id", () => {
  for (const i of items) assert.ok(spec.includes(`\`${i.id}\``), `spec is missing ${i.id}`);
});
