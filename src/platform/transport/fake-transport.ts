/**
 * The scripted fake transport, for tests.
 *
 * The fake is a fetch, not a second port: `createFakeFetch`
 * returns a fetch-compatible stub whose answers are scripted per
 * URL with `queue` — each call to a URL consumes that URL's next
 * outcome, and an unscripted URL fails as a network error. The
 * fake transport then layers the real browser port over that
 * fetch, so the attempt loop, classification and retry semantics
 * under test are the production ones; only the network is fake.
 *
 * Outcomes: "json" (a parsed body, 200 unless a status is set),
 * "http" (a failure status, no body read), "network" (fetch
 * rejects), "badJson" (a 200 whose body is not JSON) and "hang"
 * (never settles until the attempt's signal aborts it, then
 * rejects with an AbortError — what a stalled request looks like
 * to the port). Every outcome honours the caller's signal: an
 * already-aborted signal rejects before anything is recorded
 * past the call itself.
 *
 * The calls log records each call's url, method, body and
 * headers, so a test can pin exactly what would have gone out.
 */

import { createBrowserTransportPort } from "./browser-transport.ts";
import type { TransportPort } from "./transport.ts";

/** One scripted answer for the next call to a URL. */
export type FakeFetchOutcome =
  | { type: "json"; value: unknown; status?: number }
  | { type: "http"; status: number }
  | { type: "network" }
  | { type: "badJson" }
  | { type: "hang" };

/** One call the fake fetch received. */
export interface FakeFetchCall {
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
}

/** A scripted fetch plus the test's controls over it. */
export interface FakeFetch {
  /** The fetch-compatible stub to hand to the port. */
  fetch: typeof fetch;
  /** Script the next answer for a URL. Outcomes are consumed in
   * the order they were queued. */
  queue(url: string, outcome: FakeFetchOutcome): void;
  /** Every call received, in order. */
  calls: FakeFetchCall[];
}

function abortError(): Error {
  return new DOMException("Aborted", "AbortError");
}

/** The slice of a Response the port reads, as a real Response. */
function fakeResponse(
  status: number,
  json: () => Promise<unknown>,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json,
  } as Response;
}

/** Make a scripted fetch. */
export function createFakeFetch(): FakeFetch {
  const queues = new Map<string, FakeFetchOutcome[]>();
  const calls: FakeFetchCall[] = [];

  const fetchStub = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const signal = init?.signal ?? undefined;
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
      headers: (init?.headers as Record<string, string> | undefined) ?? {},
    });
    if (signal?.aborted) return Promise.reject(abortError());

    const queue = queues.get(url);
    const outcome: FakeFetchOutcome =
      queue && queue.length > 0 ? queue.shift()! : { type: "network" };

    switch (outcome.type) {
      case "network":
        return Promise.reject(new TypeError("fetch failed"));
      case "http":
        return Promise.resolve(
          fakeResponse(outcome.status, () =>
            Promise.reject(new Error("no body on a failure response")),
          ),
        );
      case "badJson":
        return Promise.resolve(
          fakeResponse(200, () =>
            Promise.reject(
              new SyntaxError("Unexpected token, not valid JSON"),
            ),
          ),
        );
      case "json": {
        const value = outcome.value;
        return Promise.resolve(
          fakeResponse(outcome.status ?? 200, () => Promise.resolve(value)),
        );
      }
      case "hang":
        return new Promise<Response>((_resolve, reject) => {
          if (!signal) return; // No signal: hangs forever, by design.
          if (signal.aborted) {
            reject(abortError());
            return;
          }
          signal.addEventListener(
            "abort",
            () => {
              reject(abortError());
            },
            { once: true },
          );
        });
    }
  };

  return {
    fetch: fetchStub as typeof fetch,
    queue(url, outcome) {
      const queue = queues.get(url);
      if (queue) queue.push(outcome);
      else queues.set(url, [outcome]);
    },
    calls,
  };
}

/** A fake transport: the real port over a scripted fetch, with
 * an instant backoff sleep. */
export interface FakeTransport {
  /** The port under test. */
  port: TransportPort;
  /** The scripted fetch the port is driving. */
  fetch: typeof fetch;
  /** The fake fetch itself, for queueing and the calls log. */
  fake: FakeFetch;
  /** Script the next answer for a URL. */
  queue(url: string, outcome: FakeFetchOutcome): void;
  /** Every call the fetch received, in order. */
  calls: FakeFetchCall[];
}

/** Make a fake transport. A sleep seam is for tests that want to
 * watch the backoff; it defaults to instant. */
export function createFakeTransport(
  deps: { sleep?: (ms: number) => Promise<void> } = {},
): FakeTransport {
  const fake = createFakeFetch();
  const port = createBrowserTransportPort({
    fetch: fake.fetch,
    sleep: deps.sleep ?? ((): Promise<void> => Promise.resolve()),
  });
  return { port, fetch: fake.fetch, fake, queue: fake.queue, calls: fake.calls };
}
