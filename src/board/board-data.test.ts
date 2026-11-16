import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  FALLBACK_BOARD,
  findStory,
  frontierSlug,
  isPublishedBoard,
  isStale,
  loadBoardStatus,
  newlyClosedFeatures,
  parseSelection,
  selectionSearch,
} from "./board-data.ts";

const DAY = 24 * 60 * 60 * 1000;

describe("loadBoardStatus — published file only, honest fallback", () => {
  it("uses the published file when it fetches and validates", async () => {
    const published = { ...FALLBACK_BOARD, source: "generated" as const };
    const fake = (async () =>
      new Response(JSON.stringify(published), { status: 200 })) as unknown as typeof fetch;
    const loaded = await loadBoardStatus(fake, Date.parse(FALLBACK_BOARD.updatedAt));
    assert.equal(loaded.source, "generated");
    assert.equal(loaded.board.counts.total, 37);
  });
  it("falls back to the bundled copy — disclosed as manual — when the fetch fails", async () => {
    const fake = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const loaded = await loadBoardStatus(fake, Date.parse(FALLBACK_BOARD.updatedAt));
    assert.equal(loaded.source, "manual");
    assert.equal(loaded.board.counts.total, 37);
  });
  it("falls back when the published payload is malformed", async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ nope: true }), { status: 200 })) as unknown as typeof fetch;
    const loaded = await loadBoardStatus(fake, Date.parse(FALLBACK_BOARD.updatedAt));
    assert.equal(loaded.source, "manual");
  });
  it("staleness: over 24h old is stale", () => {
    const t = Date.parse(FALLBACK_BOARD.updatedAt);
    assert.equal(isStale(FALLBACK_BOARD.updatedAt, t + DAY + 1), true);
    assert.equal(isStale(FALLBACK_BOARD.updatedAt, t + 60_000), false);
  });
  it("shape guard rejects v2-shaped data", () => {
    assert.equal(isPublishedBoard({ stories: [] }), false);
    assert.equal(isPublishedBoard(FALLBACK_BOARD), true);
  });
});

describe("selection store — one selection, mirrored to the URL", () => {
  it("round-trips feature + story + view", () => {
    const s = selectionSearch({ featureId: "maths", storySlug: "x-y" }, "map");
    assert.deepEqual(parseSelection(s), { featureId: "maths", storySlug: "x-y" });
    assert.match(s, /view=map/);
  });
  it("finds stories and the frontier on the real published data", () => {
    const frontier = frontierSlug(FALLBACK_BOARD);
    assert.ok(frontier);
    const found = findStory(FALLBACK_BOARD, frontier!);
    assert.equal(found?.story.status, "in-progress");
  });
});

describe("honest celebration bookkeeping", () => {
  const mini = {
    ...FALLBACK_BOARD,
    epics: [
      {
        id: "e",
        name: "E",
        color: "#000",
        features: [
          {
            id: "closed-one",
            name: "Closed One",
            promise: "",
            anim: "star" as const,
            done: 2,
            total: 2,
            bonds: 0,
            stories: [],
          },
          {
            id: "open-one",
            name: "Open One",
            promise: "",
            anim: "star" as const,
            done: 1,
            total: 2,
            bonds: 0,
            stories: [],
          },
        ],
      },
    ],
  };
  it("first visit (no seen set) never toasts", () => {
    assert.deepEqual(newlyClosedFeatures(mini, null), []);
  });
  it("a feature closed since the last visit is reported once", () => {
    assert.deepEqual(newlyClosedFeatures(mini, new Set()), ["Closed One"]);
    assert.deepEqual(newlyClosedFeatures(mini, new Set(["closed-one"])), []);
  });
});

describe("failure-mode guards — v2's lies cannot come back", () => {
  const read = (p: string) =>
    existsSync(new URL(p, import.meta.url)) ? readFileSync(new URL(p, import.meta.url), "utf8") : "";
  it("GitHub is read only by the coverage-gated live feed; the header never claims liveness", () => {
    // The v3 form of this guard banned the mechanism outright. The
    // owner's 2026-11-16 ruling restored the feed — what stays
    // banned is the LIE: a liveness claim without proven coverage.
    // So: the snapshot layer never fetches, the route never fetches
    // (the feed module owns the check), and the header carries no
    // platform or coverage wording at all: its updated line is the
    // snapshot's stamp alone, whatever the check found (a later
    // 2026-11-16 ruling removed the coverage line from the header).
    const snapshotLayer = [read("./board-data.ts"), read("./status-core.ts")].join("\n");
    assert.ok(!snapshotLayer.includes("api.github.com"), "the snapshot layer must never fetch GitHub");
    const route = read("../routes/board.tsx");
    assert.ok(!route.includes("api.github.com"), "the route must not fetch GitHub itself");
    assert.ok(
      !route.includes("Live from GitHub — every linked record checked"),
      "the header must not carry platform or coverage wording",
    );
    assert.ok(
      route.includes("Updated {formatUpdated(board.updatedAt)}"),
      "the header keeps the snapshot's Updated stamp",
    );
    assert.ok(read("./live-feed.ts").includes("api.github.com"), "the live feed owns the GitHub check");
  });
  it("the /board/issues route stays deleted (the feed is an overlay, not a data surface)", () => {
    assert.equal(existsSync(new URL("../routes/board_.issues.tsx", import.meta.url)), false);
  });
});
