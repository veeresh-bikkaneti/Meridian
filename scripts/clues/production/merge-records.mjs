// merge-records.mjs — fold the Option A production records into the
// Phase 2 audit trail, producing the union records file that final
// assembly reads.
//
// Run: node scripts/clues/production/merge-records.mjs
//        [--base <records.jsonl>] [--extra <records-full.jsonl>]
//        [--out <records-final.jsonl>] [--pool <pool.jsonl>]
//
// Rule: one record per place, in pool fame-rank order. An Option A
// record REPLACES the Phase 2 record for the same place (the Option
// A adjudication used strictly fuller source text, so it supersedes
// in both directions: a Phase 2 climate rejection can become an
// acceptance, and a Phase 2 record can be superseded by a fuller-
// evidence rejection). Places not attempted in Option A keep their
// Phase 2 record untouched — in particular the 63 Phase 2 accepted
// places were skipped by the Option A fetcher, so none of them can
// be replaced. Both input files stay on disk unchanged; the union
// is a third file, so the before/after comparison the report needs
// (e.g. climate rejection rate on re-attempted places) is always
// computable from committed artifacts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function resolvePath(value, fallback) {
  const p = value ?? fallback;
  return isAbsolute(p) ? p : join(HERE, p);
}

function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

/** Pure union: extra records replace base records per place_id. */
export function mergeRecords(base, extra) {
  const byPlace = new Map();
  for (const rec of base) byPlace.set(rec.place_id, rec);
  let replaced = 0;
  let added = 0;
  for (const rec of extra) {
    if (byPlace.has(rec.place_id)) replaced += 1;
    else added += 1;
    byPlace.set(rec.place_id, rec);
  }
  return { byPlace, replaced, added };
}

function main(argv) {
  const basePath = resolvePath(argValue(argv, "--base"), "records.jsonl");
  const extraPath = resolvePath(argValue(argv, "--extra"), "records-full.jsonl");
  const outPath = resolvePath(argValue(argv, "--out"), "records-final.jsonl");
  const poolPath = resolvePath(argValue(argv, "--pool"), "pool.jsonl");

  const rank = new Map(readJsonLines(poolPath).map((input, idx) => [input.place.place_id, idx + 1]));
  const base = readJsonLines(basePath);
  const extra = readJsonLines(extraPath);
  const { byPlace, replaced, added } = mergeRecords(base, extra);
  const ordered = [...byPlace.values()].sort(
    (a, b) => (rank.get(a.place_id) ?? 0) - (rank.get(b.place_id) ?? 0),
  );
  writeFileSync(outPath, ordered.map((r) => JSON.stringify(r)).join("\n") + (ordered.length ? "\n" : ""));
  const acceptedBase = base.filter((r) => r.status === "accepted").length;
  const acceptedExtra = extra.filter((r) => r.status === "accepted").length;
  const acceptedFinal = ordered.filter((r) => r.status === "accepted").length;
  console.log(
    JSON.stringify(
      {
        baseRecords: base.length,
        extraRecords: extra.length,
        replaced,
        added,
        finalRecords: ordered.length,
        acceptedBase,
        acceptedExtra,
        acceptedFinal,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
