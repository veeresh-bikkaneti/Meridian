/**
 * build-coldtrail-capitals.mjs tests: witness eligibility measured
 * from the real dataset, pack case invariants, the pack records
 * contract, determinism, and byte-stability of the core deck.
 * Run: node --test scripts/build-coldtrail-capitals.test.mjs
 */
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { distanceKm } from "../src/game/geo.ts";
import { QUARTER_CIRCUMFERENCE_KM } from "../src/game/loop/rings.ts";
import { buildDeck } from "./build-coldtrail.mjs";
import {
  CURATED_CAPITAL_IDS,
  MIN_PACK_CASES,
  PACK_CASE_TARGET,
  PACK_CASE_TARGET_WAVE2,
  buildPackDeck,
  loadPackCapitalIds,
  measureWitnessPool,
  resolvePackCapitalIds,
} from "./build-coldtrail-capitals.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The 17 curated capitals that cannot anchor, measured 2026-11-03
 * from public/loop/names.v2.json populations (the generator's own
 * source): 16 state capitals under 300,000 plus Reykjavik (118,918).
 * Names in CAPITALS-PACK.md sections B and C.
 */
const NON_ANCHOR_IDS = new Set([
  "gn-3413829", // Reykjavik
  "gn-5106834", // Albany
  "gn-5490263", // Santa Fe
  "gn-5554072", // Juneau
  "gn-4250542", // Springfield
  "gn-4781708", // Richmond
  "gn-4347242", // Annapolis
  "gn-5261457", // Madison
  "gn-5780993", // Salt Lake City
  "gn-5750162", // Salem
  "gn-5805687", // Olympia
  "gn-5586437", // Boise
  "gn-5656882", // Helena
  "gn-5821086", // Cheyenne
  "gn-5072006", // Lincoln
  "gn-4853828", // Des Moines
  "gn-4119403", // Little Rock
]);

test("witness eligibility: 72 of the grown 110 capitals can anchor", () => {
  const { capitalIds, anchors, nonAnchors } = measureWitnessPool();
  assert.equal(capitalIds.length, 110, "the pack set is the grown 110");
  assert.equal(anchors.length, 72, `measured anchors: ${anchors.length}`);
  assert.equal(nonAnchors.length, 38, `measured non-anchors: ${nonAnchors.length}`);
  // The original wave-1 non-anchor 17 (below) are still non-anchors;
  // wave 2 added 21 more small capitals under the same rule.
  const nonAnchorIds = new Set(nonAnchors.map((p) => p.id));
  for (const id of NON_ANCHOR_IDS) {
    assert.ok(nonAnchorIds.has(id), `original non-anchor ${id} still cannot anchor`);
  }
  assert.deepEqual(
    new Set([...nonAnchors.map((p) => p.id)].filter((id) => NON_ANCHOR_IDS.has(id))),
    NON_ANCHOR_IDS,
    "the non-anchor set is exactly the measured 17",
  );
  for (const p of nonAnchors) {
    assert.ok(p.pop < 300_000, `${p.name} is under the anchor population rule`);
  }
  for (const a of anchors) {
    assert.ok(a.pop >= 300_000, `${a.name} clears the anchor population rule`);
    assert.ok(a.difficulty === 1 || a.difficulty === 2, `${a.name} is in the witness difficulty band`);
  }
  // The documented exception to the core blurb test: Washington is a
  // real capital with population 689,545 in the index, and its blurb
  // names the District of Columbia. It anchors. See the generator
  // header for the reasoning.
  assert.ok(
    anchors.some((a) => a.id === "gn-4140963"),
    "Washington anchors (curated capital, population rule met)",
  );
});

test("buildPackDeck is deterministic and every case is a valid triangulation", () => {
  const a = buildPackDeck();
  const b = buildPackDeck();
  assert.deepEqual(a, b, "same seed, same deck");
  assert.equal(
    a.length,
    PACK_CASE_TARGET + PACK_CASE_TARGET_WAVE2,
    `pack deck has ${a.length} cases`,
  );
  assert.ok(a.length >= MIN_PACK_CASES, "pack deck clears the fail-closed floor");
  const { anchors } = measureWitnessPool();
  const anchorIds = new Set(anchors.map((p) => p.id));
  // Append-only generation (issue #344): the shipped first
  // PACK_CASE_TARGET cases draw witnesses only from the ORIGINAL 72
  // capitals' anchors, so their composition can never re-roll when
  // the pack grows; appended cases may use the grown pool.
  const wave1AnchorIds = new Set(
    anchors.filter((p) => CURATED_CAPITAL_IDS.includes(p.id)).map((p) => p.id),
  );
  const hideouts = new Set();
  for (const c of a) {
    assert.equal(c.packId, "capitals", `case ${c.caseNo}: stamped with the pack id`);
    assert.equal(c.sightings.length, 3, `case ${c.caseNo}: 3 sightings`);
    assert.equal(c.hideout.difficulty, 2, `case ${c.caseNo}: hideout is difficulty 2`);
    hideouts.add(c.hideout.placeId);
    const octants = new Set(c.sightings.map((s) => s.octant));
    assert.equal(octants.size, 3, `case ${c.caseNo}: distinct octants`);
    const witnessIds = new Set(c.sightings.map((s) => s.cityId));
    assert.equal(witnessIds.size, 3, `case ${c.caseNo}: distinct witnesses`);
    for (const s of c.sightings) {
      assert.ok(anchorIds.has(s.cityId), `case ${c.caseNo}: witness ${s.cityName} is an eligible capital anchor`);
      if (c.caseNo <= PACK_CASE_TARGET) {
        assert.ok(
          wave1AnchorIds.has(s.cityId),
          `case ${c.caseNo}: shipped-wave witness ${s.cityName} comes from the original anchor pool`,
        );
      }
      assert.notEqual(s.cityId, c.hideout.placeId, `case ${c.caseNo}: witness is not the hideout`);
      const trueKm = distanceKm([s.cityLon, s.cityLat], [c.hideout.lon, c.hideout.lat]);
      assert.ok(trueKm >= 250 && trueKm <= 4000, `case ${c.caseNo}: witness distance ${trueKm} km is inside the core band`);
      assert.ok(s.radiusKm >= trueKm, `case ${c.caseNo}: the ring never understates the true distance`);
      assert.ok(s.radiusKm - trueKm < 25, `case ${c.caseNo}: the ring is the difficulty-2 ceiling of the true distance`);
      assert.ok(s.radiusKm < QUARTER_CIRCUMFERENCE_KM, `case ${c.caseNo}: radius stays under the far-ring reframe threshold`);
      assert.ok(s.text.includes(s.cityName), `case ${c.caseNo}: text names the witness city`);
    }
  }
  assert.equal(hideouts.size, a.length, "no hideout repeats in the pack deck");
});

test("pack records contract: records win, malformed records fail closed", () => {
  const dir = mkdtempSync(join(tmpdir(), "pack-records-"));
  assert.equal(loadPackCapitalIds(dir), null, "empty records dir reads as no records yet");
  assert.deepEqual(resolvePackCapitalIds(dir), [...CURATED_CAPITAL_IDS], "no records means the curated fallback");
  writeFileSync(join(dir, "a.json"), JSON.stringify({ target: { placeId: "gn-2988507" } }));
  writeFileSync(join(dir, "b.json"), JSON.stringify({ target: { placeId: "gn-2643743" } }));
  assert.deepEqual(loadPackCapitalIds(dir), ["gn-2988507", "gn-2643743"], "ids come from the records in file order");
  writeFileSync(join(dir, "c.json"), JSON.stringify({ target: {} }));
  assert.throws(() => loadPackCapitalIds(dir), /no valid target\.placeId/, "a record without a target id aborts the build");
  writeFileSync(join(dir, "c.json"), JSON.stringify({ target: { placeId: "gn-2988507" } }));
  assert.throws(() => loadPackCapitalIds(dir), /repeats target/, "a duplicated target aborts the build");
  assert.equal(loadPackCapitalIds(join(dir, "does-not-exist")), null, "a missing records dir reads as no records yet");
});

test("the core deck file is byte-stable under its own generator", () => {
  // docs/story-packs.md section 1.4 gate: the pack pass is isolated, so the
  // core generator must still reproduce the checked-in core deck
  // byte for byte on this branch.
  const onDisk = readFileSync(join(ROOT, "src/game/coldtrail/cases.generated.json"), "utf8");
  const regenerated = `${JSON.stringify({ v: 1, cases: buildDeck() }, null, 1)}\n`;
  assert.equal(regenerated, onDisk, "core cases.generated.json is unchanged by this slice");
});
