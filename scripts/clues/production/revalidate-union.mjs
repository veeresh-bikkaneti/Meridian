// revalidate-union.mjs — coordinator driver for the tier-2 expansion
// run: re-validate every accepted record in a records file against a
// GIVEN inputs file, using the shipped validator library
// (../validate-clues.mjs validateRecord — the same function
// validate-production.mjs folds with; neither file is modified).
//
// Run: node scripts/clues/production/revalidate-union.mjs
//        --records <records.jsonl> --inputs <inputs.jsonl>
//        [--out <clean-records.jsonl>]
//
// Accepted records that fail are reported with their reason codes and
// are NOT dropped silently: the summary counts them and the caller
// decides (repair or exclude with a documented reason). Rejection
// records pass through untouched. With --out, writes the records file
// restricted to validated-accepted + original rejections, preserving
// input order.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRecord } from "../validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function argValue(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}
function resolvePath(value) {
  return isAbsolute(value) ? value : join(HERE, value);
}
function readJsonLines(path) {
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function main(argv = []) {
  const recordsPath = resolvePath(argValue(argv, "--records"));
  const inputsPath = resolvePath(argValue(argv, "--inputs"));
  const outPath = argValue(argv, "--out") ? resolvePath(argValue(argv, "--out")) : null;

  const inputs = new Map(readJsonLines(inputsPath).map((i) => [i.place.place_id, i]));
  const records = readJsonLines(recordsPath);
  const failures = [];
  let accepted = 0;
  let rejected = 0;
  let okCount = 0;
  const kept = [];
  for (const rec of records) {
    if (rec.status === "rejected") {
      rejected += 1;
      kept.push(rec);
      continue;
    }
    if (rec.status !== "accepted") {
      failures.push({ place_id: rec.place_id, codes: ["UNRECOGNIZED_STATUS"] });
      continue;
    }
    accepted += 1;
    const input = inputs.get(rec.place_id);
    if (!input) {
      failures.push({ place_id: rec.place_id, codes: ["NO_INPUT"] });
      continue;
    }
    const res = validateRecord(rec, { input });
    if (res.ok) {
      okCount += 1;
      kept.push(rec);
    } else {
      failures.push({ place_id: rec.place_id, codes: res.reasons.map((r) => r.code) });
    }
  }
  console.log(
    JSON.stringify(
      { records: recordsPath.split("/").pop(), total: records.length, accepted, rejected, acceptedValid: okCount, acceptedInvalid: failures.length, failures },
      null,
      2,
    ),
  );
  if (outPath) writeFileSync(outPath, kept.map((r) => JSON.stringify(r)).join("\n") + "\n");
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
