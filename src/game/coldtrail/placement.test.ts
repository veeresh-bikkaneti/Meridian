import { strict as assert } from "node:assert";
import { test } from "node:test";
import { effectiveRadius } from "./engine.ts";
import { buildEvidenceOverlays, nudgeDirection, tripleOverlap, wrapLonDelta } from "./placement.ts";
import { freshProgress } from "./store.ts";
import type { ColdTrailCase, ColdTrailProgress, ColdTrailSighting } from "./types.ts";

/**
 * WS1 "Every Place Findable": the render path may only ever show
 * player-chosen coordinates pre-reveal. These tests pin invariant I1
 * (no oracle rendering) to the pure buildEvidenceOverlays derivation.
 */

function sighting(id: string, cityLon: number, cityLat: number, radiusKm: number): ColdTrailSighting {
  return {
    id,
    timestamp: "Tue 08:14",
    cityId: `city-${id}`,
    cityName: `City ${id}`,
    cityLon,
    cityLat,
    radiusKm,
    octant: "east",
    text: `Last seen near City ${id}.`,
  };
}

// Anchors are deliberately spread out and memorable so a leak is obvious.
const caseData: ColdTrailCase = {
  v: 1,
  caseNo: 7,
  hideout: { placeId: "hideout", name: "Secretville", lon: 11.1, lat: 22.2, difficulty: 1 },
  sightings: [
    sighting("a", -100.0, 40.0, 400),
    sighting("b", 50.0, -30.0, 600),
    sighting("c", 120.0, 60.0, 800),
  ],
};

const anchors: Array<{ lon: number; lat: number }> = [
  ...caseData.sightings.map((s) => ({ lon: s.cityLon, lat: s.cityLat })),
  { lon: caseData.hideout.lon, lat: caseData.hideout.lat },
];

// Player centers: deliberately far from every anchor (the I1 scenario).
const playerCenters: [{ lon: number; lat: number }, { lon: number; lat: number }, { lon: number; lat: number }] = [
  { lon: 10.0, lat: 10.0 },
  { lon: -20.0, lat: -20.0 },
  { lon: 30.0, lat: -40.0 },
];

function lockedProgress(): ColdTrailProgress {
  const p = freshProgress();
  p.ringsPlaced = [true, true, true];
  p.ringCenters = [...playerCenters];
  return p;
}

function renderedCoords(out: {
  rings: Array<{ lon: number; lat: number }>;
  marks: Array<{ lon: number; lat: number }>;
  overlap: { polygon: Array<[number, number]> | null; centroid: { lon: number; lat: number } } | null;
}) {
  return [
    ...out.rings.map((r) => ({ lon: r.lon, lat: r.lat })),
    ...out.marks.map((m) => ({ lon: m.lon, lat: m.lat })),
    // The F11 lens is a render path too: its polygon + centroid must never
    // equal a true anchor (derived from player centers only).
    ...(out.overlap?.polygon ?? []).map(([lon, lat]) => ({ lon, lat })),
    ...(out.overlap ? [{ lon: out.overlap.centroid.lon, lat: out.overlap.centroid.lat }] : []),
  ];
}

test("I1 anti-leak: pre-reveal, no rendered coordinate equals any true anchor", () => {
  const out = buildEvidenceOverlays(caseData, lockedProgress(), null);
  for (const c of renderedCoords(out)) {
    for (const a of anchors) {
      assert.notDeepEqual(
        c,
        a,
        `rendered coordinate ${JSON.stringify(c)} must not equal anchor ${JSON.stringify(a)}`,
      );
    }
  }
});

test("I1 anti-leak: pre-reveal, rings render exactly the player-chosen centers", () => {
  const out = buildEvidenceOverlays(caseData, lockedProgress(), null);
  assert.equal(out.rings.length, 3);
  out.rings.forEach((r, i) => {
    assert.deepEqual({ lon: r.lon, lat: r.lat }, playerCenters[i]);
    assert.equal(r.preview, undefined, "locked rings are never previews");
  });
});

test("witness dots render at player centers pre-reveal (never at anchors)", () => {
  const out = buildEvidenceOverlays(caseData, lockedProgress(), null);
  const witnesses = out.marks.filter((m) => m.kind === "witness");
  assert.equal(witnesses.length, 3);
  witnesses.forEach((w, i) => {
    assert.deepEqual({ lon: w.lon, lat: w.lat }, playerCenters[i]);
  });
});

test("revealed: witness dots stay at player centers; guess mark appears", () => {
  const p = lockedProgress();
  p.revealed = true;
  p.guess = { lon: 5, lat: 5 };
  const out = buildEvidenceOverlays(caseData, p, null);
  const witnesses = out.marks.filter((m) => m.kind === "witness");
  assert.equal(witnesses.length, 3);
  for (const w of witnesses) {
    for (const a of anchors) {
      assert.notDeepEqual({ lon: w.lon, lat: w.lat }, a);
    }
  }
  const xs = out.marks.filter((m) => m.kind === "x");
  assert.equal(xs.length, 1);
  assert.deepEqual({ lon: xs[0]!.lon, lat: xs[0]!.lat }, { lon: 5, lat: 5 });
});

test("draft ring renders as a preview at the draft coords", () => {
  const out = buildEvidenceOverlays(caseData, freshProgress(), {
    index: 1,
    lon: 77.7,
    lat: -12.3,
  });
  assert.equal(out.rings.length, 1);
  const d = out.rings[0]!;
  assert.deepEqual({ lon: d.lon, lat: d.lat }, { lon: 77.7, lat: -12.3 });
  assert.equal(d.preview, true);
  assert.ok(d.label.endsWith("· draft"), `draft label carries the suffix: ${d.label}`);
  assert.equal(out.marks.length, 0, "no witness dot for an unconfirmed draft");
});

test("no draft: no preview rings", () => {
  const out = buildEvidenceOverlays(caseData, lockedProgress(), null);
  assert.ok(out.rings.every((r) => !r.preview));
});

test("informant halves the radius around the PLAYER center (never re-centers)", () => {
  const p = lockedProgress();
  const before = buildEvidenceOverlays(caseData, p, null);
  p.informantOn = [true, false, false];
  const after = buildEvidenceOverlays(caseData, p, null);
  // Center untouched by the informant (GD §6 guard).
  assert.deepEqual(
    { lon: after.rings[0]!.lon, lat: after.rings[0]!.lat },
    { lon: before.rings[0]!.lon, lat: before.rings[0]!.lat },
  );
  // Radius halved: drawn with effectiveRadius, the public clue data.
  assert.equal(after.rings[0]!.radiusKm, before.rings[0]!.radiusKm / 2);
  assert.equal(after.rings[0]!.radiusKm, effectiveRadius(caseData.sightings[0]!, true));
});

test("draft preview shows the informant-tightened radius after a Move", () => {
  // O12: Move following an informant buy must preview the tightened radius,
  // otherwise the preview lies about the locked ring's size.
  const p = lockedProgress();
  p.informantOn = [false, true, false];
  const out = buildEvidenceOverlays(caseData, p, { index: 1, ...playerCenters[1] });
  const previews = out.rings.filter((r) => r.preview);
  assert.equal(previews.length, 1);
  assert.equal(previews[0]!.radiusKm, effectiveRadius(caseData.sightings[1]!, true));
});

test("unplaced sightings render nothing", () => {
  const out = buildEvidenceOverlays(caseData, freshProgress(), null);
  assert.deepEqual(out.rings, []);
  assert.deepEqual(out.marks, []);
});

test("nudgeDirection names the eight winds", () => {
  assert.equal(nudgeDirection(1, 1), "northeast");
  assert.equal(nudgeDirection(-1, 1), "northwest");
  assert.equal(nudgeDirection(1, -1), "southeast");
  assert.equal(nudgeDirection(-1, -1), "southwest");
  assert.equal(nudgeDirection(1, 0), "east");
  assert.equal(nudgeDirection(0, -1), "south");
});

test("F11 overlap: three overlapping rings yield a closed lens polygon", () => {
  const region = tripleOverlap([
    { lon: 0, lat: 0, radiusKm: 500 },
    { lon: 2, lat: 1, radiusKm: 500 },
    { lon: -1, lat: 2, radiusKm: 500 },
  ]);
  assert.ok(region, "three rings always produce a region");
  assert.ok(region.polygon, "overlapping rings share a common area");
  assert.ok(region.polygon.length >= 4, "closed ring has ≥4 points");
  assert.deepEqual(
    region.polygon[0],
    region.polygon[region.polygon.length - 1],
    "the lens polygon is closed",
  );
});

test("F11 overlap: disjoint rings → no polygon (centroid computed but not rendered)", () => {
  const region = tripleOverlap([
    { lon: -100, lat: 0, radiusKm: 200 },
    { lon: 0, lat: 0, radiusKm: 200 },
    { lon: 100, lat: 0, radiusKm: 200 },
  ]);
  assert.ok(region);
  assert.equal(region.polygon, null, "no common area → no polygon");
  assert.deepEqual(region.centroid, { lon: 0, lat: 0 });
});

test("F11 overlap: antimeridian-safe for rings at 179 / -179", () => {
  const region = tripleOverlap([
    { lon: 179, lat: 10, radiusKm: 800 },
    { lon: -179, lat: 10, radiusKm: 800 },
    { lon: 179.5, lat: 12, radiusKm: 800 },
  ]);
  assert.ok(region);
  assert.ok(region.polygon, "the 2°-apart rings overlap across the antimeridian");
  assert.ok(
    region.centroid.lon >= -180 && region.centroid.lon <= 180,
    `centroid lon normalized, got ${region.centroid.lon}`,
  );
});

test("F11 overlap: fewer than three rings → null", () => {
  assert.equal(
    tripleOverlap([
      { lon: 0, lat: 0, radiusKm: 500 },
      { lon: 1, lat: 1, radiusKm: 500 },
    ]),
    null,
  );
});

test("buildEvidenceOverlays: lens polygon when locked rings overlap", () => {
  const p = freshProgress();
  p.ringsPlaced = [true, true, true];
  p.ringCenters = [
    { lon: 10, lat: 10 },
    { lon: 11, lat: 10.5 },
    { lon: 9.5, lat: 11 },
  ];
  const out = buildEvidenceOverlays(caseData, p, null);
  assert.ok(out.overlap?.polygon, "close-together locked rings share a common area");
});

test("buildEvidenceOverlays: no polygon when locked rings are disjoint", () => {
  // playerCenters are far apart → no triple intersection.
  const out = buildEvidenceOverlays(caseData, lockedProgress(), null);
  assert.ok(out.overlap, "the lens region still exists");
  assert.equal(out.overlap.polygon, null);
  // Circular mean of (10°, -20°, 30°) ≈ 6.79° — near the plain mean, but
  // antimeridian-safe by construction.
  assert.ok(Math.abs(out.overlap.centroid.lon - 6.79) < 0.05);
  assert.ok(Math.abs(out.overlap.centroid.lat + 50 / 3) < 1e-9);
});

test("buildEvidenceOverlays: no lens before all 3 locked, or after reveal", () => {
  const partial = freshProgress();
  partial.ringsPlaced = [true, true, false];
  partial.ringCenters = [{ lon: 10, lat: 10 }, { lon: 11, lat: 10.5 }, null];
  assert.equal(buildEvidenceOverlays(caseData, partial, null).overlap, null);

  const done = lockedProgress();
  done.revealed = true;
  done.guess = { lon: 5, lat: 5 };
  assert.equal(buildEvidenceOverlays(caseData, done, null).overlap, null);
});

test("wrapLonDelta recovers the signed step across the antimeridian", () => {
  assert.equal(wrapLonDelta(2), 2);
  assert.equal(wrapLonDelta(-2), -2);
  assert.equal(wrapLonDelta(-358), 2, "179 → -179 is an EAST step");
  assert.equal(wrapLonDelta(358), -2, "-179 → 179 is a WEST step");
  assert.equal(wrapLonDelta(0), 0);
  assert.equal(wrapLonDelta(10), 10);
});
