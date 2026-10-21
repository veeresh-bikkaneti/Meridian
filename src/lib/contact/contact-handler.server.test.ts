/**
 * /api/contact handler unit tests (runs in `npm test` with the src suite).
 */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  handleContactRequest as handleRequest,
  readContactEnv,
  validateContact,
  resetContactStateForTests,
  selectSink,
  DiscordWebhookSink,
  NoopSink,
  MAX_BODY_BYTES,
  MAX_MESSAGE_CHARS,
  type ContactEnv,
} from "./contact-handler.server.ts";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://meridian.test/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Default env: no secrets → NoopSink. */
function defaultEnv(): { env: ContactEnv } {
  return { env: {} };
}

beforeEach(() => resetContactStateForTests());

test("validateContact: accepts a minimal valid message", () => {
  const r = validateContact({ topic: "bug", message: "  The map froze  " });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { topic: "bug", message: "The map froze" });
});

test("validateContact: rejects bad topic, empty/oversized message, bad reply-to, extra fields", () => {
  assert.equal(validateContact({ topic: "spam", message: "x" }).ok, false);
  assert.equal(validateContact({ topic: "bug", message: "   " }).ok, false);
  assert.equal(validateContact({ topic: "bug", message: "x".repeat(MAX_MESSAGE_CHARS + 1) }).ok, false);
  assert.equal(validateContact({ topic: "bug", message: "x", replyTo: "not-an-email" }).ok, false);
  assert.equal(validateContact({ topic: "bug", message: "x", ip: "1.2.3.4" }).ok, false);
  assert.equal(validateContact([]).ok, false);
});

test("default sink is NoopSink: accepts, stores nothing, says stored:false", async () => {
  assert.ok(selectSink({}) instanceof NoopSink);
  const res = await handleRequest(post({ topic: "privacy", message: "hi" }), {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, stored: false });
});

test("Discord sink is wired only when CONTACT_DISCORD_WEBHOOK_URL is an https URL", () => {
  assert.ok(selectSink({ CONTACT_DISCORD_WEBHOOK_URL: "https://discord.example/api/webhooks/1/x" }) instanceof DiscordWebhookSink);
  assert.ok(selectSink({ CONTACT_DISCORD_WEBHOOK_URL: "  " }) instanceof NoopSink);
  assert.ok(selectSink({ CONTACT_DISCORD_WEBHOOK_URL: "http://insecure.example" }) instanceof NoopSink);
});

test("DiscordWebhookSink posts topic/message/replyTo only, mentions disabled, never the IP", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const sink = new DiscordWebhookSink("https://discord.example/hook", (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch);
  const r = await sink.deliver({ topic: "delete-data", message: "Please delete @everyone", replyTo: "p@example.com", receivedAt: "2026-10-21T15:00:00.000Z" });
  assert.deepEqual(r, { ok: true, stored: true });
  const body = JSON.parse(calls[0].body);
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  assert.match(body.content, /delete-data/);
  assert.match(body.content, /p@example\.com/);
  assert.ok(!calls[0].body.includes("203.0.113.7"));
  const long = DiscordWebhookSink.format({ topic: "bug", message: "x".repeat(5000), receivedAt: "t" });
  assert.ok(long.length <= 2000);
});

test("DiscordWebhookSink failure → ok:false (page asks to retry)", async () => {
  const sink = new DiscordWebhookSink("https://discord.example/hook", (async () => {
    throw new Error("down");
  }) as unknown as typeof fetch);
  assert.deepEqual(await sink.deliver({ topic: "bug", message: "x", receivedAt: "t" }), { ok: false, stored: false });
});

test("honeypot filled → 200 but silently dropped (sink never called)", async () => {
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called++;
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    const env: ContactEnv = { CONTACT_DISCORD_WEBHOOK_URL: "https://discord.example/hook" };
    const res = await handleRequest(post({ topic: "other", message: "buy now", website: "http://spam" }), env);
    assert.equal(res.status, 200);
    assert.equal(called, 0);
    const real = await handleRequest(post({ topic: "other", message: "hello" }, { "cf-connecting-ip": "198.51.100.9" }), env);
    assert.equal(real.status, 200);
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("rate limit: 3 per client per window, then 429 with retry-after", async () => {
  const { env } = defaultEnv();
  for (let i = 0; i < 3; i++) {
    assert.equal((await handleRequest(post({ topic: "bug", message: `m${i}` }), env, 1000)).status, 200);
  }
  const blocked = await handleRequest(post({ topic: "bug", message: "m4" }), env, 2000);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  // A different client is unaffected.
  const other = await handleRequest(post({ topic: "bug", message: "x" }, { "cf-connecting-ip": "198.51.100.1" }), env, 2000);
  assert.equal(other.status, 200);
});

test("body cap: oversized body → 413", async () => {
  const { env } = defaultEnv();
  const res = await handleRequest(post("x".repeat(MAX_BODY_BYTES + 1)), env);
  assert.equal(res.status, 413);
});

test("CORS: same-origin and the Pages mirror are allowed; anything else is refused; never *", async () => {
  const { env } = defaultEnv();
  const same = await handleRequest(post({ topic: "bug", message: "x" }, { origin: "https://meridian.test" }), env);
  assert.equal(same.status, 200);
  assert.equal(same.headers.get("access-control-allow-origin"), null);
  const pages = await handleRequest(
    post({ topic: "bug", message: "x" }, { origin: "https://veeresh-bikkaneti.github.io", "cf-connecting-ip": "198.51.100.2" }),
    env,
  );
  assert.equal(pages.status, 200);
  assert.equal(pages.headers.get("access-control-allow-origin"), "https://veeresh-bikkaneti.github.io");
  const bad = await handleRequest(post({ topic: "bug", message: "x" }, { origin: "https://evil.example" }), env);
  assert.equal(bad.status, 403);
  const override = await handleRequest(
    post({ topic: "bug", message: "x" }, { origin: "https://evil.example", "cf-connecting-ip": "198.51.100.3" }),
    { CONTACT_ALLOWED_ORIGINS: "https://evil.example" },
  );
  assert.equal(override.status, 200);
});

test("only POST (and the OPTIONS preflight) are accepted", async () => {
  const res = await handleRequest(new Request("https://meridian.test/api/contact"), {});
  assert.equal(res.status, 405);
  const pre = await handleRequest(
    new Request("https://meridian.test/api/contact", { method: "OPTIONS", headers: { origin: "https://veeresh-bikkaneti.github.io" } }),
    {},
  );
  assert.equal(pre.status, 204);
});

test("readContactEnv reads only the contact secret names from process.env", () => {
  const saved = { ...process.env };
  try {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/crash";
    delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    assert.ok(selectSink(readContactEnv()) instanceof NoopSink, "crash secret must not wire the contact sink");
    process.env.CONTACT_DISCORD_WEBHOOK_URL = "https://discord.example/contact";
    assert.ok(selectSink(readContactEnv()) instanceof DiscordWebhookSink);
  } finally {
    process.env = saved;
  }
});

test("never picks up the crash-report worker's DISCORD_WEBHOOK_URL secret", () => {
  const env = { DISCORD_WEBHOOK_URL: "https://discord.example/crash-hook" } as unknown as ContactEnv;
  assert.ok(selectSink(env) instanceof NoopSink);
});
