import assert from "node:assert/strict";
import { describe, it } from "node:test";
import branchesFixture from "./__fixtures__/github/branches.json" with { type: "json" };
import pullsFixture from "./__fixtures__/github/pulls-by-number.json" with { type: "json" };
import snapshotJson from "./kanban.json" with { type: "json" };
import {
  buildBoardUrl,
  fetchKanbanLive,
  KANBAN_LIVE_CACHE_KEY,
  loadKanbanLive,
  loadPublicSnapshot,
  parseGithubBranches,
  parseGithubPull,
  parseGithubPulls,
  parseLabelNames,
  refreshKanbanLive,
  shouldRefetchKanbanLive,
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

describe("fetchKanbanLive — exactly two requests", () => {
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
      assert.equal(stub.calls.length, 2);
      assert.ok(
        stub.calls.some((c) =>
          c.url.includes("pulls?state=all&sort=updated&direction=desc&per_page=100"),
        ),
      );
      assert.ok(stub.calls.some((c) => c.url.includes("/branches?per_page=100")));
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
      assert.equal(stub.calls.length, 2);
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

  it("writes and reads the v3 cache, including title and headRef", async () => {
    const storage = memoryStorage();
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: branchesBody };
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
      assert.equal(stub.calls.length, 2);
      const raw = storage.map.get(KANBAN_LIVE_CACHE_KEY);
      assert.equal(KANBAN_LIVE_CACHE_KEY, "meridian-kanban-live:v4");
      assert.ok(raw);
      assert.equal(raw.includes("phase1/ports-part-b"), true);
      assert.equal(storage.map.has("meridian-kanban-live:v2"), false);
      const again = await fetchKanbanLive({ storage, now: 5_000 + 1_000 });
      assert.equal(again?.pulls.get(571)?.title, "Phase 1 Part B");
      assert.equal(again?.pulls.get(571)?.headRef, "phase1/ports-part-b");
      assert.equal(stub.calls.length, 2);
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
      assert.equal(stub.calls.length, 2);
      const second = await fetchKanbanLive({
        storage,
        now: 1_000_000 + 4 * 60_000,
      });
      assert.ok(second);
      assert.equal(stub.calls.length, 2);
      const third = await fetchKanbanLive({
        storage,
        now: 1_000_000 + 6 * 60_000,
      });
      assert.ok(third);
      assert.equal(stub.calls.length, 4);
    } finally {
      stub.restore();
    }
  });
});

describe("fetchKanbanLive — no page walking", () => {
  it("stops after the two calls even when the pull list is a full page", async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      state: "closed",
      draft: false,
      merged_at: "2026-01-01T00:00:00Z",
      title: `TD-${String((i % 20) + 1).padStart(2, "0")}.1`,
    }));
    const stub = stubGlobalFetch((url) => {
      if (url.includes("/branches")) return { status: 200, body: [{ name: "feat/td-08.4-live" }] };
      if (url.includes("sort=updated")) return { status: 200, body: page };
      return { status: 500, body: { message: "should not be called" } };
    });
    try {
      const state = await fetchKanbanLive({ storage: null });
      assert.ok(state);
      assert.equal(state.pulls.size, 100);
      assert.equal(stub.calls.length, 2);
      assert.equal(stub.calls.filter((c) => /\/pulls\/\d+/.test(c.url)).length, 0);
      assert.equal(stub.calls.filter((c) => /[?&]page=/.test(c.url)).length, 0);
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
      assert.equal(stub.calls.length, 2);
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
      assert.equal(stub.calls.length, 2);
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
      assert.equal(stub.calls.length, 2);
    } finally {
      stub.restore();
    }
  });

  it("refetches on focus and visibility only after the cache expires", async () => {
    const storage = memoryStorage();
    const stub = stubGlobalFetch(fixtureHandler);
    try {
      await refreshKanbanLive({ event: "mount", storage, now: 1_000 });
      assert.equal(stub.calls.length, 2);
      const focus = await refreshKanbanLive({
        event: "focus",
        storage,
        now: 1_000 + 5 * 60_000,
      });
      assert.equal(focus.action, "live");
      assert.equal(stub.calls.length, 4);
      const visible = await refreshKanbanLive({
        event: "visible",
        storage,
        now: 1_000 + 10 * 60_000,
      });
      assert.equal(visible.action, "live");
      assert.equal(stub.calls.length, 6);
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
});
