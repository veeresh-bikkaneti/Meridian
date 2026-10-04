// compose-clues.mjs — GeoDetective clue pipeline support (Phase 2).
//
// Library + thin CLI. Plain .mjs, zero dependencies beyond node builtins
// and ./schema.mjs.
//
// Phase 2 alignment note: Phase 1's assembleClueSet()/runComposer()
// targeted the provisional Phase 1 schema and the pre-adoption prompt
// gate; both were superseded when generation prompt v1 was adopted
// verbatim (scripts/clues/generation-prompt.md, locked by Veeresh
// 2026-10-04). What survives, unchanged in behavior:
//   - loadGenerationPrompt() — the prompt socket reader. The shipped
//     socket now holds the adopted prompt, so `adopted` is true; the
//     ADOPTION PENDING marker remains the (fixture-tested) refusal
//     signal for placeholder files.
//   - loadCacheExtract() — crawl-cache extract lookup (latest JSONL
//     line wins; only `matched` + non-empty extract is usable).
// What is new:
//   - assemblePublishedFile() — prompt §10 assembly: strip the answer
//     identity from a validated accepted record into the game-side
//     LoopClueFile shape {v, placeId, target, clues[5], source}.
//   - buildManifest() — the public/loop/manifest.json shape.
// Generation itself lives with the worker tranches + the production
// runner (scripts/clues/production/); this module never invents clue
// text and never calls an LLM.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PLACEHOLDER_MARKER = "ADOPTION PENDING";

export const DEFAULT_PROMPT_PATH = fileURLToPath(
  new URL("./generation-prompt.md", import.meta.url),
);

// ---------------------------------------------------------------------------
// Generation prompt socket
// ---------------------------------------------------------------------------

/**
 * Load the generation prompt socket.
 *
 * @param {string} [promptPath] defaults to this module's sibling
 *   generation-prompt.md (i.e. scripts/clues/generation-prompt.md).
 * @returns {{ adopted: boolean, text: string, detail?: string }}
 *   adopted is false iff the file contains the placeholder marker
 *   "ADOPTION PENDING", or the file cannot be read (missing → adopted:false
 *   with detail).
 */
export function loadGenerationPrompt(promptPath = DEFAULT_PROMPT_PATH) {
  let text;
  try {
    text = readFileSync(promptPath, "utf8");
  } catch (err) {
    return {
      adopted: false,
      text: "",
      detail: `generation prompt not readable at ${promptPath}: ${err.code ?? err.message}`,
    };
  }
  return { adopted: !text.includes(PLACEHOLDER_MARKER), text };
}

// ---------------------------------------------------------------------------
// Crawl-cache extract lookup
// ---------------------------------------------------------------------------

function normalizeGeonamesId(value) {
  const raw = String(value ?? "").trim();
  return raw.replace(/^gn-/i, "").replace(/^geonames:/i, "");
}

function isIdLike(value) {
  return typeof value === "number" || /^\d+$/.test(String(value ?? "").trim());
}

function isPathLike(value) {
  return typeof value === "string" && (value.includes("/") || value.endsWith(".jsonl"));
}

/**
 * Load the usable Wikipedia extract for a place from the crawl cache.
 *
 * The cache is JSONL, append-only: a place may appear on multiple lines.
 * The LATEST line for `gn-<geonamesId>` wins.
 *
 * Signature: loadCacheExtract(cachePath, geonamesId). The argument order
 * is also tolerated reversed (id first, path second), detected by shape.
 *
 * @returns
 *   { ok: true, record: { id, title, extract } } |
 *   { ok: false, code: "EXTRACT_NOT_FOUND", detail } |
 *   { ok: false, code: "EXTRACT_STATUS", detail: <latest status> } |
 *   { ok: false, code: "EXTRACT_EMPTY", detail }
 */
export function loadCacheExtract(cachePath, geonamesId) {
  if (isIdLike(cachePath) && isPathLike(geonamesId)) {
    [cachePath, geonamesId] = [geonamesId, cachePath];
  }

  const wantedId = `gn-${normalizeGeonamesId(geonamesId)}`;

  let raw;
  try {
    raw = readFileSync(cachePath, "utf8");
  } catch (err) {
    return {
      ok: false,
      code: "EXTRACT_NOT_FOUND",
      detail: `cache not readable at ${cachePath}: ${err.code ?? err.message}`,
    };
  }

  let latest = null;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue; // skip malformed lines; the cache is append-only evidence
    }
    if (record && record.id === wantedId) latest = record; // latest wins
  }

  if (!latest) {
    return {
      ok: false,
      code: "EXTRACT_NOT_FOUND",
      detail: `no cache record for ${wantedId}`,
    };
  }
  if (latest.status !== "matched") {
    return { ok: false, code: "EXTRACT_STATUS", detail: String(latest.status ?? "") };
  }
  if (typeof latest.extract !== "string" || latest.extract.trim() === "") {
    return {
      ok: false,
      code: "EXTRACT_EMPTY",
      detail: `cache record ${wantedId} is matched but has no extract text`,
    };
  }
  return {
    ok: true,
    record: { id: latest.id, title: latest.title ?? null, extract: latest.extract },
  };
}

// ---------------------------------------------------------------------------
// Assembly (prompt §10): validated record -> published game file
// ---------------------------------------------------------------------------

/**
 * Strip a validated accepted record into the published LoopClueFile:
 *   { v: 1, placeId: "geonames:<id>", target: { lon, lat },
 *     clues: [5 clue texts in ladder order],
 *     source: { label: "Wikipedia", href: <tier-1 source url> } }
 * The answer name, aliases, and region tags never reach the published
 * file (prompt §10 assembly rule). Throws TypeError on structural
 * problems — assembly runs only on validator-passed records, so a
 * throw here is a pipeline bug, not a content rejection.
 */
export function assemblePublishedFile(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new TypeError("assemblePublishedFile: record must be an object");
  }
  if (record.status !== "accepted") {
    throw new TypeError("assemblePublishedFile: record.status must be \"accepted\"");
  }
  if (typeof record.place_id !== "string" || !record.place_id) {
    throw new TypeError("assemblePublishedFile: record.place_id must be a non-empty string");
  }
  const numericId = record.place_id.replace(/^gn-/i, "").replace(/^geonames:/i, "");
  if (!/^\d+$/.test(numericId)) {
    throw new TypeError(`assemblePublishedFile: cannot derive a GeoNames id from ${JSON.stringify(record.place_id)}`);
  }
  const answer = record.answer;
  if (!answer || !Number.isFinite(answer.lon) || !Number.isFinite(answer.lat)) {
    throw new TypeError("assemblePublishedFile: record.answer must carry finite lon/lat");
  }
  if (!Array.isArray(record.clues) || record.clues.length !== 5) {
    throw new TypeError("assemblePublishedFile: record.clues must contain exactly 5 entries");
  }
  const clues = record.clues.map((clue, i) => {
    if (!clue || typeof clue.text !== "string" || !clue.text) {
      throw new TypeError(`assemblePublishedFile: clues[${i}].text must be a non-empty string`);
    }
    return clue.text;
  });
  const href = record.clues[0]?.source?.url;
  if (typeof href !== "string" || !href) {
    throw new TypeError("assemblePublishedFile: clues[0].source.url must be a non-empty string");
  }
  // Fixed key order matching the LoopClueFile seed files.
  return {
    v: 1,
    placeId: `geonames:${numericId}`,
    target: { lon: answer.lon, lat: answer.lat },
    clues,
    source: { label: "Wikipedia", href },
  };
}

/** The public/loop/manifest.json shape: { v: 1, size, generatedAt }. */
export function buildManifest(size, generatedAt = new Date()) {
  if (!Number.isInteger(size) || size < 0) {
    throw new TypeError("buildManifest: size must be a non-negative integer");
  }
  const when = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  return { v: 1, size, generatedAt: when.toISOString() };
}

// ---------------------------------------------------------------------------
// Thin CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const [command, cachePath, geonamesId] = argv;
  if (command === "extract" && cachePath && geonamesId) {
    const result = loadCacheExtract(cachePath, geonamesId);
    if (!result.ok) {
      console.log(JSON.stringify({ ok: false, code: result.code, detail: result.detail }));
      return 0; // a missing/unusable extract is data, not a CLI failure
    }
    console.log(
      JSON.stringify({
        ok: true,
        id: result.record.id,
        title: result.record.title,
        extractLength: result.record.extract.length,
      }),
    );
    return 0;
  }
  console.error("usage: node scripts/clues/compose-clues.mjs extract <cachePath> <geonamesId>");
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
