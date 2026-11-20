/**
 * Staleness guard for eslint/layer-baseline.json (Phase 0, PR 0.2):
 * the layer baseline can only shrink. Every baselined file must
 * still violate its rule — checked with the rule module's own
 * logic, so this test and the lint can never disagree — and a
 * cured file's entry is stale and must be removed in the same PR
 * that cures it (the shared-shell baseline pattern).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importViolation } from "../eslint/layer-rule.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");
const baseline = JSON.parse(read("eslint/layer-baseline.json"));

const RAW_IO = /\bfetch\s*\(|window\.fetch\b|\blocalStorage\b|\bsessionStorage\b|new Audio\s*\(/;
const IMPORTS = /(?:from\s+|import\s+)["']([^"']+)["']/g;

describe("layer baseline (KNOWN/STALE)", () => {
  it("carries exactly the two rule lists", () => {
    const kinds = Object.keys(baseline).filter((k) => k !== "comment").sort();
    assert.deepEqual(kinds, ["noRawIo", "noUpwardImport"]);
  });

  it("every noUpwardImport entry still violates — a cured file's entry is stale", () => {
    for (const file of baseline.noUpwardImport) {
      const specs = [...read(file).matchAll(IMPORTS)].map((m) => m[1]);
      assert.ok(
        specs.some((s) => importViolation(file, s)),
        `${file} no longer violates layer/no-upward-import: remove it from eslint/layer-baseline.json`,
      );
    }
  });

  it("every noRawIo entry still violates — a cured file's entry is stale", () => {
    for (const file of baseline.noRawIo) {
      assert.match(read(file), RAW_IO, `${file} no longer violates platform/no-raw-io: remove it from eslint/layer-baseline.json`);
    }
  });
});
