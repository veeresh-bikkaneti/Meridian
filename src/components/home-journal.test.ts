import assert from "node:assert/strict";
import { test } from "node:test";
import { JOURNAL_NOTES } from "./home-journal.data.ts";
import { JOURNAL_PAGE, JOURNAL_WINDOW_MS, notesForWindow } from "./home-journal.ts";

test("the journal dataset is the catalog, with a source on every note", () => {
  assert.equal(JOURNAL_NOTES.length, 106);
  const ids = new Set(JOURNAL_NOTES.map((n) => n.id));
  assert.equal(ids.size, JOURNAL_NOTES.length);
  for (const note of JOURNAL_NOTES) {
    assert.ok(note.story.length > 40);
    assert.ok(note.sourceHref.startsWith("https://"));
  }
});

test("notes change every 2 hours and then cycle", () => {
  const first = notesForWindow(0);
  const next = notesForWindow(JOURNAL_WINDOW_MS);
  const same = notesForWindow(JOURNAL_WINDOW_MS - 1);
  assert.deepEqual(same.notes.map((n) => n.id), first.notes.map((n) => n.id));
  assert.notDeepEqual(next.notes.map((n) => n.id), first.notes.map((n) => n.id));
  assert.equal(first.notes.length, JOURNAL_PAGE);
  assert.equal(first.nextAt, JOURNAL_WINDOW_MS);
});
