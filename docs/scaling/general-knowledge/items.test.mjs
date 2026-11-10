// Checks the general-knowledge mixed-review items, the subject fixtures and the
// example rounds against contract I2 (docs/scaling/contracts.md) and the owner
// rules in docs/scaling/agent-instructions.md.
// Run: node --test docs/scaling/general-knowledge/items.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => JSON.parse(fs.readFileSync(path.join(here, ...p), "utf8"));

const gk = read("items.json");
const fixtures = [...read("fixtures", "geography.items.json"), ...read("fixtures", "physics.items.json")];
// Real I2 items already on main: the math number strand. Read, never copied.
const math = read("..", "math", "number", "items.json");
const rounds = read("rounds.json");
const spec = fs.readFileSync(path.join(here, "..", "general-knowledge-spec.md"), "utf8");

const owned = [...gk, ...fixtures];
const all = [...owned, ...math];
const byId = new Map(all.map((i) => [i.id, i]));
const subjectOf = (id) => id.split(":")[0];

// Codes read live on 2026-11-10 from the source each item cites (sources.md).
// Anything else must be the literal "UNVERIFIED".
const CCSS = "https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf";
const C3 = "https://www.socialstudies.org/sites/default/files/2017/Jun/c3-framework-for-social-studies-rev0617.pdf";
const NGSS = "https://www.nextgenscience.org/pe/5-ess1-2-earths-place-universe";
const VERIFIED = new Map([
  ["4.OA.A.3", { source: CCSS, grade: 4 }],
  ["4.NBT.A.2", { source: CCSS, grade: 4 }],
  ["4.NBT.B.4", { source: CCSS, grade: 4 }],
  ["4.MD.A.1", { source: CCSS, grade: 4 }],
  ["6.RP.A.3", { source: CCSS, grade: 6 }],
  ["HSG-SRT.C.8", { source: CCSS, grade: 9 }],
  ["D2.Geo.3.3-5", { source: C3, grade: 5 }],
  ["5-ESS1-2", { source: NGSS, grade: 5 }],
]);

const GROUPS = ["7-10", "10-18", "18+"];
const RANK = { "7-10": 0, "10-18": 1, "18+": 2 };
const ID_RE = /^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/;
const OBSERVABLE = /\b(identify|locate|sort|predict|explain|compare|compute|estimate|find|convert|choose|tap)\b/i;
const ALGEBRA_TRIG = /\b(algebra|algebraic|trigonometry|tangent|sine|cosine|equation|variable|formula|exponent|logarithm|speed|rate|interest|km\/h)\b/i;
const LIVING = /\b(plant|animal|tree|flower|seed|insect|bird|fish|cell|ecosystem|body|organism|bacteria|species|habitat|farm|crop|egg|wildlife|forest)\w*/i;
const CONTESTED = /\b(religio|church|temple|mosque|shrine|cathedral|sacred|pilgrim|god|myth|election|party|politic|gender|sexual|revolution|war|liberty)\w*/i;
const SETTING = /^(physics|chemistry|economics|geography|everyday life):/;
const text = (i) => [i.objective, i.why, ...i.useElsewhere].join(" ");

test("every owned item matches contract I2 exactly", () => {
  const keys = ["buildsOn", "group", "id", "objective", "standard", "useElsewhere", "why"];
  for (const i of owned) {
    assert.deepEqual(Object.keys(i).sort(), keys, i.id);
    assert.match(i.id, ID_RE, i.id);
    assert.ok(GROUPS.includes(i.group), `${i.id}: group`);
    assert.ok(Array.isArray(i.buildsOn) && Array.isArray(i.useElsewhere), i.id);
    assert.ok(i.why.length > 40, `${i.id}: why is too thin`);
    assert.ok(i.useElsewhere.length >= 1, `${i.id}: needs a use-it-elsewhere round`);
    for (const u of i.useElsewhere) assert.match(u, SETTING, i.id);
  }
});

test("ids are unique across general knowledge, fixtures and math", () => {
  assert.equal(byId.size, all.length);
  for (const i of gk) assert.equal(subjectOf(i.id), "general-knowledge", i.id);
  for (const i of fixtures) assert.notEqual(subjectOf(i.id), "general-knowledge", i.id);
});

test("objective has the standard form with an observable verb and a 'shown by'", () => {
  for (const i of owned) {
    assert.match(i.objective, /^After this, (a child|an adult) can /, i.id);
    assert.match(i.objective, /, shown by /, `${i.id}: missing 'shown by'`);
    assert.match(i.objective, OBSERVABLE, `${i.id}: no observable verb`);
    assert.doesNotMatch(i.objective, /\b(know|understand|appreciate)\b/i, i.id);
    assert.match(i.objective, i.group === "18+" ? /an adult/ : /a child/, i.id);
  }
});

test("standard is a code read live from its cited source, or exactly UNVERIFIED with a Fit note", () => {
  for (const i of owned) {
    if (i.standard === "UNVERIFIED") {
      assert.match(i.why, /Fit:/, `${i.id}: an UNVERIFIED item states why no code fits`);
      continue;
    }
    const v = VERIFIED.get(i.standard.code);
    assert.ok(v, `${i.id}: ${i.standard.code} was never read live`);
    assert.equal(i.standard.source, v.source, `${i.id}: source`);
  }
});

test("group matches the standard's grade: 7-10 is grades 2-5, 10-18 is grades 5-12, 18+ has no school code", () => {
  for (const i of owned) {
    if (i.standard === "UNVERIFIED") {
      assert.equal(i.group, "18+", `${i.id}: only 18+ items may be UNVERIFIED here`);
      continue;
    }
    const { grade } = VERIFIED.get(i.standard.code);
    if (i.group === "7-10") assert.ok(grade >= 2 && grade <= 5, `${i.id}: grade ${grade}`);
    else if (i.group === "10-18") assert.ok(grade >= 5 && grade <= 12, `${i.id}: grade ${grade}`);
    else assert.fail(`${i.id}: an 18+ item cites school grade ${grade}`);
  }
});

test("buildsOn resolves, never climbs to a higher group, and has no cycle", () => {
  for (const i of owned) {
    for (const b of i.buildsOn) {
      const t = byId.get(b);
      assert.ok(t, `${i.id}: buildsOn ${b} does not exist`);
      assert.ok(RANK[t.group] <= RANK[i.group], `${i.id} builds on higher-group ${b}`);
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
  for (const i of owned) visit(i.id, []);
});

test("every mixed-review item re-uses something the child met in another subject", () => {
  for (const i of gk) {
    const from = new Set(i.buildsOn.map(subjectOf).filter((s) => s !== "general-knowledge"));
    assert.ok(from.size >= 1, `${i.id}: builds on no other subject`);
  }
  // Across the set, one skill shows up in several places: at least three source subjects.
  const sources = new Set(gk.flatMap((i) => i.buildsOn.map(subjectOf)));
  for (const s of ["math-number", "geography", "physics"]) assert.ok(sources.has(s), s);
});

test("7-10 items use no algebra, trigonometry, rates or formulas", () => {
  for (const i of owned.filter((x) => x.group === "7-10")) {
    assert.doesNotMatch(text(i), ALGEBRA_TRIG, `${i.id}: ${text(i).match(ALGEBRA_TRIG)?.[0]}`);
  }
});

test("no living-thing or contested-topic words anywhere, and no exact-age question", () => {
  for (const i of owned) {
    assert.doesNotMatch(text(i), LIVING, `${i.id}: ${text(i).match(LIVING)?.[0]}`);
    assert.doesNotMatch(text(i), CONTESTED, `${i.id}: ${text(i).match(CONTESTED)?.[0]}`);
    assert.doesNotMatch(text(i), /\b(how old are you|your age|birth ?(day|date)|year you were born)\b/i, i.id);
  }
});

test("every group is served", () => {
  for (const g of GROUPS) assert.ok(gk.some((i) => i.group === g), g);
});

test("example rounds interleave 2-3 skills from at least two subjects, never above the round's group", () => {
  assert.equal(rounds.status, "PROPOSED");
  for (const r of rounds.rounds) {
    assert.ok(GROUPS.includes(r.group), r.id);
    assert.ok(r.items.length >= 2 && r.items.length <= 3, `${r.id}: 2-3 items`);
    const subjects = new Set();
    const codes = new Set();
    for (const id of r.items) {
      const i = byId.get(id);
      assert.ok(i && subjectOf(id) === "general-knowledge", `${r.id}: ${id}`);
      assert.ok(RANK[i.group] <= RANK[r.group], `${r.id}: ${id} is above the round's group`);
      for (const b of i.buildsOn) if (subjectOf(b) !== "general-knowledge") subjects.add(subjectOf(b));
      codes.add(i.standard === "UNVERIFIED" ? id : i.standard.code);
    }
    assert.ok(subjects.size >= 2, `${r.id}: mixes fewer than two subjects`);
    assert.ok(codes.size >= 2, `${r.id}: drills one skill`);
  }
});

test("the spec lists every owned item id", () => {
  for (const i of owned) assert.ok(spec.includes(`\`${i.id}\``), `spec is missing ${i.id}`);
});
