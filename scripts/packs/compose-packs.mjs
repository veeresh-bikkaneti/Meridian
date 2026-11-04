/**
 * Story pack composer — the build-time adapter of design §1.3.
 *
 * Reads one pack from scripts/packs/<packId>/ (pack.json, cases/*.json,
 * inputs/<caseId>.json), validates every record against its authoring
 * input (schema.mjs, which delegates the ladder mechanics to the shipped
 * clue validator), and writes:
 *
 *   public/loop/clues/<index>.json        one ordinary clue file per case,
 *                                         at global indexes continuing
 *                                         after the core manifest size
 *   public/packs/<packId>/manifest.json   {v, packId, category, size,
 *                                         generatedAt, loopIndexes,
 *                                         loopTiers, coldtrailFile}
 *   public/packs/<packId>/loop-meta.json  the sidecar, keyed by clue-file
 *                                         index: {subject, direction,
 *                                         prompt, blurb}
 *
 * The core manifest (public/loop/manifest.json) is never written: the
 * core deck keeps dealing the core pool, and pack decks deal from the
 * pack manifest's loopIndexes (design §6). Case order is by caseId, so
 * re-running the composer on the same pack writes the same indexes.
 *
 * Fail closed: if any record fails validation, nothing is written and
 * the CLI exits 1 with every reason printed.
 *
 * CLI: node scripts/packs/compose-packs.mjs <packId>
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assemblePublishedFile } from "../clues/compose-clues.mjs";
import { loopMetaEntry, toLoopRecord, validatePackRecord } from "./schema.mjs";

const PACKS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(PACKS_DIR));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Compose one pack. All paths are parameters so tests run the composer
 * against fixture directories instead of the real public/ tree.
 *
 * @returns {{ok: true, packId: string, size: number, loopIndexes: number[],
 *   written: string[]} | {ok: false, reasons: Array<{code: string,
 *   caseId?: string, tier?: number, detail: string}>}}
 */
export function composePack({
  packDir,
  publicDir,
  coreManifestPath,
  generatedAt = new Date(),
}) {
  const reasons = [];
  const descriptor = readJson(join(packDir, "pack.json"));
  const packId = descriptor.packId;
  const casesDir = join(packDir, "cases");
  const inputsDir = join(packDir, "inputs");
  const caseFiles = readdirSync(casesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const coreManifest = readJson(coreManifestPath);
  if (!Number.isInteger(coreManifest.size) || coreManifest.size < 0) {
    throw new Error(`composePack: core manifest at ${coreManifestPath} has no valid size`);
  }
  const base = coreManifest.size;

  // Validate everything before writing anything.
  const prepared = [];
  for (const file of caseFiles) {
    const record = readJson(join(casesDir, file));
    const inputPath = join(inputsDir, `${record.caseId}.json`);
    if (!existsSync(inputPath)) {
      reasons.push({
        code: "PACK_INPUT",
        caseId: record.caseId ?? file,
        detail: `no authoring input at inputs/${record.caseId}.json`,
      });
      continue;
    }
    const input = readJson(inputPath);
    if (record.packId !== packId) {
      reasons.push({
        code: "PACK_FIELD",
        caseId: record.caseId ?? file,
        detail: `record packId ${JSON.stringify(record.packId)} != pack ${JSON.stringify(packId)}`,
      });
      continue;
    }
    const result = validatePackRecord(record, { input });
    if (!result.ok) {
      for (const reason of result.reasons) reasons.push({ ...reason, caseId: record.caseId });
      continue;
    }
    prepared.push({ record, input });
  }
  // Indexes follow caseId order, never file-system order.
  prepared.sort((a, b) => (a.record.caseId < b.record.caseId ? -1 : 1));
  if (reasons.length > 0) return { ok: false, reasons };

  const loopIndexes = [];
  const loopTiers = [];
  const meta = {};
  const clueFiles = [];
  prepared.forEach(({ record, input }, i) => {
    const index = base + i;
    loopIndexes.push(index);
    loopTiers.push(record.packTier);
    meta[String(index)] = loopMetaEntry(record);
    clueFiles.push({
      path: join(publicDir, "loop", "clues", `${index}.json`),
      value: assemblePublishedFile(toLoopRecord(record, input)),
    });
  });

  const packManifest = {
    v: 1,
    packId,
    category: descriptor.category,
    size: prepared.length,
    generatedAt: (generatedAt instanceof Date ? generatedAt : new Date(generatedAt)).toISOString(),
    loopIndexes,
    loopTiers,
    coldtrailFile: descriptor.coldtrailFile ?? null,
  };

  const written = [];
  mkdirSync(join(publicDir, "loop", "clues"), { recursive: true });
  mkdirSync(join(publicDir, "packs", packId), { recursive: true });
  for (const file of clueFiles) {
    writeFileSync(file.path, JSON.stringify(file.value));
    written.push(file.path);
  }
  const manifestPath = join(publicDir, "packs", packId, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(packManifest));
  written.push(manifestPath);
  const metaPath = join(publicDir, "packs", packId, "loop-meta.json");
  writeFileSync(metaPath, JSON.stringify(meta));
  written.push(metaPath);

  return { ok: true, packId, size: prepared.length, loopIndexes, written };
}

function main(argv) {
  const [packId] = argv;
  if (!packId) {
    console.error("usage: node scripts/packs/compose-packs.mjs <packId>");
    return 2;
  }
  const result = composePack({
    packDir: join(PACKS_DIR, packId),
    publicDir: join(ROOT, "public"),
    coreManifestPath: join(ROOT, "public", "loop", "manifest.json"),
  });
  if (!result.ok) {
    for (const reason of result.reasons) {
      console.error(
        `${reason.caseId ?? "?"}: ${reason.code}${reason.tier ? ` (tier ${reason.tier})` : ""}: ${reason.detail}`,
      );
    }
    console.error(`compose-packs: ${packId} failed validation; nothing written`);
    return 1;
  }
  console.log(
    `compose-packs: ${result.packId} size=${result.size} loopIndexes=${result.loopIndexes.join(",")}`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}

