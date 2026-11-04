/**
 * Field-parity guard (DESIGN-FINAL §8.2, the U5 guard half, landed
 * with the client unit): the client's telemetry manifest and the
 * worker's device-field allowlist must name the SAME device keys, or
 * enriched fields silently die at intake (stripped as unknown keys)
 * or unvetted keys silently pass.
 *
 * Pattern follows the repo's extractor guards: regex-extract both
 * lists from source (no imports across the client/worker boundary),
 * assert both non-empty, no duplicates, sorted deepEqual.
 *
 * EXPECTED TO FAIL on the client unit branch: the worker side is
 * still main's code, which has no DEVICE_FIELD_ALLOWLIST export. The
 * guard turns green when the worker unit (U4) lands its allowlist.
 * It must not be weakened to pass early.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function extractList(source, markerRegex, label) {
  const m = markerRegex.exec(source);
  assert.ok(m, `${label}: list declaration not found`);
  const keys = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(keys.length > 0, `${label}: extracted list is empty`);
  assert.equal(new Set(keys).size, keys.length, `${label}: duplicate keys`);
  return keys;
}

test("field parity: client manifest device keys == worker DEVICE_FIELD_ALLOWLIST", () => {
  const manifestSrc = readFileSync(new URL("../src/lib/telemetry-manifest.ts", import.meta.url), "utf8");
  const workerSrc = readFileSync(
    new URL("../workers/crash-report/src/index.ts", import.meta.url),
    "utf8",
  );
  const clientKeys = extractList(
    manifestSrc,
    /DEVICE_FIELD_KEYS[^=]*=\s*\[([\s\S]*?)\]/,
    "client manifest (DEVICE_FIELD_KEYS)",
  );
  const workerKeys = extractList(
    workerSrc,
    /DEVICE_FIELD_ALLOWLIST[^=]*=\s*\[([\s\S]*?)\]/,
    "worker (DEVICE_FIELD_ALLOWLIST)",
  );
  assert.deepEqual(
    [...workerKeys].sort(),
    [...clientKeys].sort(),
    "device field keys drifted between client manifest and worker allowlist",
  );
});
