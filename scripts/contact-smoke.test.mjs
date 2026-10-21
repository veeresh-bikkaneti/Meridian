/**
 * The activation smoke suite must itself be discriminating: it has to FAIL
 * against a parked worker and against a worker whose webhook is rejected,
 * and PASS only against a really wired one. Runs the real handler
 * in-process, with Discord replaced by a recorder.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { runSmoke } from "./contact-smoke.mjs";
import { handleContactRequest, resetContactStateForTests } from "../src/lib/contact/contact-handler.server.ts";

const ORIGIN = "https://meridian.test";
const WEBHOOK = "https://discord.com/api/webhooks/1/secret-token";

/** fetch() that routes the site's own URL to the handler and records Discord calls. */
function workerWith(env, discordStatus = 204) {
  const discordPosts = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    discordPosts.push(JSON.parse(String(init?.body ?? "{}")).content ?? "");
    return new Response(null, { status: discordStatus });
  };
  const fetchFn = async (input, init) => handleContactRequest(new Request(String(input), init), env);
  return { fetchFn, discordPosts, restore: () => (globalThis.fetch = realFetch) };
}

async function smoke(env, discordStatus) {
  resetContactStateForTests();
  const w = workerWith(env, discordStatus);
  try {
    const out = await runSmoke({ origin: ORIGIN, fetchFn: w.fetchFn, sleep: async () => {}, recovery: false, runId: "t1" });
    return { ...out, discordPosts: w.discordPosts };
  } finally {
    w.restore();
  }
}
const failed = (r) => r.results.filter((x) => !x.ok).map((x) => x.name);

test("wired worker: every check passes, and Discord got exactly the delivered messages (never a honeypot)", async () => {
  const r = await smoke({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK });
  assert.deepEqual(failed(r), []);
  assert.equal(r.discordPosts.length, r.delivered);
  assert.ok(r.discordPosts.length >= 2 && r.discordPosts.length <= 3);
  assert.ok(r.discordPosts.every((c) => c.includes("[smoke t1]")));
  assert.ok(r.discordPosts.every((c) => !c.includes("honeypot")), "a honeypot message reached Discord");
  assert.ok(r.discordPosts.some((c) => c.includes("smoke-t1@example.com")), "reply-to missing from the message");
});

test("parked worker (NoopSink): readiness FAILS and the run stops before sending a single POST", async () => {
  resetContactStateForTests();
  const posts = [];
  const w = workerWith({});
  const counting = async (input, init) => {
    if ((init?.method ?? "GET") === "POST") posts.push(String(input));
    return w.fetchFn(input, init);
  };
  try {
    const r = await runSmoke({ origin: ORIGIN, fetchFn: counting, sleep: async () => {}, runId: "t0" });
    assert.ok(failed(r).some((n) => n.startsWith("readiness")));
    assert.ok(r.results.some((x) => x.name.startsWith("aborted")));
    assert.equal(posts.length, 0, "a parked run must not POST anything");
    assert.equal(r.delivered, 0);
    assert.equal(w.discordPosts.length, 0);
  } finally {
    w.restore();
  }
});

test("Discord rejecting the webhook: delivery FAILS (502), not a silent success", async () => {
  const r = await smoke({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK }, 401);
  assert.ok(failed(r).includes("delivery: gated POST is stored by Discord"));
});

test("a look-alike webhook URL falls back to parked, so the smoke fails", async () => {
  const r = await smoke({ CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com.evil.example/api/webhooks/1/x" });
  assert.ok(failed(r).some((n) => n.startsWith("readiness")));
  assert.ok(r.results.some((x) => x.name.startsWith("aborted")));
  assert.equal(r.discordPosts.length, 0);
});

test("--recovery: after Retry-After the next post is accepted again", async () => {
  resetContactStateForTests();
  const w = workerWith({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK });
  try {
    let now = Date.now();
    // The handler takes `now` from Date.now(); fast-forward it across the sleep.
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const r = await runSmoke({
        origin: ORIGIN,
        fetchFn: w.fetchFn,
        sleep: async (ms) => { now += ms; },
        recovery: true,
        runId: "t2",
      });
      assert.deepEqual(failed(r), []);
      assert.ok(r.results.some((x) => x.name === "rate limit: recovers after Retry-After" && x.ok));
    } finally {
      Date.now = realNow;
    }
  } finally {
    w.restore();
  }
});

// --- Every check must be able to fail -------------------------------------
// Each case wraps a really wired worker and breaks ONE behaviour; the smoke
// must name exactly that check as failed.

import { exitCodeFor } from "./contact-smoke.mjs";

async function tampered(rewrite, { recovery = false } = {}) {
  resetContactStateForTests();
  const w = workerWith({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK });
  const wrapped = async (input, init) => {
    const res = await w.fetchFn(input, init);
    const body = typeof init?.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : null;
    const hasOrigin = Boolean(init?.headers?.origin);
    return (await rewrite({ res, input, init, body, hasOrigin })) || res;
  };
  try {
    return await runSmoke({ origin: ORIGIN, fetchFn: wrapped, sleep: async () => {}, recovery, runId: "tm" });
  } finally {
    w.restore();
  }
}
const json = (status, obj, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...headers } });

test("each check fails when its one behaviour breaks", async () => {
  const cases = [
    ["refusal: a real message with no Origin → 403", ({ init, hasOrigin, body }) => init?.method === "POST" && !hasOrigin && body && !body.website && body.message.includes("no-origin") && json(200, { ok: true, stored: true })],
    ["refusal: a real message from a foreign Origin → 403", ({ init, body }) => init?.headers?.origin === "https://evil.example" && body && !body.website && json(200, { ok: true, stored: true })],
    ["refusal: an over-size body → 413", ({ init }) => typeof init?.body === "string" && init.body.length === 5000 && json(200, { ok: true })],
    ["honeypot (same-origin): silent 200, nothing delivered", ({ body, hasOrigin, init }) => body?.website && init?.headers?.origin === ORIGIN && json(200, { ok: true, stored: true })],
    ["honeypot (no Origin): silent 200, nothing delivered", ({ body, hasOrigin }) => body?.website && !hasOrigin && json(403, { error: "origin required" })],
    ["honeypot (foreign Origin): silent 200, nothing delivered", ({ body, init }) => body?.website && init?.headers?.origin === "https://evil.example" && json(200, { ok: true, stored: true })],
    ["rate limit: the handler trips with 429 and a Retry-After", ({ res }) => res.status === 429 && json(200, { ok: true, stored: true })],
    ["rate limit: the handler trips with 429 and a Retry-After", ({ res }) => res.status === 429 && json(429, { error: "edge" }, { "retry-after": "30" })],
    ["rate limit: the handler trips with 429 and a Retry-After", ({ res }) => res.status === 429 && json(429, { error: "too many messages" })],
  ];
  for (const [name, rewrite] of cases) {
    const r = await tampered(rewrite);
    assert.ok(failed(r).includes(name), `${name} did not fail; failed: ${failed(r).join(" | ")}`);
    assert.equal(exitCodeFor(r.results), 1);
  }
});

test("recovery check fails when the limiter never recovers", async () => {
  let blocked = false;
  const r = await tampered(({ res, body }) => {
    if (res.status === 429) blocked = true;
    return blocked && body?.message?.includes("recovery") && json(429, { error: "too many messages" }, { "retry-after": "5" });
  }, { recovery: true });
  assert.ok(failed(r).includes("rate limit: recovers after Retry-After"), failed(r).join("|"));
});

test("exitCodeFor: 0 only for a non-empty all-pass list", () => {
  assert.equal(exitCodeFor([]), 1);
  assert.equal(exitCodeFor([{ ok: true }, { ok: false }]), 1);
  assert.equal(exitCodeFor([{ ok: true }]), 0);
});

test("a honeypot post that Discord actually received is not counted as delivered", async () => {
  const r = await smoke({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK });
  assert.equal(r.delivered, r.discordPosts.length);
});

// --- Parked mode (the owner's first smoke, before any secret exists) ---------

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

async function parkedRun(env, rewrite) {
  resetContactStateForTests();
  const w = workerWith(env);
  const posts = [];
  const wrapped = async (input, init) => {
    if ((init?.method ?? "GET") === "POST") posts.push(1);
    const res = await w.fetchFn(input, init);
    return (rewrite && (await rewrite({ res, init }))) || res;
  };
  try {
    const out = await runSmoke({ origin: ORIGIN, mode: "parked", fetchFn: wrapped, sleep: async () => {}, runId: "pk" });
    return { ...out, posts: posts.length, discordPosts: w.discordPosts };
  } finally {
    w.restore();
  }
}

test("parked mode against a parked worker: 403 / 413 / 429 / honeypot / NoopSink cases all pass and nothing reaches Discord", async () => {
  const r = await parkedRun({});
  assert.deepEqual(failed(r), []);
  assert.equal(r.discordPosts.length, 0);
  const names = r.results.map((x) => x.name);
  for (const n of ["readiness: GET /api/contact reports the noop sink", "parked: a valid POST is accepted and discarded (stored:false)", "refusal: a real message with no Origin → 403", "refusal: an over-size body → 413"]) assert.ok(names.includes(n), n);
  assert.ok(names.some((n) => n.startsWith("rate limit:")));
  assert.equal(exitCodeFor(r.results), 0);
});

test("parked mode against a WIRED worker aborts before any POST, so it can never put test messages in the real channel", async () => {
  const r = await parkedRun({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK });
  assert.ok(failed(r).includes("readiness: GET /api/contact reports the noop sink"));
  assert.equal(r.posts, 0);
  assert.equal(r.discordPosts.length, 0);
  assert.equal(exitCodeFor(r.results), 1);
});

test("parked mode fails if the 'parked' worker claims it stored the message", async () => {
  const r = await parkedRun({}, ({ res, init }) => init?.method === "POST" && !String(init.body).includes("website") && res.status === 200 && json(200, { ok: true, stored: true }));
  assert.ok(failed(r).includes("parked: a valid POST is accepted and discarded (stored:false)"), failed(r).join("|"));
});

test("CLI: wired mode needs --yes-send-real-messages, --parked excludes it, and neither sends before the check", () => {
  const SCRIPT = fileURLToPath(new URL("./contact-smoke.mjs", import.meta.url));
  const run = (...a) => spawnSync(process.execPath, ["--no-warnings", SCRIPT, "--url", "https://example.invalid", ...a], { encoding: "utf8" });
  assert.equal(run().status, 2);
  assert.equal(run("--parked", "--yes-send-real-messages").status, 2);
});
