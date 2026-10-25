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

// Peer Reviewer (pass 10) fix: pin EVERY rendered theme string
// character-for-character against the Child Safety gate record
// (personas/child-safety.md §3–§4 + confirmation Rulings 1–2). The
// lexicon tests above catch banned words, but only an exact pin
// catches a wording drift away from the approved text (AC-13.9).
// collectStrings order is the order pinned here; sentinel inputs
// are heading(7), sighting 1 at "Tue 08:14", ariaUnavailable(1, 0)
// and (1, 3), target "Testville", miss "42 km", verdict scores
// 50/200/500/5000, and all 8 octants at 1,275 km from Denver.
const EXPECTED_STRINGS: Record<string, string[]> = {
  "5-7": [
    "T57-A",
    "Pip the puppy",
    "🐶 Cold Trail · Puppy Search",
    "Find Pip the Puppy",
    "Pip the puppy has wandered off. Three friends spotted Pip. Three rings on the map will show where Pip is waiting.",
    "🐾 Sighting 1 · Tue 08:14",
    "🦉 Wise Owl: make this ring smaller (1⭐)",
    "Wise Owl: make ring half as big, costs 1 star",
    "Wise Owl unavailable: needs 1 star, you have 0",
    "Wise Owl unavailable: needs 1 star, you have 3",
    "🦉 The Wise Owl made that ring smaller.",
    " (owl made it smaller)",
    "Cold Trail map. Place each ring where Pip was spotted, then tap where the rings cross to show where Pip is.",
    "All done — the gold star shows where Pip was waiting.",
    "All 3 rings are down — tap where they cross to show where Pip is.",
    "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.",
    "gold ring = where Pip was spotted",
    "dashed ring = your draft — not locked yet",
    "use ↩ Move on a sighting card to shift a ring closer",
    "tap where the rings cross to show your guess",
    "All 3 rings are down — tap where they cross to show where Pip is.",
    "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.",
    "Confirm your guess",
    "Your guess",
    "Is Pip here?",
    "One guess — then we will see where Pip was waiting all along.",
    "📍 Show my guess",
    "All done",
    "Pip was waiting in Testville.",
    "Your guess was 42 km away.",
    "+1⭐ for finding Pip",
    "🐶 Next search",
    "You found Pip!",
    "Pip was waiting right there, tail wagging.",
    "So close!",
    "You were very close. One more ring would have found Pip.",
    "Not here — keep looking.",
    "Pip was a little further away. Look at the rings and try the next search.",
    "Pip was far away.",
    "That was a different part of the map. Look at the rings and try the next search.",
    "Pip was spotted 1,275 km north of Denver.",
    "Pip was spotted 1,275 km northeast of Denver.",
    "Pip was spotted 1,275 km east of Denver.",
    "Pip was spotted 1,275 km southeast of Denver.",
    "Pip was spotted 1,275 km south of Denver.",
    "Pip was spotted 1,275 km southwest of Denver.",
    "Pip was spotted 1,275 km west of Denver.",
    "Pip was spotted 1,275 km northwest of Denver.",
  ],
  "8-10": [
    "T810-A",
    "The treasure map",
    "🗺️ Cold Trail · Map Mystery",
    "Case #007 — The Missing Treasure Map",
    "A treasure map has gone missing from its box. Three sightings, three rings — work out where the map ended up and tap your best guess.",
    "👀 Sighting 1 · Tue 08:14",
    "🧭 Guide: tighten this ring by half (1⭐)",
    "Guide: tighten ring to half radius, costs 1 star",
    "Guide unavailable: needs 1 star, you have 0",
    "Guide unavailable: needs 1 star, you have 3",
    "🧭 The Guide tightened that ring to half its size.",
    " (guide tightened)",
    "Cold Trail map. Place each sighting ring where the treasure map was spotted, then tap where the rings cross to set your guess.",
    "Mystery solved — the gold star marks where the map ended up.",
    "All 3 rings are down — tap where they cross to set your guess.",
    "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.",
    "gold ring = sighting ring for the map",
    "dashed ring = your draft — not locked yet",
    "use ↩ Move on a sighting card to shift a ring closer",
    "tap where the rings cross to set your guess",
    "All 3 rings are down — tap where they cross to set your guess.",
    "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.",
    "Confirm your guess",
    "Your guess",
    "Pin this spot?",
    "One guess — then we will see where the map really ended up.",
    "📍 Pin this spot",
    "Mystery solved",
    "The map ended up in Testville.",
    "Your guess was 42 km away.",
    "+1⭐ for solving the mystery",
    "🔎 Next mystery",
    "You found the map!",
    "Your pin landed right where the map ended up.",
    "Warm trail — so close!",
    "You had the right area. One more ring would have done it.",
    "The trail went quiet.",
    "You closed in, but the map was further along the trail.",
    "Wrong part of the map.",
    "The map ended up somewhere else entirely. Study the rings and try the next mystery.",
    "The treasure map was spotted 1,275 km north of Denver.",
    "The treasure map was spotted 1,275 km northeast of Denver.",
    "The treasure map was spotted 1,275 km east of Denver.",
    "The treasure map was spotted 1,275 km southeast of Denver.",
    "The treasure map was spotted 1,275 km south of Denver.",
    "The treasure map was spotted 1,275 km southwest of Denver.",
    "The treasure map was spotted 1,275 km west of Denver.",
    "The treasure map was spotted 1,275 km northwest of Denver.",
  ],
  "11-13": [
    "T1113-A",
    "the trail",
    "🕵️ Cold Trail · Case file",
    "Case #007",
    "A trail of sightings crosses the map. Three sightings, three rings — triangulate where the trail leads and tap your best guess.",
    "🕵️ Sighting 1 · Tue 08:14",
    "🧭 Guide: tighten 50% (1⭐)",
    "Guide: tighten ring to half radius, costs 1 star",
    "Guide unavailable: needs 1 star, you have 0",
    "Guide unavailable: needs 1 star, you have 3",
    "🧭 The Guide tightened that ring to half its size.",
    " (guide tightened)",
    "Cold Trail map. Place each sighting ring where the trail was spotted, then tap where the rings cross to set your guess.",
    "Case closed — the gold star marks where the trail led.",
    "All 3 rings are down — tap where they cross to set your guess.",
    "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.",
    "gold ring = sighting ring",
    "dashed ring = your draft — not locked yet",
    "use ↩ Move on a sighting card to shift a ring closer",
    "tap where the rings cross to set your guess",
    "All 3 rings are down — tap where they cross to set your guess.",
    "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.",
    "Confirm your guess",
    "Your guess",
    "Pin this spot?",
    "One guess — then we will see where the trail really led.",
    "📍 Pin this spot",
    "Case closed",
    "The trail led to Testville.",
    "Your guess was 42 km away.",
    "+1⭐ for closing the case",
    "🔎 Next case",
    "Trail solved!",
    "Your pin landed right where the trail led.",
    "Warm trail — so close!",
    "You had the right neighborhood. One more ring would have done it.",
    "The trail went cold.",
    "You closed in, but the trail led further than the rings suggested.",
    "The trail led elsewhere.",
    "Wrong part of the map entirely. Study the rings and try the next case.",
    "Last spotted 1,275 km north of Denver.",
    "Last spotted 1,275 km northeast of Denver.",
    "Last spotted 1,275 km east of Denver.",
    "Last spotted 1,275 km southeast of Denver.",
    "Last spotted 1,275 km south of Denver.",
    "Last spotted 1,275 km southwest of Denver.",
    "Last spotted 1,275 km west of Denver.",
    "Last spotted 1,275 km northwest of Denver.",
  ],
};

test("every rendered theme string matches the gate-approved text exactly", () => {
  for (const band of AGE_BAND_IDS) {
    assert.deepEqual(
      collectStrings(themeForBand(band)),
      EXPECTED_STRINGS[band],
      `band ${band}: a rendered string differs from the Child Safety gate text`,
    );
  }
});
