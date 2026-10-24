import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AGE_BAND_IDS, FULL_ACCESS_BAND } from "../age-profile/bands.ts";
import { THEMES, fmtRadius, themeForBand, verdictForTheme, type ColdTrailTheme } from "./themes.ts";
import type { ColdTrailSighting } from "./types.ts";

const OCTANTS: Array<[string, string]> = [
  ["north", "north"],
  ["north-east", "northeast"],
  ["east", "east"],
  ["south-east", "southeast"],
  ["south", "south"],
  ["south-west", "southwest"],
  ["west", "west"],
  ["north-west", "northwest"],
];

const sighting = (octant: string, radiusKm = 1275): ColdTrailSighting => ({
  id: "s1",
  timestamp: "Tue 08:14",
  cityId: "gn-1",
  cityName: "Denver",
  cityLon: -104.99,
  cityLat: 39.74,
  radiusKm,
  octant,
  text: "Last seen refueling 400 km east of Denver.",
  region: { continent: "North America", country: "United States", subdivision: "Colorado" },
});

/** Render EVERY slot of a theme with sentinel data (ADR-13 test design). */
function collectStrings(theme: ColdTrailTheme): string[] {
  const strings: string[] = [
    theme.id,
    theme.subject,
    theme.eyebrow,
    theme.heading(7),
    theme.intro,
    theme.sightingEyebrow(1, "Tue 08:14"),
    theme.helper.button,
    theme.helper.ariaAffordable,
    theme.helper.ariaUnavailable(1, 0),
    theme.helper.ariaUnavailable(1, 3),
    theme.helper.hint,
    theme.helper.suffix,
    theme.map.ariaLabel,
    theme.map.statusDone,
    theme.map.statusReadyCross,
    theme.map.statusReadyNoCross,
    // Composed legend fragments, as rendered on the card.
    `gold ring = ${theme.map.legendRing}`,
    `dashed ring = ${theme.map.legendDraft}`,
    theme.map.legendNoCross,
    theme.map.legendCross,
    theme.map.hintAllCross,
    theme.map.hintAllNoCross,
    theme.confirm.ariaLabel,
    theme.confirm.eyebrow,
    theme.confirm.heading,
    theme.confirm.body,
    theme.confirm.button,
    theme.reveal.eyebrow,
    theme.reveal.targetLine("Testville"),
    theme.reveal.missLine("42 km"),
    theme.reveal.closing,
    theme.reveal.nextButton,
  ];
  for (const score of [50, 200, 500, 5000]) {
    const verdict = verdictForTheme(theme, score);
    strings.push(verdict.title, verdict.line);
  }
  for (const [octant] of OCTANTS) {
    strings.push(theme.sightingSentence(sighting(octant)));
  }
  return strings;
}

// Banned lexicon: PO §3/§5 stems + Child Safety gate additions. The
// automated test bans caught/vanished/chase outright (gate §1a); "closed
// in" is explicitly NOT banned (its shipped uses take a thing/trail as
// object), so no stem here matches it.
const BANNED_STEMS = [
  "smuggler",
  "hideout",
  "informant",
  "intercept",
  "red-handed",
  "slipped the net",
  "vanished",
  "caught",
  "chase",
  "capture",
  "arrest",
  "police",
  "jail",
  "prison",
  "manhunt",
  "stakeout",
  "fugitive",
  "suspect",
  "culprit",
  "criminal",
  "crime",
  "theft",
  "thief",
  "steal",
  "stolen",
  "robbery",
  "robber",
  "burglary",
  "burglar",
  "contraband",
  "kidnapping",
  "fraud",
  "vandalism",
  "gang",
  "accomplice",
  "on the run",
  // Child Safety gate additions.
  "traffick",
  "ransom",
  "blackmail",
  "extort",
  "perpetrator",
  "offender",
  "outlaw",
  "lawbreaker",
  "evade",
  "evasion",
  "getaway",
  "hunt",
  "gun",
  "rifle",
  "pistol",
  "knife",
  "bomb",
  "weapon",
  "murder",
  "kill",
  "shoot",
  "stab",
  "poison",
  "hostage",
];

function bannedHit(value: string): string | null {
  const normalised = value.toLowerCase().replace(/-/g, " ");
  const words = normalised.split(/[^a-z]+/).filter(Boolean);
  for (const stem of BANNED_STEMS) {
    if (stem.includes(" ")) {
      if (normalised.includes(stem)) return stem;
    } else if (words.some((word) => word.startsWith(stem))) {
      return stem;
    }
  }
  return null;
}

// source: PO §3a / build-coldtrail.mjs SIGHTING_VERBS (verbatim fixture;
// the .mjs is not imported into the unit graph).
const SIGHTING_VERBS = [
  "refueling a dusty pickup",
  "buying supplies at a truck stop",
  "spotted at a roadside diner",
  "seen boarding a night bus",
  "withdrawing cash from an ATM",
  "asking a gas attendant for directions",
  "sleeping in a parked car",
  "buying a burner phone",
  "eating at a drive-through",
  "filling jerrycans",
  "hitching a ride from a trucker",
  "seen at a bus depot",
];

test("registry shape: exactly one theme per age band", () => {
  assert.deepEqual(Object.keys(THEMES), AGE_BAND_IDS);
  for (const band of AGE_BAND_IDS) {
    assert.equal(themeForBand(band).band, band);
  }
  assert.equal(themeForBand("5-7").id, "T57-A");
  assert.equal(themeForBand("8-10").id, "T810-A");
  assert.equal(themeForBand("11-13").id, "T1113-A");
  // Unset profile -> existing FULL_ACCESS_BAND default serves T1113-A.
  assert.equal(FULL_ACCESS_BAND, "11-13");
  assert.equal(themeForBand(FULL_ACCESS_BAND).id, "T1113-A");
});

test("no collected string in any band matches the banned lexicon", () => {
  for (const band of AGE_BAND_IDS) {
    for (const value of collectStrings(themeForBand(band))) {
      const hit = bannedHit(value);
      assert.equal(hit, null, `band ${band}: "${value}" matched banned stem "${hit}"`);
    }
  }
});

test("younger bands never get the adult theme", () => {
  // The charter sentence, as its own named test (ADR-13 assertion 4).
  for (const band of ["5-7", "8-10"] as const) {
    const theme = themeForBand(band);
    assert.equal(theme.id, band === "5-7" ? "T57-A" : "T810-A");
    for (const value of collectStrings(theme)) {
      assert.equal(bannedHit(value), null, `band ${band}: "${value}"`);
    }
  }
});

test("none of the 12 sighting verbs appears in any collected string", () => {
  for (const band of AGE_BAND_IDS) {
    for (const value of collectStrings(themeForBand(band))) {
      for (const verb of SIGHTING_VERBS) {
        assert.ok(
          !value.toLowerCase().includes(verb.toLowerCase()),
          `band ${band}: "${value}" contains sighting verb "${verb}"`,
        );
      }
    }
  }
});

test("sighting sentences: all 8 octant mappings pinned, generator format", () => {
  assert.equal(fmtRadius(1275), "1,275 km");
  const theme = themeForBand("11-13");
  for (const [octant, word] of OCTANTS) {
    assert.equal(
      theme.sightingSentence(sighting(octant)),
      `Last spotted 1,275 km ${word} of Denver.`,
    );
  }
});

test("format pins: sentence per theme at 1275 km north-east of Denver", () => {
  const s = sighting("north-east");
  assert.equal(themeForBand("5-7").sightingSentence(s), "Pip was spotted 1,275 km northeast of Denver.");
  assert.equal(
    themeForBand("8-10").sightingSentence(s),
    "The treasure map was spotted 1,275 km northeast of Denver.",
  );
  assert.equal(themeForBand("11-13").sightingSentence(s), "Last spotted 1,275 km northeast of Denver.");
});

test("verdict caught equivalence is true,true,false,false per theme", () => {
  for (const band of AGE_BAND_IDS) {
    const theme = themeForBand(band);
    assert.deepEqual(
      [50, 200, 500, 5000].map((score) => verdictForTheme(theme, score).caught),
      [true, true, false, false],
    );
  }
});
