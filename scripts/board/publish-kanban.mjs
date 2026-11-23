#!/usr/bin/env node
/**
 * Publish the build board's snapshot for one deploy — the gauges'
 * `now` values are mechanical, the cards are curated, and this
 * script only ever refreshes the mechanical part.
 *
 *   node scripts/board/publish-kanban.mjs
 *
 * Wired into `prebuild` and `prebuild:pages`, so every build
 * rewrites public/build-board.json BEFORE vite build copies
 * public/ into the deploy. The deployed /kanban page fetches
 * that file through the transport port and falls back to its
 * bundled copy of kanban.json on any error.
 *
 * Reads:
 *   - src/build-board/kanban.json — the curated v2 envelope. This
 *     script NEVER writes it: a build must not dirty the tree.
 *   - eslint/layer-baseline.json — the noRawIo and noUpwardImport
 *     row counts.
 *   - eslint/shell-ban-baseline.json — every ban list's rows,
 *     summed.
 *
 * Writes (atomically, and only after every check passes):
 *   - public/build-board.json — the envelope verbatim, with each
 *     gauges.<name>.now refreshed from the baselines and a
 *     `builtAt` ISO stamp added. The file is a build artifact:
 *     it is gitignored, never committed.
 *
 * Validation (fail loud, write NOTHING on error): schemaVersion
 * is 2; 18 stories and 45 subtasks; ids unique across stories
 * and subtasks together; every subtask sits in exactly one
 * story's subtasks list and names that story; every dependsOn
 * id exists; every gauge carries numeric start/now/target.
 *
 * Fail-loud: an unreadable baseline, a malformed envelope or a
 * failed validation prints the problem to stderr, exits non-zero
 * and writes NOTHING. Writes are atomic (tmp file in the same
 * directory, renamed over the target). No tokens, no secrets, no
 * dependencies — node stdlib only, and no network: the baselines
 * on disk are the truth.
 */
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAYER_BASELINE_PATH = join(ROOT, "eslint", "layer-baseline.json");
const SHELL_BAN_BASELINE_PATH = join(ROOT, "eslint", "shell-ban-baseline.json");
const KANBAN_PATH = join(ROOT, "src", "build-board", "kanban.json");
const PUBLIC_PATH = join(ROOT, "public", "build-board.json");
const EXPECTED_SCHEMA_VERSION = 2;
const EXPECTED_STORY_COUNT = 18;
const EXPECTED_SUBTASK_COUNT = 45;
const GAUGE_KEYS = ["noRawIo", "noUpwardImport", "shellBan"];

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
function readGaugeNows() {
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

/** The v2 envelope checks — the same invariants loadSnapshot enforces. */
function validateEnvelope(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail("kanban.json: top level is not a JSON object");
  }
  if (data.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    fail(`kanban.json: schemaVersion must be ${EXPECTED_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(data.stories) || data.stories.length !== EXPECTED_STORY_COUNT) {
    fail(
      `kanban.json: expected ${EXPECTED_STORY_COUNT} stories, got ${
        Array.isArray(data.stories) ? data.stories.length : "none"
      }`,
    );
  }
  if (!Array.isArray(data.subtasks) || data.subtasks.length !== EXPECTED_SUBTASK_COUNT) {
    fail(
      `kanban.json: expected ${EXPECTED_SUBTASK_COUNT} subtasks, got ${
        Array.isArray(data.subtasks) ? data.subtasks.length : "none"
      }`,
    );
  }
  if (typeof data.gauges !== "object" || data.gauges === null) {
    fail("kanban.json: gauges missing");
  }
  for (const key of GAUGE_KEYS) {
    const g = data.gauges[key];
    if (
      typeof g !== "object" || g === null ||
      typeof g.start !== "number" || typeof g.now !== "number" || typeof g.target !== "number"
    ) {
      fail(`kanban.json: gauges.${key} must carry numeric start/now/target`);
    }
  }

  // Ids unique across stories and subtasks together.
  const ids = new Set();
  for (const item of [...data.stories, ...data.subtasks]) {
    if (typeof item?.id !== "string" || item.id.length === 0) {
      fail("kanban.json: a story or subtask has no non-empty string id");
    }
    if (ids.has(item.id)) fail(`kanban.json: duplicate id "${item.id}"`);
    ids.add(item.id);
  }
  const subtaskIds = new Set(data.subtasks.map((s) => s.id));
  const storyIds = new Set(data.stories.map((s) => s.id));

  // Every subtask in exactly one story's list, naming that story;
  // every dependsOn id exists.
  const membership = new Map();
  for (const story of data.stories) {
    if (!Array.isArray(story.subtasks)) {
      fail(`kanban.json: story "${story.id}" has no subtasks list`);
    }
    for (const id of story.subtasks) {
      if (!subtaskIds.has(id)) {
        fail(`kanban.json: story "${story.id}" lists unknown subtask "${id}"`);
      }
      membership.set(id, (membership.get(id) ?? 0) + 1);
    }
  }
  for (const sub of data.subtasks) {
    if (membership.get(sub.id) !== 1) {
      fail(`kanban.json: subtask "${sub.id}" sits in ${membership.get(sub.id) ?? 0} stories`);
    }
    if (!storyIds.has(sub.story)) {
      fail(`kanban.json: subtask "${sub.id}" names unknown story "${sub.story}"`);
    }
    for (const dep of sub.dependsOn ?? []) {
      if (!subtaskIds.has(dep)) {
        fail(`kanban.json: subtask "${sub.id}" depends on unknown "${dep}"`);
      }
    }
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
  const envelope = readJson(KANBAN_PATH, "kanban.json");
  validateEnvelope(envelope);

  const nows = readGaugeNows();
  const built = {
    ...envelope,
    gauges: Object.fromEntries(
      GAUGE_KEYS.map((key) => [key, { ...envelope.gauges[key], now: nows[key] }]),
    ),
    builtAt: new Date().toISOString(),
  };

  writeAtomic(PUBLIC_PATH, built);

  console.log(
    `gauges now: noRawIo ${nows.noRawIo}, noUpwardImport ${nows.noUpwardImport}, ` +
      `shellBan ${nows.shellBan}`,
  );
  console.log(
    `builtAt: ${built.builtAt}; ${envelope.stories.length} stories, ` +
      `${envelope.subtasks.length} subtasks -> public/build-board.json ` +
      `(src/build-board/kanban.json untouched)`,
  );
}

try {
  main();
} catch (err) {
  console.error(`publish-kanban: ${err.message}`);
  process.exit(1);
}
