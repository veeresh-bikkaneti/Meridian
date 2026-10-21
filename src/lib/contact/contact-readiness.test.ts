/**
 * Pinning tests for the contact readiness check (panel finding B3, #207;
 * activation follow-up). The check must never read as ready when delivery
 * cannot happen, and must say whose config it looked at.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  contactReadinessFromRuntimeEnv,
  contactReadinessFromUrl,
  describeSink,
  evaluateContactReadiness,
} from "./contact-readiness.ts";
import { DiscordWebhookSink, handleContactRequest, selectSink } from "./contact-handler.server.ts";
import { resetRateLimitBindingLookupForTests } from "./rate-limiter.server.ts";

const WEBHOOK = "https://discord.com/api/webhooks/1/x";

test("no secret in env → readiness reports NOT configured (parked)", () => {
  const r = evaluateContactReadiness({});
  assert.equal(r.configured, false);
  assert.equal(r.sink, "noop");
  assert.match(r.line, /NOT configured \(parked\)/);
});

test("a look-alike webhook URL still reports NOT configured", () => {
  const r = evaluateContactReadiness({ CONTACT_DISCORD_WEBHOOK_URL: "https://discordapp.com/api/webhooks/1/x" });
  assert.equal(r.configured, false);
  assert.equal(r.sink, "noop");
});

test("a strict discord.com webhook URL selects the Discord sink and reports configured", () => {
  const env = { CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK };
  assert.ok(selectSink(env) instanceof DiscordWebhookSink);
  const r = evaluateContactReadiness(env);
  assert.equal(r.configured, true);
  assert.equal(r.sink, "discord");
});

test("the line always names whose config was checked", () => {
  assert.match(evaluateContactReadiness({}, "https://x.example").line, /\(https:\/\/x\.example\)/);
  assert.match(describeSink("discord", "somewhere").line, /\(somewhere\)/);
});

test("the shell check reads the SAME runtime env as the route, and says it is not production", async () => {
  const g = globalThis as { __env__?: unknown };
  const saved = process.env;
  process.env = {};
  g.__env__ = { CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK };
  resetRateLimitBindingLookupForTests();
  try {
    const r = await contactReadinessFromRuntimeEnv();
    assert.equal(r.configured, true);
    assert.equal(r.sink, "discord");
    assert.match(r.line, /not production/);
  } finally {
    delete g.__env__;
    process.env = saved;
    resetRateLimitBindingLookupForTests();
  }
});

/** A fetch that answers like the live worker, by running the real handler. */
function liveWorker(env: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    handleContactRequest(new Request(String(input), init), env)) as typeof fetch;
}

test("--url: parked worker → NOT configured; wired worker → configured", async () => {
  const parked = await contactReadinessFromUrl("https://meridian.test/", liveWorker({}));
  assert.equal(parked.configured, false);
  assert.equal(parked.sink, "noop");
  const wired = await contactReadinessFromUrl("https://meridian.test", liveWorker({ CONTACT_DISCORD_WEBHOOK_URL: WEBHOOK }));
  assert.equal(wired.configured, true);
  assert.equal(wired.sink, "discord");
  assert.ok(!wired.line.includes("discord.com/api"), "the webhook URL is never printed");
});

test("--url: every unexpected answer is NOT confirmed, never a green", async () => {
  const cases: Array<[string, typeof fetch]> = [
    ["404", (async () => new Response("nope", { status: 404 })) as typeof fetch],
    ["html", (async () => new Response("<html>", { status: 200 })) as typeof fetch],
    ["no sink field", (async () => new Response("{}", { status: 200 })) as typeof fetch],
    ["sink not a string", (async () => new Response('{"sink":1}', { status: 200 })) as typeof fetch],
    ["network error", (async () => { throw new Error("boom"); }) as typeof fetch],
  ];
  for (const [label, f] of cases) {
    const r = await contactReadinessFromUrl("https://meridian.test", f);
    assert.equal(r.configured, false, label);
    assert.match(r.line, /NOT confirmed/, label);
  }
});

test("--url: only the two known sink names are ever printed; a hostile string is NOT confirmed", async () => {
  const hostile = (async () => new Response(JSON.stringify({ sink: "\u001b[2Jdiscord" }), { status: 200 })) as typeof fetch;
  const r = await contactReadinessFromUrl("https://meridian.test", hostile);
  assert.equal(r.configured, false);
  assert.ok(!r.line.includes("\u001b"), "remote text must not reach the terminal");
});

test("--url: prints only the bare origin (no credentials/path) and never follows redirects", async () => {
  let seen: RequestInit | undefined;
  const spy = (async (_i: RequestInfo | URL, init?: RequestInit) => {
    seen = init;
    return new Response('{"sink":"noop"}', { status: 200 });
  }) as typeof fetch;
  const r = await contactReadinessFromUrl("https://user:pw@meridian.test/some/path?q=1", spy);
  assert.ok(!r.line.includes("pw") && !r.line.includes("some/path"), r.line);
  assert.equal(seen?.redirect, "error");
  const bad = await contactReadinessFromUrl("not a url", spy);
  assert.match(bad.line, /NOT confirmed/);
});
