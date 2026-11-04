/**
 * Capitals pack validator — the authoring gates for `meridian.pack.case.v1`
 * records (docs/story-packs.md section 1.1).
 *
 * What this file actually does, honestly split in two:
 *
 * - Shared record checks are NOT re-implemented here. This file calls
 *   `validatePackRecord` from `scripts/packs/schema.mjs`, which owns the
 *   pack shape, the feature-code gate, the direction/prompt invariants,
 *   the input cross-check, and — through the production clue validator
 *   (`scripts/clues/validate-clues.mjs`) — the clue ladder, the target
 *   leak ban, reading level, and verbatim quote tracing.
 * - The capitals-specific layer below is this file's own: the pack's
 *   identity (packId/category "capitals", the case's curated tier and
 *   source article), the v1 direction truth, dataset identity against
 *   the shipped chunks, the Hyderabad gate through the real wiring
 *   (`validateGeneratedPlace` from `src/game/validate-places.ts`, fed
 *   the same boxes `scripts/check-generated-places.mjs` uses), and the
 *   reveal blurb rules (plain pairing, capital versus capitol).
 *
 * Directions in v1: v1 ships Direction A only. Every record's
 * `direction` is "A" and its `directions` list is ["A"]; B1/B2
 * reverse-direction play is a follow-up, not shipped behaviour.
 *
 * The B2 subject rule — one rule, stated with the same words in
 * schema.mjs, and implemented there (this file reaches it only through
 * validatePackRecord): Direction B2 (neither name given): the subject
 * is a second secret. Its name and aliases are banned from every clue
 * except rung 4 (clue index 3, the hook rung), where the country is
 * confirmed by design (design §2.1). The target stays banned
 * from all five clues, and the giveaway (index 4) bans the subject
 * again.
 *
 * Run like the gate it mirrors (check-generated-places.mjs is invoked
 * the same way from prebuild):
 *   node --experimental-strip-types scripts/packs/validate-pack.mjs --all
 *   node --experimental-strip-types scripts/packs/validate-pack.mjs paris-france austin-texas
 * Exit 0 when every named case passes, 1 otherwise.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { foldText } from "../clues/schema.mjs";
import { validatePackRecord } from "./schema.mjs";
import { validateGeneratedPlace } from "../../src/game/validate-places.ts";
import { STATES } from "../../src/game/regions.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
export const PACK_DIR = join(HERE, "capitals");
const CASES_DIR = join(PACK_DIR, "cases");
const INPUTS_DIR = join(PACK_DIR, "inputs");
const STATE_BOX_MARGIN_DEG = 0.15; // same derivation as check-generated-places.mjs

let caches = null;
function loadCaches() {
  if (caches) return caches;
  const chunksDir = join(REPO, "src", "game", "data", "geonames", "chunks");
  const chunkById = new Map();
  for (const f of readdirSync(chunksDir).filter((x) => x.endsWith(".json"))) {
    const chunk = JSON.parse(readFileSync(join(chunksDir, f), "utf8"));
    for (const p of chunk.places) chunkById.set(p.id, p);
  }
  const { boxes } = JSON.parse(
    readFileSync(join(REPO, "src", "game", "data", "geonames", "country-boxes.json"), "utf8"),
  );
  const stateBoxes = new Map(
    STATES.map((s) => [
      s.id,
      {
        minLon: s.bounds[0] - STATE_BOX_MARGIN_DEG,
        minLat: s.bounds[1] - STATE_BOX_MARGIN_DEG,
        maxLon: s.bounds[2] + STATE_BOX_MARGIN_DEG,
        maxLat: s.bounds[3] + STATE_BOX_MARGIN_DEG,
      },
    ]),
  );
  caches = { chunkById, boxes, stateBoxes };
  return caches;
}

/** Into the box's frame for antimeridian-wrapped countries (check-generated-places.mjs). */
function normalizeLon(lon, entry) {
  return entry.wrapped && lon < 0 ? lon + 360 : lon;
}

function sentencesOf(text) {
  return String(text)
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Validate one pack case record against its authoring input.
 * @returns {{ok: boolean, reasons: string[]}}
 */
export function validatePackCase(record, input) {
  const reasons = [];
  const bad = (m) => reasons.push(m);
  const { chunkById, boxes, stateBoxes } = loadCaches();

  if (!record || typeof record !== "object") return { ok: false, reasons: ["record is not an object"] };
  if (!input || typeof input !== "object") return { ok: false, reasons: ["input is not an object"] };

  // -- shared record checks, owned by schema.mjs ---------------------------
  // Pack shape, feature-code gate, direction/prompt invariants, input
  // cross-check, the clue ladder and both leak bans (target, and the
  // B2 subject rule stated in the header) all live in
  // validatePackRecord; this file adds only the capitals layer below.
  const shared = validatePackRecord(record, { input });
  for (const r of shared.reasons)
    bad(`shared: ${r.code}${r.tier ? ` (tier ${r.tier})` : ""}: ${r.detail}`);

  // -- capitals identity: this pack, this curated set ----------------------
  if (record.packId !== "capitals" || record.category !== "capitals") bad("packId and category must be \"capitals\"");
  if (record.caseId !== input.caseId) bad(`caseId ${JSON.stringify(record.caseId)} != input ${JSON.stringify(input.caseId)}`);
  if (record.packTier !== input.packTier) bad(`packTier ${JSON.stringify(record.packTier)} != curated tier ${input.packTier}`);
  if (record.direction !== "A") bad(`direction must be "A" (v1 ships Direction A only), got ${JSON.stringify(record.direction)}`);
  if (
    !Array.isArray(record.directions) ||
    record.directions.length !== 1 ||
    record.directions[0] !== "A"
  )
    bad("directions must be [\"A\"] — v1 ships Direction A only; B1/B2 reverse-direction play is a follow-up");
  const t = record.target ?? {};
  const s = record.subject ?? {};
  if (s.kind !== input.subject.kind || s.name !== input.subject.name || s.iso2 !== input.subject.iso2)
    bad("subject must match the input subject (kind, name, iso2)");
  const sa = record.subjectAnswer ?? {};
  if (sa.name !== input.subject.name) bad("subjectAnswer.name must be the subject name");
  const src = record.source ?? {};
  if (src.label !== "Wikipedia" || src.href !== input.extracts[0]?.url)
    bad("record source must be {label: \"Wikipedia\", href: the case article URL}");

  // -- reveal: plain pairing at the end, capital/capitol rule -------------
  const blurb = record.reveal?.blurb;
  if (typeof blurb !== "string" || blurb.trim().length === 0) {
    bad("reveal.blurb must be a non-empty string");
  } else {
    const sentences = sentencesOf(blurb);
    if (sentences.length < 2 || sentences.length > 4)
      bad(`reveal.blurb must be 2-4 sentences, got ${sentences.length}`);
    const last = sentences[sentences.length - 1] ?? "";
    if (!foldText(last).includes(foldText(input.place.name)) || !foldText(last).includes(foldText(input.subject.name)))
      bad("reveal.blurb must end by stating the pairing plainly (last sentence names the capital and the subject)");
    const allText = [
      ...(Array.isArray(record.clues) ? record.clues.map((c) => c?.text ?? "") : []),
      blurb,
    ].join(" ");
    if (/\bcapitol\b/i.test(allText)) {
      if (!/building is the capitol/i.test(blurb) || !/city is the capital/i.test(blurb))
        bad("the case mentions the capitol building, so the reveal must teach the difference (\"the building is the capitol\" / \"the city is the capital\")");
    }
  }

  // -- dataset identity: exact match against the shipped chunk ------------
  const chunk = chunkById.get(input.place.place_id);
  if (!chunk) {
    bad(`no shipped chunk record for ${input.place.place_id}`);
  } else {
    if (chunk.name !== t.name || chunk.lat !== t.lat || chunk.lon !== t.lon)
      bad(`target does not match the shipped chunk record (${chunk.name} ${chunk.lat},${chunk.lon})`);
    if (!Number.isInteger(chunk.difficulty)) bad("chunk difficulty missing (needed by the shared validator)");
  }

  // -- Hyderabad gate, through the real wiring ----------------------------
  if (chunk) {
    let entry;
    let declared;
    if (input.subject.kind === "state") {
      const box = stateBoxes.get(chunk.regionId);
      if (!box) bad(`no state box for regionId "${chunk.regionId}"`);
      else {
        entry = { box, wrapped: false };
        declared = `US state ${chunk.regionId}`;
      }
    } else {
      const e = boxes[input.subject.iso2];
      if (!e) bad(`no country box for iso2 "${input.subject.iso2}"`);
      else {
        entry = e;
        declared = input.subject.iso2;
      }
    }
    if (entry) {
      const violations = validateGeneratedPlace({
        id: t.placeId,
        name: t.name,
        lon: normalizeLon(t.lon, entry),
        lat: t.lat,
        declaredCountry: declared,
        countryBox: entry.box,
      });
      for (const v of violations) bad(`Hyderabad gate: ${v}`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function listInputIds() {
  return readdirSync(INPUTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

export function loadCase(caseId) {
  const input = JSON.parse(readFileSync(join(INPUTS_DIR, `${caseId}.json`), "utf8"));
  const casePath = join(CASES_DIR, `${caseId}.json`);
  const record = existsSync(casePath) ? JSON.parse(readFileSync(casePath, "utf8")) : null;
  return { input, record };
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const ids = argv.includes("--all") || args.length === 0 ? listInputIds() : args;
  let failed = 0;
  for (const id of ids) {
    const { input, record } = loadCase(id);
    if (!record) {
      console.log(`MISSING ${id}: no case file at scripts/packs/capitals/cases/${id}.json`);
      failed += 1;
      continue;
    }
    const result = validatePackCase(record, input);
    if (result.ok) {
      console.log(`PASS ${id}`);
    } else {
      failed += 1;
      console.log(`FAIL ${id}`);
      for (const r of result.reasons) console.log(`  - ${r}`);
    }
  }
  console.log(`cases checked: ${ids.length}, failed: ${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
