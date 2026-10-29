import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decodeChallenge, decodeChallengeLink } from "./challenge.ts";

/**
 * Golden vectors for the mc1 back-compat contract (manifest
 * 2026-10-28 §2): REAL links captured from the shipped b09a5c3 build's
 * own UI — never computed by test code. A synthetic vector is
 * self-fulfilling (a shared encoder/decoder bug would agree with
 * itself), so these fixtures are the only honest pin on the frozen
 * format. Provenance lives in the fixture file; if a link here ever
 * fails to decode, the mc1 contract is broken — do not "fix" the
 * fixture.
 */
type CapturedLink = {
  source: string;
  fragment: string;
  ids: string[];
  seed: number;
};

const fixture = JSON.parse(
  readFileSync(new URL("./__fixtures__/mc1-captured-links.json", import.meta.url), "utf8"),
) as { provenance: { build: string }; links: CapturedLink[] };

test("fixture carries provenance and at least three distinct real links", () => {
  assert.equal(fixture.provenance.build, "b09a5c368f2860323099b98407be3095924b85d0");
  assert.ok(fixture.links.length >= 3, "need at least 3 captured links");
  const sets = fixture.links.map((l) => l.ids.join(","));
  assert.equal(new Set(sets).size, sets.length, "captured id sets must be pairwise distinct");
  for (const link of fixture.links) {
    assert.ok(link.fragment.startsWith("#c=mc1."), `${link.source} must be an mc1 fragment`);
    assert.ok(link.fragment.length < 2000);
  }
});

for (const link of fixture.links) {
  test(`captured mc1 link (${link.source}) decodes to its exact captured payload`, () => {
    const decoded = decodeChallenge(link.fragment, 3);
    assert.deepEqual(decoded, {
      ok: true,
      v: 1,
      e: "globe",
      s: 3,
      ids: link.ids,
      seed: link.seed,
    });
  });

  test(`captured mc1 link (${link.source}) normalizes to a globe mc1 route at 750 km`, () => {
    const resolved = decodeChallengeLink(link.fragment, 3);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.route.originFormat, "mc1");
    assert.equal(resolved.route.edition, "globe");
    assert.equal(resolved.route.regionId, "globe");
    assert.equal(resolved.route.radiusKm, 750);
    assert.deepEqual(resolved.route.ids, link.ids);
  });
}
