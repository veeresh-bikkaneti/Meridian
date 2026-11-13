import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  formatFeatureRequestPost,
  handleFeatureRequest,
  resetFeatureRequestStateForTests,
  sanitizeFeatureText,
  validateFeatureRequest,
  type FeatureRequestEnv,
} from "./feature-request-handler.server.ts";

const WEBHOOK = "https://discord.com/api/webhooks/123456789/test-token-abc";
const ORIGIN = "https://meridian.knowledgetest.workers.dev";
const NOW = 1_700_000_000_000;

function env(partial: Partial<FeatureRequestEnv> = {}): FeatureRequestEnv {
  return {
    FEATURE_DISCORD_WEBHOOK_URL: WEBHOOK,
    FEATURE_TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    ...partial,
  };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/feature-request`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = {
  idea: "A map quiz about rivers, please",
  ageGroup: "7-10",
  subject: "Geography",
  turnstileToken: "token-ok",
  website: "",
};

interface CapturedPost {
  url: string;
  body: { content: string; allowed_mentions?: { parse: string[] }; flags?: number; embeds?: unknown };
}

function capturingFetch(captured: CapturedPost[], ok = true): typeof fetch {
  return async (input, init) => {
    captured.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as CapturedPost["body"],
    });
    return new Response(null, { status: ok ? 204 : 500 });
  };
}

const verifyOk = async () => true;
const verifyBad = async () => false;

beforeEach(() => {
  resetFeatureRequestStateForTests();
});

describe("validation", () => {
  it("accepts a well-formed request", () => {
    const r = validateFeatureRequest(VALID);
    assert.ok("value" in r && r.ok);
  });

  it("rejects an over-long idea (501 chars)", () => {
    const r = validateFeatureRequest({ ...VALID, idea: "x".repeat(501) });
    assert.ok("problems" in r);
  });

  it("rejects unknown fields and bad enum values", () => {
    assert.ok("problems" in validateFeatureRequest({ ...VALID, email: "a@b.co" }));
    assert.ok("problems" in validateFeatureRequest({ ...VALID, ageGroup: "3-5" }));
    assert.ok("problems" in validateFeatureRequest({ ...VALID, subject: "Religion" }));
    // Never echoes the caller's field names back.
    const r = validateFeatureRequest({ ...VALID, secretField: 1 });
    assert.ok("problems" in r && !JSON.stringify(r.problems).includes("secretField"));
  });
});

describe("sanitisation", () => {
  it("strips @everyone, @here, mentions and links", () => {
    const dirty =
      "Hey @everyone and @here, ask <@123456> or <@&789> in <#111> — see https://example.com/x and www.example.org or discord.gg/abc";
    const clean = sanitizeFeatureText(dirty);
    for (const banned of ["@everyone", "@here", "<@123456>", "<@&789>", "<#111>", "https://", "www.example", "discord.gg"]) {
      assert.ok(!clean.includes(banned), `expected ${banned} to be stripped from: ${clean}`);
    }
    assert.ok(clean.includes("everyone"));
  });

  it("the Discord post is plain text with allowed_mentions empty and the triage footer", () => {
    const post = formatFeatureRequestPost({
      idea: "More river quizzes @everyone https://example.com",
      ageGroup: "10-18",
      subject: "Math",
      receivedAt: new Date(NOW).toISOString(),
    });
    assert.ok(!post.includes("@everyone"));
    assert.ok(!post.includes("https://example.com"));
    assert.ok(post.includes("requests on religion, LGBTQ or world politics are out of scope"));
  });
});

describe("handler", () => {
  it("rejects a missing Turnstile token", async () => {
    const res = await handleFeatureRequest(
      request({ ...VALID, turnstileToken: "" }),
      env(),
      NOW,
      { fetchFn: capturingFetch([]), verifyTurnstile: verifyOk },
    );
    assert.equal(res.status, 403);
  });

  it("rejects a bad Turnstile token and delivers nothing", async () => {
    const captured: CapturedPost[] = [];
    const res = await handleFeatureRequest(request(VALID), env(), NOW, {
      fetchFn: capturingFetch(captured),
      verifyTurnstile: verifyBad,
    });
    assert.equal(res.status, 403);
    assert.equal(captured.length, 0);
  });

  it("rejects over-long and unknown-field bodies with 400", async () => {
    const long = await handleFeatureRequest(
      request({ ...VALID, idea: "y".repeat(501) }),
      env(),
      NOW,
      { fetchFn: capturingFetch([]), verifyTurnstile: verifyOk },
    );
    assert.equal(long.status, 400);
    const extra = await handleFeatureRequest(
      request({ ...VALID, name: "Someone" }),
      env(),
      NOW,
      { fetchFn: capturingFetch([]), verifyTurnstile: verifyOk },
    );
    assert.equal(extra.status, 400);
  });

  it("answers 'not open yet' when the webhook secret is missing, and never echoes a webhook URL", async () => {
    const res = await handleFeatureRequest(request(VALID), env({ FEATURE_DISCORD_WEBHOOK_URL: undefined }), NOW, {
      fetchFn: capturingFetch([]),
      verifyTurnstile: verifyOk,
    });
    assert.equal(res.status, 503);
    const text = await res.text();
    assert.ok(text.includes("Feature requests are not open yet"));
    assert.ok(!text.includes("discord.com/api/webhooks"));
  });

  it("answers 'not open yet' when the webhook is not a Discord webhook URL", async () => {
    const res = await handleFeatureRequest(
      request(VALID),
      env({ FEATURE_DISCORD_WEBHOOK_URL: "https://example.com/hook" }),
      NOW,
      { fetchFn: capturingFetch([]), verifyTurnstile: verifyOk },
    );
    assert.equal(res.status, 503);
    assert.ok(!(await res.text()).includes("example.com/hook"));
  });

  it("delivers a sanitised plain-text post with allowed_mentions parse []", async () => {
    const captured: CapturedPost[] = [];
    const res = await handleFeatureRequest(
      request({ ...VALID, idea: "Quiz about rivers @everyone — https://example.com/x" }),
      env(),
      NOW,
      { fetchFn: capturingFetch(captured), verifyTurnstile: verifyOk },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, stored: true });
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, WEBHOOK);
    assert.deepEqual(captured[0].body.allowed_mentions, { parse: [] });
    assert.equal(captured[0].body.embeds, undefined, "plain text only, no embeds");
    assert.ok(!captured[0].body.content.includes("@everyone"));
    assert.ok(!captured[0].body.content.includes("https://example.com"));
    // The webhook URL appears only as the delivery target, never in a response.
  });

  it("returns 429 past the rate limit", async () => {
    const captured: CapturedPost[] = [];
    const fetchFn = capturingFetch(captured);
    // The shared in-memory floor allows 3 per client per 10 minutes.
    for (let i = 0; i < 3; i++) {
      const okRes = await handleFeatureRequest(
        request(VALID, { "cf-connecting-ip": "203.0.113.7" }),
        env(),
        NOW + i * 1000,
        { fetchFn, verifyTurnstile: verifyOk },
      );
      assert.equal(okRes.status, 200, `request ${i + 1} should pass`);
    }
    const limited = await handleFeatureRequest(
      request(VALID, { "cf-connecting-ip": "203.0.113.7" }),
      env(),
      NOW + 4000,
      { fetchFn, verifyTurnstile: verifyOk },
    );
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
  });

  it("refuses a POST with no Origin header", async () => {
    const req = new Request(`${ORIGIN}/api/feature-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID),
    });
    const res = await handleFeatureRequest(req, env(), NOW, {
      fetchFn: capturingFetch([]),
      verifyTurnstile: verifyOk,
    });
    assert.equal(res.status, 403);
  });

  it("a filled honeypot gets a quiet 200 and no delivery", async () => {
    const captured: CapturedPost[] = [];
    const res = await handleFeatureRequest(
      request({ ...VALID, website: "http://spam.example" }),
      env(),
      NOW,
      { fetchFn: capturingFetch(captured), verifyTurnstile: verifyOk },
    );
    assert.equal(res.status, 200);
    assert.equal(captured.length, 0);
  });
});
