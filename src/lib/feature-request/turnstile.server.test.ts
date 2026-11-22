import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstileToken, TURNSTILE_SITEVERIFY_URL } from "./turnstile.server.ts";

test("verifyTurnstileToken posts urlencoded to siteverify and reads success", async () => {
  const realFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    assert.equal(await verifyTurnstileToken("tok", "secret"), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, TURNSTILE_SITEVERIFY_URL);
    assert.equal(calls[0]?.init?.method, "POST");
    assert.match(String(calls[0]?.init?.body), /secret=secret/);
    assert.match(String(calls[0]?.init?.body), /response=tok/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("missing secret or token fails closed without fetching; non-ok fails closed", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
  try {
    assert.equal(await verifyTurnstileToken("", "secret"), false);
    assert.equal(await verifyTurnstileToken("tok", undefined), false);
    assert.equal(calls, 0);
    assert.equal(await verifyTurnstileToken("tok", "secret"), false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
