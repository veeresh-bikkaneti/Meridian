/**
 * check-flags — the Flagstaff gate (Capitals & Flags design §5).
 *
 * Runs in prebuild so a flag can never drift from its curation record:
 *   1. Registry ⇔ files: licence fields, SHA-256 pins, byte caps, SVG
 *      sanity and official aspect (validateFlagRegistry).
 *   2. Completeness both ways: every pack subject land is either
 *      licence-verified in the registry or explicitly flagless with a
 *      recorded reason; every registry flag belongs to a pack subject
 *      (no orphan artwork).
 *   3. The generated runtime module matches the registry exactly.
 *   4. The composed sidecar (loop-meta.json) carries a flagKey exactly
 *      where the derived identity is verified — nowhere else.
 *   5. The Cold Trail pack file's stamps agree: capital sightings carry
 *      their land's verified flagKey, hideouts carry a country name.
 *
 * Fail closed with every problem printed. CLI:
 *   node scripts/packs/check-flags.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FLAG_GENERATED_PATH,
  renderFlagModule,
  validateFlagRegistry,
} from "./build-flags.mjs";
import { flagKeyForSubject } from "./schema.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(SCRIPTS_DIR));
const PACK_DIR = join(SCRIPTS_DIR, "capitals");
const PUBLIC_PACK_DIR = join(ROOT, "public/packs/capitals");
const COLDTAIL_PACK = join(ROOT, "src/game/coldtrail/cases.capitals.generated.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const problems = [];

  const { ok, problems: registryProblems, totalBytes, registry } = validateFlagRegistry();
  problems.push(...registryProblems);
  if (!registry) {
    console.error("check-flags: FAILED");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const verified = new Set(Object.keys(registry.flags ?? {}));
  const flagless = registry.flagless ?? {};

  // Pack records → derived subject identities.
  const records = readdirSync(join(PACK_DIR, "cases"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson(join(PACK_DIR, "cases", f)));
  const subjectKeyByPlaceId = new Map();
  const subjectKeys = new Set();
  for (const record of records) {
    const key = flagKeyForSubject(record.subject);
    if (key) {
      subjectKeyByPlaceId.set(record.target.placeId, key);
      subjectKeys.add(key);
    }
  }

  // (2) Completeness both ways.
  for (const key of subjectKeys) {
    if (!verified.has(key) && !(key in flagless)) {
      problems.push(`subject ${key}: neither licence-verified nor recorded flagless`);
    }
  }
  for (const key of verified) {
    if (!subjectKeys.has(key)) {
      problems.push(`registry flag ${key}: no pack case has this subject — orphan flag`);
    }
  }
  for (const [key, reason] of Object.entries(flagless)) {
    if (typeof reason !== "string" || reason.length === 0) {
      problems.push(`flagless.${key}: a flagless land must carry its reason`);
    }
    if (verified.has(key)) {
      problems.push(`flagless.${key}: listed as both verified and flagless`);
    }
  }

  // (3) Generated module in sync.
  if (!existsSync(FLAG_GENERATED_PATH)) {
    problems.push("src/assets/flags/registry.generated.ts missing — run build-flags");
  } else if (readFileSync(FLAG_GENERATED_PATH, "utf8") !== renderFlagModule(registry)) {
    problems.push("src/assets/flags/registry.generated.ts is stale — run build-flags");
  }

  // (4) Sidecar consistency.
  const manifest = readJson(join(PUBLIC_PACK_DIR, "manifest.json"));
  const meta = readJson(join(PUBLIC_PACK_DIR, "loop-meta.json"));
  for (const index of manifest.loopIndexes) {
    const clue = readJson(join(ROOT, "public/loop/clues", `${index}.json`));
    const placeId = `gn-${String(clue.placeId).replace(/^geonames:/, "")}`;
    const derived = subjectKeyByPlaceId.get(placeId);
    const entry = meta[String(index)];
    if (!entry) {
      problems.push(`loop-meta[${index}]: missing sidecar entry`);
      continue;
    }
    const expected = derived && verified.has(derived) ? derived : undefined;
    if (entry.flagKey !== expected) {
      problems.push(
        `loop-meta[${index}]: flagKey ${JSON.stringify(entry.flagKey)} != expected ${JSON.stringify(expected)}`,
      );
    }
  }

  // (5) Cold Trail stamps.
  if (existsSync(COLDTAIL_PACK)) {
    const pack = readJson(COLDTAIL_PACK);
    for (const packCase of pack.cases ?? []) {
      for (const sighting of packCase.sightings ?? []) {
        const derived = subjectKeyByPlaceId.get(sighting.cityId);
        const expected = derived && verified.has(derived) ? derived : undefined;
        if (sighting.flagKey !== expected) {
          problems.push(
            `coldtrail case ${packCase.caseNo} sighting ${sighting.id}: flagKey ${JSON.stringify(sighting.flagKey)} != expected ${JSON.stringify(expected)}`,
          );
        }
      }
      if (typeof packCase.hideout?.countryName !== "string" || packCase.hideout.countryName.length === 0) {
        problems.push(`coldtrail case ${packCase.caseNo}: hideout has no countryName stamp`);
      }
      const hideoutKey = packCase.hideout?.flagKey;
      if (hideoutKey !== undefined && !verified.has(hideoutKey)) {
        problems.push(`coldtrail case ${packCase.caseNo}: hideout flagKey ${hideoutKey} is not licence-verified`);
      }
    }
  }

  if (problems.length > 0) {
    console.error("check-flags: FAILED");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `check-flags: OK — ${verified.size} verified flags (${totalBytes} bytes), ${Object.keys(flagless).length} flagless lands recorded, ${records.length} pack cases consistent`,
  );
}

main();
