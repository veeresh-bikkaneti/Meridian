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
 * `source: src("label", "href")` — see the catalog header. The regex is
 * anchored per-entry (non-greedy up to that entry's own story/source), and
 * the counts are cross-checked against the raw field tallies so a catalog
 * shape change fails loudly here instead of silently dropping a place.
 */
export function parseCatalog(sourceText) {
  const entryRe =
    /id:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*name:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*ring:\s*"((?:[^"\\]|\\.)*)",[\s\S]*?story:\s*\n?\s*"((?:[^"\\]|\\.)*)",\s*\n\s*source:\s*src\("((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\)/g;
  const places = [];
  for (const m of sourceText.matchAll(entryRe)) {
    places.push({
      id: decodeString(m[1]),
      name: decodeString(m[2]),
      ring: decodeString(m[3]),
      story: decodeString(m[4]),
      source: { label: decodeString(m[5]), href: decodeString(m[6]) },
    });
  }
  const tallies = {
    ids: (sourceText.match(/\n\s*id: "/g) ?? []).length,
    stories: (sourceText.match(/\n\s*story:/g) ?? []).length,
    sources: (sourceText.match(/\n\s*source: src\(/g) ?? []).length,
  };
  if (places.length !== tallies.ids || places.length !== tallies.stories || places.length !== tallies.sources) {
    throw new Error(
      `catalog parse mismatch: parsed ${places.length} entries but tallies are ` +
        `ids=${tallies.ids} stories=${tallies.stories} sources=${tallies.sources}. ` +
        `The catalog shape changed — update the parser, do not ship a partial dataset.`,
    );
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
    if (!place.story || place.story.trim() === "" || !place.source || !place.source.href) {
      excluded.push(place.id);
      continue;
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
