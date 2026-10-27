/**
 * /api/contact handler unit tests (runs in `npm test` with the src suite).
 */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  handleContactRequest as handleRequest,
  readContactEnv,
  validateContact,
  readContactRuntimeEnv,
  resetContactStateForTests,
  selectSink,
  DiscordWebhookSink,
  NoopSink,
  MAX_BODY_BYTES,
  MAX_MESSAGE_CHARS,
  readBodyCapped,
  type ContactEnv,
} from "./contact-handler.server.ts";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://meridian.test/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.7",
      origin: "https://meridian.test",
      ...headers,
    },
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
  assert.ok(selectSink({ CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/x" }) instanceof DiscordWebhookSink);
  assert.ok(selectSink({ CONTACT_DISCORD_WEBHOOK_URL: "  " }) instanceof NoopSink);
  assert.ok(selectSink({ CONTACT_DISCORD_WEBHOOK_URL: "http://insecure.example" }) instanceof NoopSink);
  // Pinned to discord.com/api/webhooks/: other hosts, look-alikes and
  // credentials-in-URL tricks all stay on NoopSink.
  for (const bad of [
    "https://discord.example/api/webhooks/1/x",
    "https://discordapp.com/api/webhooks/1/x",
    "https://discord.com.evil.example/api/webhooks/1/x",
    "https://discord.com/api/webhooksX/1/x",
    "https://discord.com:8443/api/webhooks/1/x",
    "http://discord.com/api/webhooks/1/x",
  ]) {
    assert.ok(selectSink({ CONTACT_DISCORD_WEBHOOK_URL: bad }) instanceof NoopSink, bad);
  }
});

test("DiscordWebhookSink posts topic/message/replyTo only, mentions disabled, never the IP", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const sink = new DiscordWebhookSink("https://discord.com/api/webhooks/2/hook", (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch);
  const r = await sink.deliver({ topic: "delete-data", message: "Please delete @everyone", replyTo: "p@example.com", receivedAt: "2026-10-21T15:00:00.000Z" });
  assert.deepEqual(r, { ok: true, stored: true });
  const body = JSON.parse(calls[0].body);
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  assert.equal(body.flags, 4, "SUPPRESS_EMBEDS");
  assert.match(body.content, /delete-data/);
  assert.match(body.content, /p@example\.com/);
  assert.ok(!calls[0].body.includes("203.0.113.7"));
  const long = DiscordWebhookSink.format({ topic: "bug", message: "x".repeat(5000), receivedAt: "t" });
  assert.ok(long.length <= 2000);
  assert.ok(long.trimEnd().includes("```\n_"), "fence still closed after truncation");
  assert.match(long, /within 90 days/);
});

test("DiscordWebhookSink failure → ok:false (page asks to retry)", async () => {
  const sink = new DiscordWebhookSink("https://discord.com/api/webhooks/2/hook", (async () => {
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
    const env: ContactEnv = { CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/2/hook" };
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
    process.env.CONTACT_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/3/contact";
    assert.ok(selectSink(readContactEnv()) instanceof DiscordWebhookSink);
  } finally {
    process.env = saved;
  }
});

test("never picks up the crash-report worker's DISCORD_WEBHOOK_URL secret", () => {
  const env = { DISCORD_WEBHOOK_URL: "https://discord.example/crash-hook" } as unknown as ContactEnv;
  assert.ok(selectSink(env) instanceof NoopSink);
});

test("Discord text is code-fenced; backticks cannot break out of the fence", () => {
  const text = DiscordWebhookSink.format({
    topic: "bug",
    message: "hi ``` **bold** [x](https://evil.example) ```",
    replyTo: "a`b@example.com",
    receivedAt: "t",
  });
  // Exactly two fences (reply-to + message) → four fence markers.
  assert.equal(text.match(/```/g)?.length, 4);
  assert.ok(text.includes("```text\nhi \u02cb\u02cb\u02cb **bold**"));
  assert.ok(text.includes("a\u02cbb@example.com"));
});

test("validateContact strips \\p{Cf} format chars (zero-width, bidi overrides)", () => {
  const r = validateContact({ topic: "bug", message: "a\u200bb\u202ec\u2066d\ufeff" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.message, "abcd");
  assert.equal(validateContact({ topic: "bug", message: "\u200b\u200d" }).ok, false, "only format chars → empty");
});

test("400 problems never echo unknown field names", async () => {
  const res = await handleRequest(post({ topic: "bug", message: "x", "<script>": 1 }), {});
  assert.equal(res.status, 400);
  const text = await res.text();
  assert.ok(!text.includes("<script>"));
  assert.match(text, /unexpected fields/);
});

test("POST without an Origin header is refused (cannot skip the origin check)", async () => {
  const req = new Request("https://meridian.test/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.50" },
    body: JSON.stringify({ topic: "bug", message: "x" }),
  });
  const res = await handleRequest(req, {});
  assert.equal(res.status, 403);
});

test("chunked body with no content-length is cut off at the cap, not buffered", async () => {
  let pulled = 0;
  const chunk = new TextEncoder().encode("x".repeat(1024));
  const stream = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      pulled++;
      if (pulled > 100) ctrl.close();
      else ctrl.enqueue(chunk);
    },
  });
  const req = new Request("https://meridian.test/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://meridian.test" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  const res = await handleRequest(req, {});
  assert.equal(res.status, 413);
  assert.ok(pulled <= 7, `read stopped early (pulled ${pulled} chunks of 1 KB)`);
});

test("readBodyCapped returns the text when it fits", async () => {
  const r = new Request("https://x.test", { method: "POST", body: "héllo" });
  assert.equal(await readBodyCapped(r, 10), "héllo");
  const big = new Request("https://x.test", { method: "POST", body: "x".repeat(11) });
  assert.equal(await readBodyCapped(big, 10), null);
});

test("stores nothing server-side: logs never carry message, reply-to or IP", async () => {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
  try {
    const res = await handleRequest(
      post({ topic: "privacy", message: "SECRET-MESSAGE-123", replyTo: "secret.parent@example.com" }, { "cf-connecting-ip": "192.0.2.99" }),
      {},
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, stored: false });
  } finally {
    console.log = orig;
  }
  const all = lines.join("\n");
  assert.ok(lines.length >= 1);
  for (const secret of ["SECRET-MESSAGE-123", "secret.parent@example.com", "192.0.2.99"]) {
    assert.ok(!all.includes(secret), `log leaked ${secret}`);
  }
});

test("handler source has no storage APIs (no KV, D1, Cache API, fs, or storage writes)", () => {
  const src = readFileSync(new URL("./contact-handler.server.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const banned of [/\bcaches\./, /\.put\(/, /\bprepare\(/, /node:fs/, /localStorage|sessionStorage|indexedDB/]) {
    assert.ok(!banned.test(src), `storage API ${banned} in contact handler`);
  }
});

test("rate limit: Workers binding is consulted when present and can refuse", async () => {
  const keys: string[] = [];
  const binding = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: keys.length < 2 }) };
  const env: ContactEnv = { CONTACT_RATE_LIMITER: binding };
  const first = await handleRequest(post({ topic: "bug", message: "a" }, { "cf-connecting-ip": "198.51.100.77" }), env, 1000);
  assert.equal(first.status, 200);
  const second = await handleRequest(post({ topic: "bug", message: "b" }, { "cf-connecting-ip": "198.51.100.77" }), env, 2000);
  assert.equal(second.status, 429);
  assert.equal(second.headers.get("retry-after"), "60");
  assert.equal(keys[0], keys[1], "stable cross-isolate key for the same sender");
  assert.ok(!keys[0].includes("198.51.100.77"), "binding key is a hash, not the IP");
});

test("rate limit: a throwing binding fails open to the in-memory floor", async () => {
  const env: ContactEnv = { CONTACT_RATE_LIMITER: { limit: async () => { throw new Error("down"); } } };
  for (let i = 0; i < 3; i++) {
    assert.equal((await handleRequest(post({ topic: "bug", message: `m${i}` }, { "cf-connecting-ip": "198.51.100.88" }), env, 1000)).status, 200);
  }
  assert.equal((await handleRequest(post({ topic: "bug", message: "m4" }, { "cf-connecting-ip": "198.51.100.88" }), env, 1000)).status, 429);
});

test("readContactEnv and readContactRuntimeEnv read from process.env and globalThis.__env__ (process.env wins)", async () => {
  const g = globalThis as { __env__?: Record<string, unknown> };
  const prevProcWebhook = process.env.CONTACT_DISCORD_WEBHOOK_URL;
  const prevProcOrigins = process.env.CONTACT_ALLOWED_ORIGINS;
  const prevNitroEnv = g.__env__;
  try {
    delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    delete process.env.CONTACT_ALLOWED_ORIGINS;
    g.__env__ = {
      CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/111/from-nitro",
      CONTACT_ALLOWED_ORIGINS: "https://mirror.example",
    };
    assert.deepEqual(readContactEnv(), {
      CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/111/from-nitro",
      CONTACT_ALLOWED_ORIGINS: "https://mirror.example",
    });
    const rtFromNitro = await readContactRuntimeEnv();
    assert.equal(rtFromNitro.CONTACT_DISCORD_WEBHOOK_URL, "https://discord.com/api/webhooks/111/from-nitro");
    assert.equal(rtFromNitro.CONTACT_ALLOWED_ORIGINS, "https://mirror.example");

    process.env.CONTACT_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/222/from-process";
    process.env.CONTACT_ALLOWED_ORIGINS = "https://proc.example";
    assert.deepEqual(readContactEnv(), {
      CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/222/from-process",
      CONTACT_ALLOWED_ORIGINS: "https://proc.example",
    });
    const rtFromProc = await readContactRuntimeEnv();
    assert.equal(rtFromProc.CONTACT_DISCORD_WEBHOOK_URL, "https://discord.com/api/webhooks/222/from-process");
    assert.equal(rtFromProc.CONTACT_ALLOWED_ORIGINS, "https://proc.example");
  } finally {
    if (prevProcWebhook === undefined) delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    else process.env.CONTACT_DISCORD_WEBHOOK_URL = prevProcWebhook;
    if (prevProcOrigins === undefined) delete process.env.CONTACT_ALLOWED_ORIGINS;
    else process.env.CONTACT_ALLOWED_ORIGINS = prevProcOrigins;
    if (prevNitroEnv === undefined) delete g.__env__;
    else g.__env__ = prevNitroEnv;
  }
});

test("full-stack E2E over real local HTTP server: readContactRuntimeEnv + handleContactRequest + DiscordWebhookSink -> real HTTP receiver", async () => {
  const http = await import("node:http");
  const receivedCalls: Array<{
    method: string;
    url: string;
    contentType: string | undefined;
    body: { content: string; allowed_mentions: { parse: string[] }; flags: number };
  }> = [];

  const webhookServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      receivedCalls.push({
        method: req.method ?? "",
        url: req.url ?? "",
        contentType: req.headers["content-type"],
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      });
      res.writeHead(204);
      res.end();
    });
  });

  await new Promise<void>((resolve) => webhookServer.listen(0, "127.0.0.1", resolve));
  const address = webhookServer.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const originalFetch = globalThis.fetch;
  const prevWebhook = process.env.CONTACT_DISCORD_WEBHOOK_URL;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.startsWith("https://discord.com/api/webhooks/")) {
      const u = new URL(urlStr);
      return originalFetch(`http://127.0.0.1:${port}${u.pathname}${u.search}`, init);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    process.env.CONTACT_DISCORD_WEBHOOK_URL =
      "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789?wait=true";

    const env = await readContactRuntimeEnv();
    const res = await handleRequest(
      post(
        {
          topic: "privacy",
          message: "Please verify full E2E pipeline",
          replyTo: "parent@example.com",
          website: "",
        },
        {
          origin: "https://veeresh-bikkaneti.github.io",
          "cf-connecting-ip": "198.51.100.42",
        },
      ),
      env,
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "https://veeresh-bikkaneti.github.io");
    assert.deepEqual(await res.json(), { ok: true, stored: true });

    assert.equal(receivedCalls.length, 1);
    assert.equal(receivedCalls[0].method, "POST");
    assert.equal(
      receivedCalls[0].url,
      "/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789?wait=true",
    );
    assert.equal(receivedCalls[0].contentType, "application/json");
    assert.deepEqual(receivedCalls[0].body.allowed_mentions, { parse: [] });
    assert.equal(receivedCalls[0].body.flags, 4);
    assert.match(receivedCalls[0].body.content, /\*\*Meridian contact\*\* · topic: privacy/);
    assert.match(receivedCalls[0].body.content, /```text\nparent@example\.com\n```/);
    assert.match(receivedCalls[0].body.content, /```text\nPlease verify full E2E pipeline\n```/);
    assert.ok(!JSON.stringify(receivedCalls[0]).includes("198.51.100.42"));
  } finally {
    globalThis.fetch = originalFetch;
    if (prevWebhook === undefined) delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    else process.env.CONTACT_DISCORD_WEBHOOK_URL = prevWebhook;
    await new Promise<void>((resolve) => webhookServer.close(() => resolve()));
  }
});
