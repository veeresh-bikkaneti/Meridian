/**
 * Capitals pack validator — the authoring gates for `meridian.pack.case.v1`
 * records (DESIGN.md section 1.1), built from the repo's existing gates.
 * Nothing here re-implements a check the repo already owns:
 *
 * - Clue ladder, leak ban, reading level, verbatim quotes: the production
 *   clue validator (`scripts/clues/validate-clues.mjs`), run on a
 *   `meridian.loop.clues.v1` view of the pack record against the case's
 *   authoring input (place, curated aliases, Wikipedia extracts).
 * - Hyderabad gate: `validateGeneratedPlace` from
 *   `src/game/validate-places.ts`, fed the same boxes
 *   `scripts/check-generated-places.mjs` uses — the per-country box from
 *   `src/game/data/geonames/country-boxes.json` (with its antimeridian
 *   normalisation) for country capitals, the STATES bounds plus 0.15
 *   degrees for US state capitals.
 * - Dataset identity: the record's target must match the shipped chunk
 *   record for the same GeoNames id exactly (name, latitude, longitude).
 *
 * Pack-specific checks (DESIGN.md sections 2.1 and 4):
 * - Direction B2's second secret: the subject's name and aliases are
 *   banned from rungs 1-4 (the rung-4 country confirmation is the game's
 *   job; rung 5 may state the pairing). The subject's demonym is not a
 *   term — DESIGN section 9's own Paris ladder uses "French" at rung 3.
 * - The reveal blurb's last sentence states the pairing plainly (rule 7):
 *   it names the capital and the subject.
 * - Capital versus capitol (rule 8): if any clue or the blurb mentions
 *   the capitol building, the blurb must carry the distinction sentence
 *   ("the building is the capitol", "the city is the capital").
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

import { validateRecord, buildLeakTerms, findLeaks } from "../clues/validate-clues.mjs";
import { foldText } from "../clues/schema.mjs";
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

  // -- pack shape (DESIGN.md section 1.1) --------------------------------
  if (record.schema !== "meridian.pack.case.v1") bad(`schema must be "meridian.pack.case.v1", got ${JSON.stringify(record.schema)}`);
  if (record.packId !== "capitals" || record.category !== "capitals") bad("packId and category must be \"capitals\"");
  if (record.caseId !== input.caseId) bad(`caseId ${JSON.stringify(record.caseId)} != input ${JSON.stringify(input.caseId)}`);
  if (record.packTier !== input.packTier) bad(`packTier ${JSON.stringify(record.packTier)} != curated tier ${input.packTier}`);
  if (record.pointPolicy !== "geonames-point") bad(`pointPolicy must be "geonames-point", got ${JSON.stringify(record.pointPolicy)}`);
  if (record.direction !== "A") bad(`direction must be "A" (the primary form), got ${JSON.stringify(record.direction)}`);
  if (
    !Array.isArray(record.directions) ||
    !["A", "B1", "B2"].every((d) => record.directions.includes(d))
  )
    bad("directions must list the supported GeoDetective forms A, B1, B2");
  const t = record.target ?? {};
  if (t.placeId !== input.place.place_id) bad(`target.placeId ${JSON.stringify(t.placeId)} != ${input.place.place_id}`);
  if (t.name !== input.place.name) bad(`target.name ${JSON.stringify(t.name)} != input name ${JSON.stringify(input.place.name)}`);
  if (t.lat !== input.place.lat || t.lon !== input.place.lon)
    bad(`target coords ${t.lat},${t.lon} != GeoNames row ${input.place.lat},${input.place.lon}`);
  const wantFeature = input.subject.kind === "country" ? "PPLC" : "PPLA";
  if (t.featureCode !== wantFeature) bad(`target.featureCode must be "${wantFeature}", got ${JSON.stringify(t.featureCode)}`);
  if (!Array.isArray(t.aliases) || !t.aliases.every((a) => typeof a === "string"))
    bad("target.aliases must be an array of strings");
  const s = record.subject ?? {};
  if (s.kind !== input.subject.kind || s.name !== input.subject.name || s.iso2 !== input.subject.iso2)
    bad("subject must match the input subject (kind, name, iso2)");
  const sa = record.subjectAnswer ?? {};
  if (sa.name !== input.subject.name) bad("subjectAnswer.name must be the subject name");
  if (!Array.isArray(sa.aliases) || !sa.aliases.every((a) => typeof a === "string"))
    bad("subjectAnswer.aliases must be an array of strings");
  const prompt = record.prompt ?? {};
  if (prompt.givenName !== input.subject.name || prompt.givenKind !== input.subject.kind)
    bad("prompt must give the subject (givenName = subject name, givenKind = subject kind) for Direction A");
  const src = record.source ?? {};
  if (src.label !== "Wikipedia" || src.href !== input.extracts[0]?.url)
    bad("record source must be {label: \"Wikipedia\", href: the case article URL}");

  // -- the repo clue validator, on a clues.v1 view ------------------------
  const view = {
    schema: "meridian.loop.clues.v1",
    status: "accepted",
    place_id: input.place.place_id,
    answer: {
      name: input.place.name,
      aliases: Array.isArray(t.aliases) ? t.aliases : [],
      country: input.place.country,
      subdivision: input.place.subdivision,
      lat: input.place.lat,
      lon: input.place.lon,
      difficulty: input.chunk.difficulty,
    },
    clues: record.clues,
  };
  const v1 = validateRecord(view, {
    input: {
      place: input.place,
      curated_aliases: input.curated_aliases ?? [],
      extracts: input.extracts ?? [],
    },
  });
  for (const r of v1.reasons) bad(`clues: ${r.code}${r.tier ? ` (tier ${r.tier})` : ""}: ${r.detail}`);

  // -- B2 second secret: subject terms banned from rungs 1-4 --------------
  if (Array.isArray(record.clues)) {
    const subjectTerms = buildLeakTerms({ name: sa.name, aliases: sa.aliases ?? [] });
    record.clues.slice(0, 4).forEach((clue, i) => {
      if (!clue || typeof clue.text !== "string") return;
      for (const hit of findLeaks(clue.text, subjectTerms)) {
        bad(`subject leak at rung ${i + 1}: "${hit.term}" (${hit.source}) — the subject stays secret until the rung-4 confirmation`);
      }
    });
  }

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
    if (!Number.isInteger(chunk.difficulty)) bad("chunk difficulty missing (needed for the clues.v1 view)");
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
