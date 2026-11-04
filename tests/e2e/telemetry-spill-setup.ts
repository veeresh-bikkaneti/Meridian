import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Run-level telemetry spill (globalSetup): choose the spill path the
 * escape listeners in tests/e2e/helpers.ts append to, and start every
 * run with an empty file. The path is run-unique (β-F3: pid + timestamp),
 * so a concurrent run's setup can never truncate this run's escapes
 * before its teardown reads them. The fallback path (β-F2) is exported
 * alongside it: when the primary append fails, helpers retries there
 * and the teardown reads both. Paths are handed to test workers
 * through process.env (global setup runs before workers spawn).
 */
export default async function telemetrySpillSetup(): Promise<void> {
  const spill = path.join(
    os.tmpdir(),
    `meridian-e2e-telemetry-spill-${process.pid}-${Date.now()}.jsonl`,
  );
  writeFileSync(spill, "");
  process.env.MERIDIAN_E2E_TELEMETRY_SPILL = spill;
  process.env.MERIDIAN_E2E_TELEMETRY_SPILL_FALLBACK = `${spill}.fallback`;
}
