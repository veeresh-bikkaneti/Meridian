import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCollisionCounts,
  buildQuestionLabel,
  countryKeyForPlace,
  countryNameForIso2,
  countryNameForRegionId,
  hasNameCollision,
  stateNameForPlace,
  type LabelPlace,
} from "./question-label.ts";
import { STARTERS } from "./starters.ts";
import { loadRegionChunk } from "./generated-places.ts";
import manifestJson from "./data/geonames/manifest.json" with { type: "json" };

const manifest = manifestJson as unknown as {
  regions: Record<string, { edition: "state" | "country" | "globe"; count: number }>;
};

// ---------------------------------------------------------------------------
// countryNameForIso2 — fail-closed ISO-3166-1 alpha-2 → English country name
// ---------------------------------------------------------------------------

test("countryNameForIso2 resolves common codes", () => {
  assert.equal(countryNameForIso2("US"), "United States");
  assert.equal(countryNameForIso2("CA"), "Canada");
  assert.equal(countryNameForIso2("GB"), "United Kingdom");
  assert.equal(countryNameForIso2("EG"), "Egypt");
  assert.equal(countryNameForIso2("JP"), "Japan");
});

test("countryNameForIso2 normalizes case and whitespace", () => {
  assert.equal(countryNameForIso2("ca"), "Canada");
  assert.equal(countryNameForIso2(" Us "), "United States");
});

test("countryNameForIso2 fails closed on garbage", () => {
  assert.equal(countryNameForIso2(null), null);
  assert.equal(countryNameForIso2(undefined), null);
  assert.equal(countryNameForIso2(""), null);
  assert.equal(countryNameForIso2("USA"), null); // 3 letters
  assert.equal(countryNameForIso2("U"), null);
  assert.equal(countryNameForIso2("12"), null); // would throw RangeError without the guard
  assert.equal(countryNameForIso2("U1"), null);
  assert.equal(countryNameForIso2("XX"), null); // no CLDR entry
  assert.equal(countryNameForIso2("ZZ"), null); // CLDR "Unknown Region" — never a label
});

// ---------------------------------------------------------------------------
// countryNameForRegionId — curated-starter country resolution
// ---------------------------------------------------------------------------

test("countryNameForRegionId covers the curated regionId paths", () => {
  // Direct COUNTRIES lookup (curated country starters).
  assert.equal(countryNameForRegionId("canada"), "Canada");
  assert.equal(countryNameForRegionId("united-states"), "United States");
  // Reverse ADMIN1 lookup (curated state starters).
  assert.equal(countryNameForRegionId("nebraska"), "United States");
  assert.equal(countryNameForRegionId("texas"), "United States");
  // Unresolvable.
  assert.equal(countryNameForRegionId("globe"), null);
  assert.equal(countryNameForRegionId(""), null);
  assert.equal(countryNameForRegionId(null), null);
  assert.equal(countryNameForRegionId("atlantis"), null);
});

// ---------------------------------------------------------------------------
// iso2 coverage: every iso2 across all 64 chunks resolves to a country name
// (also proves toStarter threads iso2 onto every generated Starter)
// ---------------------------------------------------------------------------

test("every iso2 across all 64 chunks resolves to a country name", async () => {
  const seen = new Set<string>();
  let checked = 0;
  for (const regionId of Object.keys(manifest.regions)) {
    const starters = await loadRegionChunk(regionId);
    for (const s of starters) {
      assert.ok(
        typeof s.iso2 === "string" && s.iso2.length > 0,
        `${s.id}: generated Starter is missing iso2`,
      );
      const name = countryNameForIso2(s.iso2);
      assert.ok(
        name !== null,
        `${s.id}: iso2 ${JSON.stringify(s.iso2)} has no country name`,
      );
      seen.add(s.iso2!);
      checked++;
    }
  }
  assert.ok(checked > 100000, `expected six-figure place count, saw ${checked}`);
  assert.ok(seen.size > 200, `expected 200+ distinct iso2 codes, saw ${seen.size}`);
});

test("curated globe starters all carry a resolvable iso2", () => {
  const globe = STARTERS.filter((s) => s.edition === "globe");
  assert.equal(globe.length, 12);
  for (const s of globe) {
    assert.ok(
      typeof s.iso2 === "string" && countryNameForIso2(s.iso2) !== null,
      `${s.id}: curated globe starter needs a resolvable iso2`,
    );
  }
  const byId = new Map(globe.map((s) => [s.id, s.iso2]));
  assert.equal(byId.get("globe-giza"), "EG");
  assert.equal(byId.get("globe-uluru"), "AU");
  assert.equal(byId.get("globe-machu"), "PE");
  assert.equal(byId.get("globe-petra"), "JO");
  assert.equal(byId.get("globe-angkor"), "KH");
  assert.equal(byId.get("globe-everest"), "NP");
  assert.equal(byId.get("globe-victoria"), "ZW");
  assert.equal(byId.get("globe-tongariki"), "CL");
  assert.equal(byId.get("globe-oia"), "GR");
  assert.equal(byId.get("globe-puerto-ayora"), "EC");
  assert.equal(byId.get("globe-serengeti"), "TZ");
  assert.equal(byId.get("globe-gullfoss"), "IS");
});

// ---------------------------------------------------------------------------
// buildQuestionLabel — the contract
// ---------------------------------------------------------------------------

test("state edition: bare name, always", () => {
  assert.equal(
    buildQuestionLabel({
      edition: "state",
      place: { name: "Omaha", iso2: "US", regionId: "nebraska" },
    }),
    "Omaha",
  );
});

test("globe edition: {place}, {country}", () => {
  assert.equal(
    buildQuestionLabel({ edition: "globe", place: { name: "Toronto", iso2: "CA" } }),
    "Toronto, Canada",
  );
});

test("globe edition resolves curated country starters via regionId", () => {
  assert.equal(
    buildQuestionLabel({
      edition: "globe",
      place: { name: "CN Tower", regionId: "canada" },
    }),
    "CN Tower, Canada",
  );
});

test("globe edition resolves curated state starters via reverse ADMIN1 lookup", () => {
  assert.equal(
    buildQuestionLabel({
      edition: "globe",
      place: { name: "Chimney Rock", regionId: "nebraska" },
    }),
    "Chimney Rock, United States",
  );
});

test("globe collision with resolvable state: 3-part label", () => {
  assert.equal(
    buildQuestionLabel({
      edition: "globe",
      place: { name: "Manhattan", regionId: "nebraska" },
      hasCollision: true,
    }),
    "Manhattan, Nebraska, United States",
  );
});

test("globe collision without resolvable state: honest 2-part label", () => {
  // Generated globe-chunk places carry iso2 but no subdivision info.
  assert.equal(
    buildQuestionLabel({
      edition: "globe",
      place: { name: "Manhattan", iso2: "US" },
      hasCollision: true,
    }),
    "Manhattan, United States",
  );
});

test("globe collision never pairs a place with another country's subdivision", () => {
  // iso2 says Canada; "nebraska" belongs to the United States — the state
  // must not attach, so the label stays the honest 2-part form.
  assert.equal(
    buildQuestionLabel({
      edition: "globe",
      place: { name: "Paris", iso2: "CA", regionId: "nebraska" },
      hasCollision: true,
    }),
    "Paris, Canada",
  );
});

test("globe with unresolvable country: fail closed to bare name", () => {
  assert.equal(
    buildQuestionLabel({
      edition: "globe",
      place: { name: "Mystery Spot", regionId: "globe" },
    }),
    "Mystery Spot",
  );
  assert.equal(
    buildQuestionLabel({
      edition: "globe",
      place: { name: "Nowhere", iso2: "XX" },
      hasCollision: true,
    }),
    "Nowhere",
  );
});

test("country edition: {place}, {state} via originRegionId", () => {
  // Whole-country runs re-tag to the country regionId but keep the
  // subdivision as originRegionId.
  assert.equal(
    buildQuestionLabel({
      edition: "country",
      place: { name: "Austin", regionId: "united-states", originRegionId: "texas" },
      countryRegionId: "united-states",
    }),
    "Austin, Texas",
  );
});

test("country edition: {place}, {state} via regionId for unfolded places", () => {
  assert.equal(
    buildQuestionLabel({
      edition: "country",
      place: { name: "Omaha", iso2: "US", regionId: "nebraska" },
      countryRegionId: "united-states",
    }),
    "Omaha, Nebraska",
  );
});

test("country edition with unresolvable state: fail closed to bare name", () => {
  // Country-chunk places (e.g. canada.json) carry no subdivision info;
  // the region line already names the country, so the bare name is the
  // honest fallback — never an empty qualifier.
  assert.equal(
    buildQuestionLabel({
      edition: "country",
      place: { name: "Toronto", iso2: "CA", regionId: "canada" },
      countryRegionId: "canada",
    }),
    "Toronto",
  );
});

test("labels never leak raw ids, undefined, or empty qualifiers", () => {
  const adversarial: LabelPlace[] = [
    { name: "X", regionId: "globe" },
    { name: "Y", iso2: "" },
    { name: "Z", iso2: "ZZ" },
    { name: "W", regionId: "atlantis" },
    { name: "V", iso2: "US", regionId: "atlantis", originRegionId: "atlantis" },
  ];
  for (const place of adversarial) {
    for (const edition of ["state", "country", "globe"] as const) {
      const label = buildQuestionLabel({
        edition,
        place,
        countryRegionId: "united-states",
        hasCollision: true,
      });
      assert.ok(label.startsWith(place.name), `${edition}: ${label}`);
      assert.ok(!label.includes("undefined"), `${edition}: ${label}`);
      assert.ok(!label.includes("atlantis"), `${edition}: ${label}`);
      assert.ok(!/,\s*$/.test(label), `${edition}: trailing comma in ${label}`);
      assert.ok(!/,\s*,/.test(label), `${edition}: empty qualifier in ${label}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Collision map
// ---------------------------------------------------------------------------

function p(name: string, iso2?: string, regionId?: string): LabelPlace {
  return { name, iso2, regionId };
}

test("collision map keys are case-insensitive and trimmed, scoped to country", () => {
  const pool = [
    p("Manhattan", "US"),
    p("manhattan", "US"),
    p("  Manhattan ", "us"),
    p("Manhattan", "CA"),
    p("Toronto", "CA"),
  ];
  const counts = buildCollisionCounts(pool);
  assert.equal(counts.get("manhattan|US"), 3);
  assert.equal(counts.get("manhattan|CA"), 1);
  assert.equal(counts.get("toronto|CA"), 1);
  assert.ok(hasNameCollision(pool[0], counts));
  assert.ok(hasNameCollision(pool[1], counts));
  assert.ok(!hasNameCollision(pool[3], counts), "cross-country must not collide");
  assert.ok(!hasNameCollision(pool[4], counts));
});

test("collision map skips places with no resolvable country", () => {
  const pool = [p("Nowhere", undefined, "globe"), p("Nowhere", undefined, "globe")];
  const counts = buildCollisionCounts(pool);
  assert.equal(counts.size, 0);
  assert.ok(!hasNameCollision(pool[0], counts));
});

test("countryKeyForPlace prefers iso2, falls back to resolved country name", () => {
  assert.equal(countryKeyForPlace(p("X", "US")), "US");
  assert.equal(countryKeyForPlace(p("X", " us ")), "US");
  assert.equal(countryKeyForPlace(p("X", undefined, "canada")), "canada");
  assert.equal(countryKeyForPlace(p("X", undefined, "nebraska")), "united states");
  assert.equal(countryKeyForPlace(p("X", undefined, "globe")), null);
});

// ---------------------------------------------------------------------------
// stateNameForPlace
// ---------------------------------------------------------------------------

test("stateNameForPlace prefers originRegionId and honors the country scope", () => {
  assert.equal(
    stateNameForPlace(
      { name: "Austin", regionId: "united-states", originRegionId: "texas" },
      "united-states",
    ),
    "Texas",
  );
  assert.equal(
    stateNameForPlace({ name: "Omaha", regionId: "nebraska" }, "united-states"),
    "Nebraska",
  );
  // Wrong scope: nebraska is not a Canadian subdivision.
  assert.equal(
    stateNameForPlace({ name: "Omaha", regionId: "nebraska" }, "canada"),
    null,
  );
  // Country chunks carry no subdivision info.
  assert.equal(
    stateNameForPlace({ name: "Toronto", regionId: "canada" }, "canada"),
    null,
  );
});
