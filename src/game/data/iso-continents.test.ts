import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { continentForIso2 } from "./iso-continents.ts";

/**
 * iso-continents table tests: ISO-3166-1 alpha-2 → continent (UN M49).
 * Run: node --experimental-strip-types --test src/game/data/iso-continents.test.ts
 */

// Independent spot-checks (20) against known geography — the human-verified
// anchor this table is checked against.
const SPOT_CHECKS: ReadonlyArray<[string, string]> = [
  ["US", "North America"],
  ["CA", "North America"],
  ["MX", "North America"],
  ["GL", "North America"],
  ["BR", "South America"],
  ["AR", "South America"],
  ["GB", "Europe"],
  ["FR", "Europe"],
  ["DE", "Europe"],
  ["RU", "Europe"], // UN M49: Eastern Europe (documented call)
  ["TR", "Asia"], // UN M49: Western Asia (documented call)
  ["CN", "Asia"],
  ["IN", "Asia"],
  ["JP", "Asia"],
  ["KZ", "Asia"], // UN M49: Central Asia (documented call)
  ["EG", "Africa"], // UN M49: Northern Africa (documented call)
  ["NG", "Africa"],
  ["ZA", "Africa"],
  ["AU", "Oceania"],
  ["NZ", "Oceania"],
  ["AQ", "Antarctica"],
  ["XK", "Europe"], // user-assigned Kosovo, in the gazetteer chunks
];

test("spot-checks: 22 known codes resolve to the UN M49 continent", () => {
  for (const [code, expected] of SPOT_CHECKS) {
    assert.equal(continentForIso2(code), expected, `${code} -> ${expected}`);
  }
});

test("every officially-assigned alpha-2 code plus XK resolves", () => {
  const ALL =
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CX CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
      " ",
    );
  assert.equal(ALL.length, 249, "249 officially-assigned codes listed");
  const missing = ALL.filter((c) => continentForIso2(c) === null);
  assert.deepEqual(missing, [], `unresolved codes: ${missing.join(" ")}`);
  assert.equal(continentForIso2("XK"), "Europe", "gazetteer XK resolves");
});

test("zero gaps: every iso2 in the GeoNames chunks resolves", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const dir = join(root, "geonames", "chunks");
  const codes = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const chunk = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const p of chunk.places ?? []) {
      if (typeof p.iso2 === "string" && p.iso2) codes.add(p.iso2.toUpperCase());
    }
  }
  assert.ok(codes.size > 200, `chunk iso2 coverage: ${codes.size} codes`);
  const gaps = [...codes].filter((c) => continentForIso2(c) === null);
  assert.deepEqual(gaps, [], `chunk codes with no continent: ${gaps.join(" ")}`);
});

test("fail-closed: malformed and unknown codes return null, never throw", () => {
  for (const bad of [null, undefined, "", " ", "USA", "12", "1A", "ZZ", "XX"]) {
    assert.equal(continentForIso2(bad as string), null, `input ${String(bad)}`);
  }
  // Lowercase is normalized, not rejected.
  assert.equal(continentForIso2("tr"), "Asia");
  assert.equal(continentForIso2(" us "), "North America");
});
