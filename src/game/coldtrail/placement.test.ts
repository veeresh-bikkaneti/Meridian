import { strict as assert } from "node:assert";
import { test } from "node:test";
import { effectiveRadius } from "./engine.ts";
import { buildEvidenceOverlays, nudgeDirection } from "./placement.ts";
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

function renderedCoords(out: { rings: Array<{ lon: number; lat: number }>; marks: Array<{ lon: number; lat: number }> }) {
  return [
    ...out.rings.map((r) => ({ lon: r.lon, lat: r.lat })),
    ...out.marks.map((m) => ({ lon: m.lon, lat: m.lat })),
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
