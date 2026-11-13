import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import snapshotJson from "./snapshot.json" with { type: "json" };
import {
  applyLiveData,
  CACHE_KEY,
  CACHE_TTL_MS,
  deriveStatus,
  fetchLivePrs,
  parseGithubPrs,
  readCache,
  writeCache,
  type GithubPr,
  type KeyValueStorage,
  type SnapshotData,
  type SnapshotStory,
} from "./board-data.ts";

const snapshot = snapshotJson as unknown as SnapshotData;

function story(partial: Partial<SnapshotStory>): SnapshotStory {
  return {
    lane: "Math",
    title: "A story",
    status: "not-started",
    waitsOn: "—",
    owner: null,
    prs: [],
    inferred: false,
    ...partial,
  };
}

function pr(number: number, state: "open" | "closed", merged: boolean, title = ""): GithubPr {
  return { number, state, merged, title };
}

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const NOW = 1_700_000_000_000;

describe("snapshot", () => {
  it("holds 46 stories in 8 lanes, with a done path", () => {
    assert.equal(snapshot.stories.length, 46);
    assert.equal(snapshot.lanes.length, 8);
    for (const s of snapshot.stories) {
      assert.ok(snapshot.lanes.some((l) => l.name === s.lane), `lane exists for ${s.title}`);
      assert.ok(["not-started", "in-progress", "done"].includes(s.status), s.title);
      assert.ok(Array.isArray(s.prs));
    }
    assert.ok(snapshot.donePath.some((g) => g.type === "gate"));
    assert.ok(snapshot.donePath.some((g) => g.type === "stage"));
  });
});

describe("status rule", () => {
  it("a story is Done when all its PRs are merged", () => {
    const s = story({ prs: [10, 11], status: "in-progress" });
    const map = new Map([
      [10, pr(10, "closed", true)],
      [11, pr(11, "closed", true)],
    ]);
    assert.equal(deriveStatus(s, map), "done");
  });

  it("a story is In progress when any of its PRs is open", () => {
    const s = story({ prs: [10, 11], status: "not-started" });
    const map = new Map([
      [10, pr(10, "closed", true)],
      [11, pr(11, "open", false)],
    ]);
    assert.equal(deriveStatus(s, map), "in-progress");
  });

  it("a story with no PRs keeps its snapshot status", () => {
    assert.equal(deriveStatus(story({ prs: [], status: "in-progress" }), new Map()), "in-progress");
    assert.equal(deriveStatus(story({ prs: [], status: "done" }), new Map()), "done");
  });

  it("closed-but-unmerged PRs keep the snapshot status", () => {
    const s = story({ prs: [10], status: "in-progress" });
    assert.equal(deriveStatus(s, new Map([[10, pr(10, "closed", false)]])), "in-progress");
  });

  it("PRs missing from the live payload cannot prove Done", () => {
    const s = story({ prs: [10, 11], status: "in-progress" });
    assert.equal(deriveStatus(s, new Map([[10, pr(10, "closed", true)]])), "in-progress");
    assert.equal(deriveStatus(s, new Map()), "in-progress");
  });

  it("applyLiveData overlays statuses and PR titles", () => {
    const out = applyLiveData([story({ prs: [7], status: "not-started" })], [
      pr(7, "closed", true, "Ship it"),
    ]);
    assert.equal(out[0].status, "done");
    assert.equal(out[0].prTitles[7], "Ship it");
  });
});

describe("GitHub payload parsing", () => {
  it("maps merged_at to merged and drops malformed entries", () => {
    const parsed = parseGithubPrs([
      { number: 1, state: "closed", merged_at: "2026-11-01T00:00:00Z", title: "A" },
      { number: 2, state: "open", merged_at: null, title: "B" },
      { number: "x", state: "open" },
      { state: "open" },
      null,
    ]);
    assert.deepEqual(
      parsed.map((p) => [p.number, p.merged]),
      [
        [1, true],
        [2, false],
      ],
    );
  });
});

describe("cache + fallback", () => {
  it("writeCache/readCache round-trips inside the TTL and expires after it", () => {
    const storage = memoryStorage();
    writeCache({ etag: '"e1"', fetchedAt: NOW, prs: [pr(1, "open", false)] }, storage);
    assert.equal(readCache(storage, NOW + CACHE_TTL_MS - 1)?.etag, '"e1"');
    assert.equal(readCache(storage, NOW + CACHE_TTL_MS + 1), null);
  });

  it("a throwing storage is treated as no cache, never an error", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    assert.equal(readCache(broken, NOW), null);
    writeCache({ etag: null, fetchedAt: NOW, prs: [] }, broken); // must not throw
  });

  it("fresh cache is served without a network call", async () => {
    const storage = memoryStorage();
    writeCache({ etag: '"e1"', fetchedAt: NOW, prs: [pr(3, "open", false)] }, storage);
    let calls = 0;
    const result = await fetchLivePrs({
      storage,
      now: NOW + 60_000,
      fetchFn: async () => {
        calls += 1;
        throw new Error("should not be called");
      },
    });
    assert.equal(calls, 0);
    assert.equal(result.source, "cache");
    assert.deepEqual(result.prs.map((p) => p.number), [3]);
  });

  it("a 304 reuses the stale cache and refreshes its timestamp", async () => {
    const storage = memoryStorage();
    writeCache({ etag: '"e9"', fetchedAt: NOW - CACHE_TTL_MS - 1, prs: [pr(4, "closed", true)] }, storage);
    let seenIfNoneMatch: string | null = null;
    const result = await fetchLivePrs({
      storage,
      now: NOW,
      fetchFn: async (_url, init) => {
        seenIfNoneMatch = new Headers(init?.headers).get("if-none-match");
        return new Response(null, { status: 304 });
      },
    });
    assert.equal(seenIfNoneMatch, '"e9"');
    assert.equal(result.source, "live");
    assert.equal(result.fetchedAt, NOW);
    assert.deepEqual(result.prs.map((p) => p.number), [4]);
  });

  it("403 falls back to stale cache and reports the saved-data time", async () => {
    const staleAt = NOW - CACHE_TTL_MS - 5_000;
    const storage = memoryStorage();
    writeCache({ etag: '"e2"', fetchedAt: staleAt, prs: [pr(5, "open", false)] }, storage);
    const result = await fetchLivePrs({
      storage,
      now: NOW,
      fetchFn: async () => new Response("rate limited", { status: 403 }),
    });
    assert.equal(result.source, "cache");
    assert.equal(result.fetchedAt, staleAt);
    assert.deepEqual(result.prs.map((p) => p.number), [5]);
  });

  it("429 with no cache falls back to the snapshot (empty PR list)", async () => {
    const result = await fetchLivePrs({
      storage: memoryStorage(),
      now: NOW,
      fetchFn: async () => new Response("slow down", { status: 429 }),
    });
    assert.equal(result.source, "snapshot");
    assert.equal(result.fetchedAt, null);
    assert.deepEqual(result.prs, []);
  });

  it("a network error with no cache falls back to the snapshot, with exactly one attempt", async () => {
    let calls = 0;
    const result = await fetchLivePrs({
      storage: memoryStorage(),
      now: NOW,
      fetchFn: async () => {
        calls += 1;
        throw new Error("offline");
      },
    });
    assert.equal(calls, 1, "never retry in a loop");
    assert.equal(result.source, "snapshot");
  });

  it("a 200 stores the ETag and payload for the next load", async () => {
    const storage = memoryStorage();
    const result = await fetchLivePrs({
      storage,
      now: NOW,
      fetchFn: async () =>
        new Response(
          JSON.stringify([{ number: 9, state: "open", merged_at: null, title: "Live one" }]),
          { status: 200, headers: { etag: '"fresh"', "content-type": "application/json" } },
        ),
    });
    assert.equal(result.source, "live");
    const cachedRaw = storage.map.get(CACHE_KEY);
    assert.ok(cachedRaw, "a cache entry must be stored");
    assert.equal((JSON.parse(cachedRaw) as { etag: string }).etag, '"fresh"');
    assert.deepEqual(result.prs.map((p) => p.title), ["Live one"]);
  });
});

describe("PR titles render as plain text", () => {
  it("a title containing <script> is escaped in rendered output", () => {
    const evil = "<script>alert(1)</script>";
    // This is exactly how StoryCard renders a live PR title: as a React
    // text child inside an element. React escapes text children, so the
    // markup can never become an element.
    const html = renderToString(createElement("span", { className: "board-pr-title" }, evil));
    assert.ok(!html.includes("<script>"), "no script element may appear");
    assert.ok(html.includes("&lt;script&gt;"), "the title must appear as escaped plain text");
  });

  it("the board sources never inject PR titles as HTML", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["story-card.tsx", "board-data.ts"]) {
      const src = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.ok(!src.includes("dangerouslySetInnerHTML"), `${file} must not use dangerouslySetInnerHTML`);
      assert.ok(!src.includes("innerHTML"), `${file} must not use innerHTML`);
    }
    const route = readFileSync(new URL("../routes/board.tsx", import.meta.url), "utf8");
    assert.ok(!route.includes("dangerouslySetInnerHTML"));
    assert.ok(!route.includes("innerHTML"));
  });
});
