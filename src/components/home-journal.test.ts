import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { JOURNAL_NOTES } from "./home-journal.data.ts";
import {
  JOURNAL_PAGE,
  JOURNAL_WINDOW_MS,
  journalImageUrl,
  notesForWindow,
} from "./home-journal.ts";

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

test("notes change every 2 hours and then cycle", () => {
  const first = notesForWindow(0);
  const next = notesForWindow(JOURNAL_WINDOW_MS);
  const same = notesForWindow(JOURNAL_WINDOW_MS - 1);
  assert.deepEqual(same.notes.map((n) => n.id), first.notes.map((n) => n.id));
  assert.notDeepEqual(next.notes.map((n) => n.id), first.notes.map((n) => n.id));
  assert.equal(first.notes.length, JOURNAL_PAGE);
  assert.equal(first.nextAt, JOURNAL_WINDOW_MS);
});
