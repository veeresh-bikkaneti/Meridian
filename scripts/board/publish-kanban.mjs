#!/usr/bin/env node
/**
 * Publish the build board's snapshot — the gauges are mechanical, the
 * cards are curated, and this script only ever touches the gauges.
 *
 *   node scripts/board/publish-kanban.mjs
 *
 * Reads the three architecture baselines (eslint/layer-baseline.json:
 * the noRawIo and noUpwardImport row counts; eslint/shell-ban-
 * baseline.json: every ban list's rows), refreshes `gauges` and
 * `asOf` (today, America/Chicago) in src/build-board/kanban.json, and
 * writes the same snapshot to public/build-board.json, which is what
 * the deployed /kanban page fetches (its bundled copy of kanban.json
 * is the offline fallback).
 *
 * The cards themselves are hand-curated in kanban.json: this script
 * preserves them byte-for-byte (2-space JSON + trailing newline) and
 * validates the envelope before writing — 45 cards, unique ids.
 *
 * Fail-loud: an unreadable baseline, a malformed snapshot or a failed
 * validation prints the problem to stderr, exits non-zero and writes
 * NOTHING. Writes are atomic (tmp file in the same directory, renamed
 * over the target). No tokens, no secrets, no dependencies — node
 * stdlib only, and no network: the baselines on disk are the truth.
 */
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAYER_BASELINE_PATH = join(ROOT, "eslint", "layer-baseline.json");
const SHELL_BAN_BASELINE_PATH = join(ROOT, "eslint", "shell-ban-baseline.json");
const KANBAN_PATH = join(ROOT, "src", "build-board", "kanban.json");
const PUBLIC_PATH = join(ROOT, "public", "build-board.json");
const EXPECTED_CARD_COUNT = 45;

function fail(message) {
  throw new Error(message);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(`cannot read/parse ${label} (${path}): ${err.message}`);
  }
}

/** Row counts from the baselines: layer lists by rule, shell-ban lists summed. */
function readGauges() {
  const layer = readJson(LAYER_BASELINE_PATH, "layer-baseline.json");
  if (!Array.isArray(layer?.noRawIo) || !Array.isArray(layer?.noUpwardImport)) {
    fail("layer-baseline.json: noRawIo and noUpwardImport must be arrays");
  }
  const shell = readJson(SHELL_BAN_BASELINE_PATH, "shell-ban-baseline.json");
  const shellBan = Object.values(shell ?? {}).reduce(
    (total, value) => total + (Array.isArray(value) ? value.length : 0),
    0,
  );
  return {
    noRawIo: layer.noRawIo.length,
    noUpwardImport: layer.noUpwardImport.length,
    shellBan,
  };
}

/** "2026-11-23" (America/Chicago), matching the seed's asOf style. */
function todayCentral(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validateSnapshot(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail("kanban.json: top level is not a JSON object");
  }
  if (!Array.isArray(data.cards)) fail("kanban.json: cards must be an array");
  if (data.cards.length !== EXPECTED_CARD_COUNT) {
    fail(`kanban.json: expected ${EXPECTED_CARD_COUNT} cards, got ${data.cards.length}`);
  }
  const ids = new Set();
  for (const card of data.cards) {
    if (typeof card?.id !== "string" || card.id.length === 0) {
      fail("kanban.json: a card has no non-empty string id");
    }
    if (ids.has(card.id)) fail(`kanban.json: duplicate card id "${card.id}"`);
    ids.add(card.id);
  }
}

function writeAtomic(path, data) {
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    fail(`atomic write to ${path} failed: ${err.message}`);
  }
}

function main() {
  const snapshot = readJson(KANBAN_PATH, "kanban.json");
  validateSnapshot(snapshot);

  const gauges = readGauges();
  const old = snapshot.gauges ?? {};
  snapshot.gauges = gauges;
  snapshot.asOf = todayCentral();

  writeAtomic(KANBAN_PATH, snapshot);
  writeAtomic(PUBLIC_PATH, snapshot);

  console.log(
    `gauges: noRawIo ${old.noRawIo ?? "?"} -> ${gauges.noRawIo}, ` +
      `noUpwardImport ${old.noUpwardImport ?? "?"} -> ${gauges.noUpwardImport}, ` +
      `shellBan ${old.shellBan ?? "?"} -> ${gauges.shellBan}`,
  );
  console.log(`asOf: ${snapshot.asOf}; ${snapshot.cards.length} cards -> public/build-board.json`);
}

try {
  main();
} catch (err) {
  console.error(`publish-kanban: ${err.message}`);
  process.exit(1);
}
