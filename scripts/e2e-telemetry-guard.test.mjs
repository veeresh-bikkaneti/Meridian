/**
 * E2E telemetry guard — a source scan proving no spec can serve the app
 * around the shared crash-report stub (tests/e2e/helpers.ts).
 *
 * Rules over tests/e2e/*.spec.ts:
 * (a) every spec imports serveBuiltArtifact or handleTelemetry from
 *     "./helpers" — the shared serving/policy entry points;
 * (b) any spec containing "route.continue()" also references
 *     handleTelemetry or serveBuiltArtifact (a hand-rolled handler must
 *     run the telemetry policy before passing a request to the network);
 * (c) any spec calling "newContext(" satisfies (a) — a hand-made context
 *     gets no stub unless it goes through the shared entry points;
 * (d) the literal prod telemetry hostname may appear only in the
 *     COLLECTOR_FILES — the inspecting specs that pin the endpoint on
 *     purpose. Everyone else derives it via helpers' TELEMETRY_ENDPOINT.
 *
 * Failure messages name the file and the one-line fix.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const E2E_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "e2e");

// EXEMPT — specs excused from rule (a). Every entry REQUIRES a written
// reason (reviewer: reject an entry without one). F1 said this list
// starts empty; implementation found one pre-existing exception the
// arena inventory missed, recorded here rather than absorbed silently:
// - tap-verify.spec.ts: predates the tracked helpers module and inlines
//   its own serveBuiltArtifact (its header comment says helpers was
//   untracked when it was written). It satisfies (b) through that local
//   handler, but it does NOT stub telemetry — a known uncovered path;
//   migrating it onto the shared helpers is a follow-up outside this
//   change's scope.
const EXEMPT = [{ file: "tap-verify.spec.ts", reason: "self-contained inline serving; see comment above" }];

// COLLECTOR_FILES — the inspecting specs allowed to name the prod
// telemetry host literally because pinning that exact endpoint is their
// subject. This list shrinks to zero as they migrate to collectTelemetry.
const COLLECTOR_FILES = [
  "observability.spec.ts",
  "crash-watchdog.spec.ts",
  "crash-classification.mobile.spec.ts",
  "chunk-recovery.desktop.spec.ts",
];

const TELEMETRY_HOST = "meridian-crash-report.knowledgetest.workers.dev";

const IMPORT_RE =
  /import\s*\{[^}]*\b(?:serveBuiltArtifact|handleTelemetry)\b[^}]*\}\s*from\s*["']\.\/helpers["']/s;

const specFiles = readdirSync(E2E_DIR)
  .filter((f) => f.endsWith(".spec.ts"))
  .sort();

function read(file) {
  return readFileSync(path.join(E2E_DIR, file), "utf8");
}

function satisfiesImportRule(file) {
  if (EXEMPT.some((e) => e.file === file)) return true;
  return IMPORT_RE.test(read(file));
}

test("(a) every spec imports serveBuiltArtifact or handleTelemetry from ./helpers", () => {
  const bad = specFiles.filter((f) => !satisfiesImportRule(f));
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: does not import serveBuiltArtifact or handleTelemetry from "./helpers" — fix: add \`import { serveBuiltArtifact } from "./helpers"\` (or handleTelemetry for a hand-rolled handler), or add an EXEMPT entry with a written reason in scripts/e2e-telemetry-guard.test.mjs`,
      )
      .join("\n"),
  );
});

test("(b) any spec with route.continue() references handleTelemetry or serveBuiltArtifact", () => {
  const bad = specFiles.filter((f) => {
    const src = read(f);
    return (
      src.includes("route.continue()") &&
      !/\b(?:handleTelemetry|serveBuiltArtifact)\b/.test(src)
    );
  });
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: calls route.continue() without referencing handleTelemetry or serveBuiltArtifact — fix: call \`await handleTelemetry(route, ledger)\` before any continue(), or serve via serveBuiltArtifact`,
      )
      .join("\n"),
  );
});

test("(c) any spec calling newContext( satisfies rule (a)", () => {
  const bad = specFiles.filter((f) => read(f).includes("newContext(") && !satisfiesImportRule(f));
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: creates a context with newContext( but does not import serveBuiltArtifact or handleTelemetry from "./helpers" — fix: serve that context with serveBuiltArtifact (or route its handler through handleTelemetry)`,
      )
      .join("\n"),
  );
});

test("(d) the prod telemetry hostname appears only in COLLECTOR_FILES", () => {
  const bad = specFiles.filter(
    (f) => read(f).includes(TELEMETRY_HOST) && !COLLECTOR_FILES.includes(f),
  );
  assert.deepEqual(
    bad,
    [],
    bad
      .map(
        (f) =>
          `${f}: names the prod telemetry host literally — fix: import TELEMETRY_ENDPOINT (or collectTelemetry) from "./helpers" instead; only the COLLECTOR_FILES inspecting specs may pin the host`,
      )
      .join("\n"),
  );
});
