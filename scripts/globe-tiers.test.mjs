import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asFameTier } from "../src/game/tier-filter.ts";
import { GLOBE_TIERS, assertCanonicalOrder, mergeTiers, splitGlobe, tierOf } from "./globe-tiers.mjs";
import { checkGlobeTiers, writeGlobeTiers, GLOBE_CHUNK_PATH, TIERS_DIR } from "./build-globe-tiers.mjs";

const place = (n, difficulty) => ({ id: `gn-${n}`, name: `P${n}`, difficulty });
const chunk = {
  meta: { regionId: "globe", edition: "globe", count: 7, gate: "hyderabad" },
  places: [place(2, 3), place(9, 1), place(30, 5), place(31, "x"), place(100, 2), place(101, 2), place(2000, undefined)],
};

test("tierOf: integer 1-5, everything else is tier 3 (same guard as asFameTier)", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => tierOf({ difficulty: d })), [1, 2, 3, 4, 5]);
  for (const bad of [0, 6, 2.5, "2", null, undefined, NaN]) assert.equal(tierOf({ difficulty: bad }), 3);
  for (const d of [1, 2, 3, 4, 5, 0, 6, 2.5, "2", null, undefined, NaN]) {
    assert.equal(tierOf({ difficulty: d }), asFameTier(d), `difficulty ${String(d)}`);
  }
});

test("splitGlobe → mergeTiers round-trips: same records, same order, counts add up", () => {
  const tiers = splitGlobe(chunk);
  assert.deepEqual(Object.keys(tiers).map(Number), GLOBE_TIERS);
  assert.equal(Object.values(tiers).reduce((n, c) => n + c.meta.count, 0), chunk.places.length);
  for (const [t, c] of Object.entries(tiers)) {
    assert.equal(c.meta.tier, Number(t));
    assert.equal(c.meta.count, c.places.length);
    assert.equal(c.meta.regionId, "globe");
  }
  assert.deepEqual(mergeTiers(Object.values(tiers)), chunk.places);
  // Any subset merges to the filtered canonical order.
  assert.deepEqual(
    mergeTiers([tiers[1], tiers[2]]).map((p) => p.id),
    chunk.places.filter((p) => [1, 2].includes(tierOf(p))).map((p) => p.id),
  );
});

test("canonical order is enforced: unsorted, duplicate or non gn-<digits> ids throw", () => {
  assert.throws(() => splitGlobe({ meta: {}, places: [place(5, 1), place(3, 1)] }), /ascending/);
  assert.throws(() => assertCanonicalOrder([place(5, 1), place(5, 1)]), /ascending/);
  assert.throws(() => assertCanonicalOrder([{ id: "xx-1" }]), /gn-<digits>/);
});

test("the checked-in tier files are in sync with chunks/globe.json", () => {
  assert.deepEqual(checkGlobeTiers(), []);
});

test("checkGlobeTiers detects a stale, missing or extra tier file", () => {
  const dir = mkdtempSync(join(tmpdir(), "globe-tiers-"));
  const canonical = join(dir, "globe.json");
  writeFileSync(canonical, JSON.stringify(chunk) + "\n");
  const out = join(dir, "tiers");
  assert.ok(checkGlobeTiers(canonical, out).some((p) => /missing/.test(p)));
  writeGlobeTiers(canonical, out);
  assert.deepEqual(checkGlobeTiers(canonical, out), []);
  // Stale: canonical changes (a place moves tier) without regenerating.
  const edited = { ...chunk, places: chunk.places.map((p) => (p.id === "gn-30" ? { ...p, difficulty: 1 } : p)) };
  writeFileSync(canonical, JSON.stringify(edited) + "\n");
  assert.ok(checkGlobeTiers(canonical, out).some((p) => /differs/.test(p)));
  // Hand-edit of a tier file is caught too.
  writeGlobeTiers(canonical, out);
  const t1 = join(out, "globe-t1.json");
  writeFileSync(t1, readFileSync(t1, "utf8").replace("P9", "Hacked"));
  assert.ok(checkGlobeTiers(canonical, out).some((p) => /globe-t1\.json: differs/.test(p)));
  writeFileSync(join(out, "stray.json"), "{}");
  assert.ok(checkGlobeTiers(canonical, out).some((p) => /unexpected file/.test(p)));
  assert.ok(GLOBE_CHUNK_PATH.endsWith("chunks/globe.json") && TIERS_DIR.endsWith("geonames/tiers"));
});
