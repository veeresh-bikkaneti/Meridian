/**
 * Stamps the build id into the built service worker (`dist/client/sw.js`).
 *
 * Browsers detect service-worker updates by byte-comparing the script: if
 * `sw.js` is identical between deploys, `updatefound` never fires and the
 * in-app update toast becomes dead code. `public/sw.js` carries a
 * `__BUILD_ID__` placeholder in VERSION; this script replaces it in the
 * *built* copy only — the committed source is never dirtied.
 *
 * Run from `postbuild:pages` (npm runs it automatically after
 * `npm run build:pages`, including in the Pages workflow). Fails loudly if
 * the placeholder is missing, so a silent no-op can never ship.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildId } from "./build-id.mjs";

export const PLACEHOLDER = "__BUILD_ID__";

/**
 * Replace the build-id placeholder in the built worker. Returns the build
 * id stamped. Throws if the placeholder is absent (fail loudly — a silent
 * no-op would ship an unfingerprinted worker).
 */
export function fingerprintSw(swPath, buildId = resolveBuildId()) {
  const source = readFileSync(swPath, "utf8");
  if (!source.includes(PLACEHOLDER)) {
    throw new Error(
      `fingerprint-sw: placeholder ${PLACEHOLDER} not found in ${swPath}`,
    );
  }
  writeFileSync(swPath, source.replaceAll(PLACEHOLDER, buildId));
  return buildId;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "client", "sw.js");

// Only stamp when run as a script (postbuild:pages), not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let buildId;
  try {
    buildId = fingerprintSw(out);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`fingerprint-sw: ${out} not found — skipping (non-Pages build?)`);
      process.exit(0);
    }
    console.error(err.message);
    process.exit(1);
  }
  console.log(`fingerprint-sw: stamped buildId=${buildId} into dist/client/sw.js`);
}
