// validate-production.mjs — validate every worker tranche output
// against the pool inputs and fold the results into the audit trail.
//
// Run: node scripts/clues/production/validate-production.mjs
//
// Reads:  pool.jsonl, tranches/out/*.jsonl (worker outputs, filename order)
// Writes: records.jsonl          — one record per attempted place, in
//                                  pool rank order: validator-passed
//                                  accepted records verbatim, §6
//                                  rejection records for everything else
//         validation-stats.json  — counts + reason histograms
//
// Folding rules (deterministic):
// - Worker "accepted" records go through validateRecord() against
//   their §9 pool input. Pass → kept verbatim. Fail → converted with
//   toRejectionRecord() and counted in the validator-reason histogram.
// - Worker "rejected" records must satisfy the §6 shape
//   (validateRejectionRecord); malformed ones are replaced by a
//   set-level rejection that preserves the worker's stated reason.
// - Unparseable lines, unknown place_ids, duplicate place_ids, and
//   records with any other status are counted in stats and never
//   silently dropped: unparseable/duplicate/orphan lines are listed
//   in validation-stats.json under pipelineIssues.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SCHEMA_ID } from "../schema.mjs";
import {
  toRejectionRecord,
  validateRecord,
  validateRejectionRecord,
} from "../validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TRANCHES_DIR = join(HERE, "tranches", "out");

function readJsonLines(path) {
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
}

function setRejection(placeId, reason, missing) {
  return {
    schema: SCHEMA_ID,
    status: "rejected",
    place_id: placeId,
    rejection: { tier: 0, tier_name: "set", reason, missing },
  };
}

function main() {
  const poolInputs = new Map();
  const poolRank = new Map();
  readJsonLines(join(HERE, "pool.jsonl")).forEach((line, idx) => {
    const input = JSON.parse(line);
    poolInputs.set(input.place.place_id, input);
    poolRank.set(input.place.place_id, idx + 1);
  });

  const stats = {
    attempted: 0,
    accepted: 0,
    workerRejected: 0,
    validatorRejected: 0,
    malformedWorkerRejections: 0,
    validatorReasonHistogram: {},
    workerRejectionTierHistogram: {},
    pipelineIssues: [],
  };
  const byPlace = new Map();

  const trancheFiles = readdirSync(TRANCHES_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();
  for (const file of trancheFiles) {
    const lines = readJsonLines(join(TRANCHES_DIR, file));
    lines.forEach((line, lineIdx) => {
      const where = `${file}:${lineIdx + 1}`;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        stats.pipelineIssues.push({ where, issue: "unparseable JSON line" });
        return;
      }
      const placeId = record && typeof record.place_id === "string" ? record.place_id : null;
      if (!placeId || !poolInputs.has(placeId)) {
        stats.pipelineIssues.push({ where, issue: `unknown place_id ${JSON.stringify(record?.place_id)}` });
        return;
      }
      if (byPlace.has(placeId)) {
        stats.pipelineIssues.push({ where, issue: `duplicate output for ${placeId}` });
        return;
      }
      stats.attempted += 1;
      const input = poolInputs.get(placeId);
      if (record.status === "rejected") {
        const shape = validateRejectionRecord(record);
        if (shape.ok) {
          byPlace.set(placeId, record);
          stats.workerRejected += 1;
          const t = record.rejection.tier_name;
          stats.workerRejectionTierHistogram[t] = (stats.workerRejectionTierHistogram[t] ?? 0) + 1;
        } else {
          stats.malformedWorkerRejections += 1;
          const original = record.rejection?.reason ?? "(no reason given)";
          byPlace.set(
            placeId,
            setRejection(
              placeId,
              `worker rejection record failed §6 shape validation (${shape.reasons.map((r) => r.code).join(", ")}); original reason: ${original}`,
              "a well-formed rejection record or a valid clue set",
            ),
          );
        }
        return;
      }
      if (record.status === "accepted") {
        const result = validateRecord(record, { input });
        if (result.ok) {
          byPlace.set(placeId, record);
          stats.accepted += 1;
        } else {
          byPlace.set(placeId, toRejectionRecord(record, result.reasons));
          stats.validatorRejected += 1;
          for (const reason of result.reasons) {
            stats.validatorReasonHistogram[reason.code] =
              (stats.validatorReasonHistogram[reason.code] ?? 0) + 1;
          }
        }
        return;
      }
      byPlace.set(
        placeId,
        setRejection(placeId, `record has unrecognized status ${JSON.stringify(record.status)}`, "a record in prompt §10 or §6 shape"),
      );
      stats.validatorRejected += 1;
    });
  }

  const ordered = [...byPlace.entries()].sort((a, b) => poolRank.get(a[0]) - poolRank.get(b[0]));
  writeFileSync(
    join(HERE, "records.jsonl"),
    ordered.map(([, record]) => JSON.stringify(record)).join("\n") + (ordered.length ? "\n" : ""),
  );
  writeFileSync(join(HERE, "validation-stats.json"), JSON.stringify(stats, null, 2) + "\n");
  console.log(JSON.stringify(stats, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
