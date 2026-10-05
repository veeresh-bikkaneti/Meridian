// seed-proof.mjs — Phase 1 proof runner, SUPERSEDED (retained for provenance).
//
// In Phase 1 (2026-10-03) this script ran the three-pass proof of the
// composer + validator over the 12 engineering seed sets from
// origin/feat/meridian-loop. Its results stand in seed-proof-report.md.
//
// It is not runnable in Phase 2: the validator/composer APIs it drove
// (validateClueSet, assembleClueSet, runComposer — the provisional
// Phase 1 schema) were superseded when generation prompt v1 was
// adopted verbatim and the validator was aligned to prompt §10
// (validateRecord / validateRejectionRecord in validate-clues.mjs).
// The Phase 2 production pipeline lives in scripts/clues/production/.
//
// Running this file prints this notice and exits 0, so no stale
// invocation can be mistaken for a live proof.

console.log(
  [
    "seed-proof.mjs is a Phase 1 artifact and no longer runs.",
    "Its results are preserved in scripts/clues/seed-proof-report.md.",
    "Phase 2 production: scripts/clues/production/ (prompt v1 aligned).",
  ].join("\n"),
);
