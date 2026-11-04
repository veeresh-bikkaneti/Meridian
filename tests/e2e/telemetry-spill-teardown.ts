import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Run-level telemetry spill (globalTeardown): any line in the spill
 * file — or in its fallback (β-F2: helpers retries a failed append
 * there) — is a telemetry request that escaped the stub in some spec,
 * asserted or not, and fails the whole E2E run with every escape
 * from either file listed.
 */
export default async function telemetrySpillTeardown(): Promise<void> {
  const spill =
    process.env.MERIDIAN_E2E_TELEMETRY_SPILL ??
    path.join(os.tmpdir(), "meridian-e2e-telemetry-spill.jsonl");
  const fallback =
    process.env.MERIDIAN_E2E_TELEMETRY_SPILL_FALLBACK ?? `${spill}.fallback`;
  const lines: string[] = [];
  for (const file of [spill, fallback]) {
    if (!existsSync(file)) continue;
    lines.push(
      ...readFileSync(file, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    );
  }
  if (lines.length === 0) return;
  throw new Error(
    `telemetry escaped the E2E stub (${lines.length} escape(s) recorded in ${spill} / ${fallback}):\n${lines.join("\n")}`,
  );
}
