#!/usr/bin/env node
/**
 * lint-content.mjs — clue-quality gate for shipped content (WI-17).
 *
 * WHAT IT GATES: the curated content surface a child actually reads — the
 * loop clue files (public/loop/clues/*.json), the curated starter stories
 * (src/game/starters.ts), and the Journal catalog stories
 * (src/game/catalog.ts) — against the game's own banned-pattern rules: no
 * elevations, populations, census numbers, or measurements a child cannot
 * picture.
 *
 * ONE SOURCE OF RULES: those rules live in src/game/story-ai.ts and today
 * run only at runtime, on on-device-AI text. This script IMPORTS the
 * runtime's own exports (checkBanned, BANNED_PATTERNS, MEASUREMENT_RE)
 * instead of copying the patterns, so the game and the gate can never drift
 * apart: there is one definition, imported by both. That is also why the
 * script runs under node --experimental-strip-types (precedent:
 * scripts/contact-readiness.mjs). story-ai.ts is imported, never edited.
 *
 * BASELINE: violations that already ship are listed individually in
 * scripts/lint-content-baseline.json as OWNER DECISION items (PO ruling,
 * WI-17: baselined, not fixed in this branch). A baseline key is the exact
 * JSON tuple [corpus, locator, ruleSource, matchedText, occurrence] — no
 * wildcards, no whole-file suppressions. Occurrence is the 0-based index
 * of prior occurrences of the same matchedText under the same rule in
 * the same record, so repeated matches in one record stay distinct.
 * Baselined violations are printed as KNOWN on every run, never hidden.
 * A violation that is not in the baseline fails; a baseline entry that
 * no longer matches a real violation also fails (STALE BASELINE), so the
 * baseline is self-expiring: fixing a violation without removing its
 * entry turns CI red with instructions.
 *
 * FIXTURE GATE (every run, mirroring lint-cards.mjs): before any corpus
 * result, a deliberately bad fixture must be caught by the measurement
 * pattern and a clean fixture must pass. If the rules ever stop biting,
 * the lint fails itself (FIXTURE GATE FAILED) rather than reporting a
 * hollow pass.
 *
 * EMPTY SCAN: the lint prints how many records it scanned per corpus and
 * fails if any selected corpus scanned zero records — a broken glob that
 * matches nothing must never read as a green tick.
 *
 * Usage: npm run lint:content
 *   node --experimental-strip-types scripts/lint-content.mjs
 *     [--corpus clues,starters,catalog] [--clues-dir <path>]
 *     [--baseline <path>]
 * Exit 0 when the gate passes; exit 1 otherwise. Node stdlib only.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkBanned, BANNED_PATTERNS, MEASUREMENT_RE } from "../src/game/story-ai.ts";
import { STARTERS } from "../src/game/starters.ts";
import { PLACES } from "../src/game/catalog.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);

const ALL_CORPORA = ["clues", "starters", "catalog"];

// The rules, in the same order checkBanned applies them: every banned
// pattern first, then the general measurement pattern.
const RULES = [...BANNED_PATTERNS, MEASUREMENT_RE];

// Fixture-gate sentences: the bad one carries a measurement the rules must
// catch; the clean one is ordinary story prose and must pass untouched.
const BAD_FIXTURE = "The tower rises 400 feet above the square.";
const CLEAN_FIXTURE =
  "The tower was built long ago, and children still climb its winding stairs.";

/**
 * Every match of every rule in a text, in checkBanned's order — one
 * record per match occurrence, with the pattern's matched text, its
 * `source` as the rule id, and an occurrence index counting prior
 * occurrences of the same matchedText under the same rule in this
 * record. checkBanned alone returns only the first match (truncated),
 * which is fine for the runtime but too lossy for a baseline key, so
 * the lint iterates the shared patterns itself. Each pattern is cloned
 * with the global flag for enumeration; the shared imported RegExp
 * objects are never mutated and never gain /g.
 */
export function findViolations(text) {
  const found = [];
  for (const re of RULES) {
    const globalRe = new RegExp(
      re.source,
      re.flags.includes("g") ? re.flags : re.flags + "g",
    );
    const priorByMatchedText = new Map();
    for (const match of text.matchAll(globalRe)) {
      const matchedText = match[0];
      const occurrence = priorByMatchedText.get(matchedText) ?? 0;
      priorByMatchedText.set(matchedText, occurrence + 1);
      found.push({ rule: re.source, matchedText, occurrence });
    }
  }
  return found;
}

/** The fixture gate: the imported rules must bite, and must not over-bite. */
function checkFixtures() {
  const failures = [];
  const badFound = findViolations(BAD_FIXTURE);
  if (!badFound.some((v) => v.rule === MEASUREMENT_RE.source)) {
    failures.push(
      `bad fixture not caught by the measurement pattern: ${JSON.stringify(BAD_FIXTURE)}`,
    );
  }
  const cleanFound = findViolations(CLEAN_FIXTURE);
  if (cleanFound.length > 0) {
    failures.push(
      `clean fixture wrongly flagged [${cleanFound.map((v) => v.rule).join(", ")}]: ${JSON.stringify(CLEAN_FIXTURE)}`,
    );
  }
  return failures;
}

/**
 * Clue records: every *.json in the clues dir, one record per clue
 * string. Malformed JSON and malformed shape are hard failures, never a
 * silent under-scan: a parse failure names its file, and a file whose
 * clues field is not an array, whose length is not exactly 5 (the
 * shipped shape, verified across all 387 files), or that contains a
 * non-string entry yields a SHAPE failure naming the file and defect.
 */
function loadClueRecords(cluesDir) {
  const records = [];
  const failures = [];
  const files = readdirSync(cluesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(cluesDir, file), "utf8"));
    } catch (err) {
      failures.push({
        kind: "parse",
        file,
        message: `${file}: malformed JSON: ${err.message}`,
      });
      continue;
    }
    if (!Array.isArray(parsed.clues)) {
      failures.push({
        kind: "shape",
        file,
        message: `${file}: clues is not an array`,
      });
      continue;
    }
    if (parsed.clues.length !== 5) {
      failures.push({
        kind: "shape",
        file,
        message: `${file}: clues length is ${parsed.clues.length}, expected 5`,
      });
    }
    parsed.clues.forEach((clue, i) => {
      if (typeof clue !== "string") {
        failures.push({
          kind: "shape",
          file,
          message: `${file}: clues[${i}] is not a string`,
        });
        return;
      }
      records.push({
        corpus: "clues",
        // 1-based locator, e.g. "101.json#c1" — the record a reviewer opens.
        locator: `${file}#c${i + 1}`,
        text: clue,
        placeId: typeof parsed.placeId === "string" ? parsed.placeId : undefined,
      });
    });
  }
  return { records, failures };
}

/** A violation's / baseline entry's exact identity — no wildcards. */
function keyOf({ corpus, locator, rule, matchedText, occurrence }) {
  return JSON.stringify([corpus, locator, rule, matchedText, occurrence ?? 0]);
}

/** Baseline entries from disk; a missing file reads as an empty baseline. */
function loadBaseline(baselinePath) {
  if (!existsSync(baselinePath)) return [];
  const parsed = JSON.parse(readFileSync(baselinePath, "utf8"));
  return Array.isArray(parsed.entries) ? parsed.entries : [];
}

function formatRecord({ corpus, locator, placeId, rule, matchedText, occurrence }) {
  const place = placeId ? ` placeId=${placeId}` : "";
  const occ = (occurrence ?? 0) > 0 ? ` occurrence=${occurrence}` : "";
  return `${corpus} ${locator}${place} rule=${rule} match=${JSON.stringify(matchedText)}${occ}`;
}

function resolvePath(value, fallback) {
  if (!value) return fallback;
  return isAbsolute(value) ? value : resolve(REPO, value);
}

/**
 * Run the lint. Options: { corpus } (csv string or array; default all
 * three), { cluesDir } (default public/loop/clues), { baseline } (default
 * scripts/lint-content-baseline.json), plus injectable { log, error }.
 * Prints the report and returns the result; the caller sets the exit code.
 */
export function runLint(options = {}) {
  const log = options.log ?? console.log;
  const error = options.error ?? console.error;

  const selected =
    options.corpus === undefined
      ? ALL_CORPORA
      : (Array.isArray(options.corpus)
          ? options.corpus
          : String(options.corpus).split(",")
        )
          .map((c) => c.trim())
          .filter(Boolean);
  for (const c of selected) {
    if (!ALL_CORPORA.includes(c)) throw new Error(`unknown corpus: ${c}`);
  }
  if (selected.length === 0) throw new Error("no corpus selected");

  const cluesDir = resolvePath(options.cluesDir, join(REPO, "public", "loop", "clues"));
  const baselinePath = resolvePath(
    options.baseline,
    join(HERE, "lint-content-baseline.json"),
  );

  // Fixture gate first: if the rules do not bite, no corpus result counts.
  const fixtureFailures = checkFixtures();
  if (fixtureFailures.length > 0) {
    error("lint-content: FIXTURE GATE FAILED");
    for (const f of fixtureFailures) error(`  - ${f}`);
    error("lint-content: GATE FAILED");
    return {
      ok: false,
      fixtureFailures,
      counts: {},
      violations: [],
      baselined: 0,
      newViolations: [],
      stale: [],
      drift: [],
    };
  }
  log("lint-content: fixture gate passed (bad fixture caught, clean fixture clean)");

  // Scan the selected corpora into { corpus, locator, text } records.
  const records = [];
  const counts = {};
  const loadFailures = [];
  if (selected.includes("clues")) {
    const clueResult = loadClueRecords(cluesDir);
    counts.clues = clueResult.records.length;
    records.push(...clueResult.records);
    loadFailures.push(...clueResult.failures);
  }
  if (selected.includes("starters")) {
    const starterRecords = STARTERS.map((s) => ({
      corpus: "starters",
      locator: s.id,
      text: s.story,
    }));
    counts.starters = starterRecords.length;
    records.push(...starterRecords);
  }
  if (selected.includes("catalog")) {
    const catalogRecords = PLACES.map((p) => ({
      corpus: "catalog",
      locator: p.id,
      text: p.story,
    }));
    counts.catalog = catalogRecords.length;
    records.push(...catalogRecords);
  }
  log(
    `lint-content: scanned ${selected.map((c) => `${c}=${counts[c]}`).join(" ")}`,
  );

  // Every violation, plus the agreement check: on every text, "the lint
  // found a violation" must agree with the runtime's own checkBanned
  // verdict — the two consumers demonstrably agree, on the full corpus,
  // every run. A disagreement means the shared rules were bypassed.
  const actual = [];
  const drift = [];
  for (const record of records) {
    const found = findViolations(record.text);
    if ((found.length > 0) !== (checkBanned(record.text).length > 0)) {
      drift.push(record);
    }
    for (const v of found) actual.push({ ...record, ...v });
  }
  actual.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));

  // Baseline diff: new violations fail, stale entries fail, baselined
  // violations are reported as KNOWN — visible, never suppressed.
  const baselineEntries = loadBaseline(baselinePath);
  const baselineKeys = new Set(baselineEntries.map(keyOf));
  const actualKeys = new Set(actual.map(keyOf));
  const known = actual.filter((v) => baselineKeys.has(keyOf(v)));
  const newViolations = actual.filter((v) => !baselineKeys.has(keyOf(v)));
  const stale = baselineEntries
    .filter((e) => !actualKeys.has(keyOf(e)))
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)));

  for (const v of known) {
    log(`KNOWN (baselined, owner decision pending) ${formatRecord(v)}`);
  }
  for (const v of newViolations) {
    log(`VIOLATION ${formatRecord(v)}`);
  }
  for (const e of stale) {
    const occ = (e.occurrence ?? 0) > 0 ? ` occurrence=${e.occurrence}` : "";
    log(
      `STALE BASELINE ${e.corpus} ${e.locator} rule=${e.rule} match=${JSON.stringify(e.matchedText)}${occ} — remove this entry`,
    );
  }
  for (const f of loadFailures) {
    if (f.kind === "shape") {
      log(`SHAPE ${f.message}`);
    } else {
      log(`ERROR ${f.message}`);
    }
  }
  for (const r of drift) {
    log(
      `RULE-DRIFT ${r.corpus} ${r.locator} — lint and checkBanned disagree on this text`,
    );
  }

  // Empty-scan guard: a selected corpus that scanned nothing is a broken
  // scan, not a pass.
  const emptyCorpora = selected.filter((c) => counts[c] === 0);
  for (const c of emptyCorpora) {
    log(`EMPTY SCAN ${c} — scanned 0 records`);
  }

  log(
    `lint-content: violations=${actual.length} (baselined ${known.length}, new ${newViolations.length}, stale ${stale.length})`,
  );
  const ok =
    newViolations.length === 0 &&
    stale.length === 0 &&
    drift.length === 0 &&
    loadFailures.length === 0 &&
    emptyCorpora.length === 0;
  if (ok) {
    log("lint-content: GATE PASSED");
  } else {
    error("lint-content: GATE FAILED");
  }
  return {
    ok,
    counts,
    violations: actual,
    baselined: known.length,
    newViolations,
    stale,
    drift,
    loadFailures,
  };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--corpus") options.corpus = argv[++i];
    else if (arg === "--clues-dir") options.cluesDir = argv[++i];
    else if (arg === "--baseline") options.baseline = argv[++i];
    else {
      throw new Error(
        `unknown argument: ${arg} (usage: lint-content.mjs [--corpus <csv>] [--clues-dir <path>] [--baseline <path>])`,
      );
    }
  }
  return options;
}

// Run only when invoked as main (mirrors lint-cards.mjs), so runLint stays
// importable without side effects.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runLint(parseArgs(process.argv.slice(2)));
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error(`lint-content: ${err.message}`);
    console.error("lint-content: GATE FAILED");
    process.exit(1);
  }
}
