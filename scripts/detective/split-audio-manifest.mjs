#!/usr/bin/env node
/**
 * split-audio-manifest.mjs — runtime shards of the detective audio manifest.
 *
 * Why: public/audio/detective/manifest.json is the hash-pinned source of
 * truth (check-audio-manifest.mjs) and is about 1.9 MB. The speech player
 * used to fetch that whole file on the first line, so every new deck
 * made the first fetch larger. This script writes a small index (voices
 * and fixed lines), one file per case, and one names file. The player
 * loads the index, then the case it is speaking. The monolith stays on
 * disk as the fallback when the shards are missing.
 *
 * Shard entries keep only file and voice — the fields the player reads.
 * Text, hashes and measurements stay in the monolith, which this script
 * never rewrites.
 *
 * Usage:
 *   node scripts/detective/split-audio-manifest.mjs [--root <dir>] [--check]
 * Exit codes: 0 clean · 2 drift (--check) or bad args.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { MANIFEST_REL, coreIndexesFromDisk, readManifest } from "./audio-manifest.mjs";

export const SPLIT_DIR_REL = "public/audio/detective/split";

/** Runtime entry: the player only reads file and voice. */
export function slimEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (typeof entry.file !== "string" || entry.file.length === 0) return null;
  const slim = { file: entry.file };
  if (typeof entry.voice === "string") slim.voice = entry.voice;
  return slim;
}

/** Contiguous case lists become a from/to span so the index stays small. */
export function deckSpan(cases) {
  const sorted = [...cases].sort((a, b) => a - b);
  if (sorted.length === 0) return { count: 0 };
  const contiguous = sorted.every((n, i) => n === sorted[0] + i);
  if (contiguous) return { from: sorted[0], to: sorted[sorted.length - 1], count: sorted.length };
  return { cases: sorted, count: sorted.length };
}

/**
 * Decks the shards are catalogued under. Core is every unpacked case;
 * each directory in public/packs with a manifest is a deck. A new pack
 * shows up here without a loader change.
 */
export function deckCatalog(root) {
  const decks = [];
  const core = coreIndexesFromDisk(root);
  if (core.length > 0) decks.push({ id: "core", ...deckSpan(core) });
  const packsDir = join(root, "public/packs");
  if (!existsSync(packsDir)) return decks;
  for (const pack of readdirSync(packsDir).sort()) {
    const mf = join(packsDir, pack, "manifest.json");
    if (!existsSync(mf)) continue;
    let data;
    try {
      data = JSON.parse(readFileSync(mf, "utf8"));
    } catch {
      continue;
    }
    const cases = Array.isArray(data.loopIndexes) ? data.loopIndexes.filter((n) => Number.isInteger(n)) : [];
    if (cases.length > 0) decks.push({ id: pack, ...deckSpan(cases) });
  }
  return decks;
}

function idSort(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === a && String(nb) === b) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Pure split of a monolith. `decks` is the catalog stored on the index. */
export function buildSplit(manifest, decks) {
  const fixed = {};
  for (const key of Object.keys(manifest.fixed ?? {}).sort()) {
    const slim = slimEntry(manifest.fixed[key]);
    if (slim) fixed[key] = slim;
  }
  const index = {
    v: 1,
    split: 1,
    voices: {
      holmes: manifest.voices?.holmes ?? "",
      watson: manifest.voices?.watson ?? "",
    },
    fixed,
    decks,
  };
  const cases = {};
  for (const key of Object.keys(manifest.cases ?? {}).sort(idSort)) {
    const bucket = manifest.cases[key] ?? {};
    cases[key] = {
      clues: Array.isArray(bucket.clues) ? bucket.clues.map((entry) => slimEntry(entry)) : [],
      answer: slimEntry(bucket.answer),
    };
  }
  const names = {};
  for (const key of Object.keys(manifest.names ?? {}).sort(idSort)) {
    const slim = slimEntry(manifest.names[key]);
    if (slim) names[key] = slim;
  }
  return { index, cases, names };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`);
}

/** Write shards next to the monolith. Does not touch manifest.json. */
export function writeSplit(root, manifest, decks = deckCatalog(root)) {
  const split = buildSplit(manifest, decks);
  const dir = join(root, SPLIT_DIR_REL);
  writeJson(join(dir, "index.json"), split.index);
  writeJson(join(dir, "names.json"), split.names);
  const casesDir = join(dir, "cases");
  mkdirSync(casesDir, { recursive: true });
  const keep = new Set();
  for (const [key, bucket] of Object.entries(split.cases)) {
    const name = `${key}.json`;
    keep.add(name);
    writeJson(join(casesDir, name), bucket);
  }
  for (const name of readdirSync(casesDir)) {
    if (!keep.has(name)) rmSync(join(casesDir, name), { force: true });
  }
  return split;
}

/**
 * Shards must match a fresh split of the monolith. A hand-edit or a
 * render that forgot to re-split fails here.
 * @returns {{ ok: boolean, problems: { key: string, kind: string, detail: string }[] }}
 */
export function verifySplit(root, manifest, decks = deckCatalog(root)) {
  const expected = buildSplit(manifest, decks);
  const problems = [];
  const dir = join(root, SPLIT_DIR_REL);
  const checkFile = (rel, value) => {
    const path = join(root, rel);
    if (!existsSync(path)) {
      problems.push({
        key: rel,
        kind: "missing",
        detail: `${rel} is missing — run scripts/detective/split-audio-manifest.mjs`,
      });
      return;
    }
    let actual;
    try {
      actual = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      problems.push({ key: rel, kind: "unreadable", detail: `${rel} is not JSON (${e.message})` });
      return;
    }
    if (JSON.stringify(actual) !== JSON.stringify(value)) {
      problems.push({
        key: rel,
        kind: "stale",
        detail: `${rel} does not match the monolith — run scripts/detective/split-audio-manifest.mjs`,
      });
    }
  };
  checkFile(`${SPLIT_DIR_REL}/index.json`, expected.index);
  checkFile(`${SPLIT_DIR_REL}/names.json`, expected.names);
  const casesDir = join(dir, "cases");
  const seen = new Set();
  for (const key of Object.keys(expected.cases)) {
    const rel = `${SPLIT_DIR_REL}/cases/${key}.json`;
    seen.add(`${key}.json`);
    checkFile(rel, expected.cases[key]);
  }
  if (existsSync(casesDir)) {
    for (const name of readdirSync(casesDir)) {
      if (!seen.has(name)) {
        problems.push({
          key: `${SPLIT_DIR_REL}/cases/${name}`,
          kind: "orphan",
          detail: `${name} is not a case in the monolith — delete it or re-run the split generator`,
        });
      }
    }
  }
  return { ok: problems.length === 0, problems };
}

/** Byte sizes of the monolith and the shards a first clue actually fetches. */
export function splitFetchSizes(root) {
  const file = (rel) => {
    const path = join(root, rel);
    const raw = statSync(path).size;
    const gzip = gzipSync(readFileSync(path), { level: 9 }).length;
    return { raw, gzip };
  };
  const mono = file(MANIFEST_REL);
  const index = file(`${SPLIT_DIR_REL}/index.json`);
  const names = file(`${SPLIT_DIR_REL}/names.json`);
  const casesDir = join(root, SPLIT_DIR_REL, "cases");
  let caseCount = 0;
  let caseRawSum = 0;
  let caseMax = { name: "", raw: 0, gzip: 0 };
  for (const name of readdirSync(casesDir)) {
    if (!/^\d+\.json$/.test(name)) continue;
    const one = file(`${SPLIT_DIR_REL}/cases/${name}`);
    caseCount += 1;
    caseRawSum += one.raw;
    if (one.raw > caseMax.raw) caseMax = { name, raw: one.raw, gzip: one.gzip };
  }
  return {
    monolith: mono,
    index,
    names,
    caseCount,
    caseAvgRaw: caseCount === 0 ? 0 : Math.round(caseRawSum / caseCount),
    caseMax,
    firstClueRaw: index.raw + (caseMax.raw === 0 ? 0 : caseMax.raw),
  };
}

function main() {
  const args = process.argv.slice(2);
  let root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  let check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") root = resolve(args[++i]);
    else if (args[i] === "--check") check = true;
    else if (args[i] === "--help") {
      console.log("Usage: split-audio-manifest.mjs [--root <dir>] [--check]");
      process.exit(0);
    } else {
      console.error(`error: unknown flag "${args[i]}" — run with --help`);
      process.exit(2);
    }
  }
  const manifest = readManifest(root);
  if (check) {
    const result = verifySplit(root, manifest);
    if (!result.ok) {
      for (const p of result.problems) console.error(`  ${p.kind}  ${p.key} — ${p.detail}`);
      process.exit(2);
    }
    const sizes = splitFetchSizes(root);
    console.log(
      `detective audio split: clean (index ${sizes.index.raw} B, largest case ${sizes.caseMax.raw} B, monolith ${sizes.monolith.raw} B)`,
    );
    return;
  }
  const split = writeSplit(root, manifest);
  const sizes = splitFetchSizes(root);
  console.log(
    `wrote ${SPLIT_DIR_REL}: index, ${Object.keys(split.cases).length} cases, ${Object.keys(split.names).length} names`,
  );
  console.log(
    `first clue fetch <= ${sizes.index.raw + sizes.caseMax.raw} B raw (index ${sizes.index.raw} + largest case ${sizes.caseMax.name} ${sizes.caseMax.raw}); monolith ${sizes.monolith.raw} B`,
  );
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) main();
