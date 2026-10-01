/**
 * Writes `public/build-meta.json` with the current build ID so a running tab
 * can detect that a newer deploy has replaced its hashed assets.
 * Run from `prebuild` / `prebuild:pages` — never commit the output.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildId } from "./build-id.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildId = resolveBuildId();
mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(
  join(root, "public", "build-meta.json"),
  JSON.stringify({ buildId }, null, 2) + "\n",
);
console.log(`build-meta.json: buildId=${buildId}`);
