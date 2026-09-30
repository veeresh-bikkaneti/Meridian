#!/usr/bin/env node
/**
 * check-generated-places.mjs — F6b/F7 import gate for the generated place dataset.
 *
 * Re-validates every generated place in `src/game/data/generated-places.json`
 * against its declared reference country box (`src/game/data/country-boxes.json`)
 * through the REAL F7 gate (`validateGeneratedPlace`). Any Hyderabad-rule
 * mismatch fails the build loudly (non-zero exit) — never silently.
 *
 * Wired as `prebuild` / `prebuild:pages` in package.json, so `npm run build`
 * and `npm run build:pages` cannot ship a bad dataset.
 *
 * Antimeridian note: boxes for wrapped countries (RU, NZ, AQ) are stored in
 * the 0–360 frame; longitudes are normalized into that frame before
 * validating, exactly like the F6a pipeline's verify gate
 * (cf. normalizeLon in the F6a verify-places.mjs).
 *
 * Node standard library only. No network.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGeneratedPlace } from "../src/game/validate-places.ts";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const VALID_EDITIONS = new Set(["state", "country", "globe"]);

function boxKeyFor(place) {
  return place.iso2 ?? `name:${place.country}`;
}

/** Into the box's frame for antimeridian-wrapped countries (cf. F6a normalizeLon). */
function normalizeLon(lon, entry) {
  return entry.wrapped && lon < 0 ? lon + 360 : lon;
}

function main() {
  const dataset = JSON.parse(
    readFileSync(join(REPO, "src", "game", "data", "generated-places.json"), "utf8"),
  );
  const { boxes } = JSON.parse(
    readFileSync(join(REPO, "src", "game", "data", "country-boxes.json"), "utf8"),
  );

  const violations = [];
  const seenIds = new Set();
  let checked = 0;
  let curatedSkipped = 0;

  for (const place of dataset.places) {
    if (place.curated) {
      curatedSkipped++;
      continue; // starters.ts owns curated places; the F7 unit tests lock those in.
    }
    if (seenIds.has(place.id)) {
      violations.push(`${place.id}: duplicate generated id`);
    }
    seenIds.add(place.id);

    if (!VALID_EDITIONS.has(place.edition)) {
      violations.push(`${place.id}: invalid edition "${place.edition}"`);
    }
    if (typeof place.regionId !== "string" || place.regionId.length === 0) {
      violations.push(`${place.id}: missing regionId`);
    }

    const key = boxKeyFor(place);
    const entry = boxes[key];
    if (!entry) {
      violations.push(`${place.id}: no reference country box for key "${key}"`);
      continue;
    }
    const v = validateGeneratedPlace({
      id: place.id,
      name: place.name,
      lon: normalizeLon(place.lon, entry),
      lat: place.lat,
      declaredCountry: entry.country,
      countryBox: entry.box,
    });
    if (v.length > 0) violations.push(...v);
    checked++;
  }

  if (violations.length > 0) {
    console.error(
      `F6b PLACE GATE FAILED: ${violations.length} violation(s) across ${checked} generated places — build rejected.`,
    );
    for (const v of violations.slice(0, 50)) console.error(`  - ${v}`);
    if (violations.length > 50) console.error(`  … and ${violations.length - 50} more`);
    process.exit(1);
  }
  console.log(
    `F6b place gate OK: ${checked} generated places validated against their country boxes, 0 violations (${curatedSkipped} curated refs skipped).`,
  );
}

main();
