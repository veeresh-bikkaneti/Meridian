// Floor for the lockfile's undici copies: GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472 and
// GHSA-xjj6-f33q-929c affect undici < 7.30.1. package.json `overrides` pins undici ^7.30.1.
//
// Scope, stated plainly: this reads package-lock.json ONLY. undici 7.29.1 is also bundled
// inline in wrangler-dist/cli.js and @cloudflare/vite-plugin/dist/index.mjs; npm audit and
// this test cannot see that. It goes away with wrangler >= 4.153.0 and a plugin release that
// bundles undici >= 7.30.1.
//
// Removal condition: delete the override once every lockfile path resolves undici >= 7.30.1
// without it (delete it, regenerate with npm, `npm audit --package-lock-only` prints 0). If a
// dependency ever asks for undici 8.x, revisit at once: the ^7 override would force it down.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const FLOOR = [7, 30, 1];
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

function parse(version, where) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`undici version is not strict x.y.z at ${where}: ${version}`);
  return m.slice(1).map(Number);
}

function below(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

test("package-lock.json resolves no undici below 7.30.1 (lockfile only; bundled copies not checked)", () => {
  assert.equal(lock.lockfileVersion, 3);
  // `undici-types` (from @types/node) must not match: anchor on the whole path segment.
  const paths = Object.keys(lock.packages).filter((p) => /(^|\/)node_modules\/undici$/.test(p));
  assert.ok(paths.length > 0, "no undici in the lockfile: remove the override and this test");
  const offenders = paths
    .filter((p) => below(parse(lock.packages[p].version, p), FLOOR))
    .map((p) => `${p}@${lock.packages[p].version}`)
    .sort();
  assert.deepStrictEqual(offenders, []);
});
