/**
 * TD-14.4 — unit tests for the seedSeenExcept dealing-pool coverage guard
 * (issue #314). Three proof obligations, per the story:
 *   (a) PASS on the current live tree (with the measured census asserted);
 *   (b) FAIL by id when a planted forced id is absent from its band pool;
 *   (c) FAIL if a listed exception vanishes (KNOWN_MISSING gone stale,
 *       KNOWN_DYNAMIC_SITES gone stale, or an unlisted dynamic call site).
 * Plus a pool-math sanity pin (US country aggregation + japan easy rung),
 * so the guard's own replication of dealingPoolFor cannot drift unnoticed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runGuard, bandPoolIds, KNOWN_MISSING } from "./check-seed-seen-except.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The live tests/e2e tree as a Map<specBasename, content>. */
function liveFiles() {
  const dir = join(ROOT, "tests/e2e");
  const files = new Map();
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".spec.ts")) files.set(f, readFileSync(join(dir, f), "utf8"));
  }
  return files;
}

/** runGuard over the live tree, with optional per-spec content patches. */
function guardWithPatches(patches = new Map()) {
  const files = liveFiles();
  for (const [spec, content] of patches) files.set(spec, content);
  return runGuard(ROOT, files);
}

test("guard semantics: US country pool aggregates the 50 state chunks (like usCountryPoolIds)", () => {
  const pool = bandPoolIds(ROOT, "country", "united-states", "medium");
  assert.ok(pool.size > 10000, `US medium pool should aggregate states, got ${pool.size}`);
  assert.ok(pool.ids.has("gn-13286806"), "US medium pool contains the Massachusetts place gn-13286806");
  assert.equal(pool.rung, "band", "medium has no curation rung");
});

test("guard semantics: japan easy engages the storied rung (>= EASY_MIN_POOL 25)", () => {
  const pool = bandPoolIds(ROOT, "country", "japan", "easy");
  assert.equal(pool.rung, "storied");
  assert.ok(pool.size >= 25, `storied rung must clear EASY_MIN_POOL, got ${pool.size}`);
  assert.ok(!pool.ids.has("gn-1853909"), "Osaka (tier 1, no history) sits outside the storied rung — the documented KNOWN_MISSING finding");
});

test("(a) PASS on the current tree, with the measured census", () => {
  const { entries, failures, documentedMissing } = guardWithPatches();
  assert.equal(failures.length, 0, `expected a clean current tree, got: ${failures.map((f) => f.reason).join(" | ")}`);
  // Census measured on the branch's base main 7dbf62eb — if these counts
  // move, a spec gained or lost a seed call site; update this test AND the
  // KNOWN_* lists in the same PR.
  assert.equal(entries.length, 29, "29 seedSeenExcept call sites");
  assert.equal(new Set(entries.map((e) => e.spec)).size, 12, "across 12 spec files");
  assert.equal(new Set(entries.filter((e) => e.kind === "fixed").map((e) => e.keepId)).size, 19, "19 distinct forced ids");
  // The two documented findings are on record, not silent:
  assert.deepEqual(
    documentedMissing.map((d) => `${d.spec}:${d.id}`).sort(),
    ["admin1-narrow.desktop.spec.ts:gn-1850147", "admin1-narrow.desktop.spec.ts:gn-1853909"],
    "KNOWN_MISSING must exactly match the two measured japan/easy findings",
  );
});

test("(b) a planted forced id absent from the pool FAILS by id and spec path", () => {
  const files = liveFiles();
  const labels = files.get("question-labels.spec.ts");
  assert.ok(labels !== undefined, "question-labels.spec.ts is in the live tree");
  const planted = guardWithPatches(new Map([[`question-labels.spec.ts`, labels.replace(`"gn-4671654"`, `"gn-0000001"`)]]));
  const hit = planted.failures.filter((f) => f.id === "gn-0000001");
  assert.equal(hit.length, 1, "exactly one failure names the planted id");
  assert.equal(hit[0].spec, `question-labels.spec.ts`, "failure names the spec path");
  assert.match(hit[0].reason, /country\/united-states\/easy/);
});

test("(b, shape C) a planted page-only-local TARGET_ID absent from the pool FAILS by id", () => {
  const files = liveFiles();
  const header = files.get("question-card-header.spec.ts");
  assert.ok(header !== undefined, "question-card-header.spec.ts is in the live tree");
  const planted = guardWithPatches(
    new Map([["question-card-header.spec.ts", header.replace("gn-13286806", "gn-0000002")]]),
  );
  assert.ok(
    planted.failures.some((f) => f.id === "gn-0000002" && f.spec === "question-card-header.spec.ts"),
    "planted shape-C failure names id + spec",
  );
});

test("(c) a vanished KNOWN_MISSING entry (seed fixed or regen restored it) FAILS as stale", () => {
  const files = liveFiles();
  const admin = files.get("admin1-narrow.desktop.spec.ts");
  assert.ok(admin !== undefined, "admin1-narrow.desktop.spec.ts is in the live tree");
  // Retarget Osaka's seed at a place that IS in the japan/easy storied pool:
  // the KNOWN_MISSING entry for gn-1853909 then matches nothing and must FAIL.
  const patched = guardWithPatches(new Map([["admin1-narrow.desktop.spec.ts", admin.replace(`const OSAKA_ID = "gn-1853909";`, `const OSAKA_ID = "gn-1848522";`)]]));
  const stale = patched.failures.filter((f) => /stale KNOWN_MISSING/.test(f.reason));
  assert.equal(stale.length, 1, "exactly the Osaka entry goes stale");
  assert.match(stale[0].reason, /gn-1853909/);
  assert.equal(patched.failures.length, 1, "the retargeted id itself is in the pool, so no new failure");
});

test("(c) an unlisted dynamic-shaped call site FAILS", () => {
  const planted = guardWithPatches(
    new Map([["unlisted-dynamic.spec.ts", `await seedSeenExcept(page, regionId, keep, catalog, "easy");`]]),
  );
  assert.ok(
    planted.failures.some(
      (f) => f.spec === "unlisted-dynamic.spec.ts" && /unlisted dynamic-shaped/.test(f.reason),
    ),
    "an unlisted dynamic site is a failure, not a silent pass",
  );
});

test("(c) a vanished KNOWN_DYNAMIC_SITES exception FAILS as stale", () => {
  const files = liveFiles();
  const cleared = files.get("cleared-mode.spec.ts");
  assert.ok(cleared !== undefined, "cleared-mode.spec.ts is in the live tree");
  const planted = guardWithPatches(
    new Map([["cleared-mode.spec.ts", cleared.replace(/seedSeenExcept/g, "retiredHelper")]]),
  );
  assert.ok(
    planted.failures.some((f) => f.spec === "cleared-mode.spec.ts" && /listed dynamic exception vanished/.test(f.reason)),
    "a dynamic exception whose call site vanished must fail",
  );
});

test("KNOWN_MISSING documents exactly the two japan/easy findings — nothing else hides there", () => {
  assert.deepEqual(Object.keys(KNOWN_MISSING).sort(), [
    "admin1-narrow.desktop.spec.ts:gn-1850147",
    "admin1-narrow.desktop.spec.ts:gn-1853909",
  ]);
});
