// compose-clues.mjs — GeoDetective clue-set composer (Phase 1).
//
// Library + thin CLI. Plain .mjs, zero dependencies beyond node builtins
// and the two sibling Workstream A modules:
//   - ./schema.mjs          (TIERS / LIMITS / DIFFICULTIES / normalizeName)
//   - ./validate-clues.mjs  (validateClueSet — imported, never reimplemented)
//
// This composer NEVER invents clue text:
//   - assembleClueSet() is pure, deterministic assembly of caller-supplied
//     clue drafts ({ text, snippet } pairs) into the production schema.
//   - runComposer() fails closed: a usable source extract must exist in the
//     crawl cache, and if generation would be required (no drafts supplied)
//     it refuses — PROMPT_NOT_ADOPTED while the generation prompt at
//     scripts/clues/generation-prompt.md is still a placeholder, and
//     GENERATION_NOT_IMPLEMENTED even after adoption (generation is a later
//     phase; this module never calls an LLM and never writes clue text).
//
// Production clue-set schema (game fields + production fields):
//   { v: 1, placeId, target: { lon, lat }, clues: [5 strings],
//     source: { label: "Wikipedia", href },
//     clueSources: [{ snippet, extractId } x5] (index-aligned with clues;
//     snippet is a verbatim span of the source extract),
//     difficulty: "easy" | "medium" | "hard", aliases: string[] }

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { TIERS, LIMITS, DIFFICULTIES, normalizeName } from "./schema.mjs";
import { validateClueSet } from "./validate-clues.mjs";

// Re-exported so callers / tests can see the exact schema vocabulary this
// composer was built against, without importing schema.mjs themselves.
export { TIERS, LIMITS, DIFFICULTIES, normalizeName, validateClueSet };

export const PLACEHOLDER_MARKER = "ADOPTION PENDING";

export const DEFAULT_PROMPT_PATH = fileURLToPath(
  new URL("./generation-prompt.md", import.meta.url),
);

// Number of positional tiers. Derived from the schema's TIERS when it is a
// list (or a keyed object), falling back to the contracted 5.
const EXPECTED_CLUE_COUNT = (() => {
  if (Array.isArray(TIERS) && TIERS.length > 0) return TIERS.length;
  if (TIERS && typeof TIERS === "object" && Object.keys(TIERS).length > 0) {
    return Object.keys(TIERS).length;
  }
  return 5;
})();

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
 * Signature per spec: loadCacheExtract(cachePath, geonamesId). The argument
 * order is also tolerated reversed (id first, path second), detected by
 * shape, so call sites written either way behave identically.
 *
 * @returns
 *   { ok: true, record: { id, title, extract } } |
 *   { ok: false, code: "EXTRACT_NOT_FOUND", detail } |
 *   { ok: false, code: "EXTRACT_STATUS", detail: <latest status> } |
 *   { ok: false, code: "EXTRACT_EMPTY", detail }
 */
export function loadCacheExtract(cachePath, geonamesId) {
  // Tolerate the reversed (geonamesId, cachePath) call shape.
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
// Pure deterministic assembly (creates NO clue text)
// ---------------------------------------------------------------------------

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`assembleClueSet: ${field} must be a non-empty string`);
  }
  return value;
}

/**
 * Assemble caller-supplied clue drafts into a production-schema clue set.
 *
 * Pure and deterministic: the output's key order is fixed by construction,
 * and two calls with equal input produce deep-equal output.
 *
 * Throws TypeError on structurally invalid input (programmer error). That is
 * deliberately distinct from validation rejections: content-level problems
 * (missing/invalid difficulty, missing aliases, untraceable snippets, name
 * leaks, …) are NOT thrown here — the assembled set is passed to
 * validateClueSet(), which reports them as reason codes. Accordingly,
 * `difficulty` and `aliases` are passed through as supplied (including
 * omitted) so the validator can exercise its DIFFICULTY_MISSING /
 * ALIASES_MISSING rejections; only their *types*, when present, are checked.
 *
 * @param {{ placeId: string, target: { lon: number, lat: number },
 *   sourceHref: string, extractId: string,
 *   clues: [{ text: string, snippet: string }],
 *   difficulty?: string, aliases?: string[] }} input
 */
export function assembleClueSet(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("assembleClueSet: input must be an object");
  }

  const placeId = requireNonEmptyString(input.placeId, "placeId");
  const sourceHref = requireNonEmptyString(input.sourceHref, "sourceHref");
  const extractId = requireNonEmptyString(input.extractId, "extractId");

  const target = input.target;
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new TypeError("assembleClueSet: target must be an object { lon, lat }");
  }
  if (!Number.isFinite(target.lon) || !Number.isFinite(target.lat)) {
    throw new TypeError("assembleClueSet: target.lon and target.lat must be finite numbers");
  }

  if (!Array.isArray(input.clues) || input.clues.length !== EXPECTED_CLUE_COUNT) {
    throw new TypeError(
      `assembleClueSet: clues must be an array of exactly ${EXPECTED_CLUE_COUNT} { text, snippet } entries`,
    );
  }
  const clues = [];
  const clueSources = [];
  input.clues.forEach((clue, i) => {
    if (!clue || typeof clue !== "object" || Array.isArray(clue)) {
      throw new TypeError(`assembleClueSet: clues[${i}] must be an object { text, snippet }`);
    }
    if (typeof clue.text !== "string" || typeof clue.snippet !== "string") {
      throw new TypeError(`assembleClueSet: clues[${i}].text and .snippet must be strings`);
    }
    clues.push(clue.text);
    clueSources.push({ snippet: clue.snippet, extractId });
  });

  if (input.difficulty !== undefined && typeof input.difficulty !== "string") {
    throw new TypeError("assembleClueSet: difficulty, when present, must be a string");
  }
  if (input.aliases !== undefined && !Array.isArray(input.aliases)) {
    throw new TypeError("assembleClueSet: aliases, when present, must be an array");
  }
  if (Array.isArray(input.aliases)) {
    input.aliases.forEach((alias, i) => {
      if (typeof alias !== "string") {
        throw new TypeError(`assembleClueSet: aliases[${i}] must be a string`);
      }
    });
  }

  // Fixed key order (construction order) — part of the determinism contract.
  return {
    v: 1,
    placeId,
    target: { lon: target.lon, lat: target.lat },
    clues,
    source: { label: "Wikipedia", href: sourceHref },
    clueSources,
    difficulty: input.difficulty,
    aliases: input.aliases === undefined ? undefined : [...input.aliases],
  };
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

/**
 * Run the composer pipeline for one place.
 *
 * @param {object} input
 * @param {number|string} input.geonamesId  place id in the crawl cache.
 * @param {string} [input.placeName]        canonical place name (validator ctx).
 * @param {string} [input.placeId]          defaults to `geonames:<geonamesId>`.
 * @param {{ lon: number, lat: number }} [input.target]
 * @param {string} [input.sourceHref]       source URL (or input.source.href /
 *   input.wikipedia as fallbacks).
 * @param {Array<{ text: string, snippet: string }> | null} [input.clues]
 *   Caller-supplied drafts. Absent/null means generation would be required.
 * @param {string} [input.difficulty]
 * @param {string[]} [input.aliases]
 * @param {string[]} [input.bannedTerms]
 * @param {{ cachePath: string, promptPath?: string }} options
 * @returns
 *   { ok: false, stage: "extract", code, detail } |
 *   { ok: false, stage: "generation", code: "PROMPT_NOT_ADOPTED" |
 *       "GENERATION_NOT_IMPLEMENTED", detail } |
 *   { ok, stage: "validate", set, reasons }
 */
export function runComposer(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("runComposer: input must be an object");
  }
  const { cachePath, promptPath = DEFAULT_PROMPT_PATH } = options ?? {};
  if (typeof cachePath !== "string" || cachePath === "") {
    throw new TypeError("runComposer: options.cachePath must be a non-empty string");
  }
  if (input.geonamesId === undefined || input.geonamesId === null || input.geonamesId === "") {
    throw new TypeError("runComposer: input.geonamesId is required");
  }

  // Stage 1 — source extract (fail closed).
  const extracted = loadCacheExtract(cachePath, input.geonamesId);
  if (!extracted.ok) {
    return { ok: false, stage: "extract", code: extracted.code, detail: extracted.detail };
  }
  const { record } = extracted;

  // Stage 2 — generation gate. This composer never invents text.
  if (input.clues === undefined || input.clues === null) {
    const prompt = loadGenerationPrompt(promptPath);
    if (!prompt.adopted) {
      return {
        ok: false,
        stage: "generation",
        code: "PROMPT_NOT_ADOPTED",
        detail: prompt.detail ?? "generation prompt is still a placeholder (ADOPTION PENDING)",
      };
    }
    return {
      ok: false,
      stage: "generation",
      code: "GENERATION_NOT_IMPLEMENTED",
      detail: "generation is a later phase; this composer never invents clue text",
    };
  }

  // Stage 3 — assemble caller-supplied drafts, then validate (imported
  // validator; its rejections are data, returned not thrown).
  const set = assembleClueSet({
    placeId: input.placeId ?? `geonames:${normalizeGeonamesId(input.geonamesId)}`,
    target: input.target,
    sourceHref: input.sourceHref ?? input.source?.href ?? input.wikipedia,
    extractId: record.id,
    clues: input.clues,
    difficulty: input.difficulty,
    aliases: input.aliases,
  });

  const { ok, reasons } = validateClueSet(set, {
    placeName: input.placeName,
    aliases: input.aliases,
    bannedTerms: input.bannedTerms,
    extractText: record.extract,
  });

  return { ok, stage: "validate", set, reasons };
}

// ---------------------------------------------------------------------------
// Thin CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const [command, cachePath, geonamesId] = argv;
  if (command === "extract" && cachePath && geonamesId) {
    const result = loadCacheExtract(cachePath, geonamesId);
    if (!result.ok) {
      // Outcome only — never the extract text.
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
