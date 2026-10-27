import assert from "node:assert/strict";
import test from "node:test";
import { STARTERS } from "./starters.ts";
import { COUNTRIES } from "./regions.ts";
import { continentForIso2, type KidContinent } from "./data/iso-continents.ts";

// WI-16 deck balance: the globe landmark deck promises the whole world, so
// the PO's minimum-share rule binds it — every inhabited continent must
// hold at least max(2, ceil(size / 8)) landmarks. The state and country
// decks are reported alongside it on every run, but never enforced: state
// decks are all-US by design, and country-deck continent share follows
// from which countries the owner has chosen (5-place blocks), not from
// this rule. Antarctica is excluded — it has no permanent population and
// no place in a landmarks deck for this age group.
const INHABITED: KidContinent[] = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
];

// Country starters carry no iso2 — their country resolves via regionId.
// This explicit map is that resolution: one entry per COUNTRIES region id.
// A country starter whose regionId is missing here fails the test by name
// below, so the report can never silently undercount a deck.
const COUNTRY_REGION_ISO2: Record<string, string> = {
  "united-states": "US",
  canada: "CA",
  mexico: "MX",
  brazil: "BR",
  "united-kingdom": "GB",
  france: "FR",
  germany: "DE",
  italy: "IT",
  egypt: "EG",
  india: "IN",
  china: "CN",
  japan: "JP",
  australia: "AU",
};

function emptyCounts(): Record<KidContinent, number> {
  return {
    Africa: 0,
    Asia: 0,
    Europe: 0,
    "North America": 0,
    Oceania: 0,
    "South America": 0,
    Antarctica: 0,
  };
}

function reportDeck(name: string, size: number, counts: Record<KidContinent, number>): void {
  console.log(`deck-balance: ${name} deck (size ${size})`);
  // Iterate INHABITED, not the observed keys — a missing continent must
  // show as 0, because a missing continent is the defect this test exists
  // to catch.
  for (const continent of INHABITED) {
    const count = counts[continent];
    const pct = size > 0 ? ((count / size) * 100).toFixed(1) : "0.0";
    console.log(`deck-balance:   ${continent}: ${count} (${pct}%)`);
  }
}

test("globe deck meets the minimum continent share (state and country decks reported)", () => {
  // Guard the map against the COUNTRIES table it was built from: a launch
  // country with no entry here would otherwise be a silent gap.
  for (const country of COUNTRIES) {
    assert.ok(
      COUNTRY_REGION_ISO2[country.id],
      `country regionId "${country.id}" (${country.name}) has no iso2 in COUNTRY_REGION_ISO2 — add it so the country deck report cannot undercount`,
    );
  }

  const stateDeck = STARTERS.filter((s) => s.edition === "state");
  const countryDeck = STARTERS.filter((s) => s.edition === "country");
  const globeDeck = STARTERS.filter((s) => s.edition === "globe");

  // State deck: every starter is North America by definition (the state
  // editions are US states; starters.test.ts proves every state regionId
  // exists in STATES).
  const stateCounts = emptyCounts();
  stateCounts["North America"] = stateDeck.length;

  // Country deck (report only): resolve each starter via the explicit map.
  const countryCounts = emptyCounts();
  for (const starter of countryDeck) {
    const iso2 = COUNTRY_REGION_ISO2[starter.regionId];
    assert.ok(
      iso2,
      `country starter ${starter.name} (${starter.id}) has regionId "${starter.regionId}" with no iso2 in COUNTRY_REGION_ISO2 — add it so the country deck report cannot undercount`,
    );
    const continent = continentForIso2(iso2);
    assert.ok(
      continent,
      `country starter ${starter.name} (${starter.id}): iso2 "${iso2}" for regionId "${starter.regionId}" resolves to no continent`,
    );
    countryCounts[continent] += 1;
  }

  // Globe deck: resolve via the starter's own iso2, fail closed — the
  // deck's data contract is that globe starters carry iso2.
  const globeCounts = emptyCounts();
  for (const starter of globeDeck) {
    const continent = continentForIso2(starter.iso2);
    assert.ok(
      continent,
      `globe starter ${starter.name} (${starter.id}) has missing or unresolvable iso2 "${starter.iso2 ?? ""}" — globe starters must carry an iso2 that resolves to a continent`,
    );
    globeCounts[continent] += 1;
  }

  reportDeck("state", stateDeck.length, stateCounts);
  reportDeck("country", countryDeck.length, countryCounts);
  reportDeck("globe", globeDeck.length, globeCounts);

  // Enforcement — globe only, per the PO rule.
  const size = globeDeck.length;
  const floor = Math.max(2, Math.ceil(size / 8));
  for (const continent of INHABITED) {
    const count = globeCounts[continent];
    assert.ok(
      count >= floor,
      `globe deck: ${continent} has ${count} of ${size} landmarks, below the floor of ${floor} (max(2, ceil(${size} / 8)))`,
    );
  }
});
