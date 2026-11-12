// Checks docs/scaling/chemistry/items.json against contract I2.
// Run: node --test docs/scaling/chemistry/items.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const items = read(path.join(here, "items.json"));

const GROUPS = ["7-10", "10-18", "18+"];
const RANK = { "7-10": 0, "10-18": 1, "18+": 2 };
const ID_RE = /^chemistry:[a-z0-9-]+:[a-z0-9-]+$/;
const ALGEBRA_TRIG = /\b(algebra|algebraic|trigonometry|sine|cosine|tangent|equation|variable|formula|exponent|logarithm|bearing)\b/i;

// Sibling files; each may be absent until its branch merges.
const sibling = (rel) => {
  const f = path.join(here, "..", rel, "items.json");
  return fs.existsSync(f) ? new Map(read(f).map((i) => [i.id, i])) : null;
};
const SIBLINGS = {
  "math-number:": ["math/number", sibling("math/number")],
  "math-applied:": ["math/applied", sibling("math/applied")],
  "physics:": ["physics", sibling("physics")],
};
const own = new Map(items.map((i) => [i.id, i]));

test("every item matches contract I2 shape", () => {
  const keys = ["buildsOn", "group", "id", "objective", "standard", "useElsewhere", "why"];
  for (const i of items) {
    assert.deepEqual(Object.keys(i).sort(), keys, i.id);
    assert.ok(Array.isArray(i.buildsOn) && Array.isArray(i.useElsewhere), i.id);
    assert.ok(i.useElsewhere.length >= 1, `${i.id}: needs a use-it-elsewhere round`);
    assert.ok(i.why.length > 20, `${i.id}: why is empty`);
    assert.match(i.objective, /^After this, an? (child|learner|adult learner|adult)\b/, i.id);
    if (i.standard !== "UNVERIFIED") {
      assert.ok(i.standard.code && i.standard.source, `${i.id}: standard needs code and source`);
    }
  }
});

test("ids match chemistry:<unit>:<item> and are unique", () => {
  for (const i of items) assert.match(i.id, ID_RE, i.id);
  assert.equal(own.size, items.length);
});

test("groups are valid and all three are served", () => {
  for (const i of items) assert.ok(GROUPS.includes(i.group), `${i.id}: ${i.group}`);
  for (const g of GROUPS) assert.ok(items.some((i) => i.group === g), g);
});

test("18+ rows are UNVERIFIED and name the code they extend", () => {
  for (const i of items.filter((x) => x.group === "18+")) {
    assert.equal(i.standard, "UNVERIFIED", i.id);
    assert.match(i.why, /Fit: adult extension of HS-PS1-\d/, i.id);
  }
});

test("7-10 items use no algebra or trigonometry", () => {
  for (const i of items.filter((x) => x.group === "7-10")) {
    const text = [i.objective, i.why, ...i.useElsewhere].join(" ");
    assert.doesNotMatch(text, ALGEBRA_TRIG, `${i.id}: ${text.match(ALGEBRA_TRIG)?.[0]}`);
  }
});

test("no placeholder map: ids remain", () => {
  for (const i of items) for (const b of i.buildsOn) assert.doesNotMatch(b, /^map:/, `${i.id}: ${b}`);
});

test("buildsOn never climbs to a higher group and every id resolves", (t) => {
  for (const [prefix, [dir, map]] of Object.entries(SIBLINGS)) {
    if (!map) t.diagnostic(`${dir}/items.json is absent: ${prefix} ids are NOT checked (file lives on a sibling branch until it merges)`);
  }
  for (const i of items) {
    for (const b of i.buildsOn) {
      let target;
      if (b.startsWith("chemistry:")) {
        target = own.get(b);
        assert.ok(target, `${i.id}: ${b} not in items.json`);
      } else {
        const hit = Object.entries(SIBLINGS).find(([p]) => b.startsWith(p));
        assert.ok(hit, `${i.id}: unknown buildsOn namespace ${b}`);
        const map = hit[1][1];
        if (!map) continue;
        target = map.get(b);
        assert.ok(target, `${i.id}: ${b} not in ${hit[1][0]}/items.json`);
      }
      assert.ok(RANK[target.group] <= RANK[i.group], `${i.id} builds on a higher group item ${b}`);
    }
  }
});
