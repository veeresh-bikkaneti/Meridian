import { strict as assert } from "node:assert";
import { test } from "node:test";
import { REQUIRED_HEADERS, runProdSmoke } from "./prod-smoke.mjs";

const BASE = "https://example.test";

function headers(map) {
  return {
    get: (name) => map[name.toLowerCase()] ?? null,
  };
}

function fullHeaders() {
  const map = {};
  for (const h of REQUIRED_HEADERS) map[h] = "present";
  return headers(map);
}

/** A fetch stub serving a fully healthy production surface. */
function healthyFetch(calls) {
  return async (url) => {
    calls?.push(String(url));
    const u = String(url);
    if (u === `${BASE}/`) {
      return { status: 200, headers: fullHeaders(), json: async () => ({}) };
    }
    if (u === `${BASE}/_serverFn/`) {
      return { status: 404, headers: headers({}), json: async () => ({}) };
    }
    if (u === `${BASE}/.well-known/security.txt`) {
      return { status: 200, headers: headers({}), json: async () => ({}) };
    }
    if (u === `${BASE}/manifest.webmanifest`) {
      return {
        status: 200,
        headers: headers({}),
        json: async () => ({ start_url: "./" }),
      };
    }
    if (u === `${BASE}/build-meta.json`) {
      return {
        status: 200,
        headers: headers({}),
        json: async () => ({ buildId: "1ca4c04" }),
      };
    }
    throw new Error(`unexpected URL ${u}`);
  };
}

test("runProdSmoke passes a healthy surface and uses GET only", async () => {
  const calls = [];
  const { ok, results } = await runProdSmoke(BASE, healthyFetch(calls));
  assert.equal(ok, true);
  assert.equal(results.length, 5);
  assert.ok(results.every((r) => r.ok));
  // start_url "./" resolved against the base and fetched.
  assert.ok(calls.includes(`${BASE}/`));
});

test("runProdSmoke fails when a security header is missing", async () => {
  const good = healthyFetch();
  const fetchFn = async (url, init) => {
    const res = await good(url, init);
    if (String(url) === `${BASE}/`) {
      const map = {};
      for (const h of REQUIRED_HEADERS) {
        if (h !== "strict-transport-security") map[h] = "present";
      }
      return { ...res, headers: headers(map) };
    }
    return res;
  };
  const { ok, results } = await runProdSmoke(BASE, fetchFn);
  assert.equal(ok, false);
  assert.ok(
    results[0].detail.includes("strict-transport-security"),
    results[0].detail,
  );
});

test("runProdSmoke fails when /_serverFn/ 500s and security.txt 404s (pre-#222 prod)", async () => {
  const good = healthyFetch();
  const fetchFn = async (url, init) => {
    const res = await good(url, init);
    if (String(url) === `${BASE}/_serverFn/`) return { ...res, status: 500 };
    if (String(url) === `${BASE}/.well-known/security.txt`) {
      return { ...res, status: 404 };
    }
    return res;
  };
  const { ok, results } = await runProdSmoke(BASE, fetchFn);
  assert.equal(ok, false);
  assert.equal(results[1].ok, false);
  assert.equal(results[2].ok, false);
  assert.equal(results[0].ok, true);
  assert.equal(results[4].ok, true);
});

test("runProdSmoke fails when build-meta has no buildId", async () => {
  const good = healthyFetch();
  const fetchFn = async (url, init) => {
    const res = await good(url, init);
    if (String(url) === `${BASE}/build-meta.json`) {
      return { ...res, json: async () => ({}) };
    }
    return res;
  };
  const { ok, results } = await runProdSmoke(BASE, fetchFn);
  assert.equal(ok, false);
  assert.equal(results[4].ok, false);
});

test("runProdSmoke fails when the manifest start_url does not resolve to 200", async () => {
  const good = healthyFetch();
  const fetchFn = async (url, init) => {
    if (String(url) === `${BASE}/start`) {
      return { status: 404, headers: headers({}), json: async () => ({}) };
    }
    const res = await good(url, init);
    if (String(url) === `${BASE}/manifest.webmanifest`) {
      return { ...res, json: async () => ({ start_url: "/start" }) };
    }
    return res;
  };
  const { ok, results } = await runProdSmoke(BASE, fetchFn);
  assert.equal(ok, false);
  assert.equal(results[3].ok, false);
});

test("runProdSmoke reports a network error as a failed check, never a throw", async () => {
  const fetchFn = async () => {
    throw new Error("connection refused");
  };
  const { ok, results } = await runProdSmoke(BASE, fetchFn);
  assert.equal(ok, false);
  assert.equal(results.length, 5);
  assert.ok(results.every((r) => !r.ok && r.detail.includes("connection refused")));
});
