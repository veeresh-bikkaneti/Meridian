import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import snapshotJson from "./snapshot.json" with { type: "json" };
import {
  applyLiveData,
  buildDependencyEdges,
  CACHE_KEY,
  CACHE_TTL_MS,
  dependencyDepths,
  deriveStatus,
  explicitIssueNumbers,
  fetchLiveIssues,
  fetchLivePrs,
  mapWorkToStories,
  parseGithubIssues,
  parseGithubPrs,
  readCache,
  storyMapLayouts,
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

describe("dependency edges (explicit PR waits only)", () => {
  it("builds exactly the 8 edges the snapshot's waitsOn PR references encode", () => {
    const edges = buildDependencyEdges(snapshot.stories);
    const asText = edges.map((e) => `${e.from}->${e.to}:${e.viaPr}`);
    assert.deepEqual(asText, [
      "2->3:431",
      "2->4:431",
      "3->5:430",
      "36->5:430",
      "17->12:434",
      "3->19:430",
      "17->19:434",
      "36->19:430",
    ]);
  });

  it("never derives an edge from prose that names no PR number", () => {
    const stories = [
      story({ title: "Pennant port", prs: [] }),
      story({ title: "Clue 4", prs: [], waitsOn: "Pennant port" }),
      story({ title: "Screens", prs: [], waitsOn: "Scene engine" }),
    ];
    assert.deepEqual(buildDependencyEdges(stories), []);
  });

  it("depths follow the longest prerequisite chain", () => {
    const depths = dependencyDepths(snapshot.stories);
    assert.equal(depths[2], 0);
    assert.equal(depths[3], 1);
    assert.equal(depths[5], 2);
    assert.equal(depths[17], 0);
    assert.equal(depths[12], 1);
    assert.equal(depths[19], 2);
    assert.equal(depths.filter((d) => d > 0).length, 5);
  });

  it("lane layout puts every prerequisite in an earlier slot than its dependent", () => {
    const layouts = storyMapLayouts(snapshot.stories, snapshot.lanes);
    for (const e of buildDependencyEdges(snapshot.stories)) {
      if (snapshot.stories[e.from].lane === snapshot.stories[e.to].lane) {
        assert.ok(
          layouts[e.from].slot < layouts[e.to].slot,
          `${snapshot.stories[e.from].title} must sit left of ${snapshot.stories[e.to].title}`,
        );
      }
    }
  });
});

describe("issues + PR map", () => {
  it("parseGithubIssues drops PR-shaped items and keeps real issues", () => {
    const parsed = parseGithubIssues([
      { number: 344, state: "open", title: "Real issue", html_url: "https://github.com/veeresh-bikkaneti/Meridian/issues/344" },
      { number: 434, state: "closed", title: "A PR in disguise", pull_request: { url: "https://api.github.com/x" } },
      { number: "x", state: "open" },
      null,
    ]);
    assert.deepEqual(parsed.map((i) => i.number), [344]);
    assert.equal(parsed[0].url, "https://github.com/veeresh-bikkaneti/Meridian/issues/344");
  });

  it("only the snapshot's explicit issue references map an issue to a story", () => {
    assert.deepEqual(explicitIssueNumbers(snapshot.stories[45]), [319, 344]);
    assert.deepEqual(explicitIssueNumbers(snapshot.stories[0]), []);
  });

  it("maps PRs by prs membership, issues by explicit reference, the rest unmapped", () => {
    const { groups, unmapped } = mapWorkToStories(
      snapshot.stories,
      [pr(434, "closed", true, "Math screen"), pr(430, "open", false, "Voice channel"), pr(999, "open", false, "Unknown PR")],
      [
        { number: 344, state: "open", title: "Known issue", url: "https://github.com/veeresh-bikkaneti/Meridian/issues/344" },
        { number: 999, state: "open", title: "Unknown issue", url: "https://github.com/veeresh-bikkaneti/Meridian/issues/999" },
      ],
    );
    const byTitle = new Map(groups.map((g) => [g.story.title, g.items.map((i) => `${i.kind}:${i.number}`)]));
    assert.deepEqual(byTitle.get("Math subject screen, 3 items per age group"), ["pr:434"]);
    // PR 430 belongs to both stories that list it — the board's own rule.
    assert.deepEqual(byTitle.get("Clue pacing and one voice at a time"), ["pr:430"]);
    assert.deepEqual(byTitle.get("Shared voice channel (one speaker at a time)"), ["pr:430"]);
    assert.deepEqual(byTitle.get("Open issues 344 and 319 (real unbuilt work)"), ["issue:344"]);
    assert.deepEqual(
      unmapped.map((i) => `${i.kind}:${i.number}`),
      ["pr:999", "issue:999"],
    );
  });

  it("fetchLiveIssues: 403 with no cache falls back to snapshot, one attempt", async () => {
    let calls = 0;
    const result = await fetchLiveIssues({
      storage: memoryStorage(),
      now: NOW,
      fetchFn: async () => {
        calls += 1;
        return new Response("rate limited", { status: 403 });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.source, "snapshot");
    assert.deepEqual(result.issues, []);
  });

  it("fetchLiveIssues: a 200 is parsed (PRs filtered out) and cached", async () => {
    const storage = memoryStorage();
    const result = await fetchLiveIssues({
      storage,
      now: NOW,
      fetchFn: async () =>
        new Response(
          JSON.stringify([
            { number: 319, state: "open", title: "Issue", html_url: "https://github.com/veeresh-bikkaneti/Meridian/issues/319" },
            { number: 436, state: "open", title: "PR", pull_request: {} },
          ]),
          { status: 200, headers: { etag: '"iss1"', "content-type": "application/json" } },
        ),
    });
    assert.equal(result.source, "live");
    assert.deepEqual(result.issues.map((i) => i.number), [319]);
    const again = await fetchLiveIssues({
      storage,
      now: NOW + 60_000,
      fetchFn: async () => {
        throw new Error("should not be called — fresh cache");
      },
    });
    assert.equal(again.source, "cache");
    assert.deepEqual(again.issues.map((i) => i.number), [319]);
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
