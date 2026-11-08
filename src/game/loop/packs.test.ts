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

test("the published pack end to end: a tier-1 case deals first, and Paris briefs from the sidecar", () => {
  const manifest = readPublicJson("packs/capitals/manifest.json") as LoopPackManifest;
  assert.equal(isLoopPackManifest(manifest), true);
  assert.equal(manifest.size, 110);
  assert.deepEqual(
    manifest.loopIndexes,
    Array.from({ length: 110 }, (_, i) => 387 + i),
    "the pack's indexes continue after the core pool in caseId order",
  );

  const cases = packManifestCases(manifest);
  const store = ensurePackDeck(freshLoopUnlimitedStore(387), "capitals", cases, (bound) => bound - 1);
  const dealt = dealFromDeck(store, "capitals", () => buildTierBandedDeck(cases, (bound) => bound - 1));
  const tier1 = new Set(cases.filter((c) => c.packTier === 1).map((c) => c.index));
  assert.ok(tier1.has(dealt.index), "a fresh tier-banded pack deck deals a tier-1 case first");

  const meta = readPublicJson("packs/capitals/loop-meta.json");
  assert.equal(isLoopPackMeta(meta), true);
  assert.equal(Object.keys(meta).length, 110);

  // Paris, the pack's pilot case, sits at its caseId-order index: its
  // clue file is an ordinary clue file and its sidecar entry briefs
  // and reveals the pairing.
  const parisIndex = Number(
    Object.keys(meta).find((key) => {
      const e = (meta as Record<string, { subject: { name: string } }>)[key];
      return e?.subject.name === "France";
    }),
  );
  assert.ok(Number.isInteger(parisIndex), "the sidecar carries the France case");
  const clue = readPublicJson(`loop/clues/${parisIndex}.json`) as {
    v: number;
    placeId: string;
    target: { lon: number; lat: number };
    clues: string[];
  };
  assert.equal(clue.v, 1);
  assert.equal(clue.placeId, "geonames:2988507");
  assert.deepEqual(clue.target, { lon: 2.3488, lat: 48.85341 });
  assert.equal(clue.clues.length, 5);

  const entry = loopMetaEntryFor(meta, parisIndex);
  assert.ok(entry);
  assert.equal(packBriefingText(entry), "Your case: find the capital of France.");
  assert.ok(entry.blurb.endsWith("Paris is the capital of France."));
});

test("missing sidecar entry: the case plays, with no briefing and no blurb (screen-level)", () => {
  // Behaviour: an index the sidecar does not carry resolves to no
  // entry, so the screen derives no briefing and no pairing blurb —
  // while the clue file itself is an ordinary clue file that plays
  // without the sidecar (the deal and clue fetch never consult it).
  const meta = { "387": PARIS_META };
  const entry = loopMetaEntryFor(meta, 400);
  assert.equal(entry, null);
  assert.equal(entry ? packBriefingText(entry) : null, null, "no entry, no briefing");
  // Screen wiring pin: LoopScreen passes the entry's blurb (or null)
  // and a briefing derived only from a present entry, and a failed or
  // empty sidecar load leaves packMeta null instead of blocking play.
  const screen = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "LoopScreen.tsx"), "utf8");
  assert.ok(screen.includes("packBlurb={packEntry?.blurb ?? null}"), "blurb falls back to null");
  assert.ok(
    screen.includes("const packBriefing = packEntry ? packBriefingText(packEntry) : null"),
    "briefing exists only when an entry exists",
  );
  assert.ok(screen.includes("if (!cancelled) setPackMeta(null)"), "sidecar failure never blocks the case");
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
