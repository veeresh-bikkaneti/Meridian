import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTopRanks,
  blurbFor,
  cardinalInBox,
  countryDisplayName,
  leadFor,
  rankRegionName,
  sportsSentence,
} from "./build-geonames-dataset.mjs";

/**
 * Kid-friendly blurb template tests (Track 4, template track).
 *
 * Every fact in a blurb must come from pipeline data — these tests lock the
 * template wording: plain-spoken geography, civic status only where the
 * feature code verifies it, and NO population/elevation filler.
 */

const box = (minLon, maxLon, minLat, maxLat) => ({ minLon, maxLon, minLat, maxLat });

// Approximate real boxes (only the cardinal math matters here).
const DC_BOX = box(-77.2, -76.9, 38.8, 39.0);
const ALABAMA_BOX = box(-88.47, -84.89, 30.22, 35.01);
const TEXAS_BOX = box(-106.43, -93.51, 25.84, 36.5);

const barryFarms = {
  name: "Barry Farms",
  admin1Name: "District of Columbia",
  countryName: "United States",
  pop: 4129,
  fcode: "PPL",
  cc: "US",
  lon: -76.98,
  lat: 38.86,
  box: DC_BOX,
};

describe("blurbFor — kid-friendly template", () => {
  it("Barry Farms: before/after — drops population and elevation, keeps plain geography", () => {
    // BEFORE (2026-10-01): "Barry Farms is a town in eastern District of
    // Columbia, United States (population ~4,129). It sits at ~50 m elevation."
    assert.equal(
      blurbFor(barryFarms),
      "Barry Farms is a town in southeastern District of Columbia, the United States.",
    );
  });

  it("ignores elevation even when the pipeline passes it", () => {
    assert.equal(blurbFor({ ...barryFarms, elev: "50" }), blurbFor(barryFarms));
    assert.ok(!/elevation/i.test(blurbFor({ ...barryFarms, elev: "50" })));
  });

  it("country capital: Paris", () => {
    assert.equal(
      blurbFor({
        name: "Paris", admin1Name: "Île-de-France", countryName: "France",
        pop: 2138551, fcode: "PPLC", cc: "FR", lon: 2.35, lat: 48.85, box: null,
      }),
      "Paris is the capital of France.",
    );
  });

  it("country capital takes the article where English needs it: London", () => {
    assert.equal(
      blurbFor({
        name: "London", admin1Name: "England", countryName: "United Kingdom",
        pop: 8961989, fcode: "PPLC", cc: "GB", lon: -0.13, lat: 51.5, box: null,
      }),
      "London is the capital of the United Kingdom.",
    );
  });

  it("state-capital list form keeps the article after the comma: Austin", () => {
    assert.equal(
      blurbFor({
        name: "Austin", admin1Name: "Texas", countryName: "United States",
        pop: 974447, fcode: "PPLA", cc: "US", lon: -97.74, lat: 30.27, box: null,
      }),
      "Austin is the capital of Texas, the United States.",
    );
  });

  it("article countries keep 'the' after a comma: the Philippines, the United Kingdom", () => {
    // ~8k shipped rows sit in article-countries (the Philippines 4,243;
    // the United Kingdom 3,392; the Maldives, the Gambia, ...). The comma
    // form must not drop the article.
    const PH_BOX = box(117.0, 126.5, 5.0, 18.5);
    assert.equal(
      blurbFor({
        name: "Zumarraga", admin1Name: "Eastern Visayas", countryName: "Philippines",
        pop: 16000, fcode: "PPL", cc: "PH", lon: 124.5, lat: 11.6, box: PH_BOX,
      }),
      "Zumarraga is a town in eastern Eastern Visayas, the Philippines.",
    );
    const WALES_BOX = box(-5.5, -2.5, 51.3, 53.5);
    assert.equal(
      blurbFor({
        name: "Ystalyfera", admin1Name: "Wales", countryName: "United Kingdom",
        pop: 9000, fcode: "PPL", cc: "GB", lon: -3.78, lat: 51.76, box: WALES_BOX,
      }),
      "Ystalyfera is a town in southern Wales, the United Kingdom.",
    );
  });

  it("county seat with cardinal position: Bay Minette, AL", () => {
    assert.equal(
      blurbFor({
        name: "Bay Minette", admin1Name: "Alabama", countryName: "United States",
        pop: 9118, fcode: "PPLA2", cc: "US", lon: -87.78, lat: 30.88, box: ALABAMA_BOX,
      }),
      "Bay Minette is a county seat in southwestern Alabama, the United States.",
    );
  });

  it("county seat without a box still reads cleanly", () => {
    assert.equal(
      blurbFor({
        name: "Edna", admin1Name: "Texas", countryName: "United States",
        pop: 5792, fcode: "PPLA2", cc: "US", lon: -96.65, lat: 28.98, box: null,
      }),
      "Edna is a county seat in Texas, the United States.",
    );
  });

  it("plain city: Lubbock", () => {
    assert.equal(
      blurbFor({
        name: "Lubbock", admin1Name: "Texas", countryName: "United States",
        pop: 263930, fcode: "PPL", cc: "US", lon: -101.88, lat: 33.58, box: TEXAS_BOX,
      }),
      "Lubbock is a city in northern Texas, the United States.",
    );
  });

  it("plain town: Edna", () => {
    assert.equal(
      blurbFor({
        name: "Edna", admin1Name: "Texas", countryName: "United States",
        pop: 5792, fcode: "PPL", cc: "US", lon: -96.65, lat: 28.98, box: null,
      }),
      "Edna is a town in Texas, the United States.",
    );
  });

  it("PPLX section of populated place → neighborhood: Dayrah, Dubai", () => {
    assert.equal(
      blurbFor({
        name: "Dayrah", admin1Name: "Dubai", countryName: "United Arab Emirates",
        pop: 400000, fcode: "PPLX", cc: "AE", lon: 55.32, lat: 25.27, box: null,
      }),
      "Dayrah is a neighborhood in Dubai, the United Arab Emirates.",
    );
  });

  it("STLMT Israeli settlement → settlement", () => {
    assert.equal(
      blurbFor({
        name: "Har Adar", admin1Name: null, countryName: "Israel",
        pop: 3300, fcode: "STLMT", cc: "IL", lon: 35.13, lat: 31.83, box: null,
      }),
      "Har Adar is a settlement in Israel.",
    );
  });

  it("non-US PPLA2 does NOT claim 'county seat' (Kuhsān, Afghanistan)", () => {
    assert.equal(
      blurbFor({
        name: "Kuhsān", admin1Name: "Herāt", countryName: "Afghanistan",
        pop: 12087, fcode: "PPLA2", cc: "AF", lon: 62.12, lat: 34.65, box: null,
      }),
      "Kuhsān is a town in Herāt, Afghanistan.",
    );
  });

  it("noisy fcodes fall back to city/town instead of a wrong word (PPLQ Sant Martí)", () => {
    assert.equal(
      blurbFor({
        name: "Sant Martí", admin1Name: "Catalonia", countryName: "Spain",
        pop: 235719, fcode: "PPLQ", cc: "ES", lon: 2.2, lat: 41.41, box: null,
      }),
      "Sant Martí is a city in Catalonia, Spain.",
    );
  });

  it("no template blurb contains digits, population filler, or elevation text", () => {
    const cases = [
      barryFarms,
      { name: "Paris", admin1Name: "Île-de-France", countryName: "France", pop: 2138551, fcode: "PPLC", cc: "FR", lon: 2.35, lat: 48.85, box: null },
      { name: "Austin", admin1Name: "Texas", countryName: "United States", pop: 974447, fcode: "PPLA", cc: "US", lon: -97.74, lat: 30.27, box: null },
      { name: "Bay Minette", admin1Name: "Alabama", countryName: "United States", pop: 9118, fcode: "PPLA2", cc: "US", lon: -87.78, lat: 30.88, box: ALABAMA_BOX },
      { name: "Lubbock", admin1Name: "Texas", countryName: "United States", pop: 263930, fcode: "PPL", cc: "US", lon: -101.88, lat: 33.58, box: TEXAS_BOX },
      { name: "Edna", admin1Name: "Texas", countryName: "United States", pop: 5792, fcode: "PPL", cc: "US", lon: -96.65, lat: 28.98, box: null },
      { name: "Dayrah", admin1Name: "Dubai", countryName: "United Arab Emirates", pop: 400000, fcode: "PPLX", cc: "AE", lon: 55.32, lat: 25.27, box: null },
      { name: "Kuhsān", admin1Name: "Herāt", countryName: "Afghanistan", pop: 12087, fcode: "PPLA2", cc: "AF", lon: 62.12, lat: 34.65, box: null },
    ];
    for (const c of cases) {
      const b = blurbFor(c);
      assert.ok(!/\d/.test(b), `digits in blurb: ${b}`);
      assert.ok(!/population|elevation/i.test(b), `filler in blurb: ${b}`);
    }
  });

  it("does NOT embed the curated notable note in the blurb", () => {
    // The notable note travels as the first-class `history` field on the
    // place record, never inside the blurb (history-first by construction).
    assert.equal(
      blurbFor({
        name: "Austin", admin1Name: "Texas", countryName: "United States",
        pop: 974447, fcode: "PPLA", cc: "US", lon: -97.74, lat: 30.27, box: null,
        notable: "Founded in 1839 and named for Stephen F. Austin.",
      }),
      "Austin is the capital of Texas, the United States.",
    );
  });

  it("appends the roster-validated sports line unchanged", () => {
    assert.equal(
      blurbFor({
        name: "Lubbock", admin1Name: "Texas", countryName: "United States",
        pop: 263930, fcode: "PPL", cc: "US", lon: -101.88, lat: 33.58, box: TEXAS_BOX,
        sports: [{ team: "Dallas Cowboys", league: "NFL" }],
      }),
      "Lubbock is a city in northern Texas, the United States. Home of the Dallas Cowboys (NFL).",
    );
  });
});

describe("countryDisplayName — the definite article", () => {
  it("adds 'the' where English needs it, leaves the rest alone", () => {
    assert.equal(countryDisplayName("United States"), "the United States");
    assert.equal(countryDisplayName("United Kingdom"), "the United Kingdom");
    assert.equal(countryDisplayName("Gambia"), "the Gambia");
    assert.equal(countryDisplayName("Maldives"), "the Maldives");
    assert.equal(countryDisplayName("The Netherlands"), "the Netherlands");
    assert.equal(countryDisplayName("France"), "France");
    assert.equal(countryDisplayName("Texas"), "Texas");
    assert.equal(
      countryDisplayName("Democratic Republic of the Congo"),
      "Democratic Republic of the Congo",
    );
  });
});

describe("rankRegionName — the comparison set reads correctly", () => {
  it("states rank within the state; DC within the District; countries take the article", () => {
    assert.equal(
      rankRegionName({ edition: "state", admin1Name: "Texas", countryName: "United States", cc: "US" }),
      "Texas",
    );
    assert.equal(
      rankRegionName({ edition: "country", admin1Name: "District of Columbia", countryName: "United States", cc: "US" }),
      "the District of Columbia",
    );
    assert.equal(
      rankRegionName({ edition: "country", admin1Name: null, countryName: "United Kingdom", cc: "GB" }),
      "the United Kingdom",
    );
    assert.equal(
      rankRegionName({ edition: "globe", admin1Name: null, countryName: "Nigeria", cc: "NG" }),
      "Nigeria",
    );
  });
});

describe("sportsSentence — unchanged behavior", () => {
  it("formats one, two, and three teams", () => {
    assert.equal(
      sportsSentence([{ team: "Texas Rangers", league: "MLB" }]),
      "Home of the Texas Rangers (MLB).",
    );
    assert.equal(
      sportsSentence([
        { team: "Dallas Cowboys", league: "NFL" },
        { team: "Dallas Mavericks", league: "NBA" },
      ]),
      "Home of the Dallas Cowboys (NFL) and Dallas Mavericks (NBA).",
    );
    assert.equal(
      sportsSentence([
        { team: "Dallas Cowboys", league: "NFL" },
        { team: "Texas Rangers", league: "MLB" },
        { team: "Dallas Stars", league: "NHL" },
      ]),
      "Home of the Dallas Cowboys (NFL), Texas Rangers (MLB), and Dallas Stars (NHL).",
    );
  });

  it("returns empty string when there are no teams", () => {
    assert.equal(sportsSentence([]), "");
    assert.equal(sportsSentence(undefined), "");
  });
});

describe("leadFor — civic status only where verifiable", () => {
  it("capitals", () => {
    assert.equal(leadFor("PPLC", 1, "FR").kind, "capital-country");
    assert.equal(leadFor("PPLA", 1, "US").kind, "capital-admin1");
  });

  it("US county seats keep the title; non-US seats do not", () => {
    assert.equal(leadFor("PPLA2", 9118, "US").kind, "county-seat");
    assert.equal(leadFor("PPLA2", 12087, "AF").word, "a town");
    assert.equal(leadFor("PPLA2", 200000, "AF").word, "a city");
  });

  it("verified settlement words", () => {
    assert.equal(leadFor("PPLX", 400000, "AE").word, "a neighborhood");
    assert.equal(leadFor("STLMT", 3300, "IL").word, "a settlement");
  });

  it("generic codes fall back to city/town by population", () => {
    assert.equal(leadFor("PPL", 263930, "US").word, "a city");
    assert.equal(leadFor("PPL", 4129, "US").word, "a town");
    assert.equal(leadFor("PPLQ", 235719, "ES").word, "a city");
    assert.equal(leadFor("PPLCH", 6499, "ES").word, "a town");
  });
});

describe("cardinalInBox — plain-spoken geography", () => {
  it("names the compass position a kid can picture", () => {
    const b = box(0, 10, 0, 10);
    assert.equal(cardinalInBox(8, 8, b), "northeastern");
    assert.equal(cardinalInBox(2, 8, b), "northwestern");
    assert.equal(cardinalInBox(5, 8, b), "northern");
    assert.equal(cardinalInBox(5, 5, b), "central");
    assert.equal(cardinalInBox(5, 2, b), "southern");
    assert.equal(cardinalInBox(8, 2, b), "southeastern");
  });
});

describe("applyTopRanks — the one stat that teaches", () => {
  const makePlace = (i, pop, gid, regionId, regionName, rankKey) => ({
    id: `gn-${i}`,
    name: `Place${i}`,
    blurb: `Place${i} is a town in ${regionName}.`,
    regionId,
    _pop: pop,
    _gid: gid,
    _rankKey: rankKey ?? regionId,
    _regionName: regionName,
  });

  it("marks the top 5 of a large region and leaves the rest alone", () => {
    const places = Array.from({ length: 35 }, (_, i) =>
      makePlace(i, 35000 - i * 1000, i, "texas", "Texas"),
    );
    const before = places.map((p) => p.id);
    applyTopRanks(places);
    assert.deepEqual(places.map((p) => p.id), before, "place order must not change");
    for (let i = 0; i < 5; i++) {
      assert.equal(
        places[i].blurb,
        `Place${i} is a town in Texas. It's one of Texas's biggest places.`,
      );
    }
    for (let i = 5; i < 35; i++) {
      assert.equal(places[i].blurb, `Place${i} is a town in Texas.`);
    }
  });

  it("skips regions with fewer than 30 shipped places", () => {
    const places = Array.from({ length: 29 }, (_, i) =>
      makePlace(i, 29000 - i * 1000, i, "vermont", "Vermont"),
    );
    applyTopRanks(places);
    for (const p of places) assert.equal(p.blurb, `${p.name} is a town in Vermont.`);
  });

  it("ranks globe-edition places per country, never against the mixed globe pool", () => {
    const ng = Array.from({ length: 30 }, (_, i) =>
      makePlace(i, 30000 - i * 1000, i, "globe", "Nigeria", "globe:NG"),
    );
    const ne = Array.from({ length: 30 }, (_, i) =>
      makePlace(100 + i, 30000 - i * 1000, 100 + i, "globe", "Niger", "globe:NE"),
    );
    applyTopRanks([...ng, ...ne]);
    for (let i = 0; i < 5; i++) {
      assert.ok(ng[i].blurb.endsWith("It's one of Nigeria's biggest places."), ng[i].blurb);
      assert.ok(ne[i].blurb.endsWith("It's one of Niger's biggest places."), ne[i].blurb);
    }
    assert.ok(!/biggest/.test(ng[5].blurb));
    assert.ok(!/biggest/.test(ne[5].blurb));
  });

  it("breaks population ties by geonameid, deterministically", () => {
    const mk = () => [
      makePlace(0, 100, 10, "texas", "Texas"),
      makePlace(1, 100, 5, "texas", "Texas"),
      makePlace(2, 50, 1, "texas", "Texas"),
      makePlace(3, 40, 2, "texas", "Texas"),
      makePlace(4, 30, 3, "texas", "Texas"),
      makePlace(5, 20, 4, "texas", "Texas"),
    ];
    const opts = { topN: 2, minRegionPlaces: 5 };
    const a = mk(); applyTopRanks(a, opts);
    const b = mk(); applyTopRanks(b, opts);
    assert.deepEqual(a.map((p) => p.blurb), b.map((p) => p.blurb), "same inputs → identical blurbs");
    // Lower geonameid wins the tie: gid 5 beats gid 10.
    assert.ok(a[1].blurb.endsWith("It's one of Texas's biggest places."), a[1].blurb);
    assert.ok(a[0].blurb.endsWith("It's one of Texas's biggest places."), a[0].blurb);
    assert.ok(!/biggest/.test(a[2].blurb), a[2].blurb);
  });
});
