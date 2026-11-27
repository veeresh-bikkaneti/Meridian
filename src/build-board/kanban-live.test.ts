import assert from "node:assert/strict";
import { describe, it } from "node:test";
import branchesFixture from "./__fixtures__/github/branches.json" with { type: "json" };
import issuesFixture from "./__fixtures__/github/issues.json" with { type: "json" };
import pullsFixture from "./__fixtures__/github/pulls-by-number.json" with { type: "json" };
import snapshotJson from "./kanban.json" with { type: "json" };
import {
  buildBoardUrl,
  fetchKanbanLive,
  githubPullsPageUrl,
  KANBAN_DEEP_CACHE_KEY,
  KANBAN_DEEP_CACHE_TTL_MS,
  KANBAN_LIVE_CACHE_KEY,
  KANBAN_LIVE_CACHE_TTL_MS,
  KANBAN_POLL_INTERVAL_MS,
  loadKanbanLive,
  loadPublicSnapshot,
  parseGithubBranches,
  parseGithubIssue,
  parseGithubIssues,
  parseGithubPull,
  parseGithubPulls,
  parseLabelNames,
  refreshKanbanLive,
  shouldRefetchKanbanLive,
  startKanbanPolling,
  type KanbanRefresh,
  type KeyValueStorage,
} from "./kanban-live.ts";

const pull571 = pullsFixture.pulls["571"];
const branchesBody = branchesFixture.branches;

/* The live-feed test discipline: drive the real transport port by
 * stubbing the global fetch it resolves lazily per call. */
function stubGlobalFetch(
  handler: (url: string) => { status: number; body: unknown } | "throw",
) {
  const realFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const r = handler(url);
    if (r === "throw") throw new Error("network down");
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    };
  }) as unknown as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = realFetch) };
}

function fixtureHandler(url: string) {
  if (url.includes("/branches")) return { status: 200, body: branchesBody };
  if (url.includes("/issues")) return { status: 200, body: issuesFixture.issues };
  if (url.includes("sort=updated")) return { status: 200, body: Object.values(pullsFixture.pulls) };
  const num = /\/pulls\/(\d+)/.exec(url);
  if (num) {
    const body = (pullsFixture.pulls as Record<string, unknown>)[num[1]];
    if (body) return { status: 200, body };
  }
  return { status: 404, body: { message: "not stubbed" } };
}

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("parseGithubPull", () => {
  it("parses one recorded pull (the pulls/{n} shape)", () => {
    const parsed = parseGithubPull(pull571);
    assert.equal(parsed?.number, 571);
    assert.equal(parsed?.info.state, "open");
    assert.equal(parsed?.info.draft, true);
    assert.equal(parsed?.info.merged, false);
    assert.equal(
      parsed?.info.title,
      "Phase 1 Part B: game-app onto the storage port (noRawIo 45 to 13)",
    );
    assert.equal(parsed?.info.headRef, "phase1/ports-part-b");
    const merged = parseGithubPull(pullsFixture.pulls["565"]);
    assert.equal(merged?.info.state, "closed");
    assert.equal(merged?.info.draft, false);
    assert.equal(merged?.info.merged, true);
    assert.equal(typeof merged?.info.title, "string");
    assert.equal(typeof merged?.info.headRef, "string");
  });

  it("maps label names and ignores a pull body", () => {
    const parsed = parseGithubPull({
      number: 577,
      state: "open",
      draft: false,
      merged_at: null,
      title: "chore(td-09.1): retire pages",
      body: "TD-99.9 is only in the body",
      head: { ref: "chore/td-09.1-retire-pages" },
      labels: [{ name: "C:Opera" }, { name: "" }, "C:Edge", { name: 3 }, null],
    });
    assert.equal(parsed?.info.headRef, "chore/td-09.1-retire-pages");
    assert.deepEqual(parsed?.info.labels, ["C:Opera", "C:Edge"]);
    assert.equal("body" in (parsed?.info ?? {}), false);
  });

  it("returns null on malformed payloads", () => {
    assert.equal(parseGithubPull(null), null);
    assert.equal(parseGithubPull({ state: "open" }), null);
    assert.equal(parseGithubPull({ number: "571", state: "open" }), null);
    assert.equal(parseGithubPull({ number: 1, state: "weird" }), null);
  });
});

describe("parseGithubPulls", () => {
  it("maps the list shape, keyed by PR number", () => {
    const pulls = parseGithubPulls([
      { number: 571, state: "open", draft: true, merged_at: null },
      { number: 565, state: "closed", draft: false, merged_at: "2026-11-21T17:42:00Z" },
      { number: 573, state: "closed", draft: false, merged_at: null },
    ]);
    assert.deepEqual(pulls.get(571), { state: "open", draft: true, merged: false });
    assert.deepEqual(pulls.get(565), { state: "closed", draft: false, merged: true });
    assert.deepEqual(pulls.get(573), { state: "closed", draft: false, merged: false });
  });

  it("skips malformed entries and survives a non-array payload", () => {
    const pulls = parseGithubPulls([
      null,
      "nope",
      { state: "open" },
      { number: "571", state: "open" },
      { number: 12, state: "weird" },
      { number: 42, state: "open" },
    ]);
    assert.equal(pulls.size, 1);
    assert.deepEqual(pulls.get(42), { state: "open", draft: false, merged: false });
    assert.equal(parseGithubPulls({ message: "rate limited" }).size, 0);
    assert.equal(parseGithubPulls(undefined).size, 0);
  });
});

describe("parseGithubBranches", () => {
  it("collects the recorded branch names into a set", () => {
    const branches = parseGithubBranches(branchesBody);
    assert.ok(branches.has("phase1/ports-part-b"));
    assert.ok(branches.has("main"));
  });

  it("skips malformed entries and survives a non-array payload", () => {
    const branches = parseGithubBranches([null, {}, { name: 7 }, { name: "" }, { name: "ok" }]);
    assert.deepEqual([...branches], ["ok"]);
    assert.equal(parseGithubBranches("nope").size, 0);
  });
});

describe("parseLabelNames", () => {
  it("reads string labels and { name } objects", () => {
    assert.deepEqual(parseLabelNames([{ name: "C:Opera" }, "C:blocked", { name: "" }, 3]), [
      "C:Opera",
      "C:blocked",
    ]);
    assert.equal(parseLabelNames("nope"), undefined);
  });
});

describe("parseGithubIssues (TD-08.7)", () => {
  it("parses the fixture: two issues, the pull row filtered out", () => {
    const issues = parseGithubIssues(issuesFixture.issues);
    assert.equal(issues.size, 2);
    assert.equal(issues.get(590)?.title, "Example open bug 590");
    assert.equal(
      issues.get(590)?.htmlUrl,
      "https://github.com/veeresh-bikkaneti/Meridian/issues/590",
    );
    assert.deepEqual(issues.get(590)?.labels, ["bug"]);
    assert.equal(issues.get(478)?.title, "Example open bug 478");
    assert.equal(issues.has(999), false);
  });

  it("skips rows without a number or title, and builds the URL when html_url is missing", () => {
    assert.equal(parseGithubIssue({ number: 1 }), null);
    assert.equal(parseGithubIssue({ title: "no number" }), null);
    assert.equal(parseGithubIssue({ number: 7, title: "x", pull_request: {} }), null);
    const built = parseGithubIssue({ number: 7, title: "x" });
    assert.equal(
      built?.info.htmlUrl,
      "https://github.com/veeresh-bikkaneti/Meridian/issues/7",
    );
  });
});

describe("fetchKanbanLive — issues failures never fail the check", () => {
  it("a failed issues call leaves the board live with the bug list unavailable", async () => {
    for (const status of [500, 403, 429]) {
      const stub = stubGlobalFetch((url) => {
        if (url.includes("/branches")) return { status: 200, body: [] };
        if (url.includes("/issues")) return { status, body: { message: "issues down" } };
        if (url.includes("sort=updated")) return { status: 200, body: [] };
        return { status: 500, body: { message: "should not be called" } };
      });
      try {
        const result = await refreshKanbanLive({
          event: "mount",
          storage: null,
          deepStorage: null,
          now: 1_000,
        });
        assert.equal(result.action, "live");
        if (result.action === "live") {
          assert.equal(result.state.issues.size, 0);
          assert.equal(result.state.issuesUnavailable, true);
        }
      } finally {
        stub.restore();
      }
    }
  });

  it("a non-array issues payload is unavailable, not fatal", async () => {
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("/issues")) return { status: 200, body: { issues: [] } };
      if (url.includes("sort=updated")) return { status: 200, body: [] };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null, deepStorage: null });
      assert.ok(state);
      assert.equal(state.issuesUnavailable, true);
    } finally {
      stub.restore();
    }
  });
});

describe("fetchKanbanLive — fast tier", () => {
  it("does not call pulls/{n} when the closes PR is already in the recent list", async () => {
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      const state = await fetchKanbanLive({
        storage: null,
        now: 1_000_000,
      });
      assert.ok(state);
      assert.equal(state.pulls.get(571)?.state, "open");
      assert.equal(state.pulls.get(571)?.draft, true);
      assert.equal(state.pulls.get(571)?.merged, false);
      assert.equal(state.pulls.get(571)?.headRef, "phase1/ports-part-b");
      assert.ok(state.branches.has("phase1/ports-part-b"));
      assert.equal(state.fetchedAt, 1_000_000);
      assert.equal(stub.calls.length, 3);
      assert.ok(
        stub.calls.some((c) =>
          c.url.includes("pulls?state=all&sort=updated&direction=desc&per_page=100"),
        ),
      );
      assert.ok(stub.calls.some((c) => c.url.includes("/branches?per_page=100")));
      assert.ok(stub.calls.some((c) => c.url.includes("/issues?labels=bug&state=open")));
      assert.equal(stub.calls.filter((c) => /\/pulls\/\d+/.test(c.url)).length, 0);
      const headers = stub.calls[0]?.init?.headers as Record<string, string> | undefined;
      assert.equal(headers?.["accept"], "application/vnd.github+json");
    } finally {
      stub.restore();
    }
  });

  it("does not look up a missing number and does not walk pages", async () => {
    const stub = stubGlobalFetch((url) => {
      if (url.includes("sort=updated")) return { status: 200, body: [] };
      if (url.includes("/branches")) return { status: 200, body: [] };
      return { status: 200, body: [{ number: 571, state: "open", draft: true }] };
    });
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.ok(state);
      assert.equal(state.pulls.has(571), false);
      assert.equal(stub.calls.length, 3);
      assert.equal(stub.calls.filter((c) => /\/pulls\/\d+/.test(c.url)).length, 0);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 0);
    } finally {
      stub.restore();
    }
  });

  it("resolves null on a 403 (the unauthenticated rate limit answering)", async () => {
    const stub = stubGlobalFetch(() => ({ status: 403, body: { message: "rate limited" } }));
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.equal(state, null);
    } finally {
      stub.restore();
    }
  });

  it("resolves null on a 429", async () => {
    const stub = stubGlobalFetch(() => ({ status: 429, body: { message: "slow down" } }));
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.equal(state, null);
    } finally {
      stub.restore();
    }
  });

  it("retries a network error exactly once, then succeeds", async () => {
    let recentCalls = 0;
    const stub = stubGlobalFetch((url) => {
      if (url.includes("sort=updated")) {
        recentCalls += 1;
        if (recentCalls === 1) return "throw";
        return { status: 200, body: Object.values(pullsFixture.pulls) };
      }
      return fixtureHandler(url);
    });
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.ok(state);
      assert.equal(recentCalls, 2);
    } finally {
      stub.restore();
    }
  });

  it("resolves null when the network stays down (one retry, no more)", async () => {
    let calls = 0;
    const stub = stubGlobalFetch(() => {
      calls += 1;
      return "throw";
    });
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.equal(state, null);
      assert.equal(calls, 2);
    } finally {
      stub.restore();
    }
  });

  it("resolves null when a payload is not the expected shape", async () => {
    const stub = stubGlobalFetch((url) =>
      url.includes("/branches")
        ? { status: 200, body: { message: "not an array" } }
        : fixtureHandler(url),
    );
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.equal(state, null);
    } finally {
      stub.restore();
    }
  });

  it("resolves null when the recent pulls payload is not an array", async () => {
    const stub = stubGlobalFetch((url) =>
      url.includes("sort=updated")
        ? { status: 200, body: { message: "not a list" } }
        : fixtureHandler(url),
    );
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.equal(state, null);
    } finally {
      stub.restore();
    }
  });

  it("writes and reads the v6 cache, including title, headRef and issues", async () => {
    const storage = memoryStorage();
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: branchesBody };
      if (url.includes("/issues")) return { status: 200, body: issuesFixture.issues };
      if (url.includes("sort=updated")) {
        return {
          status: 200,
          body: [
            {
              number: 571,
              state: "open",
              draft: true,
              merged_at: null,
              title: "Phase 1 Part B",
              head: { ref: "phase1/ports-part-b" },
              labels: [{ name: "C:Opera" }],
            },
          ],
        };
      }
      return { status: 404, body: { message: "unexpected" } };
    });
    try {
      const state = await fetchKanbanLive({ storage, now: 5_000 });
      assert.ok(state);
      assert.equal(state.pulls.get(571)?.title, "Phase 1 Part B");
      assert.equal(state.pulls.get(571)?.headRef, "phase1/ports-part-b");
      assert.deepEqual(state.pulls.get(571)?.labels, ["C:Opera"]);
      assert.equal(state.issues.size, 2);
      assert.equal(state.issues.get(590)?.title, "Example open bug 590");
      assert.equal(state.issuesUnavailable, false);
      assert.equal(stub.calls.length, 3);
      const raw = storage.map.get(KANBAN_LIVE_CACHE_KEY);
      assert.equal(KANBAN_LIVE_CACHE_KEY, "meridian-kanban-live:v6");
      assert.ok(raw);
      assert.equal(raw.includes("phase1/ports-part-b"), true);
      assert.equal(storage.map.has("meridian-kanban-live:v5"), false);
      const again = await fetchKanbanLive({ storage, now: 5_000 + 1_000 });
      assert.equal(again?.pulls.get(571)?.title, "Phase 1 Part B");
      assert.equal(again?.pulls.get(571)?.headRef, "phase1/ports-part-b");
      assert.equal(again?.issues.size, 2);
      assert.equal(again?.issues.get(478)?.title, "Example open bug 478");
      assert.equal(again?.issuesUnavailable, false);
      assert.equal(stub.calls.length, 3);
    } finally {
      stub.restore();
    }
  });

  it("serves the 5-minute session cache instead of refetching", async () => {
    const storage = memoryStorage();
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      const first = await fetchKanbanLive({
        storage,
        now: 1_000_000,
      });
      assert.ok(first);
      assert.equal(stub.calls.length, 3);
      const second = await fetchKanbanLive({
        storage,
        now: 1_000_000 + 4 * 60_000,
      });
      assert.ok(second);
      assert.equal(stub.calls.length, 3);
      const third = await fetchKanbanLive({
        storage,
        now: 1_000_000 + 6 * 60_000,
      });
      assert.ok(third);
      assert.equal(stub.calls.length, 6);
    } finally {
      stub.restore();
    }
  });
});

describe("fetchKanbanLive — deep tier (TD-08.7)", () => {
  /* One full pulls page: numbers start..start+99. */
  const fullPage = (
    start: number,
  ): { number: number; state: string; draft: boolean; merged_at: string | null; title: string }[] =>
    Array.from({ length: 100 }, (_, i) => ({
      number: start + i,
      state: "closed",
      draft: false,
      merged_at: "2026-01-01T00:00:00Z",
      title: `filler ${start + i}`,
    }));
  const shortPage = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      number: start + i,
      state: "closed",
      draft: false,
      merged_at: "2026-01-01T00:00:00Z",
      title: `older ${start + i}`,
    }));

  it("first load pages past a full first page and merges the older rows", async () => {
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("page=2")) return { status: 200, body: shortPage(101, 30) };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null, deepStorage: null });
      assert.ok(state);
      // A PR only on page 2 is in the merged state.
      assert.equal(state.pulls.size, 130);
      assert.ok(state.pulls.has(125));
      assert.equal(state.pulls.get(125)?.merged, true);
      assert.equal(stub.calls.filter((c) => c.url.includes("page=3")).length, 0);
      assert.equal(stub.calls.length, 4);
    } finally {
      stub.restore();
    }
  });

  it("a short page stops paging early", async () => {
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("page=2")) return { status: 200, body: shortPage(101, 5) };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null, deepStorage: null });
      assert.ok(state);
      assert.equal(state.pulls.size, 105);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 1);
    } finally {
      stub.restore();
    }
  });

  it("never requests page 6, even when page 5 is full", async () => {
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      const page = /[?&]page=(\d+)/.exec(url)?.[1];
      if (page) return { status: 200, body: fullPage((Number(page) - 1) * 100 + 1) };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null, deepStorage: null });
      assert.ok(state);
      assert.equal(state.pulls.size, 500);
      assert.equal(stub.calls.filter((c) => c.url.includes("page=6")).length, 0);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 4);
      assert.equal(stub.calls.length, 7);
      assert.ok(githubPullsPageUrl(3).endsWith("&page=3"));
    } finally {
      stub.restore();
    }
  });

  it("the fast tier wins when a PR appears on both tiers", async () => {
    const first = fullPage(1);
    first[49] = {
      number: 50,
      state: "open",
      draft: false,
      merged_at: null,
      title: "still open 50",
    };
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("page=2")) {
        return {
          status: 200,
          body: [
            {
              number: 50,
              state: "closed",
              draft: false,
              merged_at: "2026-01-01T00:00:00Z",
              title: "stale 50",
            },
          ],
        };
      }
      if (url.includes("sort=updated")) return { status: 200, body: first };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null, deepStorage: null });
      assert.ok(state);
      assert.equal(state.pulls.get(50)?.state, "open");
      assert.equal(state.pulls.get(50)?.merged, false);
    } finally {
      stub.restore();
    }
  });

  it("deep cache: no deep calls inside 60 min, deep calls again after", async () => {
    const storage = memoryStorage();
    const deepStorage = memoryStorage();
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("page=2")) return { status: 200, body: shortPage(101, 10) };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const first = await fetchKanbanLive({ storage, deepStorage, now: 1_000_000 });
      assert.ok(first);
      assert.equal(stub.calls.length, 4);
      const cached = await fetchKanbanLive({
        storage,
        deepStorage,
        now: 1_000_000 + 4 * 60_000,
      });
      assert.ok(cached);
      assert.equal(stub.calls.length, 4);
      // Session expired, deep fresh: exactly the fast tier, 3 calls.
      const steady = await fetchKanbanLive({
        storage,
        deepStorage,
        now: 1_000_000 + 6 * 60_000,
      });
      assert.ok(steady);
      assert.equal(steady.pulls.size, 110);
      assert.equal(stub.calls.length, 7);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 1);
      // Deep stale: the deep tier runs again.
      const later = await fetchKanbanLive({
        storage,
        deepStorage,
        now: 1_000_000 + 61 * 60_000,
      });
      assert.ok(later);
      assert.equal(stub.calls.length, 11);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 2);
      assert.equal(
        deepStorage.map.has(KANBAN_DEEP_CACHE_KEY),
        true,
      );
      assert.ok(
        1_000_000 + 61 * 60_000 - KANBAN_DEEP_CACHE_TTL_MS >= 1_000_000,
      );
    } finally {
      stub.restore();
    }
  });

  it("a failed deep page keeps the previous deep rows and does not fail the check", async () => {
    const deepStorage = memoryStorage();
    const now = 1_000_000;
    deepStorage.map.set(
      KANBAN_DEEP_CACHE_KEY,
      JSON.stringify({
        fetchedAt: now - 61 * 60_000,
        pulls: [
          [
            999,
            { state: "closed", draft: false, merged: true, title: "older than the window" },
          ],
        ],
      }),
    );
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("page=2")) return { status: 500, body: { message: "deep down" } };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null, deepStorage, now });
      assert.ok(state);
      assert.equal(state.pulls.size, 101);
      assert.equal(state.pulls.get(999)?.merged, true);
      assert.equal(stub.calls.length, 4);
    } finally {
      stub.restore();
    }
  });

  it("reports rateLimited on a 403/429 fast-tier failure", async () => {
    for (const status of [403, 429]) {
      const stub = stubGlobalFetch(() => ({ status, body: { message: "limited" } }));
      try {
        const result = await refreshKanbanLive({
          event: "mount",
          storage: null,
          deepStorage: null,
          now: 1_000,
        });
        assert.deepEqual(result, { action: "fallback", rateLimited: true });
      } finally {
        stub.restore();
      }
    }
  });

  it("a failed deep page is not retried on the next 11 refreshes in the hour", async () => {
    const storage = memoryStorage();
    const deepStorage = memoryStorage();
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("/issues")) return { status: 200, body: [] };
      if (url.includes("page=2")) return { status: 500, body: { message: "deep down" } };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const t0 = 1_000_000;
      const mount = await refreshKanbanLive({ event: "mount", storage, deepStorage, now: t0 });
      assert.equal(mount.action, "live");
      assert.equal(stub.calls.length, 4);
      for (let i = 1; i <= 11; i++) {
        const tick = await refreshKanbanLive({
          event: "tick",
          storage,
          deepStorage,
          now: t0 + i * 5 * 60_000,
        });
        assert.equal(tick.action, "live");
      }
      // 4 + 11 fast tiers of 3, and the deep page was called once.
      assert.equal(stub.calls.length, 37);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 1);
    } finally {
      stub.restore();
    }
  });

  it("a 403 on a deep page reports rateLimited and records the deep attempt", async () => {
    const storage = memoryStorage();
    const deepStorage = memoryStorage();
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("/issues")) return { status: 200, body: [] };
      if (url.includes("page=2")) return { status: 403, body: { message: "limited" } };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const t0 = 1_000_000;
      const result = await refreshKanbanLive({ event: "mount", storage, deepStorage, now: t0 });
      // The signal the poller consumes for its 60-minute back-off.
      assert.deepEqual(result, { action: "fallback", rateLimited: true });
      const tick = await refreshKanbanLive({
        event: "tick",
        storage,
        deepStorage,
        now: t0 + 5 * 60_000,
      });
      assert.equal(tick.action, "live");
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 1);
    } finally {
      stub.restore();
    }
  });

  it("a partial deep failure keeps the fetched pages and the previous rows", async () => {
    const deepStorage = memoryStorage();
    const now = 1_000_000;
    deepStorage.map.set(
      KANBAN_DEEP_CACHE_KEY,
      JSON.stringify({
        fetchedAt: now - 61 * 60_000,
        pulls: [
          [
            999,
            { state: "closed", draft: false, merged: true, title: "older than the window" },
          ],
        ],
      }),
    );
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("/issues")) return { status: 200, body: [] };
      if (url.includes("page=2")) return { status: 200, body: fullPage(101) };
      if (url.includes("page=3")) return { status: 200, body: fullPage(201) };
      if (url.includes("page=4")) return { status: 500, body: { message: "page 4 down" } };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null, deepStorage, now });
      assert.ok(state);
      // Fast tier (100) + fetched deep pages (200) + previous row (1).
      assert.equal(state.pulls.size, 301);
      assert.ok(state.pulls.has(150));
      assert.ok(state.pulls.has(250));
      assert.equal(state.pulls.get(999)?.merged, true);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 3);
      // The partial attempt is recorded: no deep retry inside the hour.
      const again = await fetchKanbanLive({
        storage: null,
        deepStorage,
        now: now + 6 * 60_000,
      });
      assert.ok(again);
      assert.equal(again.pulls.size, 301);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 3);
    } finally {
      stub.restore();
    }
  });

  it("an hour of 5-minute ticks with page 5 always failing stays within 40 calls", async () => {
    const storage = memoryStorage();
    const deepStorage = memoryStorage();
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [] };
      if (url.includes("/issues")) return { status: 200, body: [] };
      const page = /[?&]page=(\d+)/.exec(url)?.[1];
      if (page === "5") return { status: 500, body: { message: "page 5 down" } };
      if (page) return { status: 200, body: fullPage((Number(page) - 1) * 100 + 1) };
      if (url.includes("sort=updated")) return { status: 200, body: fullPage(1) };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const t0 = 1_000_000;
      const mount = await refreshKanbanLive({ event: "mount", storage, deepStorage, now: t0 });
      assert.equal(mount.action, "live");
      assert.equal(stub.calls.length, 7);
      for (let i = 1; i <= 11; i++) {
        const tick = await refreshKanbanLive({
          event: "tick",
          storage,
          deepStorage,
          now: t0 + i * 5 * 60_000,
        });
        assert.equal(tick.action, "live");
      }
      // 7 on the first refresh, 3 fast-tier calls on each of the
      // 11 ticks, no deep retry inside the hour: 40 of 60.
      assert.ok(stub.calls.length <= 40, `expected <= 40 calls, got ${stub.calls.length}`);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 4);
    } finally {
      stub.restore();
    }
  });
});

describe("loadPublicSnapshot", () => {
  it("fetches build-board.json under the base URL and validates the envelope", async () => {
    const stub = stubGlobalFetch((url) =>
      url.endsWith("build-board.json")
        ? { status: 200, body: { ...snapshotJson, builtAt: "2026-11-23T18:00:00.000Z" } }
        : { status: 404, body: { message: "not stubbed" } },
    );
    try {
      const snap = await loadPublicSnapshot();
      assert.ok(snap);
      assert.equal(snap.schemaVersion, 2);
      assert.equal(snap.stories.length, 18);
      assert.equal(snap.subtasks.length, 45);
      assert.equal(stub.calls.length, 1);
      assert.equal(stub.calls[0]?.url, buildBoardUrl());
    } finally {
      stub.restore();
    }
  });

  it("resolves null on a failure status, a network error and an invalid envelope", async () => {
    const notFound = stubGlobalFetch(() => ({ status: 404, body: { message: "missing" } }));
    try {
      assert.equal(await loadPublicSnapshot(), null);
    } finally {
      notFound.restore();
    }
    const down = stubGlobalFetch(() => "throw");
    try {
      assert.equal(await loadPublicSnapshot(), null);
    } finally {
      down.restore();
    }
    const invalid = stubGlobalFetch(() => ({ status: 200, body: { schemaVersion: 1, cards: [] } }));
    try {
      assert.equal(await loadPublicSnapshot(), null);
    } finally {
      invalid.restore();
    }
  });
});

describe("loadKanbanLive", () => {
  it("shares one fetch sequence across concurrent calls", async () => {
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      const [a, b] = await Promise.all([
        loadKanbanLive({ storage: null }),
        loadKanbanLive({ storage: null }),
      ]);
      assert.ok(a);
      assert.equal(a, b);
      assert.equal(stub.calls.length, 3);
    } finally {
      stub.restore();
    }
  });
});

describe("refresh on focus and visibility", () => {
  it("makes zero calls while the cache is fresh", async () => {
    const storage = memoryStorage();
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      const first = await refreshKanbanLive({ event: "mount", storage, now: 1_000 });
      assert.equal(first.action, "live");
      assert.equal(stub.calls.length, 3);
      const focus = await refreshKanbanLive({ event: "focus", storage, now: 1_000 + 60_000 });
      assert.equal(focus.action, "skip");
      const visible = await refreshKanbanLive({
        event: "visible",
        storage,
        now: 1_000 + 2 * 60_000,
      });
      assert.equal(visible.action, "skip");
      const hidden = await refreshKanbanLive({
        event: "hidden",
        storage,
        now: 1_000 + 10 * 60_000,
      });
      assert.equal(hidden.action, "skip");
      assert.equal(stub.calls.length, 3);
    } finally {
      stub.restore();
    }
  });

  it("refetches on focus and visibility only after the cache expires", async () => {
    const storage = memoryStorage();
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      await refreshKanbanLive({ event: "mount", storage, now: 1_000 });
      assert.equal(stub.calls.length, 3);
      const focus = await refreshKanbanLive({
        event: "focus",
        storage,
        now: 1_000 + 5 * 60_000,
      });
      assert.equal(focus.action, "live");
      assert.equal(stub.calls.length, 6);
      const visible = await refreshKanbanLive({
        event: "visible",
        storage,
        now: 1_000 + 10 * 60_000,
      });
      assert.equal(visible.action, "live");
      assert.equal(stub.calls.length, 9);
    } finally {
      stub.restore();
    }
  });

  it("hides the hidden event and treats a missing cache as stale", () => {
    assert.equal(
      shouldRefetchKanbanLive({ event: "hidden", cacheFetchedAt: null, now: 0 }),
      false,
    );
    assert.equal(
      shouldRefetchKanbanLive({ event: "focus", cacheFetchedAt: 1_000, now: 1_000 + 60_000 }),
      false,
    );
    assert.equal(
      shouldRefetchKanbanLive({
        event: "visible",
        cacheFetchedAt: 1_000,
        now: 1_000 + 5 * 60_000,
      }),
      true,
    );
    assert.equal(
      shouldRefetchKanbanLive({ event: "focus", cacheFetchedAt: null, now: 1_000 }),
      true,
    );
  });

  it("a tick allows ~5 s of slack, focus and visibility do not (TD-08.7)", () => {
    const fetchedAt = 1_000;
    assert.equal(
      shouldRefetchKanbanLive({ event: "tick", cacheFetchedAt: fetchedAt, now: fetchedAt + 299_000 }),
      true,
    );
    assert.equal(
      shouldRefetchKanbanLive({ event: "tick", cacheFetchedAt: fetchedAt, now: fetchedAt + 290_000 }),
      false,
    );
    assert.equal(
      shouldRefetchKanbanLive({ event: "focus", cacheFetchedAt: fetchedAt, now: fetchedAt + 299_000 }),
      false,
    );
    assert.equal(KANBAN_POLL_INTERVAL_MS, KANBAN_LIVE_CACHE_TTL_MS);
  });
});

describe("tick slack end to end (TD-08.7 fix)", () => {
  it("a tick at t0+299 s makes exactly 3 calls through a full refresh", async () => {
    const storage = memoryStorage();
    const deepStorage = memoryStorage();
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      const mount = await refreshKanbanLive({
        event: "mount",
        storage,
        deepStorage,
        now: 1_000,
      });
      assert.equal(mount.action, "live");
      assert.equal(stub.calls.length, 3);
      const tick = await refreshKanbanLive({
        event: "tick",
        storage,
        deepStorage,
        now: 1_000 + 299_000,
      });
      assert.equal(tick.action, "live");
      assert.equal(stub.calls.length, 6);
    } finally {
      stub.restore();
    }
  });

  it("a tick at t0+120 s makes 0 calls", async () => {
    const storage = memoryStorage();
    const deepStorage = memoryStorage();
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      const mount = await refreshKanbanLive({
        event: "mount",
        storage,
        deepStorage,
        now: 1_000,
      });
      assert.equal(mount.action, "live");
      assert.equal(stub.calls.length, 3);
      const tick = await refreshKanbanLive({
        event: "tick",
        storage,
        deepStorage,
        now: 1_000 + 120_000,
      });
      assert.equal(tick.action, "skip");
      assert.equal(stub.calls.length, 3);
    } finally {
      stub.restore();
    }
  });
});

describe("startKanbanPolling (TD-08.7)", () => {
  const liveState = {
    pulls: new Map(),
    branches: new Set<string>(),
    issues: new Map(),
    issuesUnavailable: false,
    fetchedAt: 0,
  };
  const liveResult: KanbanRefresh = { action: "live", state: liveState };

  function fakeTimers() {
    let handler: (() => Promise<void>) | null = null;
    let intervalMs: number | undefined;
    const cleared: unknown[] = [];
    return {
      setIntervalFn: ((fn: () => void, ms?: number) => {
        handler = fn as () => Promise<void>;
        intervalMs = ms;
        return 7;
      }) as typeof setInterval,
      clearIntervalFn: ((id: unknown) => {
        cleared.push(id);
        handler = null;
      }) as typeof clearInterval,
      fire: () => handler?.() ?? Promise.resolve(),
      get intervalMs() {
        return intervalMs;
      },
      cleared,
    };
  }

  it("applies on 5 ticks over 25 fake minutes, at the poll interval", async () => {
    const timers = fakeTimers();
    let now = 0;
    let applies = 0;
    const stop = startKanbanPolling({
      apply: async () => {
        applies += 1;
        return liveResult;
      },
      isHidden: () => false,
      now: () => now,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    try {
      assert.equal(timers.intervalMs, KANBAN_POLL_INTERVAL_MS);
      for (let i = 0; i < 5; i += 1) {
        now += 5 * 60_000;
        await timers.fire();
      }
      assert.equal(applies, 5);
    } finally {
      stop();
    }
  });

  it("skips ticks while hidden, resumes when visible", async () => {
    const timers = fakeTimers();
    let hidden = false;
    let applies = 0;
    const stop = startKanbanPolling({
      apply: async () => {
        applies += 1;
        return liveResult;
      },
      isHidden: () => hidden,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    try {
      await timers.fire();
      hidden = true;
      await timers.fire();
      await timers.fire();
      hidden = false;
      await timers.fire();
      assert.equal(applies, 2);
    } finally {
      stop();
    }
  });

  it("backs off 60 minutes after a rate-limited answer, then resumes", async () => {
    const timers = fakeTimers();
    let now = 0;
    let applies = 0;
    const stop = startKanbanPolling({
      apply: async () => {
        applies += 1;
        return applies === 1
          ? { action: "fallback", rateLimited: true }
          : liveResult;
      },
      isHidden: () => false,
      now: () => now,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    try {
      await timers.fire();
      assert.equal(applies, 1);
      for (let i = 0; i < 11; i += 1) {
        now += 5 * 60_000;
        await timers.fire();
      }
      assert.equal(applies, 1);
      now += 5 * 60_000;
      await timers.fire();
      assert.equal(applies, 2);
    } finally {
      stop();
    }
  });

  it("a non-rate-limited failure does not back off", async () => {
    const timers = fakeTimers();
    let applies = 0;
    const stop = startKanbanPolling({
      apply: async () => {
        applies += 1;
        return applies === 1 ? { action: "fallback" } : liveResult;
      },
      isHidden: () => false,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    try {
      await timers.fire();
      await timers.fire();
      assert.equal(applies, 2);
    } finally {
      stop();
    }
  });

  it("stop() clears the timer, and a slow refresh is not re-entered", async () => {
    const timers = fakeTimers();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let applies = 0;
    const stop = startKanbanPolling({
      apply: async () => {
        applies += 1;
        await gate;
        return liveResult;
      },
      isHidden: () => false,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    try {
      const first = timers.fire();
      await Promise.resolve();
      const second = timers.fire();
      await second;
      assert.equal(applies, 1);
      release();
      await first;
      await timers.fire();
      assert.equal(applies, 2);
    } finally {
      stop();
    }
    assert.deepEqual(timers.cleared, [7]);
    await timers.fire();
    assert.equal(applies, 2);
  });
});
