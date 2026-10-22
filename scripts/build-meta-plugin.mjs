/**
 * Build plugin that writes `build-meta.json` into the build output.
 *
 * Why this exists (WI-7a, 2026-10-21): `scripts/write-build-meta.mjs`
 * runs only from the npm `prebuild` / `prebuild:pages` lifecycle hooks.
 * If vite is invoked directly — a Cloudflare Workers Builds deploy
 * command, a CI script, `npx vite build` — the hooks are bypassed and
 * the deployed site serves no build-meta.json at all (fresh checkouts
 * don't have one: the file is gitignored). The in-app staleness check
 * (src/game/build-staleness.ts) then has nothing to compare against.
 * One nuance: the shared BUILD_ID still comes from buildIdForBundle(),
 * which prefers an existing `public/build-meta.json` — so a direct
 * build in a DIRTY worktree stamps the stale id, consistently across
 * all three copies (scripts/verify-build-stamp.mjs catches that via
 * its HEAD-prefix check). Fresh checkouts — every real deploy — have
 * no stale file to prefer.
 *
 * The fingerprint-sw plugin (scripts/fingerprint-sw-plugin.mjs) solved
 * the identical problem for sw.js in PR #145; this is the same pattern
 * for build-meta.json. vite.config.ts passes ONE build id, computed
 * once by buildIdForBundle(), to both plugins and to the bundle
 * `define`, so the served meta, the baked bundle id and the sw.js
 * VERSION are the same string by construction — including on the
 * timestamp fallback (no git, no GITHUB_SHA), where two independent
 * resolveBuildId() calls would diverge.
 *
 * Idempotent: writing the same id over the prebuild-copied file is a
 * no-op in content, so running alongside the npm hooks is safe.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildId } from "./build-id.mjs";

export const BUILD_META_FILE = "build-meta.json";

/**
 * Write `<dir>/build-meta.json` for `buildId`, creating `dir` if
 * needed. Returns the build id written.
 */
export function writeBuildMetaToDir(dir, buildId) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, BUILD_META_FILE),
    JSON.stringify({ buildId }, null, 2) + "\n",
  );
  return buildId;
}

export function buildMetaPlugin(buildId) {
  // Resolve lazily at stamp time when the caller didn't pin an id, so
  // direct imports (tests) still get a valid current id.
  const stampId = () =>
    typeof buildId === "string" && buildId.length > 0
      ? buildId
      : resolveBuildId();

  function stampDir(dir, { create = true } = {}) {
    if (!dir) return false;
    // The closeBundle safety net must never invent an output tree
    // (e.g. .vercel/ on a Pages build) just to hold a meta file.
    if (!create && !existsSync(dir)) return false;
    // Only client static outputs carry build-meta.json. They are the
    // dirs that also serve sw.js — server/SSR bundle dirs (which fire
    // writeBundle too) must not grow a meta file nobody serves.
    if (!existsSync(join(dir, "sw.js"))) return false;
    try {
      const id = writeBuildMetaToDir(dir, stampId());
      console.log(`[build-meta-plugin] wrote buildId=${id} into ${dir}`);
      return true;
    } catch (err) {
      console.error(`[build-meta-plugin] ${err.message}`);
      return false;
    }
  }

  return {
    name: "meridian:build-meta",
    // Run after all files (including public-dir copies) are written.
    writeBundle(options) {
      stampDir(options.dir);
    },
    // Nitro (non-Pages builds) copies assets to .vercel/output/static/
    // AFTER vite's writeBundle. Catch it here as a safety net, exactly
    // like fingerprint-sw-plugin does for sw.js.
    closeBundle() {
      try {
        const root = join(dirname(fileURLToPath(import.meta.url)), "..");
        stampDir(join(root, ".vercel", "output", "static"), {
          create: false,
        });
      } catch {
        // Best-effort; the writeBundle stamp is the primary path.
      }
    },
  };
}
