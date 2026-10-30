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
  honeypotFilled,
  stripContactDetails,
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

test("message length limit applies to the typed text, before contact details are scrubbed (#220 review F3)", async () => {
  // The page accepts up to MAX_MESSAGE_CHARS typed characters. Scrubbing
  // replaces a short email/phone with a longer placeholder, so checking the
  // limit AFTER scrubbing rejected messages the page had accepted.
  const nearLimit = "x".repeat(MAX_MESSAGE_CHARS - 10) + " me@ex.io";
  assert.equal(nearLimit.length, MAX_MESSAGE_CHARS - 1); // 999 typed chars
  const r = validateContact({ topic: "bug", message: nearLimit });
  assert.deepEqual(r.ok ? [] : r.problems, [], "a 999-char message ending in an email is valid");
  if (r.ok) assert.ok(r.value.message.endsWith(" [email removed]") && !r.value.message.includes("me@ex.io"));
  const phones = ("555-1234 ").repeat(Math.floor(MAX_MESSAGE_CHARS / 9)).trim();
  assert.ok(phones.length <= MAX_MESSAGE_CHARS);
  assert.equal(validateContact({ topic: "bug", message: phones }).ok, true, "phone-dense message within the typed limit");
  // The limit itself is unchanged: one typed character over is still refused.
  assert.equal(validateContact({ topic: "bug", message: "x".repeat(MAX_MESSAGE_CHARS + 1) }).ok, false);
  assert.equal(validateContact({ topic: "bug", message: "a@b.cc ".repeat(200) }).ok, false, "1400 typed chars");
  // End to end through the handler: 200, not 400.
  const res = await handleRequest(post({ topic: "bug", message: nearLimit }), {});
  assert.equal(res.status, 200);
});

test("worst-case scrub expansion still fits Discord's 2000-char content limit (#220 review F3)", () => {
  // "a@b.cc " (7 typed chars) becomes "[email removed] " (16): the most
  // placeholder-dense message the page accepts, plus the longest reply-to.
  const dense = "a@b.cc ".repeat(Math.floor(MAX_MESSAGE_CHARS / 7)).trim();
  const r = validateContact({ topic: "bug", message: dense, replyTo: `${"r".repeat(240)}@example.com` });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.value.message.length > MAX_MESSAGE_CHARS, "scrubbed text is longer than the typed limit");
  assert.ok(!r.value.message.includes("a@b.cc"));
  const text = DiscordWebhookSink.format({ ...r.value, receivedAt: "2026-10-29T00:00:00.000Z" });
  assert.ok(text.length <= 2000, `Discord content ${text.length} > 2000`);
  assert.equal(text.match(/```/g)?.length, 4, "fences stay closed after the cut");
  assert.ok(!text.includes("a@b.cc"));
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

test("readContactEnv and readContactRuntimeEnv prefer the runtime env (__env__) over process.env; process.env is the local-dev fallback", async () => {
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

    // Both set: the runtime env wins. A local-dev shell value must never
    // shadow the worker's configured bindings (env route: issue #220
    // Step 3, plan text).
    process.env.CONTACT_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/222/from-process";
    process.env.CONTACT_ALLOWED_ORIGINS = "https://proc.example";
    assert.deepEqual(readContactEnv(), {
      CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/111/from-nitro",
      CONTACT_ALLOWED_ORIGINS: "https://mirror.example",
    });
    const rtBoth = await readContactRuntimeEnv();
    assert.equal(rtBoth.CONTACT_DISCORD_WEBHOOK_URL, "https://discord.com/api/webhooks/111/from-nitro");
    assert.equal(rtBoth.CONTACT_ALLOWED_ORIGINS, "https://mirror.example");

    // process.env alone still works — it is the local-dev fallback.
    delete g.__env__;
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

test("sink selection via the runtime-bindings route: the __env__ webhook wires Discord and wins over process.env", async () => {
  const g = globalThis as { __env__?: Record<string, unknown> };
  const prevProcWebhook = process.env.CONTACT_DISCORD_WEBHOOK_URL;
  const prevNitroEnv = g.__env__;
  try {
    // A local-dev shell value must not shadow the worker's binding.
    process.env.CONTACT_DISCORD_WEBHOOK_URL = "https://example.com/not-discord";
    g.__env__ = { CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/9/from-bindings" };
    const env = await readContactRuntimeEnv();
    assert.equal(env.CONTACT_DISCORD_WEBHOOK_URL, "https://discord.com/api/webhooks/9/from-bindings");
    assert.ok(selectSink(env) instanceof DiscordWebhookSink);
  } finally {
    if (prevProcWebhook === undefined) delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    else process.env.CONTACT_DISCORD_WEBHOOK_URL = prevProcWebhook;
    if (prevNitroEnv === undefined) delete g.__env__;
    else g.__env__ = prevNitroEnv;
  }
});

test("honeypotFilled: only a non-blank string in the website field counts", () => {
  assert.equal(honeypotFilled({ website: "http://spam" }), true);
  assert.equal(honeypotFilled({ website: "  " }), false);
  assert.equal(honeypotFilled({ website: "" }), false);
  assert.equal(honeypotFilled({}), false);
  assert.equal(honeypotFilled({ website: 42 }), false);
  assert.equal(honeypotFilled(null), false);
  assert.equal(honeypotFilled("website"), false);
  assert.equal(honeypotFilled([]), false);
});

test("honeypot beats the origin gate: filled honeypot + disallowed or missing Origin still gets the quiet 200", async () => {
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called++;
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    const env: ContactEnv = { CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/2/hook" };
    const bot = { topic: "other", message: "buy now", website: "http://spam" };
    const badOrigin = await handleRequest(post(bot, { origin: "https://evil.example" }), env);
    assert.equal(badOrigin.status, 200);
    assert.deepEqual(await badOrigin.json(), { ok: true });
    const noOrigin = await handleRequest(
      new Request("https://meridian.test/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.60" },
        body: JSON.stringify(bot),
      }),
      env,
    );
    assert.equal(noOrigin.status, 200);
    assert.equal(called, 0, "sink never called for honeypot drops");
    // The gate still functions when the honeypot is empty.
    const gated = await handleRequest(
      post({ topic: "bug", message: "x" }, { origin: "https://evil.example", "cf-connecting-ip": "203.0.113.61" }),
      env,
    );
    assert.equal(gated.status, 403);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("SPEC §3.2 order: junk from one sender (honeypot, invalid, wrong/missing Origin, malformed JSON) uses no rate-limit quota", async () => {
  const { env } = defaultEnv();
  const ip = { "cf-connecting-ip": "203.0.113.70" };
  const noOrigin = () =>
    new Request("https://meridian.test/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", ...ip },
      body: JSON.stringify({ topic: "bug", message: "x" }),
    });
  const junk: Array<[string, () => Request, number]> = [
    ["honeypot", () => post({ topic: "other", message: "buy now", website: "http://spam" }, ip), 200],
    ["invalid", () => post({ topic: "nope", message: "" }, ip), 400],
    ["wrong origin", () => post({ topic: "bug", message: "x" }, { ...ip, origin: "https://evil.example" }), 403],
    ["missing origin", noOrigin, 403],
    ["malformed JSON", () => post("{not json", ip), 400],
  ];
  for (let round = 0; round < 2; round++) {
    for (const [name, make, status] of junk) {
      assert.equal((await handleRequest(make(), env, 1000)).status, status, `${name} (round ${round})`);
    }
  }
  // The sender's full quota is still there: 3 real sends land, the 4th is limited.
  for (let i = 0; i < 3; i++) {
    assert.equal((await handleRequest(post({ topic: "bug", message: `real ${i}` }, ip), env, 2000)).status, 200, `real send ${i}`);
  }
  assert.equal((await handleRequest(post({ topic: "bug", message: "real 4" }, ip), env, 2000)).status, 429);
});

test("SPEC §3.2 order: 3 invalid sends then a valid send from the same sender → the valid send is delivered (200)", async () => {
  const { env } = defaultEnv();
  const ip = { "cf-connecting-ip": "203.0.113.72" };
  for (let i = 0; i < 3; i++) {
    assert.equal((await handleRequest(post({ topic: "bug", message: "   " }, ip), env, 1000)).status, 400, `invalid ${i}`);
  }
  const valid = await handleRequest(post({ topic: "bug", message: "the map froze" }, ip), env, 1000);
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { ok: true, stored: false });
});

test("SPEC §3.2 order: an over-quota sender still gets the honeypot silent 200 and the gate answers (origin 403, invalid 400), not 429", async () => {
  const { env } = defaultEnv();
  const ip = { "cf-connecting-ip": "203.0.113.71" };
  for (let i = 0; i < 3; i++) {
    assert.equal((await handleRequest(post({ topic: "bug", message: `m${i}` }, ip), env, 1000)).status, 200);
  }
  const honeypot = await handleRequest(post({ topic: "other", message: "buy", website: "http://spam" }, ip), env, 1000);
  assert.equal(honeypot.status, 200, "honeypot stays a silent 200 after the quota is spent");
  assert.deepEqual(await honeypot.json(), { ok: true });
  assert.equal((await handleRequest(post({ topic: "bug", message: "x" }, { ...ip, origin: "https://evil.example" }), env, 1000)).status, 403);
  assert.equal((await handleRequest(post({ topic: "nope", message: "" }, ip), env, 1000)).status, 400);
  assert.equal((await handleRequest(post({ topic: "bug", message: "valid" }, ip), env, 1000)).status, 429);
});

test("SPEC §3.2 order: junk never reaches the Workers rate-limit binding (shared global budget untouched)", async () => {
  let calls = 0;
  const env: ContactEnv = { CONTACT_RATE_LIMITER: { limit: async () => (calls++, { success: true }) } };
  const ip = { "cf-connecting-ip": "203.0.113.73" };
  await handleRequest(post({ topic: "other", message: "buy", website: "http://spam" }, ip), env, 1000);
  await handleRequest(post({ topic: "nope", message: "" }, ip), env, 1000);
  await handleRequest(post({ topic: "bug", message: "x" }, { ...ip, origin: "https://evil.example" }), env, 1000);
  await handleRequest(post("{not json", ip), env, 1000);
  assert.equal(calls, 0, "no binding call for junk");
  assert.equal((await handleRequest(post({ topic: "bug", message: "real" }, ip), env, 1000)).status, 200);
  assert.ok(calls > 0, "a deliverable message is counted");
});

// --- Email detection: linear-time, and identical to the shipped regex ---

/** Test-only oracle: the shipped (quadratic) EMAIL_IN_TEXT before #220 Option 1a. */
const OLD_EMAIL_IN_TEXT = /[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}/g;
const oldStripEmails = (s: string) => s.replace(OLD_EMAIL_IN_TEXT, "[email removed]");

test("email/phone scrub runs in linear time on long adversarial text (min of 3 runs < 100 ms at 32,000 chars)", () => {
  // Load-tolerant by design (#220 review F4): the input is large enough
  // that the linear regex takes well under 1 ms (Node 22) while the old
  // unanchored, quadratic one takes about a second (~4x per doubling:
  // ~16 ms at 4k, ~240 ms at 16k chars). The MIN of a few runs is used
  // because machine load only ever adds time. stripContactDetails is
  // called directly: validateContact refuses over-length text before it
  // scrubs, so timing it on long input would not exercise the regex.
  const n = 32_000;
  const adversarial: Array<[string, string]> = [
    ["'a' run", "a".repeat(n)],
    ["'+1' run", "+1".repeat(n / 2)],
    ["'a.' run", "a.".repeat(n / 2)],
    ["'.' run", ".".repeat(n)],
    ["'x' run + '@b'", "x".repeat(n - 2) + "@b"],
    ["'a@' run", "a@".repeat(n / 2)],
    ["'a@a.' run", "a@a.".repeat(n / 4)],
  ];
  for (const [name, text] of adversarial) {
    stripContactDetails(text); // warm-up
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      stripContactDetails(text);
      best = Math.min(best, performance.now() - t);
    }
    assert.ok(best < 100, `${name}: min ${best.toFixed(1)} ms ≥ 100 ms at ${n} chars (quadratic email scan?)`);
  }
});

test("email stripping is identical to the shipped regex: hand-picked edges", () => {
  const edges = [
    "kid@example.com",
    "kid@example.com is me",
    "write to kid@example.com",
    "kid+tag@example.co.uk, and a.b.c@d.e.fg; also x@y.zz",
    "jöhn.dœ@exämple.de and 日本@例え.日本",
    "a@b@c.com",
    "a@b.c",
    "a@b",
    "@example.com",
    "kid@.com",
    "kid@example.",
    "kid@example.c",
    "<kid@example.com>",
    "(kid@example.com)",
    '"kid@example.com"',
    "mail:kid@example.com",
    "kid@@example.com",
    "kid@example..com",
    "...@...",
    "a@b.cc@d.ee",
    "x".repeat(500) + "@example.com",
    "",
    "no email here at all.",
    "emoji😀@exa😀mple.co😀",
  ];
  for (const s of edges) assert.equal(stripContactDetails(s), oldStripEmails(s), JSON.stringify(s));
  assert.equal(stripContactDetails("hi kid+tag@example.co.uk!"), "hi [email removed]");
  assert.equal(stripContactDetails("a@b.c stays"), "a@b.c stays");
});

test("email stripping is identical to the shipped regex: 200k fixed-seed random/adversarial strings", () => {
  // mulberry32, fixed seed — deterministic corpus. No digits, so the phone
  // pass is a no-op and stripContactDetails isolates the email pass.
  let seed = 0x220_1a;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const alphabet = ["a", "b", "Z", "é", "日", "😀", "_", "-", "+", ".", ".", "@", "@", " ", "\n", "\t", "\u00a0", "<", ">", "(", ")", '"', ",", ";", ":", "'", "/", "!"];
  const units = ["a@", "@a", "a.", ".a", "ab", "a@b.cd", "@", ".", " ", "x", ".co", "+1", "a@b", ";", "<a@b.cc>"];
  const N = 200_000;
  let diffs = 0;
  let withMatch = 0;
  const firstDiffs: string[] = [];
  for (let i = 0; i < N; i++) {
    let s = "";
    if (i % 4 === 3) {
      // adversarial: repeated structural units
      const reps = 1 + Math.floor(rand() * 40);
      for (let r = 0; r < reps; r++) s += units[Math.floor(rand() * units.length)];
    } else {
      const len = Math.floor(rand() * 48);
      for (let k = 0; k < len; k++) s += alphabet[Math.floor(rand() * alphabet.length)];
    }
    const want = oldStripEmails(s);
    if (want !== s) withMatch++;
    if (stripContactDetails(s) !== want) {
      diffs++;
      if (firstDiffs.length < 5) firstDiffs.push(JSON.stringify(s));
    }
  }
  assert.equal(diffs, 0, `diffs: ${firstDiffs.join(" | ")}`);
  assert.ok(withMatch > N / 20, `corpus too easy: only ${withMatch} strings contain an email`);
});

test("validateContact strips emails and phone numbers from the message, never the replyTo", () => {
  const r = validateContact({
    topic: "bug",
    message: "Reach me at kid@example.com or 402-555-1234 about the bug",
    replyTo: "grownup@example.com",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.message, "Reach me at [email removed] or [phone removed] about the bug");
    assert.equal(r.value.replyTo, "grownup@example.com");
  }
});

test("stripContactDetails: phone shapes stripped, ordinary numbers left alone", () => {
  for (const phone of [
    "402-555-1234",
    "(402) 555-1234",
    "+1 402 555 1234",
    "402.555.1234",
    "4025551234",
    "555-1234",
    "+44 20 7946 0958",
  ]) {
    assert.equal(stripContactDetails(`call ${phone} now`), "call [phone removed] now", phone);
  }
  const benign = "I scored 1200 points on level 12 in 2026, ZIP 68501, version 1.2.3";
  assert.equal(stripContactDetails(benign), benign);
  // A message that is only an email still validates — as the placeholder.
  const only = validateContact({ topic: "other", message: "kid@example.com" });
  assert.equal(only.ok, true);
  if (only.ok) assert.equal(only.value.message, "[email removed]");
});

test("delivered Discord copy carries the stripped message (no email, no phone)", async () => {
  const bodies: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(String(init.body));
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  try {
    const env: ContactEnv = { CONTACT_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/2/hook" };
    const res = await handleRequest(
      post(
        { topic: "other", message: "my phone is 402-555-1234 and email kid@example.com" },
        { "cf-connecting-ip": "198.51.100.55" },
      ),
      env,
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, stored: true });
    assert.equal(bodies.length, 1);
    assert.ok(!bodies[0].includes("402-555-1234"));
    assert.ok(!bodies[0].includes("kid@example.com"));
    assert.ok(bodies[0].includes("[phone removed]"));
    assert.ok(bodies[0].includes("[email removed]"));
  } finally {
    globalThis.fetch = realFetch;
  }
});
