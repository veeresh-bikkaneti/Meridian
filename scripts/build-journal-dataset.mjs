#!/usr/bin/env node
/**
 * build-journal-dataset.mjs — generates src/game/journal-data.ts from the
 * curated catalog (src/game/catalog.ts, PLACES).
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
 *    `confidenceForHref` in src/game/journal.ts — the unit tests pin both.)
 *
 * Dependency-free. Re-running on an unchanged catalog is byte-stable.
 * Usage: node scripts/build-journal-dataset.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(root, "src/game/catalog.ts");
const OUT_PATH = path.join(root, "src/game/journal-data.ts");

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
    const source = block.match(/source:\s*src\("((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\)/);
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
      sets.push({ geography: GEOGRAPHY_BY_RING[ring], mixed: false, noteIds: chunk.map((n) => n.placeId) });
    }
    leftovers.push(...inRing.slice(full * 3));
  }
  for (let i = 0; i < leftovers.length; i += 3) {
    const chunk = leftovers.slice(i, i + 3);
    sets.push({ geography: REMAINDER_GEOGRAPHY, mixed: true, noteIds: chunk.map((n) => n.placeId) });
  }
  return sets;
}

function main() {
  const catalogText = readFileSync(CATALOG_PATH, "utf8");
  const places = parseCatalog(catalogText);

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
      placeId: place.id,
      title: place.name,
      ring: place.ring,
      geography: GEOGRAPHY_BY_RING[place.ring],
      story: place.story,
      citation: { label: place.source.label, href: place.source.href },
      confidence: confidenceForHref(place.source.href),
    });
  }

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
    "// from the citation host — see docs/journal-spec.md §4).",
    "",
    'import type { RingId } from "./types.ts";',
    "",
    'export type JournalConfidenceTier = "verified" | "cited";',
    "",
    "export interface JournalNote {",
    "  placeId: string;",
    "  title: string;",
    "  ring: RingId;",
    "  geography: string;",
    "  story: string;",
    "  citation: { label: string; href: string };",
    "  confidence: { tier: JournalConfidenceTier; basis: string };",
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
    `\nexport const RING_ORDER: RingId[] = ${JSON.stringify(RING_ORDER)};\n\n` +
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
  console.log(`  wrote ${path.relative(root, OUT_PATH)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
