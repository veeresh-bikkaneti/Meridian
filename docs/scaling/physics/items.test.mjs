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
  "4-PS3-1", "4-PS3-4", "4-PS4-2",
  "MS-PS2-2", "MS-PS2-3", "MS-PS3-2", "MS-PS3-5", "MS-PS4-2",
  "HS-PS2-1", "HS-PS3-1",
  "6.RP.A.3b", "HSG.SRT.C.8", "HSA.CED.A.4",
]);

// id and group only. Number items are required; applied may be absent.
function loadIdGroups(filePath) {
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(rows)) throw new Error(`${filePath} is not an array`);
  const map = new Map();
  for (const row of rows) {
    if (typeof row?.id !== "string" || typeof row?.group !== "string") {
      throw new Error(`${filePath} needs string id and group`);
    }
    map.set(row.id, row.group);
  }
  return map;
}

const numberPath = path.join(here, "..", "math", "number", "items.json");
if (!fs.existsSync(numberPath)) {
  throw new Error("missing docs/scaling/math/number/items.json (../math/number/items.json)");
}
const numberGroups = loadIdGroups(numberPath);

const appliedPath = path.join(here, "..", "math", "applied", "items.json");
let appliedGroups = null;
if (!fs.existsSync(appliedPath)) {
  console.log("SKIP math-applied: docs/scaling/math/applied/items.json is absent");
} else {
  appliedGroups = loadIdGroups(appliedPath);
}

const GROUPS = ["7-10", "10-18", "18+"];
const RANK = { "7-10": 0, "10-18": 1, "18+": 2 };
const SKIP_GROUP = Symbol("math-applied-absent");
const ID_RE = /^physics:[a-z0-9-]+:[a-z0-9-]+$/;
const OBSERVABLE = /\b(identify|sort|predict|compute|measure|compare)\b/i;
const BANNED_7_10 = /\b(algebra|trigonometry|trigonometric|sine|cosine|tangent|equation|formula|speed|rate|interest|acceleration|joule)\b/i;
const LIVING = /\b(plant|animal|tree|flower|seed|insect|bird|fish|cell|ecosystem|body|organism|bacteria|species|habitat)\b/i;
const CONTESTED = /\b(religio|church|temple|mosque|god|myth|election|party|politic|gender|sexual)\w*/i;
const UNITS = [
  "push", "drop", "friction", "ramp", "arrive", "lever", "balance",
  "energy", "shadow", "mirror", "sound", "magnet",
];
const GONE = ["physics:pulley:closed", "physics:wheel:closed", "physics:sound:pluck"];
const LIGHT_IDS = ["physics:shadow:blocks", "physics:mirror:sends-back"];
const LIGHT_SOURCE = "https://www.nextgenscience.org/pe/4-ps4-2-waves-and-their-applications-technologies-information-transfer";
const ADULT_EXTENDS = [
  ["physics:ramp:adult-ratio", "HSG.SRT.C.8"],
  ["physics:arrive:adult-time", "HSA.CED.A.4"],
  ["physics:energy:missing", "HS-PS3-1"],
];

const byId = new Map(items.map((i) => [i.id, i]));

function groupOf(id) {
  if (byId.has(id)) return byId.get(id).group;
  if (numberGroups.has(id)) return numberGroups.get(id);
  if (appliedGroups !== null && appliedGroups.has(id)) return appliedGroups.get(id);
  if (appliedGroups === null && id.startsWith("math-applied:")) return SKIP_GROUP;
  return undefined;
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
      assert.match(i.why, /Fit:/, `${i.id}: an UNVERIFIED item states why no code fits`);
      continue;
    }
    assert.equal(typeof i.standard, "object", i.id);
    assert.ok(VERIFIED.has(i.standard.code), `${i.id}: ${i.standard.code}`);
    assert.match(i.standard.source, /^https?:\/\//, i.id);
    assert.ok(sources.includes(i.standard.code), `${i.id}: sources missing code`);
    assert.ok(sources.includes(i.standard.source), `${i.id}: sources missing url`);
  }
});

test("ids are unique and the count matches the spec's proposed count", () => {
  assert.equal(byId.size, items.length);
  const count = spec.match(/\*\*Count: PROPOSED (\d+) rows\*\*/);
  assert.ok(count, "missing **Count: PROPOSED N rows**");
  assert.equal(items.length, Number(count[1]));
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

test("families stay, removed ids are gone, and open and adult rows match the spec", () => {
  const ids = items.map((i) => i.id);
  const units = new Set(ids.map((id) => id.split(":")[1]));
  for (const unit of UNITS) assert.ok(units.has(unit), unit);
  for (const id of GONE) assert.ok(!ids.includes(id), id);
  for (const g of GROUPS) assert.ok(items.some((i) => i.group === g), g);

  assert.ok(spec.includes("### Open items"), "spec missing ### Open items");
  const open = spec.slice(spec.indexOf("### Open items"));
  assert.ok(open.includes("physics:pulley:closed"), "open items missing physics:pulley:closed");
  assert.ok(open.includes("physics:wheel:closed"), "open items missing physics:wheel:closed");

  for (const id of LIGHT_IDS) {
    const item = byId.get(id);
    assert.ok(item, id);
    assert.equal(item.standard?.code, "4-PS4-2", id);
    assert.equal(item.standard?.source, LIGHT_SOURCE, id);
  }

  const medium = byId.get("physics:sound:medium");
  assert.ok(medium, "physics:sound:medium");
  assert.deepEqual(medium.buildsOn, [], "physics:sound:medium buildsOn");

  const table = byId.get("physics:push:table");
  assert.ok(table, "physics:push:table");
  assert.equal(typeof table.standard, "object", "physics:push:table standard");
  assert.equal(table.standard.code, "HS-PS2-1", "physics:push:table");

  for (const [id, code] of ADULT_EXTENDS) {
    const item = byId.get(id);
    assert.ok(item, id);
    assert.equal(item.standard, "UNVERIFIED", id);
    assert.ok(item.why.includes("Fit:"), `${id}: Fit:`);
    assert.ok(item.why.includes(code), `${id}: ${code}`);
    assert.ok(spec.includes(`UNVERIFIED (extends ${code})`), id);
  }
});

test("7-10 has no algebra, trigonometry, or rate language, and does not build upward", () => {
  for (const i of items.filter((x) => x.group === "7-10")) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, BANNED_7_10, `${i.id}: ${text.match(BANNED_7_10)?.[0]}`);
    for (const b of i.buildsOn) {
      const g = groupOf(b);
      if (g === SKIP_GROUP) continue;
      assert.equal(g, "7-10", `${i.id} builds on ${b}`);
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
      if (g === SKIP_GROUP) continue;
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
