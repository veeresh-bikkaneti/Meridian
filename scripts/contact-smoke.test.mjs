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

test("parked worker (NoopSink): readiness and both delivery checks FAIL — no false green", async () => {
  const r = await smoke({});
  const f = failed(r);
  assert.ok(f.some((n) => n.startsWith("readiness")), f.join("|"));
  assert.ok(f.some((n) => n === "delivery: gated POST is stored by Discord"));
  assert.ok(f.some((n) => n === "delivery: POST with a reply-to is stored by Discord"));
  assert.equal(r.discordPosts.length, 0);
});

test("Discord rejecting the webhook: delivery FAILS (502), not a silent success", async () => {
  const r = await smoke({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK }, 401);
  assert.ok(failed(r).includes("delivery: gated POST is stored by Discord"));
});

test("a look-alike webhook URL falls back to parked, so the smoke fails", async () => {
  const r = await smoke({ CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com.evil.example/api/webhooks/1/x" });
  assert.ok(failed(r).some((n) => n.startsWith("readiness")));
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
