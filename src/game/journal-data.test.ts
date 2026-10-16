import assert from "node:assert/strict";
import test from "node:test";
import { PLACES, PLACES_BY_ID } from "./catalog.ts";
import { GEOGRAPHY_BY_RING, JOURNAL_NOTES, JOURNAL_SETS } from "./journal-data.ts";
import { confidenceForHref } from "./journal.ts";

/**
 * Dataset-vs-catalog integrity (spec §1/§4): the generated journal
 * dataset must match PLACES field for field — generation drift fails
 * the suite. Regenerate with: node scripts/build-journal-dataset.mjs
 */

test("dataset: exactly the catalog's 106 places, none missing or duplicated", () => {
  assert.equal(PLACES.length, 106);
  assert.equal(JOURNAL_NOTES.length, 106);
  const ids = JOURNAL_NOTES.map((n) => n.placeId);
  assert.equal(new Set(ids).size, ids.length, "no duplicated place in the dataset");
  assert.deepEqual(new Set(ids), new Set(PLACES.map((p) => p.id)), "no place missing");
});

test("dataset: every note's fields are verbatim from the catalog", () => {
  for (const note of JOURNAL_NOTES) {
    const place = PLACES_BY_ID[note.placeId];
    assert.ok(place, `${note.placeId} exists in the catalog`);
    assert.equal(note.title, place.name, `${note.placeId} title`);
    assert.equal(note.ring, place.ring, `${note.placeId} ring`);
    assert.equal(note.story, place.story, `${note.placeId} story is verbatim`);
    assert.equal(note.citation.label, place.source.label, `${note.placeId} citation label`);
    assert.equal(note.citation.href, place.source.href, `${note.placeId} citation href`);
    assert.equal(note.geography, GEOGRAPHY_BY_RING[place.ring], `${note.placeId} geography`);
  }
});

test("dataset: notes keep catalog order", () => {
  assert.deepEqual(
    JOURNAL_NOTES.map((n) => n.placeId),
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
    assert.deepEqual(note.confidence, confidenceForHref(note.citation.href), note.placeId);
  }
});

test("dataset: spot checks — capitol (.gov) verified, stadium (Wikipedia) cited", () => {
  const capitol = JOURNAL_NOTES.find((n) => n.placeId === "capitol");
  assert.ok(capitol);
  assert.equal(capitol.citation.href, "https://capitol.nebraska.gov/");
  assert.equal(capitol.confidence.tier, "verified");
  assert.equal(capitol.confidence.basis, "Government or university source");

  const stadium = JOURNAL_NOTES.find((n) => n.placeId === "memorial-stadium");
  assert.ok(stadium);
  assert.equal(stadium.confidence.tier, "cited");
  assert.equal(stadium.confidence.basis, "Named source recorded in the catalog");
});

test("dataset: sets reference real notes, every note exactly once", () => {
  assert.equal(JOURNAL_SETS.length, 36);
  const ids = JOURNAL_SETS.flatMap((s) => s.noteIds);
  assert.equal(ids.length, 106);
  assert.equal(new Set(ids).size, 106);
  const noteIds = new Set(JOURNAL_NOTES.map((n) => n.placeId));
  for (const id of ids) assert.ok(noteIds.has(id), `${id} resolves to a note`);
});
