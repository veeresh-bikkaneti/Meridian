// Checks docs/scaling/social-studies/items.json against contract I2
// (docs/scaling/contracts.md). Run: node --test docs/scaling/social-studies/items.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const items = read(path.join(here, "items.json"));

const GROUPS = ["7-10", "10-18", "18+"];
const ID_RE = /^social-studies:[a-z0-9-]+:[a-z0-9-]+$/;
const ALGEBRA_TRIG = /\b(algebra|algebraic|trigonometry|sine|cosine|tangent|equation|variable|formula|exponent|logarithm|bearing|bearings)\b/i;

const mathDir = path.join(here, "..", "math");
const numberFile = path.join(mathDir, "number", "items.json");
const appliedFile = path.join(mathDir, "applied", "items.json");
const numberIds = new Set(fs.existsSync(numberFile) ? read(numberFile).map((i) => i.id) : []);
const appliedPresent = fs.existsSync(appliedFile);
const appliedIds = new Set(appliedPresent ? read(appliedFile).map((i) => i.id) : []);
const ownIds = new Set(items.map((i) => i.id));

test("every item matches contract I2 shape", () => {
  const keys = ["buildsOn", "group", "id", "objective", "standard", "useElsewhere", "why"];
  for (const i of items) {
    assert.deepEqual(Object.keys(i).sort(), keys, i.id);
    assert.ok(Array.isArray(i.buildsOn) && Array.isArray(i.useElsewhere), i.id);
    assert.ok(i.useElsewhere.length >= 1, `${i.id}: needs a use-it-elsewhere round`);
    assert.ok(i.why.length > 20, `${i.id}: why is empty`);
    assert.match(i.objective, /^After this, an? (child|adult)\b/, i.id);
  }
});

test("ids match social-studies:<verb>:<item> and are unique", () => {
  for (const i of items) assert.match(i.id, ID_RE, i.id);
  assert.equal(ownIds.size, items.length);
});

test("group is one of 7-10, 10-18, 18+", () => {
  for (const i of items) assert.ok(GROUPS.includes(i.group), `${i.id}: ${i.group}`);
});

test("7-10 items use no algebra or trigonometry", () => {
  for (const i of items.filter((x) => x.group === "7-10")) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, ALGEBRA_TRIG, `${i.id}: ${text.match(ALGEBRA_TRIG)?.[0]}`);
  }
});

test("buildsOn has no placeholder ids", () => {
  for (const i of items) for (const b of i.buildsOn) assert.doesNotMatch(b, /^math:M\d/, `${i.id}: ${b}`);
});

test("every buildsOn id resolves", (t) => {
  if (!appliedPresent) {
    t.diagnostic("math/applied/items.json is absent: math-applied ids are NOT checked (it lives on feat/math-spec until that merges)");
  }
  for (const i of items) {
    for (const b of i.buildsOn) {
      if (b.startsWith("social-studies:")) assert.ok(ownIds.has(b), `${i.id}: ${b} not in items.json`);
      else if (b.startsWith("math-number:")) assert.ok(numberIds.has(b), `${i.id}: ${b} not in math/number/items.json`);
      else if (b.startsWith("math-applied:")) {
        if (appliedPresent) assert.ok(appliedIds.has(b), `${i.id}: ${b} not in math/applied/items.json`);
      } else assert.fail(`${i.id}: unknown buildsOn namespace ${b}`);
    }
  }
});
