import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { z } from "zod";

import { createBrowserTransportPort } from "./browser-transport.ts";
import {
  createFakeFetch,
  createFakeTransport,
  type FakeFetch,
  type FakeFetchCall,
  type FakeFetchOutcome,
} from "./fake-transport.ts";
import { TransportError, type TransportPort } from "./transport.ts";
import { createTransportRequest } from "./use-transport.ts";

/**
 * Contract tests for the Phase 1 transport port. One shared
 * scenario suite runs against both drivers: the browser port
 * driven by a scripted fake fetch, and the fake transport (the
 * same browser port layered over its own scripted fetch). Both
 * must behave the same: successes return the schema-parsed value,
 * failures reject with one TransportError kind, the caller's abort
 * always wins and never becomes a TransportError, and retries
 * happen only where the arena allowed them (network, timeout,
 * http 5xx) with the caller's numbers.
 */

const instantSleep = (): Promise<void> => Promise.resolve();

const GREETING = z.object({ hello: z.string() });
const OK = z.object({ ok: z.boolean() });

const URL = "https://example.test/greeting";

interface Harness {
  port: TransportPort;
  queue(url: string, outcome: FakeFetchOutcome): void;
  calls: FakeFetchCall[];
}

interface Driver {
  name: string;
  setup(): Harness;
}

const browserDriver: Driver = {
  name: "browser transport port",
  setup() {
    const fake: FakeFetch = createFakeFetch();
    const port = createBrowserTransportPort({
      fetch: fake.fetch,
      sleep: instantSleep,
    });
    return { port, queue: fake.queue, calls: fake.calls };
  },
};

const fakeDriver: Driver = {
  name: "fake transport",
  setup() {
    const fake = createFakeTransport();
    return { port: fake.port, queue: fake.queue, calls: fake.calls };
  },
};

const isTransportError =
  (kind: TransportError["kind"], status?: number) =>
  (err: unknown): boolean => {
    assert.ok(err instanceof TransportError, "rejects with a TransportError");
    assert.equal(err.name, "TransportError");
    assert.equal(err.kind, kind);
    assert.equal(err.url, URL);
    if (status !== undefined) assert.equal(err.status, status);
    return true;
  };

const isAbortError = (err: unknown): boolean => {
  assert.ok(err instanceof Error, "rejects with an Error");
  assert.equal(err.name, "AbortError");
  assert.ok(!(err instanceof TransportError), "an abort is never a TransportError");
  return true;
};

for (const driver of [browserDriver, fakeDriver]) {
  describe(`transport contract — ${driver.name}`, () => {
    test("getJson returns the schema-parsed value on success", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { hello: "world" } });
      const value = await h.port.getJson(URL, GREETING);
      assert.deepEqual(value, { hello: "world" });
      assert.equal(h.calls.length, 1);
      assert.equal(h.calls[0]?.method, "GET");
    });

    test("a payload the schema rejects is a parse failure", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { hello: 42 } });
      await assert.rejects(
        h.port.getJson(URL, GREETING),
        isTransportError("parse"),
      );
      assert.equal(h.calls.length, 1);
    });

    test("http 404 is an http failure and is never retried", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "http", status: 404 });
      await assert.rejects(
        h.port.getJson(URL, GREETING, { retries: 2 }),
        isTransportError("http", 404),
      );
      assert.equal(h.calls.length, 1);
    });

    test("http 500 retries up to the caller's count, then fails as http", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "http", status: 500 });
      h.queue(URL, { type: "http", status: 500 });
      h.queue(URL, { type: "http", status: 500 });
      await assert.rejects(
        h.port.getJson(URL, GREETING, { retries: 2 }),
        isTransportError("http", 500),
      );
      assert.equal(h.calls.length, 3);
    });

    test("a network failure followed by a success succeeds with retries: 1", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "network" });
      h.queue(URL, { type: "json", value: { hello: "again" } });
      const value = await h.port.getJson(URL, GREETING, { retries: 1 });
      assert.deepEqual(value, { hello: "again" });
      assert.equal(h.calls.length, 2);
    });

    test("a body that is not JSON is a parse failure and is not retried", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "badJson" });
      await assert.rejects(
        h.port.getJson(URL, GREETING, { retries: 2 }),
        isTransportError("parse"),
      );
      assert.equal(h.calls.length, 1);
    });

    test("a hanging attempt past timeoutMs fails as timeout", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "hang" });
      await assert.rejects(
        h.port.getJson(URL, GREETING, { timeoutMs: 25 }),
        isTransportError("timeout"),
      );
      assert.equal(h.calls.length, 1);
    });

    test("the caller aborting mid-flight rejects with an AbortError and stops", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "hang" });
      const caller = new AbortController();
      const pending = h.port.getJson(URL, GREETING, {
        signal: caller.signal,
        retries: 3,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(h.calls.length, 1);
      caller.abort();
      await assert.rejects(pending, isAbortError);
      assert.equal(h.calls.length, 1, "no further attempts after the caller aborts");
    });

    test("an already-aborted caller signal rejects before any fetch", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { hello: "world" } });
      const caller = new AbortController();
      caller.abort();
      await assert.rejects(
        h.port.getJson(URL, GREETING, { signal: caller.signal }),
        isAbortError,
      );
      assert.equal(h.calls.length, 0);
    });

    test("postJson sends a POST with a JSON body and returns the parsed value", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { ok: true } });
      const value = await h.port.postJson(URL, { hello: "world" }, OK);
      assert.deepEqual(value, { ok: true });
      assert.equal(h.calls.length, 1);
      assert.equal(h.calls[0]?.method, "POST");
      assert.equal(h.calls[0]?.body, JSON.stringify({ hello: "world" }));
      assert.equal(h.calls[0]?.headers["content-type"], "application/json");
    });

    test("postText resolves with status and text for any completed exchange, including 4xx/5xx", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "text", text: "hello", status: 200 });
      const ok = await h.port.postText(URL, "ping");
      assert.deepEqual(ok, { status: 200, text: "hello" });
      assert.equal(h.calls[0]?.method, "POST");
      assert.equal(h.calls[0]?.body, "ping");
      h.queue(URL, { type: "text", text: "nope", status: 404 });
      const notFound = await h.port.postText(URL, "ping", { retries: 2 });
      assert.deepEqual(notFound, { status: 404, text: "nope" });
      assert.equal(h.calls.length, 2);
      h.queue(URL, { type: "text", text: "boom", status: 500 });
      const serverError = await h.port.postText(URL, "ping");
      assert.deepEqual(serverError, { status: 500, text: "boom" });
      assert.equal(h.calls.length, 3);
    });

    test("postText retries a 5xx, resolving with the first success or the last failure", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "text", text: "boom", status: 500 });
      h.queue(URL, { type: "text", text: "recovered", status: 200 });
      const recovered = await h.port.postText(URL, "ping", { retries: 1 });
      assert.deepEqual(recovered, { status: 200, text: "recovered" });
      assert.equal(h.calls.length, 2);
      h.queue(URL, { type: "text", text: "boom", status: 500 });
      h.queue(URL, { type: "text", text: "boom", status: 500 });
      h.queue(URL, { type: "text", text: "boom", status: 500 });
      const last = await h.port.postText(URL, "ping", { retries: 2 });
      assert.deepEqual(last, { status: 500, text: "boom" });
      assert.equal(h.calls.length, 5);
    });

    test("postText retries a network failure and succeeds", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "network" });
      h.queue(URL, { type: "text", text: "again", status: 200 });
      const value = await h.port.postText(URL, "ping", { retries: 1 });
      assert.deepEqual(value, { status: 200, text: "again" });
      assert.equal(h.calls.length, 2);
    });

    test("postForm sends a urlencoded body and returns the schema-checked value", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { ok: true } });
      const value = await h.port.postForm(URL, { token: "a b", next: "x&y" }, OK);
      assert.deepEqual(value, { ok: true });
      assert.equal(h.calls.length, 1);
      assert.equal(h.calls[0]?.method, "POST");
      assert.equal(h.calls[0]?.body, "token=a+b&next=x%26y");
      assert.equal(
        h.calls[0]?.headers["content-type"],
        "application/x-www-form-urlencoded",
      );
    });

    test("postForm schema rejection is a parse failure and is not retried", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { ok: "yes" } });
      await assert.rejects(
        h.port.postForm(URL, { token: "t" }, OK, { retries: 2 }),
        isTransportError("parse"),
      );
      assert.equal(h.calls.length, 1);
    });

    test("getRaw resolves on success with ok, status and an awaitable json", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { hello: "world" } });
      const raw = await h.port.getRaw(URL);
      assert.equal(raw.ok, true);
      assert.equal(raw.status, 200);
      assert.deepEqual(await raw.json, { hello: "world" });
      assert.equal(h.calls.length, 1);
    });

    test("getRaw never throws on !ok: a 404 resolves with ok false", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { error: "gone" }, status: 404 });
      const raw = await h.port.getRaw(URL, { retries: 2 });
      assert.equal(raw.ok, false);
      assert.equal(raw.status, 404);
      assert.deepEqual(await raw.json, { error: "gone" });
      assert.equal(h.calls.length, 1);
    });

    test("getRaw retries a 5xx, resolving with the first success or the last failure", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "http", status: 500 });
      h.queue(URL, { type: "json", value: { hello: "world" } });
      const recovered = await h.port.getRaw(URL, { retries: 1 });
      assert.equal(recovered.ok, true);
      assert.equal(recovered.status, 200);
      assert.deepEqual(await recovered.json, { hello: "world" });
      assert.equal(h.calls.length, 2);
      h.queue(URL, { type: "http", status: 500 });
      h.queue(URL, { type: "http", status: 500 });
      h.queue(URL, { type: "http", status: 500 });
      const last = await h.port.getRaw(URL, { retries: 2 });
      assert.equal(last.ok, false);
      assert.equal(last.status, 500);
      assert.equal(h.calls.length, 5);
    });

    test("keepalive passes through to the request", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { hello: "world" } });
      await h.port.getJson(URL, GREETING, { keepalive: true });
      assert.equal(h.calls[0]?.keepalive, true);
      h.queue(URL, { type: "json", value: { hello: "world" } });
      await h.port.getJson(URL, GREETING);
      assert.equal(h.calls[1]?.keepalive, undefined);
    });

    test("the request controller walks idle → loading → ready on success", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "json", value: { hello: "world" } });
      const request = createTransportRequest(h.port);
      assert.equal(request.getState().status, "idle");
      const done = request.start(URL, GREETING);
      assert.equal(request.getState().status, "loading");
      await done;
      assert.equal(request.getState().status, "ready");
      assert.deepEqual(request.getState().data, { hello: "world" });
      assert.equal(request.getState().error, null);
    });

    test("the request controller lands in error on failure", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "network" });
      const request = createTransportRequest(h.port);
      await request.start(URL, GREETING);
      assert.equal(request.getState().status, "error");
      assert.ok(request.getState().error instanceof TransportError);
      assert.equal(request.getState().error?.kind, "network");
      assert.equal(request.getState().data, null);
    });

    test("the request controller lands in aborted when abort() cancels a call", async () => {
      const h = driver.setup();
      h.queue(URL, { type: "hang" });
      const request = createTransportRequest(h.port);
      const done = request.start(URL, GREETING);
      assert.equal(request.getState().status, "loading");
      request.abort();
      await done;
      assert.equal(request.getState().status, "aborted");
      assert.equal(request.getState().error, null);
    });
  });
}

describe("transport port — the caller's abort wins over a signal-ignoring fetch", () => {
  const stubResponse = (json: () => Promise<unknown>): Response =>
    ({ ok: true, status: 200, json }) as Response;

  test("a fetch that resolves after the caller aborts rejects with an AbortError, not data", async () => {
    // This fetch never looks at the attempt signal it is handed.
    const stubbornFetch = (): Promise<Response> =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(stubResponse(() => Promise.resolve({ hello: "world" })));
        }, 30);
      });
    const port = createBrowserTransportPort({
      fetch: stubbornFetch as typeof fetch,
      sleep: instantSleep,
    });
    const caller = new AbortController();
    const pending = port.getJson(URL, GREETING, { signal: caller.signal });
    await new Promise((resolve) => setTimeout(resolve, 5));
    caller.abort();
    await assert.rejects(pending, isAbortError);
  });

  test("a body that finishes parsing after the caller aborts rejects with an AbortError, not data", async () => {
    const slowJsonFetch = (): Promise<Response> =>
      Promise.resolve(
        stubResponse(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({ hello: "world" });
              }, 30);
            }),
        ),
      );
    const port = createBrowserTransportPort({
      fetch: slowJsonFetch as typeof fetch,
      sleep: instantSleep,
    });
    const caller = new AbortController();
    const pending = port.getJson(URL, GREETING, { signal: caller.signal });
    await new Promise((resolve) => setTimeout(resolve, 5));
    caller.abort();
    await assert.rejects(pending, isAbortError);
  });
});

describe("transport request controller — unexpected rejections are errors, not aborts", () => {
  test("a port rejecting with a plain Error lands in error with a non-null error", async () => {
    const boom = new Error("boom");
    const port: TransportPort = {
      getJson: () => Promise.reject(boom),
      postJson: () => Promise.reject(boom),
      postText: () => Promise.reject(boom),
      postForm: () => Promise.reject(boom),
      getRaw: () => Promise.reject(boom),
    };
    const request = createTransportRequest(port);
    await request.start(URL, GREETING);
    assert.equal(request.getState().status, "error");
    assert.ok(request.getState().error instanceof TransportError);
    assert.equal(request.getState().error?.kind, "network");
    assert.equal(request.getState().error?.cause, boom);
    assert.equal(request.getState().data, null);
  });

  test("a port rejecting with an AbortError-named error lands in aborted", async () => {
    const aborted = new DOMException("Aborted", "AbortError");
    const port: TransportPort = {
      getJson: () => Promise.reject(aborted),
      postJson: () => Promise.reject(aborted),
      postText: () => Promise.reject(aborted),
      postForm: () => Promise.reject(aborted),
      getRaw: () => Promise.reject(aborted),
    };
    const request = createTransportRequest(port);
    await request.start(URL, GREETING);
    assert.equal(request.getState().status, "aborted");
    assert.equal(request.getState().error, null);
    assert.equal(request.getState().data, null);
  });
});
