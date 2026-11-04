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
 * The guard runs on the combined branch and must pass there.
 * History: it was written on the client unit branch, where the
 * worker side did not exist yet (main's code had no
 * DEVICE_FIELD_ALLOWLIST export), so it failed there by design
 * until the worker unit (U4) landed its allowlist. It was not
 * weakened to pass early, and it must not be weakened now.
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
    // The worker declares its list as Object.freeze([...]); the client
    // manifest declares a plain array. Integrator fix on the combined
    // tree: allow the freeze wrapper so the extractor reads the list
    // the worker actually ships. The lists themselves matched exactly
    // (17 keys each, webgl1/webgl2 included on both sides), so no
    // field exception was needed.
    /DEVICE_FIELD_ALLOWLIST[^=]*=\s*(?:Object\.freeze\()?\s*\[([\s\S]*?)\]/,
    "worker (DEVICE_FIELD_ALLOWLIST)",
  );
  assert.deepEqual(
    [...workerKeys].sort(),
    [...clientKeys].sort(),
    "device field keys drifted between client manifest and worker allowlist",
  );
});
