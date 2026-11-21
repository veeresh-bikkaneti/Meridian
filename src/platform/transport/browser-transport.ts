/**
 * The browser transport port — the one real implementation of
 * the transport port, over the global fetch.
 *
 * The attempt loop lives here and nowhere else:
 *
 * - Each attempt composes the caller's signal with a fresh
 *   internal AbortController, plus a timer when the caller set
 *   timeoutMs. The caller's listener is added per attempt and
 *   removed when the attempt settles, so a long-lived caller
 *   signal never accumulates listeners.
 * - The caller's abort always wins: before the first attempt,
 *   mid-flight, or during the backoff sleep, the request rejects
 *   with an AbortError — never a TransportError — and stops.
 * - Classification is by where the attempt ended: fetch rejected
 *   → network; the attempt's timer fired → timeout; a response
 *   with a failure status → http (its body is never parsed); a
 *   body that is not JSON, or that the schema rejects → parse.
 * - Only network, timeout and http 5xx failures retry, up to the
 *   caller's `retries` extra attempts, waiting
 *   200 ms × 2^attempt between them through the injectable sleep.
 *
 * The global fetch is resolved lazily inside every call, never
 * at import, so tests that stub `globalThis.fetch` keep working.
 */

import {
  TransportError,
  type SchemaLike,
  type TransportOptions,
  type TransportPort,
  type TransportPortDeps,
} from "./transport.ts";

/** The rejection a caller abort produces: the signal's own reason
 * when it is an Error, a plain AbortError otherwise. */
function abortErrorFrom(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) return reason;
  return new DOMException("Aborted", "AbortError");
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** The backoff wait, cut short the moment the caller aborts. */
function sleepWithAbort(
  ms: number,
  callerSignal: AbortSignal | undefined,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  if (!callerSignal) return sleep(ms);
  if (callerSignal.aborted) return Promise.reject(abortErrorFrom(callerSignal));
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      reject(abortErrorFrom(callerSignal));
    };
    callerSignal.addEventListener("abort", onAbort, { once: true });
    sleep(ms).then(
      () => {
        callerSignal.removeEventListener("abort", onAbort);
        resolve();
      },
      (err: unknown) => {
        callerSignal.removeEventListener("abort", onAbort);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * One attempt: fetch, classify, and hand back the raw parsed
 * body. Schema checking happens in the caller of this helper so
 * its failure classifies the same whether the body came from the
 * network or not — it cannot, but the loop reads cleaner for it.
 */
async function runAttempt(
  fetchFn: typeof fetch,
  method: "GET" | "POST",
  url: string,
  body: unknown,
  opts: TransportOptions,
): Promise<unknown> {
  const callerSignal = opts.signal;
  if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);

  const attempt = new AbortController();
  let timedOut = false;
  const onCallerAbort = (): void => {
    attempt.abort(callerSignal?.reason);
  };
  callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
  const timer =
    opts.timeoutMs !== undefined
      ? setTimeout(() => {
          timedOut = true;
          attempt.abort();
        }, opts.timeoutMs)
      : null;

  try {
    const init: RequestInit = { method, signal: attempt.signal };
    if (method === "POST") {
      init.body = JSON.stringify(body);
      init.headers = {
        "content-type": "application/json",
        ...opts.headers,
      };
    } else if (opts.headers) {
      init.headers = opts.headers;
    }

    let response: Response;
    try {
      response = await fetchFn(url, init);
    } catch (err) {
      if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);
      if (timedOut) throw new TransportError("timeout", url, { cause: err });
      if (isAbortError(err)) throw err;
      throw new TransportError("network", url, { cause: err });
    }

    if (!response.ok) {
      throw new TransportError("http", url, { status: response.status });
    }

    try {
      return await response.json();
    } catch (err) {
      if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);
      if (timedOut) throw new TransportError("timeout", url, { cause: err });
      if (isAbortError(err)) throw err;
      throw new TransportError("parse", url, { cause: err });
    }
  } finally {
    if (timer !== null) clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

/** Whether one more attempt is allowed for this failure. */
function isRetryEligible(err: TransportError): boolean {
  return (
    err.kind === "network" ||
    err.kind === "timeout" ||
    (err.kind === "http" && (err.status ?? 0) >= 500)
  );
}

/** Make a transport port. Seams in deps are for tests. */
export function createBrowserTransportPort(
  deps: TransportPortDeps = {},
): TransportPort {
  const sleep = deps.sleep ?? defaultSleep;

  async function request<T>(
    method: "GET" | "POST",
    url: string,
    body: unknown,
    schema: SchemaLike<T>,
    opts: TransportOptions,
  ): Promise<T> {
    const callerSignal = opts.signal;
    if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);
    const retries = opts.retries ?? 0;

    for (let attemptIndex = 0; ; attemptIndex++) {
      if (attemptIndex > 0) {
        // Backoff for the attempt that just failed:
        // 200 ms × 2^attempt, cut short by the caller's abort.
        await sleepWithAbort(
          200 * 2 ** (attemptIndex - 1),
          callerSignal,
          sleep,
        );
      }
      if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);

      try {
        const raw = await runAttempt(
          deps.fetch ?? globalThis.fetch,
          method,
          url,
          body,
          opts,
        );
        try {
          return schema.parse(raw);
        } catch (err) {
          throw new TransportError("parse", url, { cause: err });
        }
      } catch (err) {
        // An abort — the caller's, surfaced as an AbortError — is
        // never wrapped and never retried.
        if (!(err instanceof TransportError)) throw err;
        if (!isRetryEligible(err) || attemptIndex >= retries) throw err;
      }
    }
  }

  return {
    getJson<T>(
      url: string,
      schema: SchemaLike<T>,
      opts: TransportOptions = {},
    ): Promise<T> {
      return request("GET", url, undefined, schema, opts);
    },
    postJson<T>(
      url: string,
      body: unknown,
      schema: SchemaLike<T>,
      opts: TransportOptions = {},
    ): Promise<T> {
      return request("POST", url, body, schema, opts);
    },
  };
}

const defaultPort = createBrowserTransportPort();

/** GET through the shared browser port. */
export function getJson<T>(
  url: string,
  schema: SchemaLike<T>,
  opts?: TransportOptions,
): Promise<T> {
  return defaultPort.getJson(url, schema, opts);
}

/** POST through the shared browser port. */
export function postJson<T>(
  url: string,
  body: unknown,
  schema: SchemaLike<T>,
  opts?: TransportOptions,
): Promise<T> {
  return defaultPort.postJson(url, body, schema, opts);
}
