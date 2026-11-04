import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Run-level telemetry spill (globalSetup): choose the spill path the
 * escape listeners in tests/e2e/helpers.ts append to, and start every
 * run with an empty file. The path is handed to test workers through
 * process.env (global setup runs before workers spawn).
 */
export default async function telemetrySpillSetup(): Promise<void> {
  const spill = path.join(os.tmpdir(), "meridian-e2e-telemetry-spill.jsonl");
  writeFileSync(spill, "");
  process.env.MERIDIAN_E2E_TELEMETRY_SPILL = spill;
}
