#!/usr/bin/env node
/**
 * assign-place-editions.mjs — F6b ONE-TIME landing script.
 *
 * Enriches the approved F6a dataset (`data/generated-places.json` in the
 * meridian-place-dataset scratch dir) with the dealing-pool assignment every
 * generated place needs, and writes the two checked-in data files:
 *
 *   src/game/data/generated-places.json  — F6a records + `edition`/`regionId`
 *   src/game/data/country-boxes.json     — reference country boxes, keyed for the gate
 *
 * Assignment rules (approach C, curated-first hybrid):
 *  - `curated: true` refs are left untouched — starters.ts owns the curated pool.
 *  - US places (iso2 == "US")            → edition "state", regionId = state slug,
 *                                          via the NE ADM1NAME joined through
 *                                          provenance.json (authoritative; no
 *                                          point-in-box guessing at borders).
 *  - District of Columbia (not a state)   → edition "country", regionId "united-states".
 *  - Places in the 12 ISO-mapped country-edition → edition "country", regionId = country slug.
 *    countries (CA/MX/BR/GB/FR/DE/IT/EG/IN/CN/JP/AU) — the 13th
 *    country-edition country, the US, is handled by the state/DC rules above.
 *  - Everything else                       → edition "globe", regionId "globe".
 *
 * The script FAILS LOUDLY (non-zero exit) on any unassignable place, any place
 * without a reference country box, or any duplicate id — nothing is dropped
 * silently. It is idempotent: re-running reproduces the checked-in files
 * byte-for-byte (given the same scratch inputs).
 *
 * Inputs (scratch only, never committed):
 *   ../meridian-place-dataset/data/generated-places.json
 *   ../meridian-place-dataset/provenance.json
 *   ../meridian-place-dataset/ne_10m_populated_places.geojson
 *   ../meridian-place-dataset/country-boxes.json
 *
 * Node standard library only. No network.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const SCRATCH =
  process.env.MERIDIAN_PLACE_SCRATCH ?? join(HERE, "..", "..", "meridian-place-dataset");

/** Must match the region() ids in src/game/regions.ts STATES. */
const STATE_IDS = new Set(
  "alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada new-hampshire new-jersey new-mexico new-york north-carolina north-dakota ohio oklahoma oregon pennsylvania rhode-island south-carolina south-dakota tennessee texas utah vermont virginia washington west-virginia wisconsin wyoming".split(
    " ",
  ),
);

/** ISO-2 → country-edition regionId. Must match src/game/regions.ts COUNTRIES ids. */
const COUNTRY_ISO2 = {
  CA: "canada",
  MX: "mexico",
  BR: "brazil",
  GB: "united-kingdom",
  FR: "france",
  DE: "germany",
  IT: "italy",
  EG: "egypt",
  IN: "india",
  CN: "china",
  JP: "japan",
  AU: "australia",
};

const slug = (s) => s.toLowerCase().replaceAll(" ", "-");

function boxKeyFor(place) {
  return place.iso2 ?? `name:${place.country}`;
}

function main() {
  const dataset = JSON.parse(readFileSync(join(SCRATCH, "data", "generated-places.json"), "utf8"));
  const provenance = JSON.parse(readFileSync(join(SCRATCH, "provenance.json"), "utf8"));
  const raw = JSON.parse(readFileSync(join(SCRATCH, "ne_10m_populated_places.geojson"), "utf8"));
  const refBoxes = JSON.parse(readFileSync(join(SCRATCH, "country-boxes.json"), "utf8"));

  const counts = { state: 0, country: 0, globe: 0, curatedRefs: 0 };
  const perState = Object.create(null);
  const seen = new Set();
  const out = [];

  for (const place of dataset.places) {
    if (seen.has(place.id)) throw new Error(`duplicate id in F6a output: ${place.id}`);
    seen.add(place.id);

    if (place.curated) {
      counts.curatedRefs++;
      out.push({ ...place });
      continue;
    }

    // Every generated place must have a reference box for the repo gate.
    const key = boxKeyFor(place);
    if (!refBoxes.boxes[key]) {
      throw new Error(`${place.id}: no reference country box for key "${key}"`);
    }

    let edition;
    let regionId;
    if (place.iso2 === "US") {
      const fi = provenance[place.id];
      if (fi === undefined) throw new Error(`${place.id}: missing provenance entry`);
      const adm1 = raw.features[fi]?.properties?.ADM1NAME;
      if (!adm1) throw new Error(`${place.id}: missing ADM1NAME in raw feature ${fi}`);
      const s = slug(adm1);
      if (STATE_IDS.has(s)) {
        edition = "state";
        regionId = s;
        perState[s] = (perState[s] ?? 0) + 1;
      } else if (adm1 === "District of Columbia") {
        // Not a state — it joins the US country pool instead of being dropped.
        edition = "country";
        regionId = "united-states";
      } else {
        throw new Error(`${place.id}: unassignable US adm1 "${adm1}"`);
      }
    } else if (COUNTRY_ISO2[place.iso2]) {
      edition = "country";
      regionId = COUNTRY_ISO2[place.iso2];
    } else {
      edition = "globe";
      regionId = "globe";
    }
    counts[edition]++;
    out.push({ ...place, edition, regionId });
  }

  // Flatten the reference boxes to the gate's join key: iso2, or name:<country>
  // for disputed territories with no ISO code.
  const boxes = Object.create(null);
  for (const [k, entry] of Object.entries(refBoxes.boxes)) {
    const flatKey = entry.iso2 ?? `name:${entry.country}`;
    if (flatKey !== k) {
      throw new Error(`box key drift: map key "${k}" != entry key "${flatKey}"`);
    }
    boxes[flatKey] = {
      country: entry.country,
      iso2: entry.iso2,
      wrapped: entry.wrapped,
      box: entry.box,
    };
  }

  const dataDir = join(REPO, "src", "game", "data");
  mkdirSync(dataDir, { recursive: true });

  // Compact JSON (single line): this is machine-read data; the assignment is
  // audited via this script's rules + summary output, not by reading the file.
  // Keeps the checked-in payload inside the ~1 MB F6a budget.
  const compact = (v) => JSON.stringify(v) + "\n";
  writeFileSync(
    join(dataDir, "generated-places.json"),
    compact({
      meta: {
        ...dataset.meta,
        editionsAssigned: "2026-09-30",
        assignmentScript: "scripts/assign-place-editions.mjs",
        assignment:
          "US→state via NE ADM1NAME (DC→country/united-states); 13 country-edition countries→country; rest→globe/globe; curated refs untouched",
      },
      places: out,
    }),
  );
  writeFileSync(
    join(dataDir, "country-boxes.json"),
    compact({
      meta: {
        generated: refBoxes.generated,
        note: "Reference boxes from ALL Natural Earth features (audit trail). The F6b import gate (scripts/check-generated-places.mjs) validates every generated place against its box. Antimeridian-wrapped countries (RU, NZ, AQ) use the 0–360 frame; the gate normalizes longitudes into that frame before validating.",
      },
      boxes,
    }),
  );

  console.log(
    `assigned ${out.length - counts.curatedRefs} generated places (+ ${counts.curatedRefs} curated refs untouched)`,
  );
  console.log(
    `  state edition:   ${counts.state} places across ${Object.keys(perState).length} states`,
  );
  console.log(`  country edition: ${counts.country} places`);
  console.log(`  globe edition:   ${counts.globe} places`);
  const missingStates = [...STATE_IDS].filter((s) => !perState[s]);
  console.log(
    `  states with no generated places (curated pool only): ${missingStates.join(", ") || "none"}`,
  );
  console.log(`wrote src/game/data/generated-places.json and src/game/data/country-boxes.json`);
}

main();
