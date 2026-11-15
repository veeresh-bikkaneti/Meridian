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
    assert.equal(loaded.board.counts.total, 46);
  });
  it("falls back to the bundled copy — disclosed as manual — when the fetch fails", async () => {
    const fake = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const loaded = await loadBoardStatus(fake, Date.parse(FALLBACK_BOARD.updatedAt));
    assert.equal(loaded.source, "manual");
    assert.equal(loaded.board.counts.total, 46);
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
  it("no board source reads GitHub or claims liveness it cannot prove", () => {
    const surfaces = [
      read("./board-data.ts"),
      read("../routes/board.tsx"),
      read("../routes/board_.issues.tsx"),
    ].join("\n");
    assert.ok(!surfaces.includes("api.github.com"), "board must never fetch GitHub");
    assert.ok(!surfaces.includes("Live from GitHub"), "false liveness wording");
    assert.ok(!surfaces.includes("fetchLive"), "the v2 live overlay must stay deleted");
  });
  it("the /board/issues route is deleted (it has no data source without public GitHub)", () => {
    assert.equal(existsSync(new URL("../routes/board_.issues.tsx", import.meta.url)), false);
  });
});
