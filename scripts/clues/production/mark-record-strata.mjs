// mark-record-strata.mjs — add a per-record input-stratum disclosure
// marker to every ACCEPTED record in records-tier2.jsonl.
//
// Why: T3 verdicts (Veeresh, 2026-10-04; reviews/t3-verdicts.md)
// accepted the quote-widening disclosure — the batch's tier-2 quotes
// were recorded against three different input shapes across the
// production strata. This script puts that disclosure INTO the audit
// artifact: each accepted record gains `tier2_input_stratum`, naming
// the input shape its tier-2 quote was recorded against. No clue text,
// quote, or any other field is altered; rejected records are passed
// through untouched; no published file is touched.
//
// Run: node scripts/clues/production/mark-record-strata.mjs [--dry-run]
//
// Strata (input shapes):
//   "phase2-short-extract" — Phase 2 production. Input: pool.jsonl,
//     whose extract is the Wikipedia crawl cache's short lead excerpt
//     (median ~47 words). Records file: records.jsonl.
//   "option-a-fuller-lead" — Option A production. Input:
//     .scratch/geodetective/full-inputs.jsonl (fuller article leads,
//     median ~181 words, lead only — no section extract). Records
//     file: records-full.jsonl.
//   "expansion-section" — tier-2 source-expansion run. Input: fuller
//     lead PLUS the article's Climate section (Geography fallback) as
//     a second extract; tier 2 could cite either. Records files:
//     records-scope.jsonl (scoping sample) and
//     records-tier2-wave1.jsonl / records-tier2-wave2.jsonl (waves).
//
// DERIVATION RULE (mechanical; no judgment calls, no silent guesses):
// A record's stratum is the stratum of the stage records file in
// which its place_id carries an `accepted` record. This is sound
// because of how the union was built and certified:
//   * The union (records-union-step1.jsonl, then records-tier2.jsonl)
//     folds the stage files by supersession, carrying each place's
//     record byte-identically from exactly one stage file — verified
//     first-hand at milestone 0 (reviews/milestone-0-review.md,
//     Check 1: all 8,690 union lines byte-identical to their
//     superseding stratum line under scope > full > Phase 2
//     supersession) and re-verified by this script on every run.
//   * The accepted place_id sets of the five stage files are pairwise
//     disjoint (Phase 2's 63 accepted were skipped by the Option A
//     fetcher; the scope sample and the waves drew only from places
//     rejected at tier 2 in Option A). If a place_id were accepted in
//     more than one stage file, attribution would be ambiguous: the
//     script reports it and REFUSES to write. It never guesses.
//   * Re-validated baseline records: milestone-0 revalidation
//     re-checked each stratum's records against that stratum's OWN
//     inputs (pool.jsonl / full-inputs / scope-inputs) and modified
//     nothing, so a folded baseline record's tier-2 quote still traces
//     to its origin stratum's input shape.
//   * Quote-repaired records: every repair (Phase 2 writing-cap
//     repairs, the wave-1 coordinator repair loop, the Savannah tier-5
//     patch) was applied inside the producing stratum's workflow
//     BEFORE the fold; the stage files on the branch are those
//     post-repair finals, carried byte-identically into the union, so
//     stage attribution already reflects the repaired records.
//   * Post-fold modifications: the only post-fold content changes in
//     the union file's history are the T1 repairs — Palestina
//     gn-3673269 (accepted -> §6 rejection; it is no longer accepted,
//     so it receives NO marker) and Bremerhaven gn-2944368 (tier-5
//     recompose: clues[4] + repair_note only; tier 2 untouched). The
//     script byte-compares every accepted union record against its
//     stage line; any record that is not byte-identical is reported
//     with its differing field paths, and the script ABORTS if a
//     difference touches tier 2 (clues[1]) or any field outside the
//     allowed post-fold set {clues[4], repair_note} — a post-fold
//     tier-2 change would invalidate place-based attribution, and
//     this script fails closed rather than assert provenance it
//     cannot prove.
//
// Safety properties:
//   * Refuses to run if any accepted record already carries the
//     marker (no double-marking).
//   * Asserts JSON round-trip fidelity (stringify(parse(line)) ===
//     line) for every line before modifying anything, so the only
//     possible diff is the appended marker field.
//   * Line count and line order of records-tier2.jsonl are preserved.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = join(HERE, "records-tier2.jsonl");
const MARKER = "tier2_input_stratum";

// Stage files in fold order, with the stratum each one evidences.
const STAGES = [
  { file: "records.jsonl", stratum: "phase2-short-extract" },
  { file: "records-full.jsonl", stratum: "option-a-fuller-lead" },
  { file: "records-scope.jsonl", stratum: "expansion-section" },
  { file: "records-tier2-wave1.jsonl", stratum: "expansion-section" },
  { file: "records-tier2-wave2.jsonl", stratum: "expansion-section" },
];

// Field paths a post-fold repair may legitimately have changed on an
// accepted record without affecting tier-2 provenance.
const ALLOWED_POSTFOLD_PREFIXES = ["clues.4", "repair_note"];

function readLines(path) {
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
}

function diffPaths(a, b, prefix = "", out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const aObj = a !== null && typeof a === "object";
  const bObj = b !== null && typeof b === "object";
  if (!aObj || !bObj) {
    out.push(prefix);
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
    if (a[k] !== null && b[k] !== null && typeof a[k] === "object" && typeof b[k] === "object") {
      diffPaths(a[k], b[k], p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function fail(report) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

function main(argv = []) {
  const dryRun = argv.includes("--dry-run");

  // 1. Round-trip fidelity of the target file (abort before touching).
  const targetLines = readLines(TARGET);
  const records = targetLines.map((line, i) => {
    const rec = JSON.parse(line);
    if (JSON.stringify(rec) !== line) {
      fail({ error: "ROUND_TRIP_MISMATCH", line: i + 1, place_id: rec.place_id });
    }
    return rec;
  });

  // 2. Lineage: place_id -> accepted stage evidence.
  const acceptedStage = new Map(); // place_id -> [{file, stratum, raw}]
  for (const { file, stratum } of STAGES) {
    for (const line of readLines(join(HERE, file))) {
      const rec = JSON.parse(line);
      if (rec.status !== "accepted") continue;
      if (!acceptedStage.has(rec.place_id)) acceptedStage.set(rec.place_id, []);
      acceptedStage.get(rec.place_id).push({ file, stratum, raw: line });
    }
  }
  const ambiguous = [...acceptedStage.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);
  if (ambiguous.length) {
    fail({ error: "AMBIGUOUS_PROVENANCE", places: ambiguous });
  }

  // 3. Mark accepted records; audit byte-identity and post-fold diffs.
  const counts = {};
  const postFoldModified = [];
  let marked = 0;
  let byteIdentical = 0;
  const outLines = records.map((rec, i) => {
    if (rec.status !== "accepted") return targetLines[i];
    if (MARKER in rec) fail({ error: "ALREADY_MARKED", place_id: rec.place_id });
    const evidence = acceptedStage.get(rec.place_id);
    if (!evidence || evidence.length !== 1) {
      fail({ error: "NO_STAGE_EVIDENCE", place_id: rec.place_id });
    }
    const { file, stratum, raw } = evidence[0];
    if (raw === targetLines[i]) {
      byteIdentical += 1;
    } else {
      const paths = diffPaths(rec, JSON.parse(raw));
      const disallowed = paths.filter(
        (p) => !ALLOWED_POSTFOLD_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}.`)),
      );
      if (disallowed.length) {
        fail({
          error: "POSTFOLD_DIFF_OUTSIDE_ALLOWED_SET",
          place_id: rec.place_id,
          stage_file: file,
          differing_paths: paths,
          disallowed_paths: disallowed,
        });
      }
      postFoldModified.push({ place_id: rec.place_id, stage_file: file, differing_paths: paths });
    }
    counts[stratum] = (counts[stratum] ?? 0) + 1;
    marked += 1;
    return JSON.stringify({ ...rec, [MARKER]: stratum });
  });

  const report = {
    target: "records-tier2.jsonl",
    dryRun,
    totalLines: targetLines.length,
    acceptedMarked: marked,
    rejectedUntouched: targetLines.length - marked,
    countsByStratum: counts,
    byteIdenticalToStageLine: byteIdentical,
    postFoldModified,
    ambiguous: [],
  };
  console.log(JSON.stringify(report, null, 2));

  if (!dryRun) writeFileSync(TARGET, outLines.join("\n") + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
