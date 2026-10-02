#!/usr/bin/env node
/**
 * migrate-notable-to-history.mjs — structural fix for the notable-note flaw.
 *
 * BEFORE: scripts/build-geonames-dataset.mjs appended each curated notable
 * note (src/game/data/notable-notes.json) to the END of the geography-first
 * blurb, burying the history hook inside `blurb` and violating rule #1
 * (history first, modern identity second).
 *
 * AFTER: the note travels as the first-class `history` field on the chunk
 * record, alongside `wiki`; the blurb is pure geography. The generator was
 * fixed to emit this shape; this script migrates the already-built chunks
 * in place.
 *
 * The runtime (src/game/generated-places.ts `toStarter`) already composes
 * `story = hook ? hook + blurb : blurb` with fact > history precedence, so
 * no runtime change is needed.
 *
 * Idempotent and safe to re-run: a record whose `history` already equals the
 * note and whose blurb no longer contains it is left untouched (no rewrite).
 *
 * Usage: node scripts/migrate-notable-to-history.mjs
 * Exit code 0 on success (even with reported anomalies); 1 on I/O failure.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOTES_PATH = join(REPO, "src", "game", "data", "notable-notes.json");
const CHUNKS_DIR = join(REPO, "src", "game", "data", "geonames", "chunks");

const notes = JSON.parse(readFileSync(NOTES_PATH, "utf8"));
const ids = Object.keys(notes).filter((k) => !k.startsWith("_"));

// Load all chunks once, index records by their "gn-<geonameid>" id.
const chunkFiles = readdirSync(CHUNKS_DIR)
  .filter((f) => f.endsWith(".json") && f !== "manifest.json")
  .sort();
const chunks = [];
const byId = new Map();
for (const file of chunkFiles) {
  const chunk = JSON.parse(readFileSync(join(CHUNKS_DIR, file), "utf8"));
  const entry = { file, chunk, dirty: false };
  chunks.push(entry);
  for (const place of chunk.places) {
    byId.set(place.id, { chunk: entry, place });
  }
}

const stats = {
  migrated: 0, // record found, history set, note stripped from blurb
  missing: [], // notable ID has no record in any chunk
  nonverbatim: [], // record found but note not verbatim in blurb (" " + note)
  collisions: [], // record already had a different non-empty history (overwritten)
  hookMissingCleared: 0,
};

for (const id of ids) {
  const note = notes[id].note;
  const wiki = notes[id].wiki;
  const found = byId.get(`gn-${id}`);
  if (!found) {
    stats.missing.push(`gn-${id}`);
    continue;
  }
  const { chunk, place } = found;

  // Curated note wins over any pre-existing history — Veeresh-curated —
  // but the collision is reported so a human can review it.
  if (typeof place.history === "string" && place.history.length > 0 && place.history !== note) {
    stats.collisions.push({ id: `gn-${id}`, was: place.history.slice(0, 80) });
  }

  // Strip the note verbatim from the blurb (it was appended as " " + note).
  // Anything else is "not verbatim": report it, don't guess at a fuzzy strip.
  // (On re-runs the note is already gone and history already set — stay silent.)
  const beforeRec = JSON.stringify(place);
  const historyAlreadySet = place.history === note;
  const embedded = ` ${note}`;
  if (typeof place.blurb === "string" && place.blurb.includes(embedded)) {
    let b = place.blurb.split(embedded).join("");
    b = b.replace(/\. \./g, ".").replace(/\s+/g, " ").trim();
    place.blurb = b;
    stats.migrated++;
  } else if (!historyAlreadySet) {
    stats.nonverbatim.push(`gn-${id}`);
  }

  // Rebuild the record so `history` sits right after `blurb`, before `wiki`
  // — the same key order the fixed generator emits — and drop hookMissing.
  const rebuilt = {};
  for (const key of Object.keys(place)) {
    if (key === "history" || key === "hookMissing") continue;
    if (key === "wiki") rebuilt.history = note;
    rebuilt[key] = place[key];
  }
  if (!("history" in rebuilt)) rebuilt.history = note; // record had no wiki key
  if (!("wiki" in rebuilt) && wiki) rebuilt.wiki = wiki;
  if (place.hookMissing) stats.hookMissingCleared++;
  Object.keys(place).forEach((k) => delete place[k]);
  Object.assign(place, rebuilt);
  if (JSON.stringify(place) !== beforeRec) chunk.dirty = true;
}

// Persist only chunks that actually changed (byte-identical otherwise).
let wrote = 0;
for (const { file, chunk, dirty } of chunks) {
  if (!dirty) continue;
  writeFileSync(join(CHUNKS_DIR, file), JSON.stringify(chunk) + "\n");
  wrote++;
}

console.log(`notable notes processed: ${ids.length}`);
console.log(`records migrated (note stripped from blurb): ${stats.migrated}`);
console.log(`chunks rewritten: ${wrote}`);
console.log(`hookMissing markers cleared: ${stats.hookMissingCleared}`);
for (const id of stats.missing) console.log(`MISSING (no chunk record): ${id}`);
for (const id of stats.nonverbatim) console.log(`NONVERBATIM (note not " " + note in blurb): ${id}`);
for (const c of stats.collisions) console.log(`COLLISION (history overwritten): ${c.id} was: ${c.was}…`);
