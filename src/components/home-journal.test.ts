import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { PLACES, PLACES_BY_ID } from "../game/catalog.ts";
import type { RingId } from "../game/types.ts";
import {
  GEOGRAPHY_BY_RING,
  JOURNAL_NOTES,
  JOURNAL_SETS,
} from "./home-journal.data.ts";
import {
  JOURNAL_WINDOW_MS,
  confidenceForHref,
  confidenceText,
  createJournalRotation,
  journalImageUrl,
  journalSetAt,
  journalSetByIndex,
  journalSetCount,
  journalSetIndexAt,
  journalSets,
  nextEntryCountdown,
  nextWindowStart,
  shouldApplySetChange,
  type JournalTimerHost,
} from "./home-journal.ts";

/** Ring order (generator-internal on the merged dataset; restated here). */
const RING_ORDER: RingId[] = ["lincoln", "region", "nebraska", "usa", "world"];

// ---------------------------------------------------------------------------
// #167 art tests (preserved verbatim from the pre-port file)
// ---------------------------------------------------------------------------

test("the journal dataset is the catalog, with a source on every note", () => {
  assert.equal(JOURNAL_NOTES.length, 106);
  const ids = new Set(JOURNAL_NOTES.map((n) => n.id));
  assert.equal(ids.size, JOURNAL_NOTES.length);
  for (const note of JOURNAL_NOTES) {
    assert.ok(note.story.length > 40);
    assert.ok(note.sourceHref.startsWith("https://"));
  }
});

test("journal art: notes with images carry alt text, unique paths, and real files", () => {
  const withArt = JOURNAL_NOTES.filter((n) => n.image);
  assert.ok(withArt.length > 0, "at least one note has art");
  const paths = withArt.map((n) => n.image as string);
  assert.equal(new Set(paths).size, paths.length, "image paths are unique");
  for (const note of withArt) {
    assert.ok(
      note.imageAlt && note.imageAlt.length > 0,
      `note ${note.id} has non-empty imageAlt`,
    );
    assert.ok(
      existsSync(new URL(`../../public/${note.image}`, import.meta.url)),
      `missing asset file for note ${note.id}: ${note.image}`,
    );
  }
});

test("journalImageUrl uses the deploy base like the storyteller audio URLs", () => {
  // Under node --test import.meta.env is undefined, so assetBase() is "/".
  assert.equal(journalImageUrl("images/journal/taj.webp"), "/images/journal/taj.webp");
});

// ---------------------------------------------------------------------------
// Window → set index (spec §3): deterministic, boundary-exact.
// (Adapted from v2 src/game/journal.test.ts; merged field names.)
// ---------------------------------------------------------------------------

test("JOURNAL_WINDOW_MS is 2 hours; the cycle is 36 sets / 72 hours", () => {
  assert.equal(JOURNAL_WINDOW_MS, 7_200_000);
  assert.equal(journalSetCount(), 36);
  assert.equal(journalSetCount() * JOURNAL_WINDOW_MS, 72 * 3_600_000);
});

test("journalSetIndexAt: window boundaries", () => {
  assert.equal(journalSetIndexAt(0), 0);
  assert.equal(journalSetIndexAt(JOURNAL_WINDOW_MS - 1), 0);
  assert.equal(journalSetIndexAt(JOURNAL_WINDOW_MS), 1);
  assert.equal(journalSetIndexAt(JOURNAL_WINDOW_MS * 35), 35);
  assert.equal(journalSetIndexAt(JOURNAL_WINDOW_MS * 36 - 1), 35);
  assert.equal(journalSetIndexAt(JOURNAL_WINDOW_MS * 36), 0);
  assert.equal(journalSetIndexAt(JOURNAL_WINDOW_MS * 36 + JOURNAL_WINDOW_MS), 1);
});

test("journalSetIndexAt: same instant → same index (any client)", () => {
  const t = 1_761_234_567_890;
  assert.equal(journalSetIndexAt(t), journalSetIndexAt(t));
  assert.equal(journalSetAt(t)?.index, journalSetIndexAt(t));
  assert.equal(journalSetAt(t + JOURNAL_WINDOW_MS)?.index, (journalSetIndexAt(t) + 1) % 36);
});

test("journalSetIndexAt: negative times wrap to the cycle's tail", () => {
  // floor(-1ms / WINDOW) is window -1 → the last set; a whole negative
  // window lands on the same tail set, two back lands on the one before.
  assert.equal(journalSetIndexAt(-1), 35);
  assert.equal(journalSetIndexAt(-JOURNAL_WINDOW_MS), 35);
  assert.equal(journalSetIndexAt(-JOURNAL_WINDOW_MS - 1), 34);
});

test("journalSetByIndex: wraps in both directions", () => {
  assert.equal(journalSetByIndex(0)?.index, 0);
  assert.equal(journalSetByIndex(35)?.index, 35);
  assert.equal(journalSetByIndex(36)?.index, 0);
  assert.equal(journalSetByIndex(37)?.index, 1);
  assert.equal(journalSetByIndex(-1)?.index, 35);
  assert.deepEqual(
    journalSetByIndex(36)?.notes.map((n) => n.id),
    journalSetByIndex(0)?.notes.map((n) => n.id),
  );
});

test("nextWindowStart: start of the following window", () => {
  assert.equal(nextWindowStart(0), JOURNAL_WINDOW_MS);
  assert.equal(nextWindowStart(JOURNAL_WINDOW_MS - 1), JOURNAL_WINDOW_MS);
  assert.equal(nextWindowStart(JOURNAL_WINDOW_MS), JOURNAL_WINDOW_MS * 2);
});

test("nextEntryCountdown: h:mm to the next window", () => {
  assert.equal(nextEntryCountdown(0), "2:00");
  assert.equal(nextEntryCountdown(JOURNAL_WINDOW_MS / 2), "1:00");
  assert.equal(nextEntryCountdown(JOURNAL_WINDOW_MS - 30 * 60_000), "0:30");
  assert.equal(nextEntryCountdown(JOURNAL_WINDOW_MS - 1), "0:01");
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
    const offset = ringPlaces.findIndex((p) => p.id === set.notes[0]!.id);
    assert.deepEqual(
      set.notes.map((n) => n.id),
      ringPlaces.slice(offset, offset + 3).map((p) => p.id),
    );
  }
});

test("sets: every place appears exactly once across the cycle", () => {
  const ids = journalSets().flatMap((s) => s.notes.map((n) => n.id));
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
  assert.deepEqual(remainder[0]!.notes.map((n) => n.id), leftovers.slice(0, 3));
  assert.deepEqual(remainder[1]!.notes.map((n) => n.id), leftovers.slice(3, 6));
  assert.deepEqual(remainder[2]!.notes.map((n) => n.id), leftovers.slice(6, 7));
  // Each remainder note keeps its own geography (no false shared claim).
  for (const set of remainder) {
    for (const note of set.notes) {
      assert.equal(note.where, GEOGRAPHY_BY_RING[note.ring]);
    }
  }
  // The raw generated sets agree with the resolved view.
  assert.deepEqual(
    JOURNAL_SETS.slice(33).map((s) => s.noteIds),
    remainder.map((s) => s.notes.map((n) => n.id)),
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

test("confidenceText: the displayed lines, verbatim for both tiers (spec §5)", () => {
  const notes = journalSets().flatMap((s) => s.notes);
  const verified = notes.find((n) => n.id === "capitol");
  const cited = notes.find((n) => n.id === "memorial-stadium");
  assert.ok(verified && cited);
  assert.equal(confidenceText(verified), "Confidence: Verified — government or university source.");
  assert.equal(confidenceText(cited), "Confidence: Cited — named source recorded in the catalog.");
});

// ---------------------------------------------------------------------------
// Deferral rule (spec §6) — the pure decision the component applies.
// Inline-host signature: { focusInsideCard, focusInsideSection }.
// ---------------------------------------------------------------------------

test("shouldApplySetChange: blocked by focus in the card or in the section", () => {
  assert.equal(shouldApplySetChange({ focusInsideCard: false, focusInsideSection: false }), true);
  assert.equal(shouldApplySetChange({ focusInsideCard: true, focusInsideSection: false }), false);
  assert.equal(shouldApplySetChange({ focusInsideCard: false, focusInsideSection: true }), false);
  assert.equal(shouldApplySetChange({ focusInsideCard: true, focusInsideSection: true }), false);
});

// ---------------------------------------------------------------------------
// Dataset-vs-catalog integrity (spec §1/§4) — adapted from v2
// src/game/journal-data.test.ts. The generated dataset must match PLACES
// field for field — generation drift fails the suite. Regenerate with:
// node scripts/build-journal-dataset.mjs
// ---------------------------------------------------------------------------

test("dataset: exactly the catalog's 106 places, none missing or duplicated", () => {
  assert.equal(PLACES.length, 106);
  assert.equal(JOURNAL_NOTES.length, 106);
  const ids = JOURNAL_NOTES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicated place in the dataset");
  assert.deepEqual(new Set(ids), new Set(PLACES.map((p) => p.id)), "no place missing");
});

test("dataset: every note's fields are verbatim from the catalog", () => {
  for (const note of JOURNAL_NOTES) {
    const place = PLACES_BY_ID[note.id];
    assert.ok(place, `${note.id} exists in the catalog`);
    assert.equal(note.place, place.name, `${note.id} title`);
    assert.equal(note.ring, place.ring, `${note.id} ring`);
    assert.equal(note.story, place.story, `${note.id} story is verbatim`);
    assert.equal(note.sourceLabel, place.source.label, `${note.id} citation label`);
    assert.equal(note.sourceHref, place.source.href, `${note.id} citation href`);
    assert.equal(note.where, GEOGRAPHY_BY_RING[place.ring], `${note.id} geography`);
  }
});

test("dataset: notes keep catalog order", () => {
  assert.deepEqual(
    JOURNAL_NOTES.map((n) => n.id),
    PLACES.map((p) => p.id),
  );
});

test("dataset: confidence tiers — counts 49 verified / 57 cited, none uncited", () => {
  const verified = JOURNAL_NOTES.filter((n) => n.confidence.tier === "verified");
  const cited = JOURNAL_NOTES.filter((n) => n.confidence.tier === "cited");
  assert.equal(verified.length, 49);
  assert.equal(cited.length, 57);
  assert.equal(verified.length + cited.length, JOURNAL_NOTES.length);
});

test("dataset: every confidence vote recomputes from the citation host (§4)", () => {
  for (const note of JOURNAL_NOTES) {
    assert.deepEqual(note.confidence, confidenceForHref(note.sourceHref), note.id);
  }
});

test("dataset: spot checks — capitol (.gov) verified, stadium (Wikipedia) cited", () => {
  const capitol = JOURNAL_NOTES.find((n) => n.id === "capitol");
  assert.ok(capitol);
  assert.equal(capitol.sourceHref, "https://capitol.nebraska.gov/");
  assert.equal(capitol.confidence.tier, "verified");
  assert.equal(capitol.confidence.basis, "Government or university source");

  const stadium = JOURNAL_NOTES.find((n) => n.id === "memorial-stadium");
  assert.ok(stadium);
  assert.equal(stadium.confidence.tier, "cited");
  assert.equal(stadium.confidence.basis, "Named source recorded in the catalog");
});

test("dataset: sets reference real notes, every note exactly once", () => {
  assert.equal(JOURNAL_SETS.length, 36);
  const ids = JOURNAL_SETS.flatMap((s) => s.noteIds);
  assert.equal(ids.length, 106);
  assert.equal(new Set(ids).size, 106);
  const noteIds = new Set(JOURNAL_NOTES.map((n) => n.id));
  for (const id of ids) assert.ok(noteIds.has(id), `${id} resolves to a note`);
});

// ---------------------------------------------------------------------------
// Auto-switch wiring with fake timers (spec §8 — closes v2 review F2).
//
// The production mechanism is createJournalRotation (home-journal.ts),
// which the home component drives. These tests inject a fake timer host
// and a fake clock: no real timers fire, and time advances only when a
// test moves the clock and fires a captured callback.
// ---------------------------------------------------------------------------

class FakeTimers implements JournalTimerHost {
  timeout: { callback: () => void; ms: number; handle: number } | null = null;
  interval: { callback: () => void; ms: number; handle: number } | null = null;
  cleared: unknown[] = [];
  private nextHandle = 1;

  setTimeout = (callback: () => void, ms: number) => {
    const handle = this.nextHandle++;
    this.timeout = { callback, ms, handle };
    return handle;
  };
  clearTimeout = (handle: unknown) => {
    this.cleared.push(handle);
    if (this.timeout?.handle === handle) this.timeout = null;
  };
  setInterval = (callback: () => void, ms: number) => {
    const handle = this.nextHandle++;
    this.interval = { callback, ms, handle };
    return handle;
  };
  clearInterval = (handle: unknown) => {
    this.cleared.push(handle);
    if (this.interval?.handle === handle) this.interval = null;
  };
  fireTimeout() {
    const pending = this.timeout;
    assert.ok(pending, "a boundary timeout is scheduled");
    this.timeout = null;
    pending.callback();
  }
  fireInterval() {
    assert.ok(this.interval, "the safety interval is scheduled");
    this.interval.callback();
  }
}

function fakeRotation(startMs: number) {
  const clock = { now: startMs };
  const timers = new FakeTimers();
  const applied: number[] = [];
  const blockers = { focusInsideCard: false, focusInsideSection: false };
  const rotation = createJournalRotation({
    now: () => clock.now,
    timers,
    blockers: () => ({ ...blockers }),
    onApply: (index) => applied.push(index),
  });
  return { clock, timers, applied, blockers, rotation };
}

test("auto-switch: boundary timeout fires at the next window start and applies the next set", () => {
  // Start 1s into window 10 → current set index 10.
  const { clock, timers, applied, rotation } = fakeRotation(JOURNAL_WINDOW_MS * 10 + 1_000);
  assert.equal(rotation.getCurrentIndex(), 10);
  rotation.start();
  // Boundary timeout delay = remaining window + the 50ms settle margin;
  // the safety interval is 30s. Starting twice schedules nothing extra.
  assert.equal(timers.timeout?.ms, JOURNAL_WINDOW_MS - 1_000 + 50);
  assert.equal(timers.interval?.ms, 30_000);
  const firstTimeout = timers.timeout;
  rotation.start();
  assert.equal(timers.timeout, firstTimeout);

  // Nothing applies before the boundary.
  timers.fireInterval();
  assert.deepEqual(applied, []);

  // The clock reaches the next window; the boundary timeout fires.
  clock.now = JOURNAL_WINDOW_MS * 11;
  timers.fireTimeout();
  assert.deepEqual(applied, [11]);
  assert.equal(rotation.getCurrentIndex(), 11);
  assert.equal(rotation.getPendingIndex(), null);
  // …and the following boundary is already scheduled.
  assert.equal(timers.timeout?.ms, JOURNAL_WINDOW_MS + 50);
  rotation.stop();
});

test("auto-switch: the 30s safety interval catches a boundary the timeout missed", () => {
  const { clock, timers, applied, rotation } = fakeRotation(JOURNAL_WINDOW_MS * 3);
  rotation.start();
  // Timer throttling: the boundary timeout never fires, but the clock
  // has moved two windows on when the safety interval next runs.
  clock.now = JOURNAL_WINDOW_MS * 5 + 500;
  timers.fireInterval();
  assert.deepEqual(applied, [5]);
  assert.equal(rotation.getCurrentIndex(), 5);
  rotation.stop();
});

test("auto-switch: focus inside the section defers the swap until focus leaves", () => {
  const { clock, timers, applied, blockers, rotation } = fakeRotation(JOURNAL_WINDOW_MS * 7);
  rotation.start();
  blockers.focusInsideSection = true;
  clock.now = JOURNAL_WINDOW_MS * 8;
  timers.fireTimeout();
  // The new set is computed but NOT applied under the reader (§6).
  assert.deepEqual(applied, []);
  assert.equal(rotation.getCurrentIndex(), 7);
  assert.equal(rotation.getPendingIndex(), 8);
  // Recomputes while focus is still inside keep it deferred.
  rotation.recompute();
  assert.deepEqual(applied, []);
  assert.equal(rotation.getPendingIndex(), 8);
  // Focus leaves → the component's focusin recompute lands the set.
  blockers.focusInsideSection = false;
  rotation.recompute();
  assert.deepEqual(applied, [8]);
  assert.equal(rotation.getPendingIndex(), null);
  rotation.stop();
});

test("auto-switch: focus inside the home Journal card also defers the swap", () => {
  const { clock, timers, applied, blockers, rotation } = fakeRotation(JOURNAL_WINDOW_MS * 20);
  rotation.start();
  blockers.focusInsideCard = true;
  clock.now = JOURNAL_WINDOW_MS * 21;
  timers.fireInterval();
  assert.deepEqual(applied, []);
  assert.equal(rotation.getPendingIndex(), 21);
  blockers.focusInsideCard = false;
  rotation.recompute();
  assert.deepEqual(applied, [21]);
  rotation.stop();
});

test("auto-switch: no swap inside one window, and stop() clears both timers", () => {
  const { clock, timers, applied, rotation } = fakeRotation(JOURNAL_WINDOW_MS * 2 + 60_000);
  rotation.start();
  clock.now += 60_000; // still window 2
  timers.fireInterval();
  rotation.recompute();
  assert.deepEqual(applied, []);
  assert.equal(rotation.getPendingIndex(), null);
  const timeoutHandle = timers.timeout?.handle;
  const intervalHandle = timers.interval?.handle;
  rotation.stop();
  assert.deepEqual(timers.cleared, [timeoutHandle, intervalHandle]);
  assert.equal(timers.timeout, null);
  assert.equal(timers.interval, null);
});
