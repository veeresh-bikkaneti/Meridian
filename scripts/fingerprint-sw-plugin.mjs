/**
 * Build plugin that fingerprints the service worker with the build ID.
 *
 * Browsers detect SW updates by byte-comparing sw.js — if it's identical
 * across deploys, `updatefound` never fires and the PWA update toast becomes
 * dead code. This plugin replaces the `__BUILD_ID__` placeholder in the
 * emitted sw.js with the resolved build ID.
 *
 * Why a plugin AND npm postbuild hooks? The hooks only fire when npm runs
 * the build. If vite is invoked directly (`npx vite build`, CI scripts,
 * Cloudflare deploy commands), the hooks are bypassed and the SW ships
 * unstamped. This plugin runs inside the build itself, so it works no
 * matter how vite is invoked.
 *
 * Idempotent: already-stamped files are skipped, so running both the plugin
 * and the postbuild hook is safe.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLACEHOLDER, fingerprintSw } from "./fingerprint-sw.mjs";

const SW_FILE = "sw.js";
// Matches an already-stamped version: meridian-<7-40 hex chars>
const STAMPED_RE = /meridian-[0-9a-f]{7,40}/;

function stampSwFile(dir, pinnedBuildId) {
  if (!dir) return false;
  const swPath = join(dir, SW_FILE);
  let source;
  try {
    source = readFileSync(swPath, "utf8");
  } catch {
    return false; // no sw.js in this output dir
  }
  if (!source.includes(PLACEHOLDER)) {
    return false; // already stamped or not ours — skip
  }
  try {
    // A pinned id (vite.config passes the one buildIdForBundle() value)
    // wins so sw.js, build-meta.json and the bundle can never diverge;
    // undefined keeps the old resolveBuildId() default.
    const buildId = fingerprintSw(swPath, pinnedBuildId);
    console.log(`[fingerprint-sw-plugin] stamped buildId=${buildId} into ${swPath}`);
    return true;
  } catch (err) {
    console.error(`[fingerprint-sw-plugin] ${err.message}`);
    return false;
  }
}

export function fingerprintSwPlugin(buildId) {
  const pinned =
    typeof buildId === "string" && buildId.length > 0 ? buildId : undefined;
  return {
    name: "meridian:fingerprint-sw",
    // Run after all files are written to disk.
    writeBundle(options) {
      stampSwFile(options.dir, pinned);
    },
    // Nitro (non-Pages builds) copies assets to .vercel/output/static/
    // AFTER vite's writeBundle. Catch it here as a safety net.
    closeBundle() {
      try {
        const root = join(dirname(fileURLToPath(import.meta.url)), "..");
        stampSwFile(join(root, ".vercel", "output", "static"), pinned);
      } catch {
        // Best-effort; the npm postbuild hook is the primary path.
      }
    },
  };
}
