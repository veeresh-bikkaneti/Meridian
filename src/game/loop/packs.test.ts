import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isLoopPackManifest,
  isLoopPackMeta,
  loopMetaEntryFor,
  packBriefingText,
  packManifestCases,
  type LoopPackManifest,
  type LoopPackMetaEntry,
} from "./packs.ts";
import { buildTierBandedDeck, dealFromDeck, ensurePackDeck, freshLoopUnlimitedStore } from "./store.ts";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public");
const readPublicJson = (path: string) => JSON.parse(readFileSync(join(PUBLIC_DIR, path), "utf8"));

const MANIFEST: LoopPackManifest = {
  v: 1,
  packId: "capitals",
  category: "capitals",
  size: 2,
  generatedAt: "2026-11-03T00:00:00.000Z",
  loopIndexes: [387, 388],
  loopTiers: [1, 3],
  coldtrailFile: null,
};

const PARIS_META: LoopPackMetaEntry = {
  subject: { kind: "country", name: "France" },
  direction: "A",
  prompt: { givenName: "France", givenKind: "country" },
  blurb: "Paris is the capital of France.",
};

test("isLoopPackManifest accepts the pilot manifest shape", () => {
  assert.equal(isLoopPackManifest(MANIFEST), true);
  const noTiers: Record<string, unknown> = { ...MANIFEST };
  delete noTiers.loopTiers;
  assert.equal(isLoopPackManifest(noTiers), true, "tiers are optional");
});

test("isLoopPackManifest rejects size drift, duplicate indexes, and bad tiers", () => {
  assert.equal(isLoopPackManifest({ ...MANIFEST, size: 3 }), false);
  assert.equal(isLoopPackManifest({ ...MANIFEST, loopIndexes: [387, 387] }), false);
  assert.equal(isLoopPackManifest({ ...MANIFEST, loopTiers: [1] }), false);
  assert.equal(isLoopPackManifest({ ...MANIFEST, loopTiers: [1, 9] }), false);
  assert.equal(isLoopPackManifest({ ...MANIFEST, coldtrailFile: "" }), false);
  assert.equal(isLoopPackManifest({ ...MANIFEST, v: 2 }), false);
});

test("isLoopPackMeta validates the sidecar shape key by key", () => {
  assert.equal(isLoopPackMeta({ "387": PARIS_META }), true);
  assert.equal(isLoopPackMeta({}), true, "an empty sidecar is valid");
  assert.equal(isLoopPackMeta({ paris: PARIS_META }), false, "keys are clue indexes");
  assert.equal(
    isLoopPackMeta({ "387": { ...PARIS_META, direction: "C" } }),
    false,
    "unknown direction fails closed",
  );
  assert.equal(isLoopPackMeta([PARIS_META]), false, "the sidecar is a map, not a list");
});

test("loopMetaEntryFor reads by numeric index and misses cleanly", () => {
  const meta = { "387": PARIS_META };
  assert.equal(loopMetaEntryFor(meta, 387), PARIS_META);
  assert.equal(loopMetaEntryFor(meta, 12), null);
  assert.equal(loopMetaEntryFor(null, 387), null);
});

test("packManifestCases pairs indexes with tiers, defaulting to one band", () => {
  assert.deepEqual(packManifestCases(MANIFEST), [
    { index: 387, packTier: 1 },
    { index: 388, packTier: 3 },
  ]);
  const noTiers: LoopPackManifest = { ...MANIFEST };
  delete noTiers.loopTiers;
  assert.deepEqual(packManifestCases(noTiers), [
    { index: 387, packTier: 2 },
    { index: 388, packTier: 2 },
  ]);
});

test("pilot end to end: the generated Paris case deals from the pack deck and briefs from the sidecar", () => {
  const manifest = readPublicJson("packs/capitals/manifest.json") as LoopPackManifest;
  assert.equal(isLoopPackManifest(manifest), true);
  assert.deepEqual(manifest.loopIndexes, [387]);

  const cases = packManifestCases(manifest);
  const store = ensurePackDeck(freshLoopUnlimitedStore(387), "capitals", cases, (bound) => bound - 1);
  const dealt = dealFromDeck(store, "capitals", () => buildTierBandedDeck(cases, (bound) => bound - 1));
  assert.equal(dealt.index, 387, "Paris, the pack's tier-1 case, deals first");

  const clue = readPublicJson("loop/clues/387.json") as {
    v: number;
    placeId: string;
    target: { lon: number; lat: number };
    clues: string[];
  };
  assert.equal(clue.v, 1);
  assert.equal(clue.placeId, "geonames:2988507");
  assert.deepEqual(clue.target, { lon: 2.3488, lat: 48.85341 });
  assert.equal(clue.clues.length, 5);

  const meta = readPublicJson("packs/capitals/loop-meta.json");
  assert.equal(isLoopPackMeta(meta), true);
  const entry = loopMetaEntryFor(meta, dealt.index);
  assert.ok(entry);
  assert.equal(packBriefingText(entry), "Your case: find the capital of France.");
  assert.ok(entry.blurb.endsWith("Paris is the capital of France."));
});

test("packBriefingText states only what the direction gives", () => {
  assert.equal(packBriefingText(PARIS_META), "Your case: find the capital of France.");
  const drill: LoopPackMetaEntry = {
    subject: { kind: "state", name: "Texas" },
    direction: "B1",
    prompt: { givenName: "Austin", givenKind: "capital" },
    blurb: "Austin is the capital of Texas.",
  };
  assert.equal(packBriefingText(drill), "Your drill: find Austin on the map.");
  const deduce: LoopPackMetaEntry = {
    subject: { kind: "country", name: "France" },
    direction: "B2",
    prompt: { givenName: "", givenKind: "country" },
    blurb: "Paris is the capital of France.",
  };
  const text = packBriefingText(deduce);
  assert.ok(text && !text.includes("France") && !text.includes("Paris"), "B2 names nothing");
  const noGiven: LoopPackMetaEntry = { ...PARIS_META, prompt: { givenName: "", givenKind: "country" } };
  assert.equal(packBriefingText(noGiven), null, "Direction A without a given name has no briefing");
});
