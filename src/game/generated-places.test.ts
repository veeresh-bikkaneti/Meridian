import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STARTERS } from "./starters.ts";
import {
  generatedStartersFor,
  placesFor,
  poolSizeFor,
  generatedPlaceCount,
  loadRegionChunk,
  startersFromChunk,
  clearChunkCacheForTests,
  aggregateChunkIds,
  applyFactIndex,
  GENERATED_SOURCE_LABEL,
  GENERATED_SOURCE_HREF,
  GLOBE_TIERS,
  loadGlobeTiers,
  loadedGlobeTiersForTests,
  mergeByGeonameId,
} from "./generated-places.ts";
import { asFameTier, filterByTier, tiersFor, TIER_BANDS, type PickerDifficulty } from "./tier-filter.ts";
import { resolveRunPool } from "./pool.ts";
import { createDealer, memorySeenStore, poolForNewRun } from "./trail.ts";
import { ADMIN1_BY_COUNTRY } from "./regions.ts";
import manifestJson from "./data/geonames/manifest.json" with { type: "json" };
import notableNotesJson from "./data/notable-notes.json" with { type: "json" };

const manifest = manifestJson as unknown as {
  meta: { total: number };
  regions: Record<string, { edition: "state" | "country" | "globe"; count: number; bytes: number }>;
};

test("GeoNames source label points at geonames.org", () => {
  assert.equal(GENERATED_SOURCE_LABEL, "GeoNames");
  assert.equal(GENERATED_SOURCE_HREF, "https://www.geonames.org/");
});

test("generatedPlaceCount is the manifest sum (no chunk loads)", () => {
  assert.equal(generatedPlaceCount(), 124690);
  assert.equal(generatedPlaceCount(), manifest.meta.total);
});

test("every manifest count matches its chunk's real contents", async () => {
  // Loads all 64 chunks through the real loader — the same code path the
  // game uses at region selection.
  const starterIds = new Set(STARTERS.map((s) => s.id));
  const seen = new Set<string>();
  for (const [regionId, region] of Object.entries(manifest.regions)) {
    const starters = await loadRegionChunk(regionId);
    assert.equal(
      starters.length,
      region.count,
      `${regionId}: manifest count ${region.count} !== loaded ${starters.length}`,
    );
    for (const s of starters) {
      assert.equal(s.edition, region.edition, `${s.id}: edition mismatch`);
      assert.equal(s.regionId, regionId, `${s.id}: regionId mismatch`);
      assert.ok(!seen.has(s.id), `duplicate generated id across chunks: ${s.id}`);
      seen.add(s.id);
      assert.ok(!starterIds.has(s.id), `generated id collides with a starter: ${s.id}`);
    }
  }
  assert.equal(seen.size, 124690);
});

test("loader returns Starter-shaped records with GeoNames attribution", async () => {
  const texas = await generatedStartersFor("state", "texas");
  assert.ok(texas.length > 0, "expected generated Texas places");
  assert.ok(
    texas.some((s) => s.name === "Houston"),
    "Houston should be in the Texas chunk",
  );
  for (const s of texas) {
    assert.equal(s.edition, "state");
    assert.equal(s.regionId, "texas");
    assert.ok(s.story && s.story.length > 0, `${s.id}: empty story`);
    // Notable places (e.g. Austin) carry a curated Wikipedia note.
    assert.ok(
      s.sourceLabel === GENERATED_SOURCE_LABEL || s.sourceLabel === "GeoNames · Wikipedia",
      `${s.id}: unexpected sourceLabel ${s.sourceLabel}`,
    );
    if (s.sourceLabel === "GeoNames · Wikipedia") {
      assert.ok(
        s.sourceHref.startsWith("https://en.wikipedia.org/wiki/"),
        `${s.id}: Wikipedia attribution must link the article`,
      );
    } else {
      assert.equal(s.sourceHref, GENERATED_SOURCE_HREF);
    }
  }
  // Vermont has generated depth in the GeoNames dataset (F6b had none).
  const vermont = await generatedStartersFor("state", "vermont");
  assert.ok(vermont.length > 0, "expected generated Vermont places");
  // DC places (not a state) land in the US country pool.
  const usCountry = await generatedStartersFor("country", "united-states");
  assert.ok(usCountry.length > 0, "expected District of Columbia places in the united-states pool");
  for (const s of usCountry) {
    assert.equal(s.edition, "country");
    assert.equal(s.regionId, "united-states");
  }
});

test("notable capitals get Wikipedia-sourced memorable notes", async () => {
  const texas = await generatedStartersFor("state", "texas");
  const austin = texas.find((s) => s.name === "Austin");
  assert.ok(austin, "Austin should be in the Texas chunk");
  assert.equal(austin.sourceLabel, "GeoNames · Wikipedia");
  assert.equal(austin.sourceHref, "https://en.wikipedia.org/wiki/Austin,_Texas");
  assert.ok(austin.story.includes("the capital of Texas"), "capital lead missing");
  assert.ok(austin.story.includes("Stephen F. Austin"), "notable note missing");
  // A non-notable place keeps the plain GeoNames attribution and the new
  // geographic blurb shape (cardinal + town/city, no "populated place").
  const brandonTx = texas.find((s) => s.name === "Brandon");
  if (brandonTx) {
    assert.equal(brandonTx.sourceLabel, GENERATED_SOURCE_LABEL);
    assert.ok(!brandonTx.story.includes("populated place"), "generic phrasing survived");
  }
});

test("sports cities get a Big-5 home-teams line in the blurb", async () => {
  const wisconsin = await generatedStartersFor("state", "wisconsin");
  const greenBay = wisconsin.find((s) => s.name === "Green Bay");
  assert.ok(greenBay, "Green Bay should be in the Wisconsin chunk");
  assert.ok(
    greenBay.story.includes("Home of the Green Bay Packers (NFL)."),
    `sports line missing: ${greenBay.story}`,
  );
  // Multi-team city lists teams across leagues, NFL first.
  const newYork = await generatedStartersFor("state", "new-york");
  const nyc = newYork.find((s) => s.name === "New York City");
  assert.ok(nyc, "New York City should be in the New York chunk");
  assert.ok(nyc.story.includes("New York Giants (NFL)"), "Giants missing");
  assert.ok(nyc.story.includes("New York Yankees (MLB)"), "Yankees missing");
  assert.ok(nyc.story.includes("New York Knicks (NBA)"), "Knicks missing");
  assert.ok(nyc.story.includes("New York Rangers (NHL)"), "Rangers missing");
  // A town with no Big-5 team gets no sports filler.
  const sd = await generatedStartersFor("state", "south-dakota");
  const brandon = sd.find((s) => s.name === "Brandon");
  assert.ok(brandon, "Brandon should be in the South Dakota chunk");
  assert.ok(!brandon.story.includes("Home of the"), "sports filler on a team-less town");
});

test("history notes: curated history-first notes render for historic cities", async () => {
  // Representative sample across the crew A/B batches; full per-city
  // source audits live in history-sources-a.md / history-sources-b.md.
  const cases = [
    { country: "italy", name: "Rome", marker: "Eternal City" }, // crew A batch
    { country: "japan", name: "Kyoto", marker: "imperial capital" }, // crew B batch
    { country: "egypt", name: "Cairo", marker: "Fatimid" }, // crew A batch
    { country: "india", name: "Delhi", marker: "Mughal" }, // crew B batch
  ];
  for (const c of cases) {
    const starters = await generatedStartersFor("country", c.country);
    const place = starters.find((s) => s.name === c.name);
    assert.ok(place, `${c.name} should be in the ${c.country} chunk`);
    assert.ok(
      place.story.includes(c.marker),
      `${c.name} story should include its history note (marker: ${c.marker})`,
    );
    assert.equal(place.sourceLabel, "GeoNames · Wikipedia");
  }
  // Cusco lives in the globe chunk (no Peru-specific chunk).
  const globe = await generatedStartersFor("globe", "globe");
  const cusco = globe.find((s) => s.name === "Cusco");
  assert.ok(cusco, "Cusco should be in the globe chunk");
  assert.ok(cusco.story.includes("Inca"), "Cusco story should include its history note");
  assert.equal(cusco.sourceLabel, "GeoNames · Wikipedia");
});

test("historic places get curated history-first notes (Hyderabad pilot)", async () => {
  const india = await generatedStartersFor("country", "india");
  const hyderabad = india.find((s) => s.name === "Hyderabad");
  assert.ok(hyderabad, "Hyderabad should be in the India chunk");
  assert.equal(hyderabad.sourceLabel, "GeoNames · Wikipedia");
  assert.equal(hyderabad.sourceHref, "https://en.wikipedia.org/wiki/Hyderabad");
  // History before modern identity: Golconda + Charminar, then HITEC + Ramoji.
  assert.ok(hyderabad.story.includes("Golconda"), "Golconda missing");
  assert.ok(hyderabad.story.includes("Charminar"), "Charminar missing");
  assert.ok(hyderabad.story.includes("HITEC City"), "HITEC City missing");
  assert.ok(hyderabad.story.includes("Ramoji Film City"), "Ramoji missing");
});

test("placesFor is curated-first: curated starters, then generated depth", async () => {
  const curatedTexas = STARTERS.filter((s) => s.edition === "state" && s.regionId === "texas");
  const pool = await placesFor("state", "texas");
  assert.ok(curatedTexas.length > 0, "expected curated Texas starters");
  assert.ok(pool.length > curatedTexas.length, "pool should be deeper than the curated set alone");
  assert.deepEqual(
    pool.slice(0, curatedTexas.length).map((p) => p.id),
    curatedTexas.map((p) => p.id),
    "curated starters must lead the pool",
  );
  const curatedIds = new Set(curatedTexas.map((p) => p.id));
  for (const p of pool.slice(curatedTexas.length)) {
    assert.ok(!curatedIds.has(p.id), `curated place ${p.id} appears twice`);
  }
});

test("poolSizeFor (manifest picker count) equals the real pool size", async () => {
  for (const [edition, regionId] of [
    ["state", "texas"],
    ["state", "vermont"],
    ["country", "united-states"],
    ["globe", "globe"],
  ] as const) {
    const pool = await placesFor(edition, regionId);
    assert.equal(
      poolSizeFor(edition, regionId),
      pool.length,
      `${edition}/${regionId}: picker count must equal the dealt pool size`,
    );
  }
});

test("chunk loads are cached per region", async () => {
  clearChunkCacheForTests();
  const first = await loadRegionChunk("texas");
  const second = await loadRegionChunk("texas");
  assert.equal(first, second, "second load should hit the cache");
  clearChunkCacheForTests();
  const third = await loadRegionChunk("texas");
  assert.notEqual(first, third, "cache clear should force a fresh load");
  assert.deepEqual(
    third.map((s) => s.id),
    first.map((s) => s.id),
    "fresh load must produce identical contents",
  );
});

test("loading an unknown region fails closed without fetching", async () => {
  await assert.rejects(
    loadRegionChunk("no-such-region"),
    /unknown GeoNames region/,
    "unknown region must reject",
  );
  await assert.rejects(
    loadRegionChunk("../../package"),
    /unknown GeoNames region/,
    "path traversal must reject before any fetch",
  );
  await assert.rejects(
    generatedStartersFor("state", "no-such-region"),
    /unknown GeoNames region/,
  );
  await assert.rejects(placesFor("state", "no-such-region"), /unknown GeoNames region/);
});

test("a single malformed record rejects the whole chunk (fail-closed)", () => {
  const good = {
    id: "gn-1",
    name: "Goodville",
    lon: 10,
    lat: 50,
    blurb: "Goodville is a city in Nowhere.",
    iso2: "DE",
    edition: "country",
    regionId: "germany",
  };
  const chunkFor = (places: unknown[]) => ({
    meta: { regionId: "germany", edition: "country", count: places.length },
    places,
  });

  // A clean chunk validates.
  assert.equal(startersFromChunk("germany", chunkFor([good])).length, 1);

  // One bad record anywhere poisons the chunk.
  const badEdition = { ...good, id: "gn-2", edition: "globe" };
  assert.throws(() => startersFromChunk("germany", chunkFor([good, badEdition])), /edition/);
  const badRegion = { ...good, id: "gn-3", regionId: "france" };
  assert.throws(() => startersFromChunk("germany", chunkFor([badRegion])), /regionId/);
  const badCoords = { ...good, id: "gn-4", lat: Number.NaN };
  assert.throws(() => startersFromChunk("germany", chunkFor([badCoords])), /coordinates/);
  const badId = { ...good, id: "" };
  assert.throws(() => startersFromChunk("germany", chunkFor([badId])), /invalid id/);

  // Truncated or mislabeled chunks reject too.
  assert.throws(
    () => startersFromChunk("germany", { meta: { regionId: "germany", edition: "country", count: 5 }, places: [good] }),
    /truncated/,
  );
  assert.throws(
    () => startersFromChunk("germany", { meta: { regionId: "france", edition: "country", count: 1 }, places: [good] }),
    /meta\.regionId mismatch/,
  );
});

test("history notes: crew C batch (US non-capitals, India, UK) is audited and keyed to real chunk places", async () => {
  // Crew C curated 12 Wikipedia-audited notes (claim-by-claim audit in
  // history-sources-c.md). Notes merge into chunk blurbs at dataset build
  // time (scripts/build-geonames-dataset.mjs); this test pins the merge
  // key — geonameid → the named place in the region chunk — so a future
  // rebuild lands every note on the right place.
  const notable = notableNotesJson as unknown as Record<
    string,
    { note: string; wiki: string }
  >;
  const cases = [
    { id: "5128581", name: "New York City", edition: "state", region: "new-york", marker: "Duke of York", wiki: "New_York_City" },
    { id: "4887398", name: "Chicago", edition: "state", region: "illinois", marker: "BACKWARD", wiki: "Chicago" },
    { id: "5368361", name: "Los Angeles", edition: "state", region: "california", marker: "world capital of film", wiki: "Los_Angeles" },
    { id: "5391959", name: "San Francisco", edition: "state", region: "california", marker: "three-quarters", wiki: "San_Francisco" },
    { id: "4335045", name: "New Orleans", edition: "state", region: "louisiana", marker: "Congo Square", wiki: "New_Orleans" },
    { id: "4164138", name: "Miami", edition: "state", region: "florida", marker: "mother of Miami", wiki: "Miami" },
    { id: "1275339", name: "Mumbai", edition: "country", region: "india", marker: "wedding dowry", wiki: "Mumbai" },
    { id: "1269515", name: "Jaipur", edition: "country", region: "india", marker: "Pink City", wiki: "Jaipur" },
    { id: "1279259", name: "Agra", edition: "country", region: "india", marker: "Mumtaz Mahal", wiki: "Agra" },
    { id: "2650225", name: "Edinburgh", edition: "country", region: "united-kingdom", marker: "Athens of the North", wiki: "Edinburgh" },
    { id: "2643123", name: "Manchester", edition: "country", region: "united-kingdom", marker: "Cottonopolis", wiki: "Manchester" },
    { id: "2640729", name: "Oxford", edition: "country", region: "united-kingdom", marker: "ford of the oxen", wiki: "Oxford" },
  ] as const;
  assert.equal(cases.length, 12);
  for (const c of cases) {
    const entry = notable[c.id];
    assert.ok(entry, `notable-notes.json missing crew C entry for ${c.name} (${c.id})`);
    assert.equal(typeof entry.note, "string", `${c.id}: note must be a string`);
    assert.ok(entry.note.length > 0, `${c.id}: empty note`);
    assert.equal(entry.wiki, c.wiki, `${c.id}: wiki slug mismatch`);
    assert.ok(
      entry.note.includes(c.marker),
      `${c.id}: note should include its audited hook (marker: ${c.marker})`,
    );
    const starters = await generatedStartersFor(c.edition, c.region);
    const place = starters.find((s) => s.id === `gn-${c.id}`);
    assert.ok(place, `gn-${c.id} should exist in the ${c.region} chunk`);
    assert.equal(
      place.name,
      c.name,
      `gn-${c.id} resolves to "${place.name}", not ${c.name} — note would land on the wrong place`,
    );
  }
});

test("Barry Farms gets the approved kid-friendly history note", async () => {
  // The before/after sample Veeresh approved ("love the kid-friendly
  // rewrite; lets build that"). Audit: history-sources-c.md; merge key
  // geonameid 4137672 → gn-4137672 in the united-states country chunk.
  const notable = notableNotesJson as unknown as Record<
    string,
    { note: string; wiki: string }
  >;
  const entry = notable["4137672"];
  assert.ok(entry, "notable-notes.json missing the Barry Farms entry (4137672)");
  assert.equal(entry.wiki, "Barry_Farm", "wiki slug mismatch");
  assert.ok(entry.note.includes("Land! Give us land!"), "approved hook missing");
  assert.ok(entry.note.includes("1867"), "purchase year missing");
  assert.ok(entry.note.includes("375-acre"), "farm size missing");
  assert.ok(entry.note.includes("one-acre"), "one-acre plots missing");
  assert.ok(entry.note.includes("Marion Barry"), "name-twist hook missing");
  const usCountry = await generatedStartersFor("country", "united-states");
  const barry = usCountry.find((s) => s.id === "gn-4137672");
  assert.ok(barry, "gn-4137672 should exist in the united-states chunk");
  assert.equal(barry.name, "Barry Farms", "note would land on the wrong place");
  assert.equal(barry.sourceLabel, "GeoNames · Wikipedia");
  assert.equal(barry.sourceHref, "https://en.wikipedia.org/wiki/Barry_Farm");
  assert.ok(
    barry.story.includes("Land! Give us land!"),
    "curated note missing from the shipped story",
  );
  // Rule 1 (history first): the curated note leads the card; the plain
  // geographic blurb follows. The note must not be duplicated.
  assert.ok(
    barry.story.startsWith(entry.note),
    "history note should lead the card (rule 1: history first, geography second)",
  );
  assert.ok(
    barry.story.includes("Barry Farms is a town in eastern District of Columbia"),
    "geographic blurb should follow the history note",
  );
  assert.equal(
    barry.story.split(entry.note).length - 1,
    1,
    "curated note must appear exactly once (no embedded duplication)",
  );
});

test("whole-US pool aggregates all 50 state datasets, not just the DC chunk", async () => {
  const pool = await placesFor("country", "united-states");
  const curatedUS = STARTERS.filter((s) => s.edition === "country" && s.regionId === "united-states");
  const expectedGenerated = Object.entries(manifest.regions)
    .filter(([id, r]) => id === "united-states" || r.edition === "state")
    .reduce((n, [, r]) => n + r.count, 0);
  assert.equal(
    pool.length,
    curatedUS.length + expectedGenerated,
    `whole-US pool should be curated (${curatedUS.length}) + US chunk + 50 states (${expectedGenerated})`,
  );
  assert.ok(pool.length > 14000, `whole-US pool should be national-scale, got ${pool.length}`);

  // Fail-closed dealing contract: every place claims the selected region.
  for (const p of pool) {
    assert.equal(p.edition, "country", `${p.id}: edition must be country`);
    assert.equal(p.regionId, "united-states", `${p.id}: regionId must be united-states`);
  }
  // No duplicate ids — the no-repeat guarantee survives aggregation.
  assert.equal(new Set(pool.map((p) => p.id)).size, pool.length, "duplicate ids in whole-US pool");

  // Genuinely national: places from far-apart states, not just DC.
  const texas = await generatedStartersFor("state", "texas");
  const california = await generatedStartersFor("state", "california");
  const poolIds = new Set(pool.map((p) => p.id));
  assert.ok(poolIds.has(texas[0].id), "expected a Texas place in the whole-US pool");
  assert.ok(poolIds.has(california[0].id), "expected a California place in the whole-US pool");

  // Curated national features still lead the pool (approach C: curated-first).
  assert.deepEqual(
    pool.slice(0, curatedUS.length).map((p) => p.id),
    curatedUS.map((p) => p.id),
    "curated US starters must lead the whole-US pool",
  );

  // Re-tagged places keep their identity: coordinates still match the
  // claimed location (Hyderabad rule) — only the region label widened.
  const houston = texas.find((s) => s.name === "Houston");
  assert.ok(houston, "expected Houston in the Texas chunk");
  const houstonInPool = pool.find((p) => p.id === houston.id);
  assert.ok(houstonInPool, "expected Houston in the whole-US pool");
  assert.equal(houstonInPool.lon, houston.lon);
  assert.equal(houstonInPool.lat, houston.lat);
  assert.equal(houstonInPool.name, houston.name);
  // The native state survives as a display-only origin so UI labels keep
  // state-level disambiguation after the dealing re-tag.
  assert.equal(houstonInPool.originRegionId, "texas");
  // Country-chunk places (curated national features lead the pool) carry
  // no origin — they were never re-tagged.
  for (const p of pool.slice(0, curatedUS.length)) {
    assert.equal(p.originRegionId, undefined, `${p.id}: country-chunk place should carry no origin`);
  }
});

test("whole-country aggregation wiring is fail-closed and non-US regions are untouched", () => {
  const usChunks = aggregateChunkIds("country", "united-states");
  // The country's own chunk plus one chunk per drill-down subdivision.
  assert.equal(usChunks[0], "united-states");
  assert.deepEqual(
    usChunks.slice(1),
    ADMIN1_BY_COUNTRY["united-states"].map((s) => s.id),
    "aggregation must follow the picker's drill-down list",
  );
  for (const id of usChunks) {
    assert.ok(
      Object.hasOwn(manifest.regions, id),
      `aggregated chunk missing from manifest (would fail closed at load): ${id}`,
    );
  }
  // No other edition/region aggregates — their pools are byte-identical.
  assert.deepEqual(aggregateChunkIds("state", "texas"), ["texas"]);
  assert.deepEqual(aggregateChunkIds("state", "united-states"), ["united-states"]);
  assert.deepEqual(aggregateChunkIds("country", "canada"), ["canada"]);
  assert.deepEqual(aggregateChunkIds("country", "india"), ["india"]);
  assert.deepEqual(aggregateChunkIds("globe", "globe"), ["globe"]);
});

test("poolSizeFor counts the aggregated whole-US pool (picker gate stays honest)", async () => {
  const pool = await placesFor("country", "united-states");
  assert.equal(
    poolSizeFor("country", "united-states"),
    pool.length,
    "picker count must equal the aggregated whole-US pool size",
  );
  // Unaffected regions still agree.
  assert.equal(poolSizeFor("state", "texas"), (await placesFor("state", "texas")).length);
  assert.equal(poolSizeFor("country", "canada"), (await placesFor("country", "canada")).length);
});

test("history hook sentence leads the card (rule 1: history first)", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-1",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        history: "The town is named after a railroad official's daughter.",
        wiki: "Edna,_Texas",
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [s] = startersFromChunk("texas", chunk);
  assert.equal(
    s.story,
    "The town is named after a railroad official's daughter. Edna is a county seat in southeastern Texas, the United States.",
  );
  assert.equal(s.sourceLabel, "GeoNames · Wikipedia");
  assert.equal(s.sourceHref, "https://en.wikipedia.org/wiki/Edna,_Texas");
});

test("places without history keep the plain blurb card", () => {  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-2",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [s] = startersFromChunk("texas", chunk);
  assert.equal(s.story, "Edna is a county seat in southeastern Texas, the United States.");
  assert.equal(s.sourceLabel, "GeoNames");
});

test("fact-ladder fact leads the card and outranks history (card rule 1)", () => {
  const fact = {
    text: "Named for President Abraham Lincoln, who practiced law here before the White House.",
    kind: "wikidata",
    source: "Wikidata",
    qid: "Q123",
  };
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-4",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        history: "The town is named after a railroad official's daughter.",
        wiki: "Edna,_Texas",
        fact,
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [s] = startersFromChunk("texas", chunk);
  assert.ok(
    s.story.startsWith(fact.text),
    `fact must lead the card, got: ${s.story.slice(0, 80)}…`,
  );
  assert.equal(s.fact, fact.text, "fact text travels on the Starter for the AI fallback");
  assert.equal(s.history, "The town is named after a railroad official's daughter.");
});

test("plain-string fact is tolerated and leads the card", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-5",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        fact: "Founded in 1882 as a railroad town, it never grew beyond its depot dreams.",
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [s] = startersFromChunk("texas", chunk);
  assert.ok(s.story.startsWith("Founded in 1882"));
});

test("hookMissing marker is accepted (pipeline truth signal, not corruption)", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-6",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        hookMissing: true,
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [s] = startersFromChunk("texas", chunk);
  assert.equal(s.story, "Edna is a county seat in southeastern Texas, the United States.");
});

test("assertValidRecord rejects corrupt fact hooks fail-closed", () => {
  const base = {
    id: "gn-7",
    name: "Edna",
    lon: -96.6,
    lat: 28.9,
    blurb: "Edna is a county seat in southeastern Texas, the United States.",
    iso2: "US",
    edition: "state",
    regionId: "texas",
  };
  assert.throws(
    () => startersFromChunk("texas", { meta: { regionId: "texas", edition: "state", count: 1 }, places: [{ ...base, fact: { kind: "wikidata" } }] }),
    /invalid fact hook/,
  );
  assert.throws(
    () => startersFromChunk("texas", { meta: { regionId: "texas", edition: "state", count: 1 }, places: [{ ...base, hookMissing: "yes" }] }),
    /invalid hookMissing marker/,
  );
});

test("assertValidRecord rejects corrupt history sentences fail-closed", () => {
  const base = {
    id: "gn-3",
    name: "Edna",
    lon: -96.6,
    lat: 28.9,
    blurb: "Edna is a county seat in southeastern Texas, the United States.",
    wiki: "Edna,_Texas",
    iso2: "US",
    edition: "state",
    regionId: "texas",
  };
  const bad = [
    { ...base, history: "too short." },
    { ...base, history: "x".repeat(241) },
    { ...base, history: "No terminal punctuation here and it is long enough to pass length" },
    { ...base, history: "It sits at 35° north and has a long enough sentence here." },
    { ...base, history: "Its elevation is 500 meters and this sentence is long enough." },
  ];
  for (const place of bad) {
    assert.throws(
      () => startersFromChunk("texas", { meta: { regionId: "texas", edition: "state", count: 1 }, places: [place] }),
      /invalid history/,
    );
  }
});

test("history without a wiki slug is rejected (attribution pairing)", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-9",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        history: "The town is named after a railroad official's daughter.",
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  assert.throws(() => startersFromChunk("texas", chunk), /invalid history hook sentence/);
});
test("toStarter prefers the stamped difficulty, backfills 3 for missing/invalid", () => {
  // Difficulty tiers (dataset crew): the build script stamps an integer 1–5
  // on every chunk record. toStarter must prefer it and backfill medium (3)
  // for anything missing or hand-edited — a bad value must never poison the
  // v3 multiplier.
  const base = {
    name: "Tierville",
    lon: 10,
    lat: 50,
    blurb: "Tierville is a city in Nowhere.",
    iso2: "DE",
    edition: "country",
    regionId: "germany",
  };
  const chunkFor = (places: unknown[]) => ({
    meta: { regionId: "germany", edition: "country", count: places.length },
    places,
  });
  const records = [
    { ...base, id: "gn-t1", difficulty: 1 },
    { ...base, id: "gn-t2", difficulty: 2 },
    { ...base, id: "gn-t4", difficulty: 4 },
    { ...base, id: "gn-t5", difficulty: 5 },
    { ...base, id: "gn-missing" },
    { ...base, id: "gn-zero", difficulty: 0 },
    { ...base, id: "gn-six", difficulty: 6 },
    { ...base, id: "gn-float", difficulty: 2.5 },
    { ...base, id: "gn-string", difficulty: "3" },
    { ...base, id: "gn-null", difficulty: null },
  ];
  const starters = startersFromChunk("germany", chunkFor(records));
  const byId = new Map(starters.map((s) => [s.id, s]));
  // Stamped integers 1–5 survive untouched.
  assert.equal(byId.get("gn-t1")?.difficulty, 1);
  assert.equal(byId.get("gn-t2")?.difficulty, 2);
  assert.equal(byId.get("gn-t4")?.difficulty, 4);
  assert.equal(byId.get("gn-t5")?.difficulty, 5);
  // Missing or invalid backfills to medium (3) — back-compat for legacy
  // chunks and hand-edited records.
  for (const id of ["gn-missing", "gn-zero", "gn-six", "gn-float", "gn-string", "gn-null"]) {
    assert.equal(byId.get(id)?.difficulty, 3, `${id} must backfill to 3`);
  }
});
test("toStarter passes through a valid subdivision, drops missing/invalid", () => {
  // Subdivision (dataset crew): the pipeline stamps the resolved admin1
  // display name ("Nebraska", "Madhya Pradesh") for the PR #38 label rules.
  // toStarter must pass a non-empty string through and drop anything else —
  // absent means unknown, and question-label.ts fails closed to the bare
  // place name.
  const base = {
    name: "Sagar",
    lon: 78.78,
    lat: 23.84,
    blurb: "Sagar is a city in central Madhya Pradesh, India.",
    iso2: "IN",
    edition: "country",
    regionId: "india",
  };
  const chunkFor = (places: unknown[]) => ({
    meta: { regionId: "india", edition: "country", count: places.length },
    places,
  });
  const records = [
    { ...base, id: "gn-s1", subdivision: "Madhya Pradesh" },
    { ...base, id: "gn-s2" },
    { ...base, id: "gn-s3", subdivision: "" },
    { ...base, id: "gn-s4", subdivision: "   " },
    { ...base, id: "gn-s5", subdivision: 42 },
    { ...base, id: "gn-s6", subdivision: null },
  ];
  const starters = startersFromChunk("india", chunkFor(records));
  const byId = new Map(starters.map((s) => [s.id, s]));
  assert.equal(byId.get("gn-s1")?.subdivision, "Madhya Pradesh");
  for (const id of ["gn-s2", "gn-s3", "gn-s4", "gn-s5", "gn-s6"]) {
    assert.equal(
      byId.get(id)?.subdivision,
      undefined,
      `${id}: invalid subdivision must be dropped`,
    );
  }
});
test("merged fact leads the card (fact-first ladder precedence)", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-10",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        history: "The town is named after a railroad official's daughter.",
        wiki: "Edna,_Texas",
        fact: {
          text: "Founded in 1882 and named after Edna, the railroad official's daughter.",
          kind: "wikitext",
          source: "Wikipedia",
        },
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [s] = startersFromChunk("texas", chunk);
  // The ladder's merged fact outranks the legacy history hook.
  assert.equal(
    s.story,
    "Founded in 1882 and named after Edna, the railroad official's daughter. Edna is a county seat in southeastern Texas, the United States.",
  );
  assert.equal(s.sourceLabel, "GeoNames · Wikipedia");
  assert.equal(s.sourceHref, "https://en.wikipedia.org/wiki/Edna,_Texas");
});

test("fact source attribution per kind", () => {
  const mkChunk = (fact: {
    text: string;
    kind: "wikidata" | "wikitext" | "eb1911" | "hook";
    source: string;
    qid?: string;
    href?: string;
  }) => ({
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-11",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        wiki: "Edna,_Texas",
        fact,
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  });
  const [wd] = startersFromChunk(
    "texas",
    mkChunk({ text: "Named after King Louis XVI of France.", kind: "wikidata", source: "Wikidata", qid: "Q7732" }),
  );
  assert.equal(wd.sourceLabel, "Wikidata");
  assert.equal(wd.sourceHref, "https://www.wikidata.org/wiki/Q7732");
  assert.ok(wd.story.startsWith("Named after King Louis XVI of France."));

  const [eb] = startersFromChunk(
    "texas",
    mkChunk({
      text: "The town was founded in 1204 by King John in this long sentence.",
      kind: "eb1911",
      source: "EB1911",
      href: "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Edna",
    }),
  );
  assert.equal(eb.sourceLabel, "EB1911");
  assert.equal(eb.sourceHref, "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Edna");

  const [hk] = startersFromChunk(
    "texas",
    mkChunk({ text: "The town is named after a railroad official's daughter.", kind: "hook", source: "Wikipedia" }),
  );
  assert.equal(hk.sourceLabel, "GeoNames · Wikipedia");
  assert.equal(hk.sourceHref, "https://en.wikipedia.org/wiki/Edna,_Texas");
});

test("invalid fact fields are rejected fail-closed", () => {
  const base = {
    id: "gn-12",
    name: "Edna",
    lon: -96.6,
    lat: 28.9,
    blurb: "Edna is a county seat in southeastern Texas, the United States.",
    wiki: "Edna,_Texas",
    iso2: "US",
    edition: "state",
    regionId: "texas",
  };
  const mk = (fact: unknown, wiki: string | null = "Edna,_Texas") => {
    const place: Record<string, unknown> = { ...base, fact };
    if (wiki !== null) place.wiki = wiki;
    else delete place.wiki;
    return startersFromChunk("texas", {
      meta: { regionId: "texas", edition: "state", count: 1 },
      places: [place],
    })[0];
  };
  // Too short to be a hook: assertValidRecord rejects the record fail-closed.
  // The build-time gate (scripts/check-generated-places.mjs) catches these
  // before they ship; the runtime never sails a bad fact through.
  assert.throws(
    () => mk({ text: "too short.", kind: "hook", source: "Wikipedia" }),
    /invalid fact hook/,
  );
  // Over-long / unpunctuated facts: the runtime validator only gates text
  // length >= 20; shape strictness lives in the build-time gate.
  const long = mk({ text: "x".repeat(241), kind: "hook", source: "Wikipedia" });
  assert.equal(long.fact, "x".repeat(241));
  const nopunct = mk({ text: "No terminal punctuation here and it is long enough", kind: "hook", source: "Wikipedia" });
  assert.equal(nopunct.fact, "No terminal punctuation here and it is long enough");
  // Bad kind / missing qid / bad qid / missing href: text extracted, but
  // per-kind attribution falls back to the default Wikipedia credit.
  const badKind = mk({ text: "Named after King Louis XVI of France.", kind: "bogus", source: "Wikidata" });
  assert.equal(badKind.fact, "Named after King Louis XVI of France.");
  assert.equal(badKind.sourceLabel, "GeoNames · Wikipedia");
  const noQid = mk({ text: "Named after King Louis XVI of France.", kind: "wikidata", source: "Wikidata" });
  assert.equal(noQid.sourceLabel, "GeoNames · Wikipedia");
  const badQid = mk({ text: "Named after King Louis XVI of France.", kind: "wikidata", source: "Wikidata", qid: "not-a-qid" });
  assert.equal(badQid.sourceLabel, "GeoNames · Wikipedia");
  const noHref = mk({ text: "The town was founded in 1204 by King John here today.", kind: "eb1911", source: "EB1911" });
  assert.equal(noHref.sourceLabel, "GeoNames · Wikipedia");
  // Wikipedia-sourced fact without the wiki slug: same fallback.
  const noWiki = mk(
    { text: "Named after King Louis XVI of France here.", kind: "wikitext", source: "Wikipedia" },
    null,
  );
  assert.equal(noWiki.sourceHref, "https://www.geonames.org/");
});

test("places without a fact keep current behavior (blurb or history hook)", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 2 },
    places: [
      {
        id: "gn-13",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
      {
        id: "gn-14",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        history: "The town is named after a railroad official's daughter.",
        wiki: "Edna,_Texas",
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [plain, hooked] = startersFromChunk("texas", chunk);
  assert.equal(plain.story, "Edna is a county seat in southeastern Texas, the United States.");
  assert.equal(plain.sourceLabel, "GeoNames");
  assert.ok(hooked.story.startsWith("The town is named after a railroad official's daughter."));
});

test("wikitext fact without a chunk wiki slug attributes via its own article href", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 1 },
    places: [
      {
        id: "gn-15",
        name: "Edna",
        lon: -96.6,
        lat: 28.9,
        blurb: "Edna is a county seat in southeastern Texas, the United States.",
        fact: {
          text: "The town was named after explorer X in this sentence here.",
          kind: "wikitext",
          source: "Wikipedia",
          href: "https://en.wikipedia.org/wiki/Some_Town",
        },
        iso2: "US",
        edition: "state",
        regionId: "texas",
      },
    ],
  };
  const [s] = startersFromChunk("texas", chunk);
  assert.ok(s.story.startsWith("The town was named after explorer X"));
  assert.equal(s.sourceLabel, "GeoNames · Wikipedia");
  assert.equal(s.sourceHref, "https://en.wikipedia.org/wiki/Some_Town");
});

// ---------------------------------------------------------------------------
// Derived fact indexes (applyFactIndex + loadRegionChunk overlay)
// ---------------------------------------------------------------------------

test("applyFactIndex: attaches facts and clears hookMissing", () => {
  const chunk = {
    meta: { regionId: "texas", edition: "state", count: 2 },
    places: [
      { id: "gn-1", name: "A", hookMissing: true },
      { id: "gn-2", name: "B", hookMissing: true },
    ],
  };
  const index = {
    regionId: "texas",
    facts: {
      "gn-1": { text: "Named after someone famous here.", kind: "wikidata", source: "Wikidata", qid: "Q1" },
    },
  };
  const out = applyFactIndex(chunk, index, "texas");
  assert.deepEqual(out.places[0].fact, index.facts["gn-1"]);
  assert.equal("hookMissing" in out.places[0], false);
  // Untouched place keeps its marker.
  assert.equal(out.places[1].hookMissing, true);
  assert.equal("fact" in out.places[1], false);
  // Input chunk not mutated.
  assert.equal("fact" in chunk.places[0], false);
});

test("applyFactIndex: null index returns the chunk unchanged", () => {
  const chunk = { places: [{ id: "gn-1" }] };
  assert.equal(applyFactIndex(chunk, null, "texas"), chunk);
  assert.equal(applyFactIndex(chunk, undefined, "texas"), chunk);
});

test("applyFactIndex: regionId mismatch fails closed", () => {
  assert.throws(
    () => applyFactIndex({ places: [] }, { regionId: "nope", facts: {} }, "texas"),
    /regionId/,
  );
});

test("applyFactIndex: malformed facts fails closed", () => {
  assert.throws(
    () => applyFactIndex({ places: [] }, { regionId: "texas", facts: [] }, "texas"),
    /facts is not an object/,
  );
});

test("loadRegionChunk overlays the derived arkansas fact index", async () => {
  clearChunkCacheForTests();
  const starters = await loadRegionChunk("arkansas");
  assert.equal(starters.length, 177);
  const withFact = starters.filter((s) => typeof s.fact === "string" && s.fact.length > 0);
  assert.equal(withFact.length, 20); // pilot derived index
  // Spot-check: a wikidata fact links its entity.
  const wikidata = withFact.find((s) => s.sourceLabel === "Wikidata");
  assert.ok(wikidata);
  assert.match(wikidata.sourceHref, /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/);
});

test("loadRegionChunk works with no fact index (alabama)", async () => {
  clearChunkCacheForTests();
  const starters = await loadRegionChunk("alabama");
  assert.ok(starters.length > 0);
});

// ---------------------------------------------------------------------------
// Globe tier split (perf Task 2): the Easy path must not download or parse
// tiers 3–5, and splitting must change nothing about WHAT is dealt or the
// ORDER it is dealt in.
// ---------------------------------------------------------------------------

const GEONAMES_DIR = new URL("./data/geonames/", import.meta.url);
const readJson = (rel: string) => JSON.parse(readFileSync(new URL(rel, GEONAMES_DIR), "utf8"));
const CHOICES: PickerDifficulty[] = ["easy", "medium", "hard"];

interface RawPlace {
  id: string;
  difficulty?: unknown;
}

/** The pre-split behavior, computed straight from the canonical file: the band filter over file order. */
function legacyBandIds(choice: PickerDifficulty): string[] {
  const band = TIER_BANDS[choice];
  const places = (readJson("chunks/globe.json") as { places: RawPlace[] }).places;
  return places
    .filter((p) => {
      const tier = asFameTier(p.difficulty);
      return band.some(([lo, hi]) => tier >= lo && tier <= hi);
    })
    .map((p) => p.id);
}

test("globe tiers: the tier files are exactly the canonical set — same ids, count, order, records", () => {
  const canonical = (readJson("chunks/globe.json") as { places: RawPlace[] }).places;
  assert.equal(canonical.length, 59423);
  const tierChunks = GLOBE_TIERS.map(
    (t) => readJson(`tiers/globe-t${t}.json`) as { meta: { tier: number; count: number }; places: RawPlace[] },
  );
  let total = 0;
  for (const [i, chunk] of tierChunks.entries()) {
    assert.equal(chunk.meta.tier, GLOBE_TIERS[i]);
    assert.equal(chunk.meta.count, chunk.places.length);
    for (const p of chunk.places) assert.equal(asFameTier(p.difficulty), GLOBE_TIERS[i], `${p.id} filed in wrong tier`);
    total += chunk.places.length;
  }
  assert.equal(total, 59423);
  assert.equal(total, manifest.regions.globe.count);
  // Merge by numeric id and compare record-for-record with the canonical file.
  const merged = tierChunks
    .flatMap((c) => c.places)
    .sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)));
  assert.deepEqual(merged, canonical);
  assert.equal(new Set(merged.map((p) => p.id)).size, 59423);
});

test("globe tiers: loading all tiers equals the canonical chunk (loadRegionChunk('globe'))", async () => {
  clearChunkCacheForTests();
  const all = await loadRegionChunk("globe");
  const canonicalIds = (readJson("chunks/globe.json") as { places: RawPlace[] }).places.map((p) => p.id);
  assert.deepEqual(all.map((s) => s.id), canonicalIds);
  assert.equal(all.length, manifest.regions.globe.count);
  assert.deepEqual((await loadGlobeTiers(GLOBE_TIERS)).map((s) => s.id), canonicalIds);
});

test("globe tiers: each learning path's pool equals the previous filter result, in the same order", async () => {
  for (const choice of CHOICES) {
    clearChunkCacheForTests();
    const tiers = tiersFor(choice);
    const loaded = await loadGlobeTiers(tiers);
    const legacy = legacyBandIds(choice);
    assert.deepEqual(loaded.map((s) => s.id), legacy, `${choice}: loaded tiers differ from legacy filter`);
    // ...and the app's own filter over what was loaded keeps all of it.
    assert.deepEqual(filterByTier(loaded, choice).map((s) => s.id), legacy);
    // ...and over the FULL globe gives the same set (what the old code did).
    const full = await loadRegionChunk("globe");
    assert.deepEqual(filterByTier(full, choice).map((s) => s.id), legacy);
  }
  assert.deepEqual(tiersFor("easy"), [1, 2]);
  assert.deepEqual(tiersFor("medium"), [2, 3, 4]);
  assert.deepEqual(tiersFor("hard"), [4, 5]);
});

test("globe tiers: placesFor(globe, choice) keeps curated starters and the same banded pool as the full load", async () => {
  for (const choice of CHOICES) {
    clearChunkCacheForTests();
    const lean = await placesFor("globe", "globe", choice);
    const fullPool = await placesFor("globe", "globe");
    assert.deepEqual(
      filterByTier(lean, choice).map((s) => s.id),
      filterByTier(fullPool, choice).map((s) => s.id),
      `${choice}: banded pool differs`,
    );
    // Curated globe starters are always in the pool (the band filters them later).
    const curated = STARTERS.filter((s) => s.edition === "globe" && s.regionId === "globe").map((s) => s.id);
    for (const id of curated) assert.ok(lean.some((s) => s.id === id), `${choice}: curated ${id} missing`);
    assert.ok(lean.length <= fullPool.length);
  }
});

test("globe tiers: Easy fetches only t1+t2; Medium/Hard add only the extra tiers", async () => {
  clearChunkCacheForTests();
  assert.deepEqual(loadedGlobeTiersForTests(), []);
  await placesFor("globe", "globe", "easy");
  assert.deepEqual(loadedGlobeTiersForTests(), [1, 2]);
  await placesFor("globe", "globe", "medium"); // extra: t3, t4 (t2 is cached)
  assert.deepEqual(loadedGlobeTiersForTests(), [1, 2, 3, 4]);
  await placesFor("globe", "globe", "hard"); // extra: t5
  assert.deepEqual(loadedGlobeTiersForTests(), [1, 2, 3, 4, 5]);

  clearChunkCacheForTests();
  await placesFor("globe", "globe", "hard");
  assert.deepEqual(loadedGlobeTiersForTests(), [4, 5]);
  clearChunkCacheForTests();
  await placesFor("globe", "globe"); // no path (tests/tooling): everything
  assert.deepEqual(loadedGlobeTiersForTests(), [1, 2, 3, 4, 5]);
});

test("globe tiers: seeded dealing order is unchanged by the split", async () => {
  const SEED = 20261013;
  for (const choice of CHOICES) {
    clearChunkCacheForTests();
    const fullPlaces = await placesFor("globe", "globe");
    const leanPlaces = await placesFor("globe", "globe", choice);
    const dealFrom = (places: typeof fullPlaces) => {
      const start = poolForNewRun(filterByTier(places, choice), memorySeenStore());
      const pool = resolveRunPool(places, start.poolIds);
      const dealer = createDealer(pool, SEED, memorySeenStore());
      return Array.from({ length: 300 }, (_, i) => dealer.at(i)?.id);
    };
    const before = dealFrom(fullPlaces);
    const after = dealFrom(leanPlaces);
    assert.deepEqual(after, before, `${choice}: seeded deal order changed`);
    assert.equal(new Set(before).size, 300, `${choice}: repeated a place before pool exhaustion`);
  }
});

test("globe tiers: whole-country runs (aggregated subdivision chunks) ignore the learning path", async () => {
  clearChunkCacheForTests();
  const plain = await placesFor("country", "united-states");
  assert.deepEqual(loadedGlobeTiersForTests(), [], "a country run must not touch globe tiers");
  clearChunkCacheForTests();
  for (const choice of CHOICES) {
    const withChoice = await placesFor("country", "united-states", choice);
    assert.deepEqual(withChoice.map((s) => s.id), plain.map((s) => s.id));
    assert.deepEqual(withChoice.map((s) => s.regionId), plain.map((s) => s.regionId));
  }
  assert.deepEqual(loadedGlobeTiersForTests(), []);
  // Wiring unchanged: the country chunk plus its 50 state chunks.
  assert.deepEqual(aggregateChunkIds("country", "united-states"), [
    "united-states",
    ...ADMIN1_BY_COUNTRY["united-states"].map((s) => s.id),
  ]);
});

test("globe tiers: fail closed — bad tier numbers, unsorted lists, misfiled records", async () => {
  await assert.rejects(() => loadGlobeTiers([6]), /invalid globe tier/);
  await assert.rejects(() => loadGlobeTiers([0]), /invalid globe tier/);
  const a = { id: "gn-5" } as never;
  const b = { id: "gn-9" } as never;
  assert.deepEqual(mergeByGeonameId([[b], [a]]).map((s) => s.id), ["gn-5", "gn-9"]);
  assert.throws(() => mergeByGeonameId([[b, a]]), /ascending id order/);
  assert.throws(() => mergeByGeonameId([[{ id: "x-1" } as never]]), /not "gn-<digits>"/);
});
