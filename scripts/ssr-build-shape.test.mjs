/**
 * Post-build pin for the production SSR shape (#233).
 *
 * Why this exists: production runs our custom server entry
 * (`src/server.ts`, with the server-fn guard from PR #232) because the
 * root `wrangler.jsonc` + the @cloudflare/vite-plugin wiring make Nitro
 * emit a custom-entry SSR service. Dropping the plugin alone fails
 * loudly, but reverting the config AND the wiring together would
 * silently restore the default entry — and the guard would vanish
 * with it. This test is the cheap pin against that path: after a
 * production build, the emitted SSR `wrangler.json` must keep the
 * custom-entry shape and the SSR bundle must still contain the
 * guard's literals.
 *
 * The literals below are strings that survive minification (route
 * path and error messages from `src/lib/server/server-fn-guard.ts`).
 * Identifiers are NOT asserted — minifiers rename or inline them.
 * No single literal proves the guard on its own (`/_serverFn/` also
 * appears inside TanStack); the pin is the combination of the config
 * fields plus the full literal set.
 *
 * When the build artifact is absent (a plain `npm test` on a fresh
 * checkout), the tests skip with an explicit reason instead of
 * failing — CI runs the build before the tests, so the pin is live
 * there. Followed the precedent of scripts/share-card-built.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ssrDir = resolve(repoRoot, "node_modules/.nitro/vite/services/ssr");
const wranglerJsonPath = resolve(ssrDir, "wrangler.json");
const bundlePath = resolve(ssrDir, "index.js");

const SKIP_REASON =
  "SSR build artifact absent (node_modules/.nitro/vite/services/ssr) — run a production build first; CI builds before testing, so the pin is live there";

test("emitted ssr wrangler.json keeps the custom-entry shape", { skip: existsSync(wranglerJsonPath) ? false : SKIP_REASON }, () => {
  const cfg = JSON.parse(readFileSync(wranglerJsonPath, "utf8"));
  assert.equal(cfg.main, "index.js", "ssr entry must stay index.js");
  assert.equal(cfg.no_bundle, true, "ssr service must stay no_bundle (custom entry, not a bundled default)");
  assert.ok(cfg.configPath, "ssr wrangler.json must carry a configPath");
  assert.equal(
    resolve(cfg.configPath),
    resolve(repoRoot, "wrangler.jsonc"),
    "configPath must point at the repo-root wrangler.jsonc",
  );
  assert.equal(basename(cfg.configPath), "wrangler.jsonc");
});

test("ssr bundle still contains the server-fn guard literals", { skip: existsSync(bundlePath) ? false : SKIP_REASON }, () => {
  const bundle = readFileSync(bundlePath, "utf8");
  for (const literal of ["/_serverFn/", "not found", "method not allowed", "no-store"]) {
    assert.ok(bundle.includes(literal), `ssr bundle must contain the guard literal ${JSON.stringify(literal)}`);
  }
});
