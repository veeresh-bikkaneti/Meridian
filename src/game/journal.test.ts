import assert from "node:assert/strict";
import test from "node:test";
import { PLACES } from "./catalog.ts";
import { GEOGRAPHY_BY_RING, JOURNAL_SETS, RING_ORDER } from "./journal-data.ts";
import {
  WINDOW_MS,
  confidenceForHref,
  journalSetAt,
  journalSetCount,
  journalSetIndexAt,
  journalSets,
  nextEntryCountdown,
  nextWindowStart,
  shouldApplySetChange,
} from "./journal.ts";

// ---------------------------------------------------------------------------
// Window → set index (spec §3): deterministic, boundary-exact.
// ---------------------------------------------------------------------------

test("WINDOW_MS is 2 hours; the cycle is 36 sets / 72 hours", () => {
  assert.equal(WINDOW_MS, 7_200_000);
  assert.equal(journalSetCount(), 36);
  assert.equal(journalSetCount() * WINDOW_MS, 72 * 3_600_000);
});

test("journalSetIndexAt: window boundaries", () => {
  assert.equal(journalSetIndexAt(0), 0);
  assert.equal(journalSetIndexAt(WINDOW_MS - 1), 0);
  assert.equal(journalSetIndexAt(WINDOW_MS), 1);
  assert.equal(journalSetIndexAt(WINDOW_MS * 35), 35);
  assert.equal(journalSetIndexAt(WINDOW_MS * 36 - 1), 35);
  assert.equal(journalSetIndexAt(WINDOW_MS * 36), 0);
  assert.equal(journalSetIndexAt(WINDOW_MS * 36 + WINDOW_MS), 1);
});

test("journalSetIndexAt: same instant → same index (any client)", () => {
  const t = 1_761_234_567_890;
  assert.equal(journalSetIndexAt(t), journalSetIndexAt(t));
  assert.equal(journalSetAt(t)?.index, journalSetIndexAt(t));
  assert.equal(journalSetAt(t + WINDOW_MS)?.index, (journalSetIndexAt(t) + 1) % 36);
});

test("nextWindowStart: start of the following window", () => {
  assert.equal(nextWindowStart(0), WINDOW_MS);
  assert.equal(nextWindowStart(WINDOW_MS - 1), WINDOW_MS);
  assert.equal(nextWindowStart(WINDOW_MS), WINDOW_MS * 2);
});

test("nextEntryCountdown: h:mm to the next window", () => {
  assert.equal(nextEntryCountdown(0), "2:00");
  assert.equal(nextEntryCountdown(WINDOW_MS / 2), "1:00");
  assert.equal(nextEntryCountdown(WINDOW_MS - 30 * 60_000), "0:30");
  assert.equal(nextEntryCountdown(WINDOW_MS - 1), "0:01");
});

// ---------------------------------------------------------------------------
// Set formation + remainder rule (spec §3)
// ---------------------------------------------------------------------------

test("sets: 36 total — 35 triples and one single", () => {
  const sets = journalSets();
  assert.equal(sets.length, 36);
  assert.equal(sets.filter((s) => s.notes.length === 3).length, 35);
  assert.equal(sets.filter((s) => s.notes.length === 1).length, 1);
  assert.equal(sets[35]!.notes.length, 1);
});

test("sets: first 33 are ring-pure, in ring order, with the §2 labels", () => {
  const sets = journalSets();
  const expectedLabels: string[] = [
    ...Array(9).fill(GEOGRAPHY_BY_RING.lincoln),
    ...Array(4).fill(GEOGRAPHY_BY_RING.region),
    ...Array(6).fill(GEOGRAPHY_BY_RING.nebraska),
    ...Array(6).fill(GEOGRAPHY_BY_RING.usa),
    ...Array(8).fill(GEOGRAPHY_BY_RING.world),
  ];
  assert.equal(expectedLabels.length, 33);
  for (let i = 0; i < 33; i++) {
    const set = sets[i]!;
    assert.equal(set.mixed, false, `set ${i} must be pure`);
    assert.equal(set.geography, expectedLabels[i], `set ${i} geography`);
    const rings = new Set(set.notes.map((n) => n.ring));
    assert.equal(rings.size, 1, `set ${i} must share one ring`);
    // Pure sets follow catalog order within the ring.
    const ringPlaces = PLACES.filter((p) => p.ring === set.notes[0]!.ring);
    const offset = ringPlaces.findIndex((p) => p.id === set.notes[0]!.placeId);
    assert.deepEqual(
      set.notes.map((n) => n.placeId),
      ringPlaces.slice(offset, offset + 3).map((p) => p.id),
    );
  }
});

test("sets: every place appears exactly once across the cycle", () => {
  const ids = journalSets().flatMap((s) => s.notes.map((n) => n.placeId));
  assert.equal(ids.length, 106);
  assert.equal(new Set(ids).size, 106);
  assert.deepEqual(new Set(ids), new Set(PLACES.map((p) => p.id)));
});

test("sets: remainder sets are the ring leftovers in ring order (3, 3, 1)", () => {
  // Recompute the leftovers straight from the catalog: within each ring,
  // the places past the last full triple, rings in RING_ORDER.
  const leftovers: string[] = [];
  for (const ring of RING_ORDER) {
    const inRing = PLACES.filter((p) => p.ring === ring);
    leftovers.push(...inRing.slice(Math.floor(inRing.length / 3) * 3).map((p) => p.id));
  }
  assert.equal(leftovers.length, 7);
  const sets = journalSets();
  const remainder = sets.slice(33);
  assert.equal(remainder.length, 3);
  for (const set of remainder) {
    assert.equal(set.mixed, true);
    assert.equal(set.geography, "Field Notes");
  }
  assert.deepEqual(remainder[0]!.notes.map((n) => n.placeId), leftovers.slice(0, 3));
  assert.deepEqual(remainder[1]!.notes.map((n) => n.placeId), leftovers.slice(3, 6));
  assert.deepEqual(remainder[2]!.notes.map((n) => n.placeId), leftovers.slice(6, 7));
  // Each remainder note keeps its own geography (no false shared claim).
  for (const set of remainder) {
    for (const note of set.notes) {
      assert.equal(note.geography, GEOGRAPHY_BY_RING[note.ring]);
    }
  }
  // The raw generated sets agree with the resolved view.
  assert.deepEqual(
    JOURNAL_SETS.slice(33).map((s) => s.noteIds),
    remainder.map((s) => s.notes.map((n) => n.placeId)),
  );
});

// ---------------------------------------------------------------------------
// Confidence rubric (spec §4)
// ---------------------------------------------------------------------------

test("confidenceForHref: .gov / .edu hosts are verified", () => {
  assert.equal(confidenceForHref("https://capitol.nebraska.gov/").tier, "verified");
  assert.equal(confidenceForHref("https://www.unl.edu/about").tier, "verified");
  assert.equal(confidenceForHref("https://example.gov").tier, "verified");
});

test("confidenceForHref: any other recorded source is cited", () => {
  assert.equal(confidenceForHref("https://en.wikipedia.org/wiki/X").tier, "cited");
  assert.equal(confidenceForHref("https://www.pinnaclebankarena.com/").tier, "cited");
  assert.equal(confidenceForHref("https://notgov.com/").tier, "cited");
  assert.equal(confidenceForHref("https://fake.edu.evil.com/").tier, "cited");
  assert.equal(confidenceForHref("not a url").tier, "cited");
});

test("confidenceForHref: basis text matches the spec", () => {
  assert.equal(confidenceForHref("https://x.gov/").basis, "Government or university source");
  assert.equal(confidenceForHref("https://x.com/").basis, "Named source recorded in the catalog");
});

// ---------------------------------------------------------------------------
// Deferral rule (spec §6) — the pure decision the component applies.
// ---------------------------------------------------------------------------

test("shouldApplySetChange: blocked by an open view or focus in the card", () => {
  assert.equal(shouldApplySetChange({ overlayOpen: false, focusInsideCard: false }), true);
  assert.equal(shouldApplySetChange({ overlayOpen: true, focusInsideCard: false }), false);
  assert.equal(shouldApplySetChange({ overlayOpen: false, focusInsideCard: true }), false);
  assert.equal(shouldApplySetChange({ overlayOpen: true, focusInsideCard: true }), false);
});
