import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  FLAG_DEFAULTS,
  FLAGS_FETCH_TIMEOUT_MS,
  getObservabilityEndpoint,
  isEnabled,
  isValidObservabilityEndpoint,
  loadFlags,
  resetFlags,
  type FlagName,
  type LoadFlagsEnv,
} from "./flags.ts";

/**
 * Focused unit tests for the feature-flag system:
 * - baked-in defaults are returned before any load (boot-time semantics)
 * - remote overrides merge correctly; unknown names and non-boolean values
 *   are ignored (fail closed to defaults)
 * - every failure mode (timeout, rejection, invalid JSON, malformed
 *   payloads, offline-shaped aborts) leaves the defaults in place
 * - loadFlags never rejects; isEnabled never throws
 *
 * import.meta.env is undefined under node --test, so BASE_URL and fetch
 * are injected through the documented LoadFlagsEnv seam — no real network.
 */

type FakeJson = () => Promise<unknown>;

function okResponse(payload: unknown): Response {
  const json: FakeJson = async () => {
    if (typeof payload === "string" && payload === "__THROW__") {
      throw new SyntaxError("invalid JSON");
    }
    return payload;
  };
  return { ok: true, json } as unknown as Response;
}

function failedResponse(): Response {
  return { ok: false, json: async () => ({}) } as unknown as Response;
}

/** Resolves with `response` after an optional delay; records the URL seen. */
function fakeFetch(response: Response | (() => Response), delayMs = 0) {
  const seen: string[] = [];
  const fn = async (
    url: string,
    init?: RequestInit,
  ): Promise<Response> => {
    seen.push(url);
    if (init?.signal?.aborted) throw new Error("already aborted");
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (init?.signal?.aborted) throw new Error("aborted");
    return typeof response === "function" ? response() : response;
  };
  return { fn, seen };
}

/** Hangs until the abort signal fires, then rejects like a real fetch. */
function hangingFetch() {
  const seen: string[] = [];
  const fn = (url: string, init?: RequestInit) => {
    seen.push(url);
    return new Promise<Response>((_resolve, reject) => {
      const onAbort = () => reject(new DOMException("aborted", "AbortError"));
      const sig = init?.signal;
      if (sig?.aborted) {
        onAbort();
        return;
      }
      sig?.addEventListener("abort", onAbort, { once: true });
    });
  };
  return { fn, seen };
}

function rejectingFetch() {
  return async (url: string): Promise<Response> => {
    void url;
    throw new TypeError("network down");
  };
}

const BASE: LoadFlagsEnv = { BASE_URL: "/Meridian/" };

beforeEach(() => {
  resetFlags();
});

describe("flags — defaults", () => {
  it("returns the baked-in default before loadFlags resolves (boot-time, not reactive)", async () => {
    assert.equal(isEnabled("pwaUpdateToast"), FLAG_DEFAULTS.pwaUpdateToast);
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });

  it("the default timeout is ~1.5s", () => {
    assert.equal(FLAGS_FETCH_TIMEOUT_MS, 1500);
  });

  it("resetFlags restores defaults after a successful override load", async () => {
    const { fn } = fakeFetch(okResponse({ version: 1, flags: { pwaUpdateToast: false } }));
    await loadFlags({ ...BASE, fetch: fn });
    assert.equal(isEnabled("pwaUpdateToast"), false);
    resetFlags();
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });
});

describe("flags — remote overrides", () => {
  it("merges remote boolean overrides over the defaults", async () => {
    const { fn } = fakeFetch(okResponse({ version: 1, flags: { pwaUpdateToast: false } }));
    await loadFlags({ ...BASE, fetch: fn });
    assert.equal(isEnabled("pwaUpdateToast"), false);
  });

  it("ignores unknown flag names in the payload", async () => {
    const { fn } = fakeFetch(
      okResponse({ version: 1, flags: { pwaUpdateToast: false, notAFlag: true } }),
    );
    await loadFlags({ ...BASE, fetch: fn });
    assert.equal(isEnabled("pwaUpdateToast"), false);
    // "notAFlag" is not in the catalog: nothing to observe, nothing breaks.
    assert.equal(
      isEnabled("notAFlag" as FlagName),
      false,
      "unknown names must not enable anything",
    );
  });

  it("ignores non-boolean values (fail closed to defaults)", async () => {
    for (const bad of ["false", 0, 1, null, {}, []]) {
      resetFlags();
      const { fn } = fakeFetch(okResponse({ version: 1, flags: { pwaUpdateToast: bad } }));
      await loadFlags({ ...BASE, fetch: fn });
      assert.equal(
        isEnabled("pwaUpdateToast"),
        true,
        `non-boolean ${JSON.stringify(bad)} must be ignored`,
      );
    }
  });

  it("a second load replaces overrides wholesale (stale false does not linger)", async () => {
    const off = fakeFetch(okResponse({ flags: { pwaUpdateToast: false } }));
    await loadFlags({ ...BASE, fetch: off.fn });
    assert.equal(isEnabled("pwaUpdateToast"), false);
    const on = fakeFetch(okResponse({ flags: { pwaUpdateToast: true } }));
    await loadFlags({ ...BASE, fetch: on.fn });
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });

  it("fetches flags.json under the Vite base path", async () => {
    const { fn, seen } = fakeFetch(okResponse({ flags: {} }));
    await loadFlags({ ...BASE, fetch: fn });
    assert.deepEqual(seen, ["/Meridian/flags.json"]);
  });

  it("defaults the base to / when no BASE_URL is given", async () => {
    const { fn, seen } = fakeFetch(okResponse({ flags: {} }));
    await loadFlags({ fetch: fn });
    assert.deepEqual(seen, ["/flags.json"]);
  });
});

describe("flags — failure modes fall back to defaults", () => {
  it("timeout (~1.5s) leaves defaults in place and never hangs the caller", async () => {
    const { fn, seen } = hangingFetch();
    const start = Date.now();
    await loadFlags({ ...BASE, fetch: fn, timeoutMs: 20 });
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 2000, `loadFlags took ${elapsed}ms — must not hang`);
    assert.deepEqual(seen, ["/Meridian/flags.json"]);
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });

  it("fetch rejection leaves defaults in place", async () => {
    await loadFlags({ ...BASE, fetch: rejectingFetch() });
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });

  it("non-OK responses are ignored", async () => {
    const { fn } = fakeFetch(failedResponse());
    await loadFlags({ ...BASE, fetch: fn });
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });

  it("invalid JSON is ignored", async () => {
    const { fn } = fakeFetch(okResponse("__THROW__"));
    await loadFlags({ ...BASE, fetch: fn });
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });

  it("malformed payload shapes are ignored", async () => {
    for (const bad of [null, [], "nope", 42, { flags: null }, { flags: "nope" }, { flags: [] }, {}]) {
      resetFlags();
      const { fn } = fakeFetch(okResponse(bad));
      await loadFlags({ ...BASE, fetch: fn });
      assert.equal(
        isEnabled("pwaUpdateToast"),
        true,
        `payload ${JSON.stringify(bad)} must be ignored`,
      );
    }
  });

  it("a failed load does not clobber a previously loaded override", async () => {
    const off = fakeFetch(okResponse({ flags: { pwaUpdateToast: false } }));
    await loadFlags({ ...BASE, fetch: off.fn });
    assert.equal(isEnabled("pwaUpdateToast"), false);
    await loadFlags({ ...BASE, fetch: rejectingFetch() });
    assert.equal(isEnabled("pwaUpdateToast"), false);
  });
});

describe("flags — never throws / never rejects", () => {
  it("loadFlags resolves (never rejects) on every failure mode", async () => {
    const envs: LoadFlagsEnv[] = [
      { ...BASE, fetch: rejectingFetch() },
      { ...BASE, fetch: hangingFetch().fn, timeoutMs: 10 },
      { ...BASE, fetch: fakeFetch(okResponse("__THROW__")).fn },
      { ...BASE, fetch: fakeFetch(failedResponse()).fn },
    ];
    for (const env of envs) {
      resetFlags();
      await loadFlags(env); // would throw the test if it rejected
    }
  });

  it("loadFlags resolves when fetch is unavailable (no global fetch)", async () => {
    const g = globalThis as Record<string, unknown>;
    const orig = g.fetch;
    g.fetch = undefined;
    try {
      await loadFlags({ ...BASE });
    } finally {
      g.fetch = orig;
    }
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });

  it("isEnabled never throws, even on out-of-catalog names", () => {
    assert.doesNotThrow(() => {
      assert.equal(isEnabled("bogus" as FlagName), false);
      assert.equal(isEnabled(undefined as unknown as FlagName), false);
      assert.equal(isEnabled(null as unknown as FlagName), false);
    });
  });
});

// ---------------------------------------------------------------------------
// Production-path tests: the memoized load promise, the await-before-check
// ordering the __root.tsx kill-switch relies on, and the SSR early return.
//
// Under node --test there is no window, so the production path early-returns;
// these tests install a fake window (and a fake global fetch) to reach it.
// The afterEach below restores the originals so the testEnv-based suites
// above are unaffected.
// ---------------------------------------------------------------------------

const ORIG_FETCH = (globalThis as Record<string, unknown>).fetch;

function installProdDom(
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const g = globalThis as Record<string, unknown>;
  g.window = {};
  g.fetch = fetchFn;
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  g.fetch = ORIG_FETCH;
});

describe("flags — memoized production load", () => {
  it("concurrent callers share one fetch (the memoized promise)", async () => {
    const { fn, seen } = fakeFetch(
      okResponse({ flags: { pwaUpdateToast: false } }),
      50,
    );
    installProdDom(fn);
    const p1 = loadFlags();
    const p2 = loadFlags();
    assert.equal(p1, p2, "concurrent calls must share the memoized promise");
    assert.equal(
      isEnabled("pwaUpdateToast"),
      true,
      "sync read before the await sees the baked-in default",
    );
    await p1;
    assert.equal(
      isEnabled("pwaUpdateToast"),
      false,
      "awaiting the shared load applies the remote value — the kill-switch ordering",
    );
    assert.deepEqual(seen, ["/flags.json"]);
  });

  it("a later call after the load settles re-fetches (no stale promise)", async () => {
    const { fn, seen } = fakeFetch(okResponse({ flags: {} }));
    installProdDom(fn);
    await loadFlags();
    await loadFlags();
    assert.equal(seen.length, 2);
  });

  it("the testEnv seam always runs fresh, bypassing the memoized promise", async () => {
    const prod = fakeFetch(okResponse({ flags: { pwaUpdateToast: false } }), 100);
    const seam = fakeFetch(okResponse({ flags: { pwaUpdateToast: true } }));
    installProdDom(prod.fn);
    const pending = loadFlags(); // memoized, in flight
    await loadFlags({ ...BASE, fetch: seam.fn }); // testEnv: always its own fetch
    assert.equal(
      seam.seen.length,
      1,
      "the test seam must not share the in-flight production promise",
    );
    await pending;
    assert.equal(prod.seen.length, 1);
  });

  it("resetFlags clears the in-flight promise so the next call re-fetches", async () => {
    const { fn, seen } = fakeFetch(
      okResponse({ flags: { pwaUpdateToast: false } }),
      100,
    );
    installProdDom(fn);
    const pending = loadFlags();
    resetFlags();
    const retry = loadFlags();
    assert.notEqual(pending, retry);
    await Promise.all([pending, retry]);
    assert.equal(seen.length, 2);
  });

  it("resolves without fetching when there is no window (SSR) — defaults win", async () => {
    const g = globalThis as Record<string, unknown>;
    delete g.window;
    let calls = 0;
    g.fetch = async () => {
      calls++;
      throw new Error("must not fetch in SSR");
    };
    await loadFlags(); // no testEnv → production path
    assert.equal(calls, 0, "no fetch may happen server-side");
    assert.equal(isEnabled("pwaUpdateToast"), true);
  });
});

describe("learningOutcomes flag", () => {
  beforeEach(() => resetFlags());

  it("defaults to false — current production behavior (no records, no growth UI)", () => {
    assert.equal(FLAG_DEFAULTS.learningOutcomes, false);
    assert.equal(isEnabled("learningOutcomes"), false);
  });

  it("remote payloads can flip it on; unknown names and non-booleans are ignored", async () => {
    const seam = fakeFetch(
      okResponse({
        flags: {
          learningOutcomes: true,
          unknownExperiment: true,
          pwaUpdateToast: "yes",
        },
      }),
    );
    await loadFlags({ ...BASE, fetch: seam.fn });
    assert.equal(isEnabled("learningOutcomes"), true);
    assert.equal(isEnabled("pwaUpdateToast"), true, "non-boolean ignored → default wins");
  });

  it("fail-closed: unreachable flags.json keeps the dark default", async () => {
    const { fn } = fakeFetch(failedResponse());
    await loadFlags({ ...BASE, fetch: fn });
    assert.equal(isEnabled("learningOutcomes"), false);
  });
});

describe("observabilityEndpoint", () => {
  beforeEach(() => resetFlags());
  it("defaults to null (transport disabled — shipped behavior)", async () => {
    assert.equal(getObservabilityEndpoint(), null);
  });
  it("accepts https and root-relative endpoints", async () => {
    const a = fakeFetch(okResponse({ flags: {}, observabilityEndpoint: "https://obs.example.com/ingest" }));
    await loadFlags({ ...BASE, fetch: a.fn });
    assert.equal(getObservabilityEndpoint(), "https://obs.example.com/ingest");
    resetFlags();
    const b = fakeFetch(okResponse({ flags: {}, observabilityEndpoint: "/api/observability" }));
    await loadFlags({ ...BASE, fetch: b.fn });
    assert.equal(getObservabilityEndpoint(), "/api/observability");
  });
  it("rejects http, protocol-relative, non-string and junk endpoints (fail closed to null)", async () => {
    for (const bad of ["http://obs.example.com/x", "//evil.example/x", "javascript:alert(1)", 42, {}, "not a url", ""]) {
      resetFlags();
      const f = fakeFetch(okResponse({ flags: {}, observabilityEndpoint: bad }));
      await loadFlags({ ...BASE, fetch: f.fn });
      assert.equal(getObservabilityEndpoint(), null, `bad endpoint ${JSON.stringify(bad)} must be rejected`);
      assert.equal(isValidObservabilityEndpoint(bad), false);
    }
    assert.equal(isValidObservabilityEndpoint("https://obs.example.com/ingest"), true);
    assert.equal(isValidObservabilityEndpoint("/ingest"), true);
  });
});
