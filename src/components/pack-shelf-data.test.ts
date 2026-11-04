/**
 * Pack shelf data adapter: logic tests. The manifest guard, the deck
 * list builder, the progress lines, the selection store, and the
 * per-deck progress peeks all run against fake storage and fake
 * fetchers. The storage key literals are pinned against their owner
 * files so a key change anywhere fails here instead of drifting.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CORE_DECK_ID,
  PACK_SHELF_SELECTION_KEY,
  buildDeckList,
  deckProgressLine,
  fetchLoopDeckSize,
  fetchPackManifest,
  initialTrailDeck,
  isPackManifest,
  readColdtrailClosed,
  readLoopCoreClosed,
  readLoopDeckClosed,
  readSelectedDeck,
  deckLabelForId,
  toShelfDeckId,
  writeSelectedDeck,
  type PackManifest,
} from "./pack-shelf-data.ts";

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, rel), "utf8");

const MANIFEST: PackManifest = {
  v: 1,
  packId: "capitals",
  category: "capitals",
  size: 72,
  generatedAt: "2026-11-03T00:00:00.000Z",
  loopIndexes: Array.from({ length: 72 }, (_, i) => 387 + i),
  coldtrailFile: "cases.capitals.generated.json",
};

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    dump: () => Object.fromEntries(map),
  };
}

describe("isPackManifest", () => {
  it("accepts the DESIGN section 1.2 shape", () => {
    assert.equal(isPackManifest(MANIFEST), true);
    assert.equal(isPackManifest({ ...MANIFEST, coldtrailFile: null }), true);
  });

  it("rejects wrong versions, bad sizes, and bad index lists", () => {
    assert.equal(isPackManifest(null), false);
    assert.equal(isPackManifest({ ...MANIFEST, v: 2 }), false);
    assert.equal(isPackManifest({ ...MANIFEST, size: 0 }), false);
    assert.equal(isPackManifest({ ...MANIFEST, size: 72.5 }), false);
    assert.equal(isPackManifest({ ...MANIFEST, loopIndexes: [387, -1] }), false);
    assert.equal(isPackManifest({ ...MANIFEST, loopIndexes: "387" }), false);
    assert.equal(isPackManifest({ ...MANIFEST, coldtrailFile: "" }), false);
    assert.equal(isPackManifest({ ...MANIFEST, packId: "" }), false);
  });

  it("rejects size drift and duplicate indexes (parity with the loop validator)", () => {
    assert.equal(isPackManifest({ ...MANIFEST, size: 71 }), false);
    assert.equal(isPackManifest({ ...MANIFEST, size: 3, loopIndexes: [387, 388, 389] }), true);
    const dup = Array.from({ length: 72 }, (_, i) => 387 + i);
    dup[71] = 387;
    assert.equal(isPackManifest({ ...MANIFEST, loopIndexes: dup }), false);
  });
});

describe("buildDeckList", () => {
  const base = { coreClosed: 3, coreTotal: 387, packClosed: null };

  it("shows only the core deck when the pack has not shipped", () => {
    const decks = buildDeckList({ ...base, edition: "geodetective", packManifest: null });
    assert.deepEqual(
      decks.map((d) => d.id),
      [CORE_DECK_ID],
    );
    assert.equal(decks[0]!.label, "All cases");
  });

  it("adds the Capitals & Flags chip in GeoDetective when loop indexes exist", () => {
    const decks = buildDeckList({ ...base, edition: "geodetective", packManifest: MANIFEST });
    assert.equal(decks.length, 2);
    assert.equal(decks[1]!.id, "capitals");
    // Owner-ratified relabel (issue #344): the pack's player-facing
    // name is "Capitals & Flags"; the deck id stays "capitals".
    assert.equal(decks[1]!.label, "Capitals & Flags");
    assert.equal(decks[1]!.star, true);
    assert.equal(decks[1]!.total, 72);
  });

  it("keeps the chip out of an edition the manifest cannot deal", () => {
    const noLoop = buildDeckList({
      ...base,
      edition: "geodetective",
      packManifest: { ...MANIFEST, loopIndexes: [] },
    });
    assert.equal(noLoop.length, 1);
    const noTrail = buildDeckList({
      ...base,
      edition: "coldtrail",
      packManifest: { ...MANIFEST, coldtrailFile: null },
    });
    assert.equal(noTrail.length, 1);
    const trail = buildDeckList({ ...base, edition: "coldtrail", packManifest: MANIFEST });
    assert.equal(trail.length, 2);
  });

  it("uses the edition-true pack total: 72 for GeoDetective, 60 for Cold Trail", () => {
    const geo = buildDeckList({ ...base, edition: "geodetective", packManifest: MANIFEST });
    assert.equal(geo[1]!.total, 72);
    const trail = buildDeckList({
      ...base,
      edition: "coldtrail",
      packManifest: MANIFEST,
      packTotal: 60,
    });
    assert.equal(trail[1]!.total, 60);
    assert.equal(deckProgressLine(trail[1]!), "60 cases");
    // Without a bundled count, Cold Trail falls back to the manifest size.
    const fallback = buildDeckList({ ...base, edition: "coldtrail", packManifest: MANIFEST });
    assert.equal(fallback[1]!.total, 72);
  });
});

describe("initialTrailDeck (Cold Trail mount resume)", () => {
  const open = { revealed: false };
  const done = { revealed: true };
  it("resumes the one deck with an unrevealed case, over the selection blob", () => {
    assert.equal(
      initialTrailDeck({ selected: "capitals", coreCurrent: open, packCurrent: null }),
      CORE_DECK_ID,
    );
    assert.equal(
      initialTrailDeck({ selected: "all", coreCurrent: null, packCurrent: open }),
      "capitals",
    );
    assert.equal(
      initialTrailDeck({ selected: "all", coreCurrent: done, packCurrent: open }),
      "capitals",
    );
  });
  it("falls back to the stored selection when both or neither deck is mid-case", () => {
    assert.equal(
      initialTrailDeck({ selected: "capitals", coreCurrent: open, packCurrent: open }),
      "capitals",
    );
    assert.equal(
      initialTrailDeck({ selected: "capitals", coreCurrent: done, packCurrent: done }),
      "capitals",
    );
    assert.equal(
      initialTrailDeck({ selected: "all", coreCurrent: null, packCurrent: null }),
      "all",
    );
  });
});

describe("deckProgressLine", () => {
  it("reads as closed of total when both counts are known", () => {
    assert.equal(deckProgressLine({ closed: 3, total: 387 }), "3 of 387 cases closed");
    assert.equal(deckProgressLine({ closed: 0, total: 72 }), "0 of 72 cases closed");
  });

  it("drops a total the closed count has passed (wrapped deck)", () => {
    assert.equal(deckProgressLine({ closed: 400, total: 387 }), "400 cases closed");
  });

  it("handles closed-only, total-only, and unknown counts", () => {
    assert.equal(deckProgressLine({ closed: 0, total: null }), "No cases closed yet");
    assert.equal(deckProgressLine({ closed: 1, total: null }), "1 case closed");
    assert.equal(deckProgressLine({ closed: 5, total: null }), "5 cases closed");
    assert.equal(deckProgressLine({ closed: null, total: 72 }), "72 cases");
    assert.equal(deckProgressLine({ closed: null, total: null }), "");
  });
});

describe("deck selection storage", () => {
  it("reads the GeoDetective pick from the loop store's active deck", () => {
    const empty = fakeStorage();
    assert.equal(readSelectedDeck("geodetective", empty), CORE_DECK_ID);
    const core = fakeStorage({
      "meridian.loop.v2": JSON.stringify({ deck: {}, activeDeckId: "core" }),
    });
    assert.equal(readSelectedDeck("geodetective", core), CORE_DECK_ID);
    const pack = fakeStorage({
      "meridian.loop.v2": JSON.stringify({ deck: {}, activeDeckId: "capitals" }),
    });
    assert.equal(readSelectedDeck("geodetective", pack), "capitals");
    const corrupt = fakeStorage({ "meridian.loop.v2": "{nope" });
    assert.equal(readSelectedDeck("geodetective", corrupt), CORE_DECK_ID);
    const badId = fakeStorage({
      "meridian.loop.v2": JSON.stringify({ deck: {}, activeDeckId: "Bad Id!" }),
    });
    assert.equal(readSelectedDeck("geodetective", badId), CORE_DECK_ID);
  });

  it("round-trips a Cold Trail pick in the selection blob", () => {
    const s = fakeStorage();
    assert.equal(readSelectedDeck("coldtrail", s), CORE_DECK_ID);
    writeSelectedDeck("coldtrail", "capitals", s);
    assert.equal(readSelectedDeck("coldtrail", s), "capitals");
    writeSelectedDeck("coldtrail", CORE_DECK_ID, s);
    assert.equal(readSelectedDeck("coldtrail", s), CORE_DECK_ID);
    const blob = JSON.parse(s.dump()[PACK_SHELF_SELECTION_KEY]!) as { v: number };
    assert.equal(blob.v, 1);
  });

  it("fails closed to the core deck on corrupt or foreign selection blobs", () => {
    const corrupt = fakeStorage({ [PACK_SHELF_SELECTION_KEY]: "{nope" });
    assert.equal(readSelectedDeck("coldtrail", corrupt), CORE_DECK_ID);
    const foreign = fakeStorage({
      [PACK_SHELF_SELECTION_KEY]: JSON.stringify({ v: 2, decks: { coldtrail: "capitals" } }),
    });
    assert.equal(readSelectedDeck("coldtrail", foreign), CORE_DECK_ID);
    const badId = fakeStorage({
      [PACK_SHELF_SELECTION_KEY]: JSON.stringify({ v: 1, decks: { coldtrail: "Bad Id!" } }),
    });
    assert.equal(readSelectedDeck("coldtrail", badId), CORE_DECK_ID);
  });

  it("refuses to store an id that is not a plain deck token", () => {
    const s = fakeStorage();
    writeSelectedDeck("coldtrail", "Bad Id!", s);
    assert.equal(s.dump()[PACK_SHELF_SELECTION_KEY], undefined);
    assert.equal(readSelectedDeck("coldtrail", s), CORE_DECK_ID);
  });

  it("never writes GeoDetective selection from here (the loop screen's commit owns it)", () => {
    const s = fakeStorage();
    writeSelectedDeck("geodetective", "capitals", s);
    assert.deepEqual(s.dump(), {});
    assert.equal(readSelectedDeck("geodetective", s), CORE_DECK_ID);
  });
});

describe("per-deck progress peeks", () => {
  it("reads GeoDetective cases closed from the loop store cycle count", () => {
    const s = fakeStorage({
      "meridian.loop.v2": JSON.stringify({
        deck: { deck: [1, 2], cycle: 1, cycleCompleted: 3 },
        current: null,
        streak: 0,
        bestStreak: 0,
        totals: { solved: 2, lost: 1 },
      }),
    });
    assert.equal(readLoopCoreClosed(s), 3);
  });

  it("reads GeoDetective pack progress from the pack deck's own cycle count", () => {
    const s = fakeStorage({
      "meridian.loop.v2": JSON.stringify({
        deck: { deck: [], cycle: 1, cycleCompleted: 3 },
        packDecks: { capitals: { deck: [], cycle: 2, cycleCompleted: 7 } },
        current: null,
      }),
    });
    assert.equal(readLoopDeckClosed("capitals", s), 7);
    assert.equal(readLoopDeckClosed(CORE_DECK_ID, s), 3);
    const unbuilt = fakeStorage({
      "meridian.loop.v2": JSON.stringify({ deck: { deck: [], cycle: 1, cycleCompleted: 0 } }),
    });
    assert.equal(readLoopDeckClosed("capitals", unbuilt), null, "never built reads unknown, not zero");
  });

  it("reads Cold Trail cases closed from core and pack store keys", () => {
    const s = fakeStorage({
      "meridian.coldtrail.v2": JSON.stringify({ v: 2, caseIndex: 4, stars: 9, solved: 5, current: null }),
      "meridian.coldtrail.pack.capitals.v1": JSON.stringify({
        v: 2,
        caseIndex: 1,
        stars: 3,
        solved: 2,
        current: null,
      }),
    });
    assert.equal(readColdtrailClosed("core", s), 5);
    assert.equal(readColdtrailClosed("pack", s), 2);
  });

  it("returns unknown, never zero, for missing or malformed stores", () => {
    const empty = fakeStorage();
    assert.equal(readLoopCoreClosed(empty), null);
    assert.equal(readColdtrailClosed("core", empty), null);
    assert.equal(readColdtrailClosed("pack", empty), null);
    const malformed = fakeStorage({
      "meridian.loop.v2": JSON.stringify({ deck: { cycleCompleted: -1 } }),
      "meridian.coldtrail.v2": JSON.stringify({ v: 1, solved: 5 }),
    });
    assert.equal(readLoopCoreClosed(malformed), null);
    assert.equal(readColdtrailClosed("core", malformed), null);
  });
});

describe("manifest fetches", () => {
  it("fetchPackManifest validates and builds the packs URL", async () => {
    let seenUrl = "";
    const ok = await fetchPackManifest("capitals", async (url) => {
      seenUrl = url;
      return MANIFEST;
    });
    assert.deepEqual(ok, MANIFEST);
    assert.ok(seenUrl.endsWith("packs/capitals/manifest.json"), seenUrl);
    const invalid = await fetchPackManifest("capitals", async () => ({ v: 2 }));
    assert.equal(invalid, null);
    const failed = await fetchPackManifest("capitals", async () => {
      throw new Error("404");
    });
    assert.equal(failed, null);
  });

  it("fetchLoopDeckSize reads the loop manifest size", async () => {
    assert.equal(await fetchLoopDeckSize(async () => ({ v: 1, size: 387 })), 387);
    assert.equal(await fetchLoopDeckSize(async () => ({ v: 1 })), null);
    assert.equal(
      await fetchLoopDeckSize(async () => {
        throw new Error("offline");
      }),
      null,
    );
  });
});

describe("fetchPackManifest shared UI load (shelf + doorway dedupe)", () => {
  const realFetch = globalThis.fetch;

  function manifestFor(id: string): PackManifest {
    return { ...MANIFEST, packId: id };
  }

  /**
   * Stub the global fetch the default path uses. `respond` decides
   * per call; the returned probe counts underlying network loads.
   */
  function stubNetwork(respond: (id: string, call: number) => { ok: boolean; body?: unknown }) {
    let calls = 0;
    globalThis.fetch = (async (input: unknown) => {
      calls += 1;
      const id = /packs\/([^/]+)\/manifest\.json/.exec(String(input))?.[1] ?? "";
      const { ok, body } = respond(id, calls);
      return { ok, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    return () => calls;
  }

  it("two UI callers mounting together share one underlying load", async () => {
    const calls = stubNetwork((id) => ({ ok: true, body: manifestFor(id) }));
    try {
      // Fired back-to-back, as the doorway and the shelf mount in the
      // same session: only the first may touch the network.
      const [doorway, shelf] = await Promise.all([
        fetchPackManifest("probe-shared"),
        fetchPackManifest("probe-shared"),
      ]);
      assert.deepEqual(doorway, manifestFor("probe-shared"));
      assert.deepEqual(shelf, manifestFor("probe-shared"));
      assert.equal(calls(), 1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a settled success is reused by the next mount, not refetched", async () => {
    const calls = stubNetwork((id) => ({ ok: true, body: manifestFor(id) }));
    try {
      assert.deepEqual(await fetchPackManifest("probe-cached"), manifestFor("probe-cached"));
      assert.deepEqual(await fetchPackManifest("probe-cached"), manifestFor("probe-cached"));
      assert.equal(calls(), 1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("a failed load is evicted, so a later mount can retry and succeed", async () => {
    let healthy = false;
    const calls = stubNetwork((id) =>
      healthy ? { ok: true, body: manifestFor(id) } : { ok: false },
    );
    try {
      assert.equal(await fetchPackManifest("probe-retry"), null);
      healthy = true;
      assert.deepEqual(await fetchPackManifest("probe-retry"), manifestFor("probe-retry"));
      assert.equal(calls(), 2);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("an injected fetcher bypasses the shared cache — it neither reads nor writes it", async () => {
    const calls = stubNetwork((id) => ({ ok: true, body: manifestFor(id) }));
    try {
      // Prime the shared cache through the default (UI) path.
      assert.deepEqual(await fetchPackManifest("probe-bypass"), manifestFor("probe-bypass"));
      assert.equal(calls(), 1);
      // A caller with its own fetcher must NOT be served the cached
      // success: its failure is its own (this is the seam a fresh,
      // fail-able load depends on — the deal path proper uses its
      // own fetch in LoopScreen and never this function).
      let injectedCalls = 0;
      const failed = await fetchPackManifest("probe-bypass", async () => {
        injectedCalls += 1;
        throw new Error("offline");
      });
      assert.equal(failed, null);
      assert.equal(injectedCalls, 1);
      // And the injected path must not write the cache either: its
      // success does not replace what UI callers already share.
      const other = { ...manifestFor("probe-bypass"), size: 1, loopIndexes: [0] };
      const fresh = await fetchPackManifest("probe-bypass", async () => other);
      assert.deepEqual(fresh, other);
      assert.deepEqual(await fetchPackManifest("probe-bypass"), manifestFor("probe-bypass"));
      assert.equal(calls(), 1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("deckLabelForId (the open case's deck name, issue #336)", () => {
  it("names the core deck in shelf vocabulary, in either id vocabulary", () => {
    assert.equal(deckLabelForId("core"), "All cases");
    assert.equal(deckLabelForId(CORE_DECK_ID), "All cases");
  });

  it("names a pack deck with the chip's label", () => {
    assert.equal(deckLabelForId("capitals"), "Capitals & Flags");
    // The label agrees with the chip buildDeckList renders for the pack.
    const decks = buildDeckList({
      edition: "geodetective",
      packManifest: MANIFEST,
      coreClosed: null,
      coreTotal: null,
      packClosed: null,
    });
    assert.equal(deckLabelForId("capitals"), decks[1]!.label);
    assert.equal(deckLabelForId("core"), decks[0]!.label);
  });

  it("falls back to the capitalized pack id for an unknown pack", () => {
    assert.equal(deckLabelForId("rivers"), "Rivers");
  });
});

describe("storage key literals match their owner files", () => {
  it("loop and coldtrail core keys match the engine sources", () => {
    const dataSrc = readSrc("pack-shelf-data.ts");
    const loopTypes = readSrc("../game/loop/types.ts");
    const trailStore = readSrc("../game/coldtrail/store.ts");
    assert.ok(loopTypes.includes('"meridian.loop.v2"'), "loop key owner");
    assert.ok(dataSrc.includes('"meridian.loop.v2"'), "loop key restated");
    assert.ok(trailStore.includes('"meridian.coldtrail.v2"'), "coldtrail key owner");
    assert.ok(dataSrc.includes('"meridian.coldtrail.v2"'), "coldtrail key restated");
  });

  it("the pack store key matches its owner in cases-pack.ts and its restatement in store.ts", () => {
    const dataSrc = readSrc("pack-shelf-data.ts");
    const casesPack = readSrc("../game/coldtrail/cases-pack.ts");
    const trailStore = readSrc("../game/coldtrail/store.ts");
    assert.ok(casesPack.includes('"meridian.coldtrail.pack.capitals.v1"'), "pack key owner");
    assert.ok(trailStore.includes('"meridian.coldtrail.pack.capitals.v1"'), "pack key restated for the reset");
    assert.ok(dataSrc.includes('"meridian.coldtrail.pack.capitals.v1"'), "pack key restated for peeks");
  });

  it("maps loop deck ids to shelf deck ids", () => {
    const loopTypes = readSrc("../game/loop/types.ts");
    assert.ok(loopTypes.includes('LOOP_CORE_DECK_ID = "core"'), "loop core id owner");
    assert.equal(toShelfDeckId("core"), CORE_DECK_ID);
    assert.equal(toShelfDeckId("capitals"), "capitals");
  });
});
