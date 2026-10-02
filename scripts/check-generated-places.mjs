#!/usr/bin/env node
/**
 * check-generated-places.mjs — GeoNames 100k+ import gate (Hyderabad rule).
 *
 * Re-validates 100% of shipped chunk places
 * (`src/game/data/geonames/chunks/<regionId>.json`, 64 chunks) on every
 * build. Any violation fails the build loudly (non-zero exit) — never
 * silently.
 *
 * Wired as `prebuild` / `prebuild:pages` in package.json, so `npm run build`
 * and `npm run build:pages` cannot ship a bad dataset.
 *
 * Per place:
 *  - id uniqueness across ALL chunks
 *  - edition ∈ {state, country, globe} and regionId match the chunk's meta
 *    and the manifest; manifest counts match real chunk contents
 *  - regionId membership in `src/game/regions.ts` (state → STATES ids,
 *    country → COUNTRIES ids, globe → "globe")
 *  - Hyderabad coordinate check through the REAL F7 gate
 *    (`validateGeneratedPlace`):
 *      - state places: US state box from regions.ts STATES bounds (+0.15°
 *        margin) — the same derivation the dataset pipeline used
 *      - country/globe places: the derived per-country box for the place's
 *        own iso2 (`src/game/data/geonames/country-boxes.json`)
 *
 * The reference boxes are the padded boxes derived from ALL GeoNames
 * populated-place rows — deliberately NOT the tight F6b boxes (those were
 * derived from a sparse dataset and falsely rejected 74 genuinely-correct
 * places: Easter Island, Bornholm, …). Antimeridian-wrapped countries
 * (RU, NZ, …) are stored in the 0–360 frame; longitudes are normalized into
 * that frame before validating, exactly like the pipeline.
 *
 * Node standard library only. No network.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGeneratedPlace } from "../src/game/validate-places.ts";
import { COUNTRIES, STATES } from "../src/game/regions.ts";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const CHUNKS_DIR = join(REPO, "src", "game", "data", "geonames", "chunks");
const VALID_EDITIONS = new Set(["state", "country", "globe"]);
// Same derivation as scripts/build-geonames-dataset.mjs loadStateBoxes:
// STATES bounds, generous by design (the gate catches "wrong state", not
// survey-grade imprecision).
const STATE_BOX_MARGIN_DEG = 0.15;

const STATE_IDS = new Set(STATES.map((s) => s.id));
const COUNTRY_IDS = new Set(COUNTRIES.map((c) => c.id));
const STATE_BOXES = new Map(
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

/** Into the box's frame for antimeridian-wrapped countries (cf. the pipeline's normalizeLon). */
function normalizeLon(lon, entry) {
  return entry.wrapped && lon < 0 ? lon + 360 : lon;
}

function main() {
  const manifest = JSON.parse(
    readFileSync(join(REPO, "src", "game", "data", "geonames", "manifest.json"), "utf8"),
  );
  const { boxes } = JSON.parse(
    readFileSync(join(REPO, "src", "game", "data", "geonames", "country-boxes.json"), "utf8"),
  );

  const violations = [];
  const seenIds = new Set();
  let checked = 0;

  const chunkFiles = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith(".json")).sort();
  const manifestIds = new Set(Object.keys(manifest.regions));

  for (const file of chunkFiles) {
    const regionId = file.slice(0, -".json".length);
    if (!manifestIds.has(regionId)) {
      violations.push(`chunk "${file}" has no manifest entry`);
      continue;
    }
    const expected = manifest.regions[regionId];
    const chunk = JSON.parse(readFileSync(join(CHUNKS_DIR, file), "utf8"));

    if (chunk.meta?.regionId !== regionId) {
      violations.push(`chunk "${file}": meta.regionId ${JSON.stringify(chunk.meta?.regionId)} !== "${regionId}"`);
    }
    if (chunk.meta?.edition !== expected.edition) {
      violations.push(
        `chunk "${file}": meta.edition ${JSON.stringify(chunk.meta?.edition)} !== manifest "${expected.edition}"`,
      );
    }
    if (!Array.isArray(chunk.places)) {
      violations.push(`chunk "${file}": places is not an array`);
      continue;
    }
    if (chunk.meta?.count !== chunk.places.length) {
      violations.push(
        `chunk "${file}": meta.count ${JSON.stringify(chunk.meta?.count)} !== places.length ${chunk.places.length} (manifest count ${expected.count})`,
      );
    }
    if (expected.count !== chunk.places.length) {
      violations.push(
        `chunk "${file}": manifest count ${expected.count} !== places.length ${chunk.places.length}`,
      );
    }

    for (const place of chunk.places) {
      const tag = `${place.id} (${file})`;
      if (seenIds.has(place.id)) {
        violations.push(`${tag}: duplicate id across chunks`);
      }
      seenIds.add(place.id);

      if (!VALID_EDITIONS.has(place.edition) || place.edition !== expected.edition) {
        violations.push(`${tag}: invalid edition ${JSON.stringify(place.edition)}`);
      }
      if (place.regionId !== regionId) {
        violations.push(`${tag}: regionId ${JSON.stringify(place.regionId)} !== chunk "${regionId}"`);
      }
      const regionOk =
        (place.edition === "state" && STATE_IDS.has(place.regionId)) ||
        (place.edition === "country" && COUNTRY_IDS.has(place.regionId)) ||
        (place.edition === "globe" && place.regionId === "globe");
      if (!regionOk) {
        violations.push(
          `${tag}: regionId "${place.regionId}" is not a regions.ts id for edition "${place.edition}"`,
        );
      }
      if (typeof place.iso2 !== "string" || place.iso2.length === 0) {
        violations.push(`${tag}: missing iso2 (gate key)`);
        continue;
      }

      // --- Hyderabad rule: coordinates must match the claimed location
      let entry;
      let declared;
      if (place.edition === "state") {
        const box = STATE_BOXES.get(place.regionId);
        if (!box) {
          violations.push(`${tag}: no state box for regionId "${place.regionId}"`);
          continue;
        }
        entry = { box, wrapped: false };
        declared = `US state ${place.regionId}`;
      } else {
        entry = boxes[place.iso2];
        if (!entry) {
          violations.push(`${tag}: no reference country box for iso2 "${place.iso2}"`);
          continue;
        }
        declared = place.iso2;
      }
      const v = validateGeneratedPlace({
        id: place.id,
        name: place.name,
        lon: normalizeLon(place.lon, entry),
        lat: place.lat,
        declaredCountry: declared,
        countryBox: entry.box,
      });
      if (v.length > 0) violations.push(...v.map((m) => `${file}: ${m}`));

      // Difficulty tier: optional on legacy records, but any present value
      // must be an integer 1–5 — fail closed on anything else. Stamped at
      // build time by scripts/build-geonames-dataset.mjs (tierFor).
      if (place.difficulty !== undefined) {
        const d = place.difficulty;
        if (!Number.isInteger(d) || d < 1 || d > 5) {
          violations.push(
            `${tag}: invalid difficulty ${JSON.stringify(d)} — must be an integer 1–5`,
          );
        }
      }

      // Subdivision display name: optional on legacy records, but any
      // present value must be a non-empty string — fail closed on anything
      // else. Stamped at build time from the row's admin1 code
      // (admin1CodesASCII.txt); the label builder fails closed to the bare
      // place name when it is absent.
      if (place.subdivision !== undefined) {
        const s = place.subdivision;
        if (typeof s !== "string" || s.trim().length === 0) {
          violations.push(
            `${tag}: invalid subdivision ${JSON.stringify(s)} — must be a non-empty string`,
          );
        }
      }

      // History hook sentences: shape gate. Wikipedia-extract histories were
      // proved verbatim by the merge-time gate; curated notable notes
      // (src/game/data/notable-notes.json) are Veeresh-approved instead.
      // The length bound fits the longest curated note (512 chars) — it
      // guards against hand-edited corruption, not brevity. Keep in sync
      // with assertValidRecord in src/game/generated-places.ts.
      if (place.history !== undefined) {
        const h = place.history;
        const badShape =
          typeof h !== "string" || h.length < 20 || h.length > 600 || !/[.!?]$/.test(h.trim());
        const hasFiller = typeof h === "string" && (/°/.test(h) || /\belevation\b/i.test(h));
        if (badShape || hasFiller) {
          violations.push(`${tag}: invalid history hook sentence`);
        }
        if (typeof h === "string" && (typeof place.wiki !== "string" || place.wiki.length === 0)) {
          violations.push(`${tag}: history present without wiki attribution slug`);
        }
      }
      // Pairing invariant (both directions): a wiki attribution slug with no
      // history extract is an unpaired record — the slug must travel with
      // the extract it attributes. history-without-wiki is gated above.
      if (
        typeof place.wiki === "string" &&
        place.wiki.length > 0 &&
        (typeof place.history !== "string" || place.history.length === 0)
      ) {
        violations.push(`${tag}: wiki attribution slug present without history extract`);
      }
      // Merged facts (scripts/facts-ladder.mjs): shape gate for the optional
      // fact field. The merge-time no-fabrication proof lives in the ladder;
      // this keeps hand-edited or corrupted records out of the build.
      if (place.fact !== undefined) {
        const f = place.fact;
        const kinds = new Set(["wikidata", "wikitext", "eb1911", "hook"]);
        const badShape =
          typeof f !== "object" || f === null ||
          typeof f.text !== "string" || f.text.length < 20 || f.text.length > 240 ||
          !/[.!?]$/.test(f.text.trim()) ||
          !kinds.has(f.kind) ||
          typeof f.source !== "string" || f.source.length === 0;
        const badQid = f?.kind === "wikidata" && !(typeof f.qid === "string" && /^Q\d+$/.test(f.qid));
        const badHref = f?.kind === "eb1911" && !(typeof f.href === "string" && f.href.startsWith("https://en.wikisource.org/"));
        const badWiki = (f?.kind === "wikitext" || f?.kind === "hook") &&
          !(typeof place.wiki === "string" && place.wiki.length > 0);
        if (badShape || badQid || badHref || badWiki) {
          violations.push(`${tag}: invalid fact field`);
        }
      }
      checked++;
    }
  }

  for (const regionId of manifestIds) {
    if (!chunkFiles.includes(`${regionId}.json`)) {
      violations.push(`manifest region "${regionId}" has no chunk file`);
    }
  }

  if (violations.length > 0) {
    console.error(
      `GEONAMES PLACE GATE FAILED: ${violations.length} violation(s) across ${checked} chunk places — build rejected.`,
    );
    for (const v of violations.slice(0, 50)) console.error(`  - ${v}`);
    if (violations.length > 50) console.error(`  … and ${violations.length - 50} more`);
    process.exit(1);
  }
  console.log(
    `GeoNames place gate OK: ${checked} places in ${chunkFiles.length} chunks validated ` +
      `(id uniqueness, edition/regionId membership, manifest counts, Hyderabad coordinates), 0 violations.`,
  );
}

main();
