/**
 * Rate limiter unit tests (rate-limiter.server.ts).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  BINDING_PERIOD_SEC,
  CLIENT_LIMITER_BINDING,
  CloudflareBindingRateLimiter,
  GLOBAL_BINDING_KEY,
  GLOBAL_LIMITER_BINDING,
  InMemoryRateLimiter,
  LayeredRateLimiter,
  bindingClientKey,
  isRateLimitBinding,
  readRateLimitBindings,
  resetRateLimitBindingLookupForTests,
  selectRateLimiter,
  type RateLimitBinding,
} from "./rate-limiter.server.ts";

function counting(limit: number): RateLimitBinding & { keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { success: n <= limit };
    },
  };
}

test("in-memory: 3 per client per 10 min, then retry-after; window resets", async () => {
  const l = new InMemoryRateLimiter();
  for (let i = 0; i < 3; i++) assert.equal((await l.take("1.1.1.1", 0)).allowed, true);
  const d = await l.take("1.1.1.1", 1000);
  assert.equal(d.allowed, false);
  assert.ok(d.retryAfterSec > 0 && d.retryAfterSec <= 600);
  assert.equal((await l.take("2.2.2.2", 1000)).allowed, true, "other client unaffected");
  assert.equal((await l.take("1.1.1.1", 10 * 60_000 + 1)).allowed, true, "window reset");
});

test("in-memory: global per-isolate cap", async () => {
  const l = new InMemoryRateLimiter({ perClientMax: 100, perClientWindowMs: 1000, globalMax: 2, globalWindowMs: 60_000 });
  assert.equal((await l.take("a", 0)).allowed, true);
  assert.equal((await l.take("b", 0)).allowed, true);
  assert.equal((await l.take("c", 0)).allowed, false);
});

test("in-memory keys are salted hashes, never the IP", async () => {
  const l = new InMemoryRateLimiter();
  const k = await l.keyFor("203.0.113.7");
  assert.match(k, /^[0-9a-f]{24}$/);
  l.reset();
  assert.notEqual(await l.keyFor("203.0.113.7"), k, "fresh salt after reset");
});

test("binding key: stable within a UTC day, rotates across days, no IP", async () => {
  const day1 = Date.UTC(2026, 9, 21, 1);
  const a = await bindingClientKey("203.0.113.7", day1);
  assert.equal(await bindingClientKey("203.0.113.7", day1 + 3_600_000), a);
  assert.notEqual(await bindingClientKey("203.0.113.7", day1 + 86_400_000), a);
  assert.notEqual(await bindingClientKey("203.0.113.8", day1), a);
  assert.match(a, /^c:[0-9a-f]{16}$/);
});

test("binding limiter: per-client then global; refuses with the binding period", async () => {
  const client = counting(1);
  const global = counting(100);
  const l = new CloudflareBindingRateLimiter(client, global);
  assert.equal((await l.take("1.1.1.1", 0)).allowed, true);
  const d = await l.take("1.1.1.1", 0);
  assert.deepEqual(d, { allowed: false, retryAfterSec: BINDING_PERIOD_SEC });
  assert.deepEqual(global.keys, [GLOBAL_BINDING_KEY], "a client already over its limit does not use up the global budget");
});

test("binding limiter: global refusal applies to everyone", async () => {
  const l = new CloudflareBindingRateLimiter(counting(100), counting(1));
  assert.equal((await l.take("a", 0)).allowed, true);
  assert.equal((await l.take("b", 0)).allowed, false);
});

test("binding limiter: throwing binding fails open and reports", async () => {
  const errors: string[] = [];
  const l = new CloudflareBindingRateLimiter({ limit: async () => { throw new Error("x"); } }, null, (n) => errors.push(n));
  assert.equal((await l.take("a", 0)).allowed, true);
  assert.deepEqual(errors, [CLIENT_LIMITER_BINDING]);
});

test("layered: first refusal wins and later layers are not consumed", async () => {
  const later = counting(100);
  const l = new LayeredRateLimiter([
    { name: "no", take: async () => ({ allowed: false, retryAfterSec: 9 }) },
    new CloudflareBindingRateLimiter(later),
  ]);
  assert.deepEqual(await l.take("a", 0), { allowed: false, retryAfterSec: 9 });
  assert.equal(later.keys.length, 0);
});

test("selectRateLimiter: in-memory only without a binding; adds the binding layer when present", () => {
  assert.equal(selectRateLimiter({}).name, "in-memory");
  assert.equal(selectRateLimiter({ CONTACT_RATE_LIMITER: "not-a-binding" }).name, "in-memory");
  assert.equal(selectRateLimiter({ CONTACT_RATE_LIMITER: counting(1) }).name, "in-memory+cf-binding");
  assert.equal(isRateLimitBinding({ limit: () => {} }), true);
  assert.equal(isRateLimitBinding(null), false);
});

test("readRateLimitBindings: {} on Node (no workerd), picks up globalThis.__env__ when set", async () => {
  resetRateLimitBindingLookupForTests();
  assert.deepEqual(await readRateLimitBindings(), {});
  const g = globalThis as { __env__?: unknown };
  const b = counting(1);
  g.__env__ = { [CLIENT_LIMITER_BINDING]: b, OTHER: "x" };
  try {
    resetRateLimitBindingLookupForTests();
    const found = await readRateLimitBindings();
    assert.equal(found.CONTACT_RATE_LIMITER, b);
    assert.equal(found.CONTACT_GLOBAL_RATE_LIMITER, undefined);
  } finally {
    delete g.__env__;
    resetRateLimitBindingLookupForTests();
  }
});

test("config record declares both bindings with names the code reads and a legal period", () => {
  const toml = readFileSync(new URL("../../../config/cloudflare/meridian.wrangler.toml", import.meta.url), "utf8");
  const blocks = toml.split(/^\[\[ratelimits\]\]$/m).slice(1);
  const parsed = blocks.map((b) => ({
    name: /name\s*=\s*"([^"]+)"/.exec(b)?.[1],
    ns: /namespace_id\s*=\s*"(\d+)"/.exec(b)?.[1],
    period: Number(/period\s*=\s*(\d+)/.exec(b)?.[1]),
  }));
  assert.deepEqual(parsed.map((p) => p.name).sort(), [CLIENT_LIMITER_BINDING, GLOBAL_LIMITER_BINDING].sort());
  for (const p of parsed) {
    assert.ok(p.ns, `${p.name} has a numeric namespace_id`);
    assert.ok(p.period === 10 || p.period === 60, `${p.name} period must be 10 or 60`);
    assert.equal(p.period, BINDING_PERIOD_SEC);
  }
  assert.notEqual(parsed[0].ns, parsed[1].ns, "separate counters");
});
