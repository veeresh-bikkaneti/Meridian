// Checks docs/scaling/math/applied/items.json against contract I2
// (docs/scaling/contracts.md) and the owner rules for this strand.
// Run: node --test docs/scaling/math/applied/items.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(fs.readFileSync(path.join(here, "items.json"), "utf8"));
const spec = fs.readFileSync(path.join(here, "..", "..", "math-spec.md"), "utf8");
const sources = fs.readFileSync(path.join(here, "sources.md"), "utf8");

// Opening lines fetched 2026-11-10 from thecorestandards.org (see sources.md).
// Letter suffixes are the clause the item uses, not a second standard.
const VERIFIED = new Set([
  "2.MD.A.1", "2.MD.A.3", "2.MD.A.4", "2.G.A.1",
  "3.MD.A.1", "3.MD.A.2", "3.MD.C.6", "3.MD.D.8",
  "4.MD.A.3", "4.MD.C.6", "4.G.A.1",
  "5.MD.A.1", "5.MD.C.5a",
  "6.RP.A.2", "6.RP.A.3b", "6.EE.B.7", "6.G.A.3",
  "7.RP.A.2b", "7.EE.B.4a", "7.G.A.1",
  "8.EE.B.5", "8.G.B.7", "8.G.B.8", "8.G.C.9",
  "HSN.Q.A.3", "HSA.CED.A.4", "HSA.REI.C.6", "HSF.LE.B.5",
  "HSG.SRT.C.6", "HSG.SRT.C.8", "HSG.SRT.D.9", "HSG.SRT.D.11",
]);

// Ids published on origin/feat/math-definition @ 9f87b717. Not on main yet.
// Referenced only. If that branch renames one, this list must change with it.
const NUMBER_GROUP = {
  "math-number:groups:skip-count": "7-10",
  "math-number:groups:arrays": "7-10",
  "math-number:groups:equal-groups": "7-10",
  "math-number:place:hundreds-tens-ones": "7-10",
  "math-number:place:compare": "7-10",
  "math-number:place:round": "7-10",
  "math-number:place:ten-times": "7-10",
  "math-number:tables:buses": "7-10",
  "math-number:tables:facts": "7-10",
  "math-number:tables:patterns": "7-10",
  "math-number:tables:big-products": "7-10",
  "math-number:tables:multi-digit": "10-18",
  "math-number:tables:mental-strategies": "18+",
  "math-number:place:decimal-shifts": "10-18",
  "math-number:place:scientific": "10-18",
  "math-number:division:fair-share": "7-10",
  "math-number:division:unknown-factor": "7-10",
  "math-number:division:remainders": "7-10",
  "math-number:division:big-quotients": "7-10",
  "math-number:division:two-digit-divisors": "10-18",
  "math-number:division:standard-algorithm": "10-18",
  "math-number:fractions:fair-parts": "7-10",
  "math-number:fractions:number-line": "7-10",
  "math-number:fractions:equivalent": "7-10",
  "math-number:fractions:compare-unlike": "7-10",
  "math-number:fractions:add-unlike": "10-18",
  "math-number:fractions:multiply": "10-18",
  "math-number:fractions:divide": "10-18",
  "math-number:fractions:percent": "10-18",
  "math-number:fractions:combine-shares": "18+",
};

const GROUPS = ["7-10", "10-18", "18+"];
const RANK = { "7-10": 0, "10-18": 1, "18+": 2 };
const ID_RE = /^math-applied:[a-z0-9-]+:[a-z0-9-]+$/;
const OBSERVABLE = /\b(identify|locate|sort|predict|explain|compare|compute|estimate|count|find|measure|read|solve|enter)\b/i;
const ALGEBRA_TRIG = /\b(algebra|algebraic|trigonometry|sine|cosine|tangent|equation|variable|formula|exponent|logarithm|speed|rate|interest)\b/i;
const LIVING = /\b(plant|animal|tree|flower|seed|insect|bird|fish|cell|ecosystem|body|organism|bacteria|species|habitat|farm|crop|egg)\b/i;
const CONTESTED = /\b(religio|church|temple|mosque|god|myth|election|party|politic|gender|sexual)\w*/i;
const YOUNG_UNITS = new Set(["measure", "geometry"]);
const OLDER_ONLY = new Set(["rates", "trig"]);

const byId = new Map(items.map((i) => [i.id, i]));

function groupOf(id) {
  if (byId.has(id)) return byId.get(id).group;
  return NUMBER_GROUP[id];
}

test("every item matches contract I2 exactly", () => {
  const keys = ["buildsOn", "group", "id", "objective", "standard", "useElsewhere", "why"];
  for (const i of items) {
    assert.deepEqual(Object.keys(i).sort(), keys, i.id);
    assert.match(i.id, ID_RE, i.id);
    assert.ok(GROUPS.includes(i.group), `${i.id}: group`);
    assert.ok(Array.isArray(i.buildsOn) && Array.isArray(i.useElsewhere), i.id);
    assert.ok(i.why.length > 20, `${i.id}: why is empty`);
    assert.equal(i.useElsewhere.length, 1, `${i.id}: one use-it-elsewhere round`);
  }
});

test("ids are unique and the count is the proposed 38", () => {
  assert.equal(byId.size, items.length);
  assert.equal(items.length, 38);
});

test("objective has the standard form with an observable verb and a shown-by", () => {
  for (const i of items) {
    assert.match(i.objective, /^After this, (a child|an adult) can /, i.id);
    assert.match(i.objective, /, shown by /, `${i.id}: missing shown by`);
    assert.match(i.objective, OBSERVABLE, `${i.id}: no observable verb`);
    assert.doesNotMatch(i.objective, /\b(know|understand|appreciate)\b/i, i.id);
    if (i.group === "18+") assert.match(i.objective, /an adult/, i.id);
    else assert.match(i.objective, /a child/, i.id);
  }
});

test("standard is a fetched code with a live source, or exactly UNVERIFIED", () => {
  for (const i of items) {
    if (i.standard === "UNVERIFIED") {
      assert.match(i.why, /Fit:/, `${i.id}: an UNVERIFIED item states why no code fits`);
      continue;
    }
    assert.ok(VERIFIED.has(i.standard.code), `${i.id}: ${i.standard.code} was never fetched`);
    assert.match(i.standard.source, /^https:\/\/www\.thecorestandards\.org\/Math\/Content\//, i.id);
    const m = i.standard.code.match(/^([0-9]+|HS[A-Z])\.([A-Z]+)\./);
    assert.ok(m, `${i.id}: code shape`);
    assert.ok(
      i.standard.source.includes(`/Content/${m[1]}/${m[2]}/`),
      `${i.id}: source ${i.standard.source} does not match ${i.standard.code}`,
    );
    assert.ok(sources.includes(i.standard.code), `${i.id}: sources.md missing ${i.standard.code}`);
  }
});

test("buildsOn resolves, never climbs to a higher group, and has no cycle", () => {
  for (const i of items) {
    for (const b of i.buildsOn) {
      const g = groupOf(b);
      assert.ok(g, `${i.id}: buildsOn ${b} is not an applied item or a known number-strand id`);
      assert.ok(RANK[g] <= RANK[i.group], `${i.id} builds on a higher group item ${b}`);
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

test("7-10 has no algebra or trigonometry, and does not build on rates or trig", () => {
  for (const i of items.filter((x) => x.group === "7-10")) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, ALGEBRA_TRIG, `${i.id}: ${text.match(ALGEBRA_TRIG)?.[0]}`);
    const unit = i.id.split(":")[1];
    assert.ok(YOUNG_UNITS.has(unit), `${i.id}: 7-10 item in ${unit}`);
    for (const b of i.buildsOn) {
      assert.ok(!b.includes(":rates:") && !b.includes(":trig:"), `${i.id} builds on ${b}`);
    }
  }
  for (const unit of OLDER_ONLY) {
    assert.equal(
      items.filter((i) => i.id.split(":")[1] === unit && i.group === "7-10").length,
      0,
      unit,
    );
  }
});

test("no living-thing or contested-topic words anywhere", () => {
  for (const i of items) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, LIVING, `${i.id}: ${text.match(LIVING)?.[0]}`);
    assert.doesNotMatch(text, CONTESTED, `${i.id}: ${text.match(CONTESTED)?.[0]}`);
  }
});

test("use-it-elsewhere starts with a setting from the map web", () => {
  const settings = /^(physics|chemistry|economics|geography|environment|everyday life):/;
  for (const i of items) for (const u of i.useElsewhere) assert.match(u, settings, i.id);
});

test("measurement and geometry have a 7-10 entry; rates and trig do not", () => {
  for (const g of GROUPS) assert.ok(items.some((i) => i.group === g), g);
  for (const u of YOUNG_UNITS) {
    assert.ok(
      items.some((i) => i.id.split(":")[1] === u && i.group === "7-10"),
      u,
    );
  }
});

test("percent stays on the number strand; this strand uses the speed clause only", () => {
  const codes = items.map((i) => (i.standard === "UNVERIFIED" ? "" : i.standard.code));
  assert.ok(!codes.includes("6.RP.A.3"));
  assert.ok(!codes.includes("6.RP.A.3c"));
  assert.ok(codes.includes("6.RP.A.3b"));
});

test("group matches the standard's grade band", () => {
  // 7-10 = grades 2-5, 10-18 = grades 5-12, 18+ = beyond grade 12.
  // Grade 5 may sit in either. High school codes are 10-18, not 18+.
  for (const i of items) {
    if (i.standard === "UNVERIFIED") {
      assert.equal(i.group, "18+", `${i.id}: an item with no school code is the adult extension`);
      continue;
    }
    const code = i.standard.code;
    if (code.startsWith("HS")) {
      assert.equal(i.group, "10-18", `${i.id}: high school code`);
      continue;
    }
    const grade = Number(code.split(".")[0]);
    assert.ok(grade >= 2 && grade <= 8, `${i.id}: grade ${grade}`);
    if (grade <= 4) assert.equal(i.group, "7-10", i.id);
    else if (grade === 5) assert.ok(i.group === "7-10" || i.group === "10-18", i.id);
    else assert.equal(i.group, "10-18", i.id);
  }
});

test("the spec lists every item id and records that D5 is still open", () => {
  for (const i of items) assert.ok(spec.includes(`\`${i.id}\``), `spec is missing ${i.id}`);
  assert.match(spec, /D5/);
  assert.match(spec, /awaits owner decision/);
});
