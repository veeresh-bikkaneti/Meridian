import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applyLiveBoard,
  fetchLiveStates,
  isBoardLinks,
  loadLiveBoard,
  parseGithubIssues,
  parseGithubPrs,
  wantedRecords,
  type BoardLinks,
  type KeyValueStorage,
} from "./live-feed.ts";
import type { PublishedBoard, RecordState } from "./status-core.ts";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const pr = (number: number, state: "open" | "closed", merged = false) => ({
  number,
  state,
  merged_at: merged ? "2026-11-01T00:00:00Z" : null,
});

function fakeFetch(handler: (url: string) => { status: number; body: unknown } | "throw") {
  const calls: string[] = [];
  const fetchFn = (async (url: string) => {
    calls.push(url);
    const r = handler(url);
    if (r === "throw") throw new Error("network down");
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as FetchFn;
  return { fetchFn, calls };
}

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("parseGithubPrs / parseGithubIssues — defensive parsing", () => {
  it("keeps well-formed PRs, maps merged_at to merged, drops junk", () => {
    const out = parseGithubPrs([
      pr(1, "open"),
      pr(2, "closed", true),
      { number: "3", state: "open" },
      { number: 4, state: "weird" },
      null,
      "junk",
    ]);
    assert.deepEqual(out, [
      { number: 1, state: "open", merged: false },
      { number: 2, state: "closed", merged: true },
    ]);
    assert.deepEqual(parseGithubPrs({ not: "an array" }), []);
  });

  it("issues parsing skips pull-request items (the pulls pass owns them)", () => {
    const out = parseGithubIssues([
      { number: 7, state: "open" },
      { number: 8, state: "closed", pull_request: { url: "x" } },
      { number: 9, state: "closed" },
    ]);
    assert.deepEqual(out, [
      { number: 7, state: "open" },
      { number: 9, state: "closed" },
    ]);
  });
});

describe("isBoardLinks / wantedRecords", () => {
  it("wanted = story records + task records, unique and sorted", () => {
    const links: BoardLinks = {
      version: 1,
      stories: {
        a: { records: [9, 3], carried: "done" },
        b: { records: [3], carried: "not-started", tasks: [{ phase: "Checking", record: 12 }] },
      },
    };
    assert.deepEqual(wantedRecords(links), [3, 9, 12]);
    assert.equal(isBoardLinks(links), true);
    assert.equal(isBoardLinks({ version: 2, stories: {} }), false);
    assert.equal(isBoardLinks({ version: 1, stories: { a: { records: ["x"], carried: "done" } } }), false);
    assert.equal(isBoardLinks(null), false);
  });
});

describe("fetchLiveStates — pagination until covered, honest failure", () => {
  it("pages until every wanted number is covered (the v2 one-page defect stays dead)", async () => {
    const page = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => pr(from + i, "closed", true));
    const { fetchFn, calls } = fakeFetch((url) => {
      if (url.includes("page=3")) return { status: 200, body: [...page(201, 59), pr(430, "open")] };
      if (url.includes("page=2")) return { status: 200, body: page(101, 100) };
      return { status: 200, body: page(1, 100) };
    });
    const result = await fetchLiveStates({
      wanted: [10, 250, 430],
      fetchFn,
      storage: null,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.equal(result.kind, "live");
    if (result.kind !== "live") return;
    assert.equal(result.covered, 3);
    assert.deepEqual(result.states.get(250), { merged: true, open: false });
    assert.deepEqual(result.states.get(430), { merged: false, open: true });
    assert.equal(calls.filter((u) => u.includes("/pulls")).length, 3);
    assert.equal(calls.filter((u) => u.includes("/issues")).length, 0);
  });

  it("runs the issues pass only for records the pulls list never showed", async () => {
    const { fetchFn, calls } = fakeFetch((url) => {
      if (url.includes("/issues")) {
        if (url.includes("page=2")) return { status: 200, body: [] };
        return {
          status: 200,
          body: [
            { number: 77, state: "open" },
            { number: 78, state: "closed", pull_request: { url: "x" } },
          ],
        };
      }
      if (url.includes("page=2")) return { status: 200, body: [pr(2001, "closed", true)] };
      return {
        status: 200,
        body: Array.from({ length: 100 }, (_, i) => pr(1000 + i, "closed", true)),
      };
    });
    const result = await fetchLiveStates({
      wanted: [77],
      fetchFn,
      storage: null,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.equal(result.kind, "live");
    if (result.kind !== "live") return;
    assert.deepEqual(result.states.get(77), { merged: false, open: true });
    assert.ok(calls.some((u) => u.includes("/issues")));
  });

  it("an HTTP error is a failed check — and is never retried", async () => {
    const { fetchFn, calls } = fakeFetch(() => ({ status: 403, body: { message: "rate limited" } }));
    const result = await fetchLiveStates({
      wanted: [5],
      fetchFn,
      storage: null,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.deepEqual(result, { kind: "unavailable", covered: 0, wanted: 1 });
    assert.equal(calls.length, 1);
  });

  it("a network error gets exactly one retry", async () => {
    let first = true;
    const { fetchFn, calls } = fakeFetch(() => {
      if (first) {
        first = false;
        return "throw";
      }
      return { status: 200, body: [pr(5, "closed", true)] };
    });
    const result = await fetchLiveStates({
      wanted: [5],
      fetchFn,
      storage: null,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.equal(result.kind, "live");
    assert.equal(calls.length, 2);

    const down = fakeFetch(() => "throw");
    const failed = await fetchLiveStates({
      wanted: [5],
      fetchFn: down.fetchFn,
      storage: null,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.equal(failed.kind, "unavailable");
    assert.equal(down.calls.length, 2);
  });

  it("a list that ends before coverage is a failed check with the honest count", async () => {
    const { fetchFn } = fakeFetch((url) => {
      if (url.includes("/issues")) return { status: 200, body: [] };
      return { status: 200, body: [pr(5, "closed", true)] };
    });
    const result = await fetchLiveStates({
      wanted: [5, 6],
      fetchFn,
      storage: null,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.deepEqual(result, { kind: "unavailable", covered: 1, wanted: 2 });
  });

  it("serves the session cache within its TTL; a changed wanted set ignores it", async () => {
    const storage = memoryStorage();
    const good = fakeFetch(() => ({ status: 200, body: [pr(5, "closed", true)] }));
    const first = await fetchLiveStates({
      wanted: [5],
      fetchFn: good.fetchFn,
      storage,
      now: 1_000_000,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.equal(first.kind, "live");

    const down = fakeFetch(() => "throw");
    const cached = await fetchLiveStates({
      wanted: [5],
      fetchFn: down.fetchFn,
      storage,
      now: 1_000_000 + 60_000,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.equal(cached.kind, "live");
    if (cached.kind === "live") assert.equal(cached.fromCache, true);
    assert.equal(down.calls.length, 0);

    const changed = await fetchLiveStates({
      wanted: [5, 6],
      fetchFn: down.fetchFn,
      storage,
      now: 1_000_000 + 60_000,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    });
    assert.equal(changed.kind, "unavailable");
  });
});

/* The real artifacts: the recompute must be the publisher's rule. */
const published = JSON.parse(
  readFileSync(new URL("../../public/board-status.json", import.meta.url), "utf8"),
) as PublishedBoard;
const links = JSON.parse(
  readFileSync(new URL("../../public/board-links.json", import.meta.url), "utf8"),
) as BoardLinks;
const capturedStates = new Map<number, RecordState>(
  Object.entries(
    JSON.parse(readFileSync(new URL("./record-states.json", import.meta.url), "utf8")) as Record<
      string,
      RecordState
    >,
  ).map(([n, s]) => [Number(n), s]),
);

describe("applyLiveBoard — the publisher's rule, fed live states", () => {
  it("fed the captured states, reproduces the published file exactly", () => {
    assert.deepEqual(applyLiveBoard(published, links, capturedStates), published);
  });

  it("one record reopening moves its stories, the counts, and the blocked derivation together", () => {
    const live = new Map(capturedStates);
    live.set(430, { merged: false, open: true });
    const board = applyLiveBoard(published, links, live);
    assert.deepEqual(board.counts, { done: 18, inProgress: 6, notStarted: 13, total: 37 });
    const stories = new Map(
      board.epics.flatMap((e) =>
        e.features.flatMap((f) => f.stories.map((s) => [s.slug, s] as const)),
      ),
    );
    const pacing = stories.get("clue-pacing-and-one-voice-at-a-time")!;
    assert.equal(pacing.status, "in-progress");
    assert.equal(pacing.line, "Testing in progress");
    const voice = stories.get("shared-voice-channel-one-speaker-at-a-time")!;
    assert.equal(voice.status, "in-progress");
    assert.equal(voice.line, "Recording in progress");
    const truce = stories.get("truce-pennant-port")!;
    assert.equal(truce.status, "not-started");
    assert.equal(truce.comingAfter, "Clues arrive one at a time, one voice at a time");
    assert.equal(truce.line, "Coming after: Clues arrive one at a time, one voice at a time");
  });
});

describe("loadLiveBoard — one sequence per page load", () => {
  it("repeat calls share the check; the board is recomputed from the live answer", async () => {
    const mini: PublishedBoard = {
      version: 3,
      source: "generated",
      updatedAt: "2026-11-16T00:00:00.000Z",
      counts: { done: 0, inProgress: 0, notStarted: 1, total: 1 },
      epics: [
        {
          id: "e",
          name: "Epic",
          color: "#000000",
          features: [
            {
              id: "f",
              name: "Feature",
              promise: "Promise",
              anim: "star",
              done: 0,
              total: 1,
              bonds: 0,
              stories: [
                { slug: "s-one", title: "Story One", status: "not-started", line: "Not started yet" },
              ],
            },
          ],
        },
      ],
      bonds: [],
    };
    const miniLinks: BoardLinks = {
      version: 1,
      stories: { "s-one": { records: [9], carried: "not-started" } },
    };
    const { fetchFn, calls } = fakeFetch(() => ({ status: 200, body: [pr(9, "closed", true)] }));
    const opts = {
      fetchFn,
      storage: null,
      pullsUrl: "https://example.test/pulls?per_page=100",
      issuesUrl: "https://example.test/issues?per_page=100",
    };
    const [a, b] = await Promise.all([
      loadLiveBoard(mini, miniLinks, opts),
      loadLiveBoard(mini, miniLinks, opts),
    ]);
    assert.equal(a.kind, "live");
    assert.equal(b.kind, "live");
    if (a.kind === "live") {
      assert.equal(a.board.counts.done, 1);
      assert.equal(a.board.epics[0].features[0].stories[0].status, "done");
    }
    assert.equal(calls.length, 1);
  });
});
