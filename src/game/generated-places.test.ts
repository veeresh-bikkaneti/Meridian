import test from "node:test";
import assert from "node:assert/strict";
import { STARTERS } from "./starters.ts";
import {
  generatedStartersFor,
  placesFor,
  poolSizeFor,
  generatedPlaceCount,
  loadRegionChunk,
  startersFromChunk,
  clearChunkCacheForTests,
  GENERATED_SOURCE_LABEL,
  GENERATED_SOURCE_HREF,
} from "./generated-places.ts";
import manifestJson from "./data/geonames/manifest.json" with { type: "json" };

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
