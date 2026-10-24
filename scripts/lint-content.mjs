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
 * JSON tuple [corpus, locator, ruleSource, matchedText] — no wildcards, no
 * whole-file suppressions. Baselined violations are printed as KNOWN on
 * every run, never hidden. A violation that is not in the baseline fails;
 * a baseline entry that no longer matches a real violation also fails
 * (STALE BASELINE), so the baseline is self-expiring: fixing a violation
 * without removing its entry turns CI red with instructions.
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
 * Every rule that matches a text, in checkBanned's order — one record per
 * matching pattern, with the pattern's matched text and its `source` as
 * the rule id. checkBanned alone returns only the first match (truncated),
 * which is fine for the runtime but too lossy for a baseline key, so the
 * lint iterates the shared patterns itself.
 */
export function findViolations(text) {
  const found = [];
  for (const re of RULES) {
    const match = re.exec(text);
    if (match) found.push({ rule: re.source, matchedText: match[0] });
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

/** Clue records: every *.json in the clues dir, one record per clue string. */
function loadClueRecords(cluesDir) {
  const records = [];
  const files = readdirSync(cluesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(cluesDir, file), "utf8"));
    const clues = Array.isArray(parsed.clues) ? parsed.clues : [];
    clues.forEach((clue, i) => {
      if (typeof clue !== "string") return;
      records.push({
        corpus: "clues",
        // 1-based locator, e.g. "101.json#c1" — the record a reviewer opens.
        locator: `${file}#c${i + 1}`,
        text: clue,
        placeId: typeof parsed.placeId === "string" ? parsed.placeId : undefined,
      });
    });
  }
  return records;
}

/** A violation's / baseline entry's exact identity — no wildcards. */
function keyOf({ corpus, locator, rule, matchedText }) {
  return JSON.stringify([corpus, locator, rule, matchedText]);
}

/** Baseline entries from disk; a missing file reads as an empty baseline. */
function loadBaseline(baselinePath) {
  if (!existsSync(baselinePath)) return [];
  const parsed = JSON.parse(readFileSync(baselinePath, "utf8"));
  return Array.isArray(parsed.entries) ? parsed.entries : [];
}

function formatRecord({ corpus, locator, placeId, rule, matchedText }) {
  const place = placeId ? ` placeId=${placeId}` : "";
  return `${corpus} ${locator}${place} rule=${rule} match=${JSON.stringify(matchedText)}`;
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
  if (selected.includes("clues")) {
    const clueRecords = loadClueRecords(cluesDir);
    counts.clues = clueRecords.length;
    records.push(...clueRecords);
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
    log(
      `STALE BASELINE ${e.corpus} ${e.locator} rule=${e.rule} match=${JSON.stringify(e.matchedText)} — remove this entry`,
    );
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
