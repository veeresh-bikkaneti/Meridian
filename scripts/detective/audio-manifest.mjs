/**
 * audio-manifest.mjs — read / write / verify the detective audio manifest.
 *
 * Why: pre-rendered speech is only trustworthy if the shipped file still
 * matches the words it was rendered from. The manifest at
 * public/audio/detective/manifest.json records, per line, the exact text,
 * voice, speed and gain plus a hash of those four. Verify recomputes the
 * expected specs from the CURRENT sources (clue files, the names catalog
 * and render-plan.mjs) and compares hashes — so editing one clue word
 * makes exactly that line stale, loudly, in CI (check-audio-manifest.mjs).
 *
 * Entry shape: { text, textHash, voice, speed, gainDb, file, measuredHz,
 * measuredWpm, durationSec, status: "ok" | "flagged", note? }
 * textHash = sha256 hex of `voice|speed|gainDb|text`.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXED_LINES, VOICES, casePlan, displayName, selectionNamePlan } from "./render-plan.mjs";

export const MANIFEST_REL = "public/audio/detective/manifest.json";
export const AUDIO_REL = "public/audio/detective";
export const NAMES_MIN_POPULATION = 500000;
/** Capitals pack case indexes (public/packs/capitals/manifest.json). */
export const CAPITALS_INDEXES = Object.freeze(
  Array.from({ length: 110 }, (_, i) => 387 + i),
);

export function textHash({ voice, speed, gainDb, text }) {
  return createHash("sha256").update(`${voice}|${speed}|${gainDb}|${text}`).digest("hex");
}

export function createManifest() {
  return {
    v: 1,
    voices: { holmes: VOICES.holmes, watson: VOICES.watson },
    coverage: {
      // Claimed coverage grows as units land: U1 renders the dev case
      // only (below, under cases), U2 claims `fixed`, U3 fills
      // `capitals` + `answers`. The CI gate fails on any CLAIMED entry
      // that is missing or stale — an empty list claims nothing.
      capitals: [],
      answers: [],
      fixed: false,
      namesMinPopulation: NAMES_MIN_POPULATION,
      namesTierComplete: false,
    },
    fixed: {},
    cases: {},
    names: {},
  };
}

export function manifestPath(root) {
  return join(root, MANIFEST_REL);
}

export function readManifest(root) {
  const path = manifestPath(root);
  if (!existsSync(path)) return createManifest();
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (parsed?.v !== 1) {
    throw new Error(`manifest at ${path} is not schema v1 — delete it and re-render, or fix its "v" field`);
  }
  // Fill any sections an older/partial manifest lacks.
  const base = createManifest();
  return {
    ...base,
    ...parsed,
    coverage: { ...base.coverage, ...(parsed.coverage ?? {}) },
    fixed: parsed.fixed ?? {},
    cases: parsed.cases ?? {},
    names: parsed.names ?? {},
  };
}

export function writeManifest(root, manifest) {
  const path = manifestPath(root);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 1)}\n`);
  renameSync(tmp, path);
}

/** Build a manifest entry from a render spec + its measurements. */
export function entryFromSpec(spec, measured = {}) {
  const entry = {
    text: spec.text,
    textHash: textHash(spec),
    voice: spec.voice,
    speed: spec.speed,
    gainDb: spec.gainDb,
    file: spec.file,
    measuredHz: measured.measuredHz ?? null,
    measuredWpm: measured.measuredWpm ?? null,
    durationSec: measured.durationSec ?? null,
    status: measured.status ?? "ok",
  };
  const note = measured.note ?? spec.note;
  if (note) entry.note = note;
  return entry;
}

/** Where an entry lives in the manifest, as a stable dotted key. */
export function entryKey(spec) {
  if (spec.kind === "clue") return `cases.${spec.caseIndex}.clues.${spec.clueIndex}`;
  if (spec.kind === "answer") return `cases.${spec.caseIndex}.answer`;
  if (spec.kind === "name") return `names.${spec.geonameId}`;
  return `fixed.${spec.id}`;
}

export function getEntry(manifest, spec) {
  if (spec.kind === "clue") return manifest.cases?.[spec.caseIndex]?.clues?.[spec.clueIndex];
  if (spec.kind === "answer") return manifest.cases?.[spec.caseIndex]?.answer;
  if (spec.kind === "name") return manifest.names?.[spec.geonameId];
  return manifest.fixed?.[spec.id];
}

export function setEntry(manifest, spec, entry) {
  if (spec.kind === "clue" || spec.kind === "answer") {
    const bucket = (manifest.cases[spec.caseIndex] ??= { clues: [], answer: null });
    if (spec.kind === "clue") bucket.clues[spec.clueIndex] = entry;
    else bucket.answer = entry;
  } else if (spec.kind === "name") {
    manifest.names[spec.geonameId] = entry;
  } else {
    manifest.fixed[spec.id] = entry;
  }
}

/* ------------------------------------------------------------------ */
/* Source loading (the "current truth" verify recomputes from)         */
/* ------------------------------------------------------------------ */

export function clueFilePath(root, caseIndex) {
  return join(root, "public/loop/clues", `${caseIndex}.json`);
}

export function readClueFile(root, caseIndex) {
  const path = clueFilePath(root, caseIndex);
  if (!existsSync(path)) {
    throw new Error(
      `missing clue file for case ${caseIndex}: looked at ${path} — check the case index is in range 0-496`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Unpack public/loop/names.v2.json (parallel columns, region strings
 * interned) into rows { id: "geonames:<n>", n, r, p } — the same decode
 * as unpackNameIndex in src/game/loop/names-codec.ts, kept dependency-
 * free here so the gate runs on plain node with no build step.
 */
export function readNamesIndex(root) {
  const path = join(root, "public/loop/names.v2.json");
  if (!existsSync(path)) {
    throw new Error(`missing names catalog: looked at ${path} — the pipeline cannot resolve display names without it`);
  }
  const d = JSON.parse(readFileSync(path, "utf8"));
  if (d?.v !== 2 || !Array.isArray(d.n) || !Array.isArray(d.regions)) {
    throw new Error(`names catalog at ${path} has an unexpected shape (want packed v2) — re-run the loop build that produces it`);
  }
  const rows = new Array(d.n.length);
  for (let i = 0; i < d.n.length; i++) {
    rows[i] = { id: `geonames:${d.id[i]}`, n: d.n[i], r: d.regions[d.r[i]], p: d.p[i] };
  }
  return rows;
}

/** Resolve a clue file's placeId to its spoken display name. */
export function displayNameForCase(root, clueFile, rows = readNamesIndex(root)) {
  const entry = rows.find((r) => r.id === clueFile.placeId);
  if (!entry) {
    throw new Error(
      `place ${clueFile.placeId} is not in the names catalog — the game could not show this answer either; fix the clue file or the catalog`,
    );
  }
  return displayName(entry);
}

/* ------------------------------------------------------------------ */
/* Verify                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every spec the manifest is accountable for: all CLAIMED coverage
 * (coverage.capitals clues+answers, coverage.answers, coverage.fixed,
 * the full name tier when namesTierComplete) PLUS every entry actually
 * present in the manifest (a rendered dev case is verified even before
 * its deck is claimed, so it can never rot silently either).
 *
 * @returns {Map<string, object>} entryKey → render spec
 */
export function collectExpectedSpecs(root, manifest) {
  const expected = new Map();
  const rows = readNamesIndex(root);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const addCase = (caseIndex, { clues = true, answer = true } = {}) => {
    const clueFile = readClueFile(root, caseIndex);
    const row = byId.get(clueFile.placeId);
    if (!row) {
      throw new Error(`case ${caseIndex}: place ${clueFile.placeId} is not in the names catalog — fix the clue file or the catalog`);
    }
    const plan = casePlan(clueFile, displayName(row), caseIndex);
    if (clues) for (const s of plan.clues) expected.set(entryKey(s), s);
    if (answer) expected.set(entryKey(plan.answer), plan.answer);
  };

  if (manifest.coverage?.fixed) {
    for (const s of FIXED_LINES) expected.set(entryKey(s), s);
  }
  for (const i of manifest.coverage?.capitals ?? []) addCase(i);
  for (const i of manifest.coverage?.answers ?? []) addCase(i, { clues: false });
  if (manifest.coverage?.namesTierComplete) {
    const min = manifest.coverage.namesMinPopulation ?? NAMES_MIN_POPULATION;
    const wanted = new Set(rows.filter((r) => r.p >= min).map((r) => r.id));
    for (let i = 0; i <= 496; i++) wanted.add(readClueFile(root, i).placeId);
    for (const id of wanted) {
      const s = selectionNamePlan(byId.get(id));
      expected.set(entryKey(s), s);
    }
  }

  // Everything present in the manifest is accountable too.
  for (const s of FIXED_LINES) {
    if (manifest.fixed?.[s.id]) expected.set(entryKey(s), s);
  }
  for (const key of Object.keys(manifest.cases ?? {})) {
    const i = Number(key);
    const present = manifest.cases[key];
    addCase(i, {
      clues: Array.isArray(present?.clues) && present.clues.some(Boolean),
      answer: Boolean(present?.answer),
    });
  }
  for (const id of Object.keys(manifest.names ?? {})) {
    const row = byId.get(`geonames:${id}`);
    if (!row) {
      expected.set(`names.${id}`, null); // surfaces as a stale/orphan problem
    } else {
      const s = selectionNamePlan(row);
      expected.set(entryKey(s), s);
    }
  }
  return expected;
}

/**
 * Compare the manifest against current sources.
 * @returns {{ ok: boolean, checked: number,
 *   problems: { key: string, kind: "missing"|"stale"|"missing-file"|"orphan", detail: string }[] }}
 */
export function verifyManifest(root, manifest) {
  const expected = collectExpectedSpecs(root, manifest);
  const problems = [];
  let checked = 0;
  for (const [key, spec] of expected) {
    checked++;
    if (!spec) {
      problems.push({ key, kind: "orphan", detail: "manifest names an id that is no longer in the names catalog" });
      continue;
    }
    // Rebuild a pseudo-spec to fetch the stored entry.
    const stored = getEntry(manifest, spec);
    if (!stored) {
      problems.push({ key, kind: "missing", detail: `claimed but not rendered (file should be ${spec.file})` });
      continue;
    }
    // Text, voice and gain must match the plan exactly. Speed may differ
    // only as a retry-ladder adjustment that the entry's own note
    // records — see render-audio.mjs and pace-ladder.mjs: the pitch
    // ladder moves ±3/±6 and the pace ladder then adds +6/+12 on top,
    // so the total drift is a multiple of 3 between -6 and +18. The
    // stored hash must always be the hash of the stored fields, so a
    // hand-edited entry cannot pass.
    const speedDelta = stored.speed - spec.speed;
    const speedOk =
      stored.speed === spec.speed ||
      (speedDelta % 3 === 0 &&
        speedDelta >= -6 &&
        speedDelta <= 18 &&
        /(pitch|pace) retry ladder/.test(stored.note ?? ""));
    const hashOk =
      stored.textHash ===
      textHash({ voice: stored.voice, speed: stored.speed, gainDb: stored.gainDb, text: stored.text });
    if (
      !hashOk ||
      !speedOk ||
      stored.text !== spec.text ||
      stored.voice !== spec.voice ||
      stored.gainDb !== spec.gainDb
    ) {
      problems.push({
        key,
        kind: "stale",
        detail: `text/voice/speed/gain changed since render — manifest text ${JSON.stringify(stored.text)} vs current ${JSON.stringify(spec.text)}`,
      });
      continue;
    }
    if (!existsSync(join(root, AUDIO_REL, stored.file))) {
      problems.push({ key, kind: "missing-file", detail: `audio file missing: ${AUDIO_REL}/${stored.file}` });
    }
  }
  return { ok: problems.length === 0, checked, problems };
}

/* ------------------------------------------------------------------ */
/* Per-case clues-only size budget (cure pass, item 4)                 */
/* ------------------------------------------------------------------ */

/**
 * The per-case audio budget, CLUES-ONLY definition: the five clue
 * reads of one case together must not exceed this many bytes on disk.
 * The answer read is NOT counted. (The record previously claimed a
 * clues+answer budget with no enforcement anywhere; measured truth:
 * clues+answer exceeds 500,000 B in 12 of 497 cases — worst case 397
 * at 524,574 B — while the clues-only maximum is case 397 at
 * 495,161 B, inside the budget. The budget now means clues-only and
 * this gate enforces it.)
 */
export const CLUES_ONLY_BUDGET_BYTES = 500_000;

/**
 * Sum the on-disk sizes of each manifest case's CLUE files only and
 * report every case over the budget. Missing files are skipped here —
 * verifyManifest already reports them as missing-file problems.
 * @returns {{ key: string, kind: "over-budget", detail: string }[]}
 */
export function checkClueBudgets(root, manifest) {
  const problems = [];
  for (const [caseIndex, bucket] of Object.entries(manifest.cases ?? {})) {
    let total = 0;
    for (const entry of bucket?.clues ?? []) {
      if (!entry?.file) continue;
      const path = join(root, AUDIO_REL, entry.file);
      if (existsSync(path)) total += statSync(path).size;
    }
    if (total > CLUES_ONLY_BUDGET_BYTES) {
      problems.push({
        key: `cases.${caseIndex}.clues`,
        kind: "over-budget",
        detail: `clues-only audio is ${total} B, over the ${CLUES_ONLY_BUDGET_BYTES} B per-case budget (answer read not counted)`,
      });
    }
  }
  return problems;
}
