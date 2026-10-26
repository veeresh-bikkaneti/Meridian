#!/usr/bin/env node
/**
 * build-journal-dataset.mjs — generates src/components/home-journal.data.ts
 * from the curated catalog (src/game/catalog.ts, PLACES), with the storybook
 * art overlay from scripts/journal-art-manifest.json merged in by note id.
 *
 * Journal spec (docs/journal-spec.md):
 *  - §1: the dataset is every catalog place with a non-empty `story` AND a
 *    recorded `source`; anything else is EXCLUDED and printed in the report
 *    below (no source → not published; card rule #5, no fabrication).
 *  - §2: geography labels come from the catalog `ring`.
 *  - §3: sets are ring-grouped triples in catalog order (33 pure sets);
 *    ring leftovers, in ring order, form remainder sets of 3, 3, 1
 *    (mixed, labeled "Field Notes") → 36 sets, every place exactly once.
 *  - §4: the confidence vote is computed mechanically from the citation
 *    URL host: host ending .gov/.edu → "verified", any other recorded
 *    source → "cited". Never hand-assigned. (Keep in sync with
 *    `confidenceForHref` in src/components/home-journal.ts — the unit
 *    tests pin both.)
 *
 * Art manifest (plan item 4 / ruling Q5): the catalog carries no image
 * fields, so #167's image/imageAlt values live in the manifest — the
 * generator's second input. The merge is deterministic (notes are visited
 * in catalog order, the manifest is looked up by id, and image/imageAlt
 * are appended after `confidence`) and every manifest problem is a HARD
 * FAIL: a missing or malformed manifest file, a duplicate id, an unknown
 * id, or an entry with `image` but no `imageAlt` aborts generation with a
 * named error. Regeneration must never silently wipe the art.
 *
 * Catalog `src(...)` calls (#200): the parser in parseCatalog tolerates
 * line breaks inside a call — after `src(`, around the comma, and
 * before `)` — because a formatter pass (Prettier, printWidth 100) can
 * rewrap a long call into that shape. The older one-line-only parser
 * silently dropped such a place from the dataset, and the loss only
 * surfaced later as a misleading art-manifest "unknown id" abort. A
 * present-but-unparseable `src(` call now fails loudly, naming the
 * place. See docs/journal-spec.md §1 for the same note.
 *
 * Dependency-free. Re-running on an unchanged catalog + manifest is
 * byte-stable.
 * Usage: node scripts/build-journal-dataset.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(root, "src/game/catalog.ts");
const MANIFEST_PATH = path.join(root, "scripts/journal-art-manifest.json");
const OUT_PATH = path.join(root, "src/components/home-journal.data.ts");

export const RING_ORDER = ["lincoln", "region", "nebraska", "usa", "world"];

export const GEOGRAPHY_BY_RING = {
  lincoln: "Lincoln, Nebraska",
  region: "Lincoln Region, Nebraska",
  nebraska: "Nebraska",
  usa: "United States",
  world: "The World",
};

export const REMAINDER_GEOGRAPHY = "Field Notes";

/** §4 rubric, on the citation href's host. */
export function confidenceForHref(href) {
  let host = "";
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (host.endsWith(".gov") || host.endsWith(".edu")) {
    return { tier: "verified", basis: "Government or university source" };
  }
  return { tier: "cited", basis: "Named source recorded in the catalog" };
}

/** Decode a double-quoted TS string literal body (handles \-escapes). */
function decodeString(raw) {
  return JSON.parse(`"${raw}"`);
}

/**
 * Parse PLACES out of catalog.ts. Every entry is a literal object with
 * `id` / `name` / `ring` string fields, a `story:` string, and
 * `source: src("label", "href")` — see the catalog header.
 *
 * The text is segmented into one block per entry (an entry starts at its
 * `id:` field). Structural integrity fails LOUD: the block count must
 * equal the raw `id:` tally, and every block must carry id/name/ring.
 * Content gaps are NOT structural (spec §1): a block whose `story:` or
 * `source:` field is genuinely MISSING parses with that field null, and
 * the caller excludes the place and prints it in the report — a missing
 * field must never become a parse throw or a silent drop.
 *
 * Wrapped `src(...)` calls (#200): the `source:` parser tolerates line
 * breaks anywhere whitespace may appear inside the call — after `src(`,
 * before or after the comma, and before `)`. This matters because
 * Prettier (printWidth 100) rewraps long one-line calls into exactly
 * that shape; the old one-line-only regex silently dropped such a
 * place from the dataset. A `src(` call that is present but still
 * unparseable (e.g. single-quoted arguments) is malformed, not
 * missing: parseCatalog throws, naming the place, instead of dropping
 * it silently.
 */
export function parseCatalog(sourceText) {
  const idTally = (sourceText.match(/\n\s*id: "/g) ?? []).length;
  const starts = [...sourceText.matchAll(/\n\s*\{\s*\n\s*id: "/g)].map((m) => m.index);
  if (starts.length !== idTally) {
    throw new Error(
      `catalog parse mismatch: segmented ${starts.length} entry blocks but the ` +
        `id tally is ${idTally}. The catalog shape changed — update the parser, ` +
        `do not ship a partial dataset.`,
    );
  }
  const places = [];
  for (let i = 0; i < starts.length; i++) {
    const block = sourceText.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : undefined);
    const id = block.match(/id:\s*"((?:[^"\\]|\\.)*)"/);
    const name = block.match(/name:\s*"((?:[^"\\]|\\.)*)"/);
    const ring = block.match(/ring:\s*"((?:[^"\\]|\\.)*)"/);
    if (!id || !name || !ring) {
      throw new Error(
        `catalog entry block #${i + 1} is missing id/name/ring — structural ` +
          `damage, not a §1 exclusion. Fix the catalog or the parser.`,
      );
    }
    const story = block.match(/story:\s*\n?\s*"((?:[^"\\]|\\.)*)"/);
    const source = block.match(/source:\s*src\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/);
    if (!source && /\bsource\s*:\s*src\s*\(/.test(block)) {
      // A src(...) call is PRESENT but unparseable — that is malformed,
      // not missing. Throwing here (naming the place) is what stops a
      // formatting change from silently dropping the place from the
      // dataset (#200). A genuinely missing source: field still parses
      // as null below and is excluded/reported by the caller, per §1.
      throw new Error(
        `catalog entry "${decodeString(id[1])}" has a source: src(...) call the parser ` +
          `could not parse — it would otherwise be silently excluded as a missing ` +
          `source. Fix the catalog formatting or the parser.`,
      );
    }
    places.push({
      id: decodeString(id[1]),
      name: decodeString(name[1]),
      ring: decodeString(ring[1]),
      story: story ? decodeString(story[1]) : null,
      source: source ? { label: decodeString(source[1]), href: decodeString(source[2]) } : null,
    });
  }
  return places;
}

/** §3 set formation: pure ring triples, then remainder sets of 3, 3, 1. */
export function formSets(notes) {
  const sets = [];
  const leftovers = [];
  for (const ring of RING_ORDER) {
    const inRing = notes.filter((n) => n.ring === ring);
    const full = Math.floor(inRing.length / 3);
    for (let i = 0; i < full; i++) {
      const chunk = inRing.slice(i * 3, i * 3 + 3);
      sets.push({ geography: GEOGRAPHY_BY_RING[ring], mixed: false, noteIds: chunk.map((n) => n.id) });
    }
    leftovers.push(...inRing.slice(full * 3));
  }
  for (let i = 0; i < leftovers.length; i += 3) {
    const chunk = leftovers.slice(i, i + 3);
    sets.push({ geography: REMAINDER_GEOGRAPHY, mixed: true, noteIds: chunk.map((n) => n.id) });
  }
  return sets;
}

/**
 * Find a duplicated top-level key in a JSON object text. JSON.parse alone
 * cannot do this (a later duplicate silently overwrites the earlier one),
 * so the raw text is scanned: a string token at depth 1 followed by ":"
 * is a top-level key.
 */
function duplicateTopLevelKey(rawText) {
  let depth = 0;
  const seen = new Set();
  let i = 0;
  while (i < rawText.length) {
    const ch = rawText[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < rawText.length && rawText[j] !== '"') {
        if (rawText[j] === "\\") j += 1;
        j += 1;
      }
      const token = rawText.slice(i, j + 1);
      let k = j + 1;
      while (k < rawText.length && /\s/.test(rawText[k])) k += 1;
      if (depth === 1 && rawText[k] === ":") {
        let key;
        try {
          key = JSON.parse(token);
        } catch {
          key = token;
        }
        if (seen.has(key)) return key;
        seen.add(key);
      }
      i = j + 1;
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") depth -= 1;
    i += 1;
  }
  return null;
}

/**
 * Parse + validate the art manifest text. Every problem is a hard fail
 * with a named error (plan item 4): malformed JSON, a non-object manifest
 * or entry, a duplicate id, or an entry with `image` but no `imageAlt`.
 * (Unknown ids can only be judged against the generated notes — that
 * check lives in applyArtManifest.)
 */
export function parseArtManifest(rawText) {
  let manifest;
  try {
    manifest = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`journal art manifest is malformed (invalid JSON: ${err.message}) — generation aborted.`);
  }
  const duplicate = duplicateTopLevelKey(rawText);
  if (duplicate !== null) {
    throw new Error(`journal art manifest has a duplicate id "${duplicate}" — generation aborted.`);
  }
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("journal art manifest is malformed (top level must be an object keyed by note id) — generation aborted.");
  }
  for (const [id, entry] of Object.entries(manifest)) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`journal art manifest entry "${id}" is malformed (must be an object with image/imageAlt) — generation aborted.`);
    }
    for (const key of Object.keys(entry)) {
      if (key !== "image" && key !== "imageAlt") {
        throw new Error(`journal art manifest entry "${id}" is malformed (unknown field "${key}") — generation aborted.`);
      }
    }
    if (entry.image !== undefined && typeof entry.image !== "string") {
      throw new Error(`journal art manifest entry "${id}" is malformed (image must be a string) — generation aborted.`);
    }
    if (entry.imageAlt !== undefined && typeof entry.imageAlt !== "string") {
      throw new Error(`journal art manifest entry "${id}" is malformed (imageAlt must be a string) — generation aborted.`);
    }
    if (entry.image && !entry.imageAlt) {
      throw new Error(
        `journal art manifest entry "${id}" has an image but no imageAlt — generation aborted.`,
      );
    }
    if (!entry.image) {
      throw new Error(`journal art manifest entry "${id}" is malformed (carries no image) — generation aborted.`);
    }
  }
  return manifest;
}

/**
 * Merge the manifest into the notes, deterministically: notes are
 * visited in catalog order, the manifest is looked up by id, and
 * image/imageAlt are appended after `confidence` (the merged-schema key
 * order). A manifest id that matches no generated note is a hard fail.
 * Returns the ids that received art, in catalog order.
 */
export function applyArtManifest(notes, manifest) {
  const noteIds = new Set(notes.map((n) => n.id));
  for (const id of Object.keys(manifest)) {
    if (!noteIds.has(id)) {
      throw new Error(`journal art manifest names unknown note id "${id}" — generation aborted.`);
    }
  }
  const merged = [];
  for (const note of notes) {
    const entry = manifest[note.id];
    if (entry) {
      note.image = entry.image;
      note.imageAlt = entry.imageAlt;
      merged.push(note.id);
    }
  }
  return merged;
}

/** Read the manifest file; a missing file is a hard fail, never an empty merge. */
function readArtManifest() {
  let rawText;
  try {
    rawText = readFileSync(MANIFEST_PATH, "utf8");
  } catch {
    throw new Error(
      `journal art manifest is missing (${path.relative(root, MANIFEST_PATH)}) — generation aborted. ` +
        `The manifest is a required generator input; regeneration without it would wipe the storybook art.`,
    );
  }
  return parseArtManifest(rawText);
}

function main() {
  const catalogText = readFileSync(CATALOG_PATH, "utf8");
  const places = parseCatalog(catalogText);
  const manifest = readArtManifest();

  const notes = [];
  const excluded = [];
  for (const place of places) {
    // §1 exclusion rule: no usable story or no recorded citation → the
    // place is NOT published in the journal, and the report below names
    // it with its reason. A genuinely missing field (null from the
    // parser) lands here exactly like an empty one.
    const reason =
      place.story === null
        ? "missing story field"
        : place.story.trim() === ""
          ? "empty story"
          : place.source === null
            ? "missing source field"
            : place.source.label.trim() === ""
              ? "empty citation label"
              : place.source.href.trim() === ""
                ? "empty citation href"
                : null;
    if (reason !== null) {
      excluded.push(`${place.id} (${reason})`);
      continue;
    }
    // Security guard: a citation becomes a rendered link in the journal
    // view — only web protocols may ever reach it.
    let protocol = "";
    try {
      protocol = new URL(place.source.href).protocol;
    } catch {
      throw new Error(`place ${place.id} has an unparseable citation href: ${place.source.href}`);
    }
    if (protocol !== "http:" && protocol !== "https:") {
      throw new Error(
        `place ${place.id} citation href protocol "${protocol}" is not http:/https: — refusing to generate.`,
      );
    }
    if (!RING_ORDER.includes(place.ring)) {
      throw new Error(`place ${place.id} has unknown ring "${place.ring}" — no geography label exists for it.`);
    }
    notes.push({
      id: place.id,
      place: place.name,
      ring: place.ring,
      where: GEOGRAPHY_BY_RING[place.ring],
      story: place.story,
      sourceLabel: place.source.label,
      sourceHref: place.source.href,
      confidence: confidenceForHref(place.source.href),
    });
  }

  const artIds = applyArtManifest(notes, manifest);

  const sets = formSets(notes);

  const tierCounts = { verified: 0, cited: 0 };
  for (const note of notes) tierCounts[note.confidence.tier] += 1;
  const setSizes = sets.map((s) => s.noteIds.length);
  const seen = sets.flatMap((s) => s.noteIds);
  if (new Set(seen).size !== seen.length || seen.length !== notes.length) {
    throw new Error("set formation invariant broken: every note must appear exactly once across the sets.");
  }

  const header = [
    "// Generated by scripts/build-journal-dataset.mjs — do not edit by hand.",
    "// Regenerate: node scripts/build-journal-dataset.mjs",
    "// Source of truth: PLACES in src/game/catalog.ts (stories and citations",
    "// are verbatim from the catalog; confidence is computed mechanically",
    "// from the citation host — see docs/journal-spec.md §4) plus the",
    "// storybook art overlay in scripts/journal-art-manifest.json.",
    "",
    'import type { RingId } from "../game/types.ts";',
    "",
    'export type JournalConfidenceTier = "verified" | "cited";',
    "",
    "export interface JournalNote {",
    "  id: string;",
    "  place: string;",
    "  ring: RingId;",
    "  where: string;",
    "  story: string;",
    "  sourceLabel: string;",
    "  sourceHref: string;",
    "  confidence: { tier: JournalConfidenceTier; basis: string };",
    "  /** Optional storybook drawing for the note (path under public/, e.g.",
    '   *  "images/journal/taj.webp"). Notes without art render as before. */',
    "  image?: string;",
    "  /** One-sentence, kid-friendly description of the drawing (required",
    "   *  whenever image is set). */",
    "  imageAlt?: string;",
    "}",
    "",
    "export interface JournalSetData {",
    "  /** Shared geography label, or \"Field Notes\" for mixed remainder sets. */",
    "  geography: string;",
    "  /** True for the mixed-geography remainder sets (spec §3). */",
    "  mixed: boolean;",
    "  noteIds: string[];",
    "}",
    "",
  ].join("\n");

  const body =
    `export const GEOGRAPHY_BY_RING: Record<RingId, string> = ${JSON.stringify(GEOGRAPHY_BY_RING, null, 2)};\n\n` +
    `export const JOURNAL_NOTES: JournalNote[] = ${JSON.stringify(notes, null, 2)};\n\n` +
    `export const JOURNAL_SETS: JournalSetData[] = ${JSON.stringify(sets, null, 2)};\n`;

  writeFileSync(OUT_PATH, header + body);

  console.log("Journal dataset report");
  console.log(`  catalog places parsed: ${places.length}`);
  console.log(`  notes included: ${notes.length}`);
  console.log(`  notes excluded: ${excluded.length}${excluded.length ? ` (${excluded.join(", ")})` : ""}`);
  console.log(`  confidence tiers: verified=${tierCounts.verified} cited=${tierCounts.cited}`);
  console.log(`  sets: ${sets.length} (sizes: ${setSizes.join(", ")})`);
  console.log(`  pure sets: ${sets.filter((s) => !s.mixed).length}, remainder sets: ${sets.filter((s) => s.mixed).length}`);
  console.log(`  art notes merged: ${artIds.length}${artIds.length ? ` (${artIds.join(", ")})` : ""}`);
  console.log(`  wrote ${path.relative(root, OUT_PATH)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
