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
  caseNumber,
  dependencyDepths,
  dependencyRows,
  deriveStatus,
  donePathMatch,
  expeditionProgress,
  explicitIssueNumbers,
  fetchLiveIssues,
  fetchLivePrs,
  filterStories,
  headerMetrics,
  leadCounts,
  mapWorkToStories,
  nextToCrack,
  parseGithubIssues,
  parseGithubPrs,
  readCache,
  statusWhy,
  storyMapLayouts,
  storyMatchesQuery,
  writeCache,
  type GithubPr,
  type KeyValueStorage,
  type SnapshotData,
  type SnapshotStory,
} from "./board-data.ts";

const snapshot = snapshotJson as unknown as SnapshotData;

function story(partial: Partial<SnapshotStory>): SnapshotStory {
  return {
    id: "math/a-story",
    lane: "Math",
    title: "A story",
    status: "not-started",
    waitsOn: "—",
    waitsOnIds: [],
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

  it("every story has a non-empty unique id in <lane-slug>/<title-slug> form", () => {
    const slug = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const ids = snapshot.stories.map((s) => s.id);
    for (const s of snapshot.stories) {
      assert.ok(typeof s.id === "string" && s.id.length > 0, s.title);
      assert.equal(s.id, `${slug(s.lane)}/${slug(s.title)}`, s.title);
    }
    assert.equal(new Set(ids).size, ids.length, "ids must be unique");
  });

  it("every waitsOnIds entry is an existing story id", () => {
    const ids = new Set(snapshot.stories.map((s) => s.id));
    for (const s of snapshot.stories) {
      assert.ok(Array.isArray(s.waitsOnIds), s.title);
      for (const id of s.waitsOnIds) assert.ok(ids.has(id), `${s.title} -> ${id}`);
    }
  });

  it("waitsOnIds is exactly consistent with buildDependencyEdges output", () => {
    const edges = buildDependencyEdges(snapshot.stories);
    snapshot.stories.forEach((s, to) => {
      const expected = [...new Set(edges.filter((e) => e.to === to).map((e) => snapshot.stories[e.from].id))].sort(
        (a, b) => snapshot.stories.findIndex((x) => x.id === a) - snapshot.stories.findIndex((x) => x.id === b),
      );
      assert.deepEqual([...s.waitsOnIds].sort(), [...expected].sort(), s.title);
      // snapshot order, not just set equality
      assert.deepEqual(s.waitsOnIds, expected, s.title);
    });
  });

  it("waitsOn text is unchanged for sampled stories", () => {
    const byTitle = new Map(snapshot.stories.map((s) => [s.title, s]));
    assert.equal(
      byTitle.get("Clue pacing and one voice at a time")?.waitsOn,
      "PR 431 first, update from main (47 behind), fix the two-voices test gap",
    );
    assert.equal(
      byTitle.get("Holmes and Watson in math")?.waitsOn,
      "PR 434 and PR 430 merged. Prompt written",
    );
    assert.equal(byTitle.get("Truce pennant port")?.waitsOn, "PR 430 merged. Prompt is ready; old branch kept");
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

describe("header metrics", () => {
  // Hand-counted fixture: PR 100 is open and shared by two stories,
  // PR 200 is merged. Edges (buildDependencyEdges): Blocked story and
  // Done waiter wait on PR 100's stories; Waiting-on-done waits on
  // PR 200's (done) story.
  const fixture = () => [
    story({ title: "Prereq", prs: [100], status: "not-started" }),
    story({ title: "Blocked story", prs: [], status: "in-progress", waitsOn: "PR 100 first" }),
    story({ title: "Waiting on done", prs: [], status: "not-started", waitsOn: "PR 200 merged" }),
    story({ title: "Done prereq", prs: [200], status: "in-progress" }),
    story({ title: "Done waiter", prs: [], status: "done", waitsOn: "PR 100 first" }),
    story({ title: "Also on PR 100", prs: [100], status: "not-started" }),
  ];
  const livePrs = () => [pr(100, "open", false, "Open one"), pr(200, "closed", true, "Merged one")];

  it("applyLiveData exposes per-PR live states (open / merged / closed)", () => {
    const out = applyLiveData([story({ prs: [7, 8, 9] })], [
      pr(7, "open", false),
      pr(8, "closed", true),
      pr(9, "closed", false),
    ]);
    assert.deepEqual(out[0].prStates, { 7: "open", 8: "merged", 9: "closed" });
  });

  it("counts statuses, distinct open PRs (duplicates once), and blocked stories", () => {
    // Live: Prereq + Also on PR 100 -> in-progress (open PR); Blocked story
    // stays in-progress; Waiting on done stays not-started; Done prereq ->
    // done (merged); Done waiter stays done.
    // Blocked: only "Blocked story" (not done, waits on not-done stories).
    // "Waiting on done" waits on a done story; "Done waiter" is done.
    assert.deepEqual(headerMetrics(applyLiveData(fixture(), livePrs())), {
      notStarted: 1,
      inProgress: 3,
      done: 2,
      openPrs: 1,
      blocked: 1,
    });
  });

  it("snapshot-only stories carry no PR states, so openPrs is 0", () => {
    const metrics = headerMetrics(applyLiveData(fixture(), []));
    assert.equal(metrics.openPrs, 0);
    // Snapshot statuses stand: not-started x3, in-progress x2, done x1.
    // Without live data the PR 200 story is not done, so both stories
    // waiting on a not-done story count as blocked (Done waiter excluded).
    assert.deepEqual(metrics, { notStarted: 3, inProgress: 2, done: 1, openPrs: 0, blocked: 2 });
  });
});

describe("case numbers + lead counts", () => {
  it("caseNumber is the 1-based position within the story's own lane, in snapshot order", () => {
    const stories = [
      story({ id: "math/a", lane: "Math", title: "A" }),
      story({ id: "journals/b", lane: "Journals", title: "B" }),
      story({ id: "math/c", lane: "Math", title: "C" }),
      story({ id: "math/d", lane: "Math", title: "D" }),
      story({ id: "journals/e", lane: "Journals", title: "E" }),
    ];
    assert.equal(caseNumber(stories[0], stories), 1);
    assert.equal(caseNumber(stories[1], stories), 1); // first case of its own lane
    assert.equal(caseNumber(stories[2], stories), 2);
    assert.equal(caseNumber(stories[3], stories), 3);
    assert.equal(caseNumber(stories[4], stories), 2);
  });

  it("caseNumber matches by id, not by object identity or title", () => {
    const stories = [
      story({ id: "math/a", lane: "Math", title: "A" }),
      story({ id: "math/c", lane: "Math", title: "C" }),
    ];
    const overlayCopy = { ...stories[1], title: "C (live copy)" };
    assert.equal(caseNumber(overlayCopy, stories), 2);
    assert.equal(caseNumber(story({ id: "math/absent", lane: "Math" }), stories), 0);
  });

  it("leadCounts counts every linked PR, solved only when its live state is merged", () => {
    const [s] = applyLiveData([story({ prs: [10, 11, 12] })], [
      pr(10, "closed", true),
      pr(11, "open", false),
      pr(12, "closed", false),
    ]);
    assert.deepEqual(leadCounts(s), { total: 3, solved: 1 });
  });

  it("leadCounts: a PR shared by two stories counts as a solved lead for both", () => {
    const [a, b] = applyLiveData(
      [story({ id: "math/a", prs: [100, 101] }), story({ id: "math/b", prs: [100] })],
      [pr(100, "closed", true), pr(101, "open", false)],
    );
    assert.deepEqual(leadCounts(a), { total: 2, solved: 1 });
    assert.deepEqual(leadCounts(b), { total: 1, solved: 1 });
  });

  it("leadCounts: PRs with no live state are leads, never solved", () => {
    const [partial] = applyLiveData([story({ prs: [200, 201] })], [pr(200, "closed", false)]);
    assert.deepEqual(leadCounts(partial), { total: 2, solved: 0 });
    const [snapshotOnly] = applyLiveData([story({ prs: [200, 201] })], []);
    assert.deepEqual(leadCounts(snapshotOnly), { total: 2, solved: 0 });
  });

  it("leadCounts: no PRs means no leads; all merged means all solved", () => {
    const [none] = applyLiveData([story({ prs: [] })], []);
    assert.deepEqual(leadCounts(none), { total: 0, solved: 0 });
    const [all] = applyLiveData([story({ prs: [1, 2] })], [pr(1, "closed", true), pr(2, "closed", true)]);
    assert.deepEqual(leadCounts(all), { total: 2, solved: 2 });
  });
});

describe("expedition progress + next to crack", () => {
  const live = (partials: Partial<SnapshotStory>[]) => applyLiveData(partials.map((p) => story(p)), []);
  const lanes = [
    { name: "Math", note: "math note" },
    { name: "Journals", note: "journals note" },
    { name: "Empty lane", note: "nothing here" },
  ];

  it("progress counts closed overall and per lane, including an empty lane", () => {
    const stories = live([
      { id: "math/a", lane: "Math", title: "A", status: "done" },
      { id: "math/b", lane: "Math", title: "B", status: "in-progress" },
      { id: "math/c", lane: "Math", title: "C", status: "not-started" },
      { id: "journals/d", lane: "Journals", title: "D", status: "done" },
      { id: "journals/e", lane: "Journals", title: "E", status: "done" },
    ]);
    const progress = expeditionProgress(stories, lanes);
    assert.equal(progress.total, 5);
    assert.equal(progress.closed, 3); // A, D, E
    assert.deepEqual(
      progress.perLane.map(({ lane, closed, total }) => [lane.name, closed, total]),
      [
        ["Math", 1, 3],
        ["Journals", 2, 2],
        ["Empty lane", 0, 0],
      ],
    );
  });

  it("nextToCrack picks the open case that unblocks the most", () => {
    const stories = live([
      { id: "math/a", lane: "Math", title: "A", status: "in-progress" },
      { id: "math/b", lane: "Math", title: "B", status: "not-started" },
      { id: "math/c", lane: "Math", title: "C", status: "not-started", waitsOnIds: ["math/a"] },
      { id: "math/d", lane: "Math", title: "D", status: "not-started", waitsOnIds: ["math/a", "math/b"] },
      { id: "math/e", lane: "Math", title: "E", status: "not-started", waitsOnIds: ["math/a"] },
    ]);
    const next = nextToCrack(stories);
    assert.equal(next?.story.title, "A");
    assert.equal(next?.unblocks, 3);
  });

  it("nextToCrack tie breaks by snapshot order (first wins)", () => {
    const stories = live([
      { id: "math/a", lane: "Math", title: "First", status: "not-started" },
      { id: "math/b", lane: "Math", title: "Second", status: "not-started" },
      { id: "math/c", lane: "Math", title: "C", status: "not-started", waitsOnIds: ["math/a"] },
      { id: "math/d", lane: "Math", title: "D", status: "not-started", waitsOnIds: ["math/b"] },
    ]);
    const next = nextToCrack(stories);
    assert.equal(next?.story.title, "First");
    assert.equal(next?.unblocks, 1);
  });

  it("nextToCrack excludes a done leader", () => {
    const stories = live([
      { id: "math/a", lane: "Math", title: "Done leader", status: "done" },
      { id: "math/b", lane: "Math", title: "Open runner-up", status: "in-progress" },
      { id: "math/c", lane: "Math", title: "C", status: "not-started", waitsOnIds: ["math/a"] },
      { id: "math/d", lane: "Math", title: "D", status: "not-started", waitsOnIds: ["math/a", "math/b"] },
      { id: "math/e", lane: "Math", title: "E", status: "not-started", waitsOnIds: ["math/a"] },
    ]);
    const next = nextToCrack(stories);
    assert.equal(next?.story.title, "Open runner-up");
    assert.equal(next?.unblocks, 1);
  });

  it("nextToCrack returns null when no open case unblocks anything", () => {
    const stories = live([
      { id: "math/a", lane: "Math", title: "A", status: "not-started" },
      { id: "math/b", lane: "Math", title: "B", status: "in-progress" },
      { id: "math/c", lane: "Math", title: "C", status: "done", waitsOnIds: [] },
    ]);
    assert.equal(nextToCrack(stories), null);
  });
});

describe("search + blocked-only filter", () => {
  const fixture = () =>
    applyLiveData(
      [
        story({ title: "Clue pacing and one voice at a time", lane: "Detective core", owner: "Your agent", prs: [430], status: "not-started" }),
        story({ title: "Math subject screen", lane: "Math", owner: "You", prs: [434], status: "in-progress" }),
        story({ title: "Truce pennant port", lane: "Detective core", owner: "Your agent", prs: [], status: "not-started", waitsOn: "PR 430 merged" }),
        story({ title: "Quiet story", lane: "Journals", owner: null, prs: [], status: "done" }),
      ],
      [],
    );
  const titles = (list: { title: string }[]) => list.map((s) => s.title);

  it("matches title, lane and owner case-insensitively", () => {
    const [a, b] = fixture();
    assert.equal(storyMatchesQuery(a, "CLUE PACING"), true);
    assert.equal(storyMatchesQuery(b, "math"), true); // lane (and title)
    assert.equal(storyMatchesQuery(a, "your AGENT"), true);
    assert.equal(storyMatchesQuery(b, "detective"), false);
    assert.equal(storyMatchesQuery(a, ""), true);
  });

  it("matches PR numbers in plain, 'PR 430' and '#430' forms", () => {
    const stories = fixture();
    assert.deepEqual(titles(filterStories(stories, { query: "430", blockedOnly: false })), [
      "Clue pacing and one voice at a time",
    ]);
    assert.deepEqual(titles(filterStories(stories, { query: "PR 430", blockedOnly: false })), [
      "Clue pacing and one voice at a time",
    ]);
    assert.deepEqual(titles(filterStories(stories, { query: "#434", blockedOnly: false })), [
      "Math subject screen",
    ]);
  });

  it("blockedOnly keeps only blocked stories", () => {
    assert.deepEqual(titles(filterStories(fixture(), { query: "", blockedOnly: true })), [
      "Truce pennant port",
    ]);
  });

  it("combines query and blockedOnly, and can return nothing", () => {
    const stories = fixture();
    assert.deepEqual(titles(filterStories(stories, { query: "detective", blockedOnly: true })), [
      "Truce pennant port",
    ]);
    assert.deepEqual(filterStories(stories, { query: "math", blockedOnly: true }), []);
    assert.deepEqual(filterStories(stories, { query: "no such thing", blockedOnly: false }), []);
  });
});

describe("statusWhy + done path match", () => {
  const live = (partial: Partial<SnapshotStory>, prs: GithubPr[]) =>
    applyLiveData([story(partial)], prs)[0];

  it("all PRs merged explains Done", () => {
    const s = live({ prs: [10, 11] }, [pr(10, "closed", true), pr(11, "closed", true)]);
    assert.equal(statusWhy(s), "Done — all 2 linked PRs are merged (PR 10, PR 11)");
  });

  it("an open PR explains In progress", () => {
    const s = live({ prs: [430] }, [pr(430, "open", false)]);
    assert.equal(statusWhy(s), "In progress — PR 430 is open");
  });

  it("a closed-unmerged PR says the snapshot status is kept", () => {
    const s = live({ prs: [10], status: "in-progress" }, [pr(10, "closed", false)]);
    assert.equal(statusWhy(s), "Keeps the snapshot status — PR 10 closed without merging");
  });

  it("no PRs says snapshot status", () => {
    assert.equal(statusWhy(live({ prs: [] }, [])), "Snapshot status — no linked PRs");
  });

  it("partial live data names what is unknown, never Done", () => {
    const s = live({ prs: [10, 11] }, [pr(10, "closed", true)]);
    const why = statusWhy(s);
    assert.ok(why.includes("PR 11 has no live data yet"), why);
    assert.ok(!why.startsWith("Done"), why);
    const none = live({ prs: [10] }, []);
    assert.equal(statusWhy(none), "Snapshot status — PR 10 has no live data yet");
  });

  it("donePathMatch only fires on a verbatim substring match", () => {
    assert.equal(
      donePathMatch(story({ title: "Render the missing voices" }), snapshot.donePath),
      "Render the missing voices",
    );
    assert.equal(donePathMatch(story({ title: "Journals release" }), snapshot.donePath), "Journals");
    assert.equal(
      donePathMatch(story({ title: "Math subject screen, 3 items per age group" }), snapshot.donePath),
      null,
    );
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

describe("dependency rows", () => {
  it("snapshot: row count equals total waitsOnIds entries", () => {
    const rows = dependencyRows(snapshot.stories);
    const total = snapshot.stories.reduce((n, s) => n + s.waitsOnIds.length, 0);
    assert.equal(rows.length, total);
    assert.equal(rows.length, 8);
  });

  it("fixture: impact counts and viaPrs are correct", () => {
    const stories = [
      story({ id: "x/prereq", title: "Prereq", prs: [100] }),
      story({ id: "x/other-prereq", title: "Other prereq", prs: [200] }),
      story({ id: "x/waiter-one", title: "Waiter one", waitsOn: "PR 100 first", waitsOnIds: ["x/prereq"] }),
      story({
        id: "x/waiter-two",
        title: "Waiter two",
        waitsOn: "PR 100 and PR 200",
        waitsOnIds: ["x/prereq", "x/other-prereq"],
      }),
    ];
    const rows = dependencyRows(stories);
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((r) => [r.from.title, r.to.title, r.viaPrs, r.blocks]),
      [
        ["Prereq", "Waiter one", [100], 2],
        ["Prereq", "Waiter two", [100], 2],
        ["Other prereq", "Waiter two", [200], 1],
      ],
    );
  });

  it("returns no rows when no story waits on another", () => {
    assert.deepEqual(dependencyRows([story({ id: "x/a", title: "A" }), story({ id: "x/b", title: "B" })]), []);
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
    for (const file of ["story-card.tsx", "board-data.ts", "story-inspector.tsx"]) {
      const src = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.ok(!src.includes("dangerouslySetInnerHTML"), `${file} must not use dangerouslySetInnerHTML`);
      assert.ok(!src.includes("innerHTML"), `${file} must not use innerHTML`);
    }
    const route = readFileSync(new URL("../routes/board.tsx", import.meta.url), "utf8");
    assert.ok(!route.includes("dangerouslySetInnerHTML"));
    assert.ok(!route.includes("innerHTML"));
  });
});
