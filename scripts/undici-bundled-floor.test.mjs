// Floor for undici shipped inside dev/build tooling, not the lockfile.
// GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472 and GHSA-xjj6-f33q-929c affect
// undici < 7.30.1. npm audit cannot see a copy that is inlined into a
// bundle. These copies are tooling only: nothing uploaded to the Worker
// imports undici. The direct wrangler package and @cloudflare/vite-plugin
// (plus a nested wrangler, when npm does not hoist it) are the places the
// old 7.29.1 bundle lived.
//
// A bundle that stamps `undici@x.y.z` is checked on that stamp. A bundle
// that only require()s the package is checked on the undici install that
// Node would resolve from that file. A file we cannot version fails, so a
// packaging change cannot hide a downgrade.
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const FLOOR = [7, 30, 1];
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "node_modules/wrangler/wrangler-dist/cli.js",
  "node_modules/@cloudflare/vite-plugin/dist/index.mjs",
];
const OPTIONAL = [
  "node_modules/@cloudflare/vite-plugin/node_modules/wrangler/wrangler-dist/cli.js",
];

function parse(version, where) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`undici version is not strict x.y.z at ${where}: ${version}`);
  return m.slice(1).map(Number);
}

function below(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

function resolvedUndici(fromFile) {
  let dir = dirname(fromFile);
  const stop = dirname(REPO);
  while (dir.startsWith(REPO)) {
    const pkg = join(dir, "node_modules", "undici", "package.json");
    if (existsSync(pkg)) return JSON.parse(readFileSync(pkg, "utf8")).version;
    if (dir === stop) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function versionsIn(rel) {
  const abs = join(REPO, rel);
  const text = readFileSync(abs, "utf8");
  const markers = [...text.matchAll(/undici@(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
  const external = /require\(["']undici["']\)|from ["']undici["']/.test(text);
  const found = new Set(markers);
  if (external) {
    const resolved = resolvedUndici(abs);
    if (!resolved) throw new Error(`${rel} require()s undici but no install was resolved`);
    found.add(resolved);
  }
  if (found.size === 0) {
    throw new Error(`${rel} has no undici@version stamp and does not require("undici")`);
  }
  return [...found];
}

test("wrangler and @cloudflare/vite-plugin ship no undici below 7.30.1", () => {
  const present = [...REQUIRED, ...OPTIONAL].filter((rel) => existsSync(join(REPO, rel)));
  for (const rel of REQUIRED) {
    assert.ok(existsSync(join(REPO, rel)), `missing ${rel}; npm ci before this test`);
  }
  const offenders = [];
  for (const rel of present) {
    for (const version of versionsIn(rel)) {
      if (below(parse(version, rel), FLOOR)) offenders.push(`${rel} undici@${version}`);
    }
  }
  assert.deepStrictEqual(offenders.sort(), []);
});
