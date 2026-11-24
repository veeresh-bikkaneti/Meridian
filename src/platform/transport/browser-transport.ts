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
 *   with a failure status → http (its body is never parsed, in
 *   the JSON modes); a body that is not JSON, or that the schema
 *   rejects → parse. The resolving modes (postText, getRaw) read
 *   any completed response instead of throwing for its status.
 * - Only network, timeout and http 5xx failures retry, up to the
 *   caller's `retries` extra attempts, waiting
 *   200 ms × 2^attempt between them through the injectable sleep.
 *   A resolving mode retries a 5xx while attempts remain and
 *   resolves with it once they run out.
 *
 * The global fetch is resolved lazily inside every call, never
 * at import, so tests that stub `globalThis.fetch` keep working.
 */

import {
  TransportError,
  type RawResponse,
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

/** What one attempt sends: a pre-encoded body, when it has one. */
interface AttemptRequest {
  method: "GET" | "POST";
  /** The body's bytes, already encoded by the caller. */
  body?: string;
  /** The body's media type, when the method carries one. */
  contentType?: string;
}

/**
 * One attempt, three ways of reading the answer. The overloads
 * keep each caller typed: "json" hands back the parsed body (and
 * throws for a failure status, its body never parsed), "text"
 * hands back status and text for any completed exchange, "raw"
 * hands back the status and the body's async parse, which the
 * caller owns. Schema checking happens in the caller of this
 * helper so its failure classifies the same whether the body
 * came from the network or not — it cannot, but the loop reads
 * cleaner for it.
 */
async function runAttempt(
  fetchFn: typeof fetch,
  url: string,
  req: AttemptRequest,
  mode: "json",
  opts: TransportOptions,
): Promise<unknown>;
async function runAttempt(
  fetchFn: typeof fetch,
  url: string,
  req: AttemptRequest,
  mode: "text",
  opts: TransportOptions,
): Promise<{ status: number; text: string }>;
async function runAttempt(
  fetchFn: typeof fetch,
  url: string,
  req: AttemptRequest,
  mode: "raw",
  opts: TransportOptions,
): Promise<{ ok: boolean; status: number; json: Promise<unknown> }>;
async function runAttempt(
  fetchFn: typeof fetch,
  url: string,
  req: AttemptRequest,
  mode: "json" | "text" | "raw",
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
    const init: RequestInit = { method: req.method, signal: attempt.signal };
    if (opts.keepalive !== undefined) init.keepalive = opts.keepalive;
    if (opts.credentials !== undefined) init.credentials = opts.credentials;
    if (opts.referrerPolicy !== undefined) init.referrerPolicy = opts.referrerPolicy;
    if (req.body !== undefined) {
      init.body = req.body;
      init.headers = {
        ...(req.contentType ? { "content-type": req.contentType } : {}),
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

    // A fetch that ignores its signal can still resolve after
    // the caller aborted; the caller's abort wins over the data.
    if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);

    if (mode === "raw") {
      // No body is read here: the parse starts only when the
      // caller first reads json, and that one parse is memoized.
      // A discarded outcome (a retried 5xx) and a dropped one
      // never create a promise nobody awaits, so neither can
      // reject unhandled.
      let parsed: Promise<unknown> | null = null;
      return {
        ok: response.ok,
        status: response.status,
        get json(): Promise<unknown> {
          if (!parsed) parsed = response.json();
          return parsed;
        },
      };
    }

    if (mode === "json" && !response.ok) {
      throw new TransportError("http", url, { status: response.status });
    }

    if (mode === "json") {
      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch (err) {
        if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);
        if (timedOut) throw new TransportError("timeout", url, { cause: err });
        if (isAbortError(err)) throw err;
        throw new TransportError("parse", url, { cause: err });
      }
      // Same check after the body lands: a slow parse must not
      // hand back data the caller already cancelled.
      if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);
      return parsed;
    }

    // mode === "text": a text read that fails classifies the same
    // way a JSON read does — a body that never lands is a parse
    // failure.
    let text: string;
    try {
      text = await response.text();
    } catch (err) {
      if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);
      if (timedOut) throw new TransportError("timeout", url, { cause: err });
      if (isAbortError(err)) throw err;
      throw new TransportError("parse", url, { cause: err });
    }
    if (callerSignal?.aborted) throw abortErrorFrom(callerSignal);
    return { status: response.status, text };
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

/** The attempt loop, shared by every method: backoff between
 * attempts, the caller's abort always winning, retries only for
 * the failures the arena allowed. An attempt reports a failure
 * worth retrying by throwing a TransportError; anything it
 * returns is the answer. */
async function requestWithRetries<T>(
  opts: TransportOptions,
  sleep: (ms: number) => Promise<void>,
  doAttempt: (attemptIndex: number, retries: number) => Promise<T>,
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
      return await doAttempt(attemptIndex, retries);
    } catch (err) {
      // An abort — the caller's, surfaced as an AbortError — is
      // never wrapped and never retried.
      if (!(err instanceof TransportError)) throw err;
      if (!isRetryEligible(err) || attemptIndex >= retries) throw err;
    }
  }
}

/** Make a transport port. Seams in deps are for tests. */
export function createBrowserTransportPort(
  deps: TransportPortDeps = {},
): TransportPort {
  const sleep = deps.sleep ?? defaultSleep;

  const requestJson = <T>(
    req: AttemptRequest,
    url: string,
    schema: SchemaLike<T>,
    opts: TransportOptions,
  ): Promise<T> =>
    requestWithRetries(opts, sleep, async () => {
      // The global fetch resolves lazily on every attempt, never
      // at import, so tests that stub it keep working.
      const raw = await runAttempt(
        deps.fetch ?? globalThis.fetch,
        url,
        req,
        "json",
        opts,
      );
      try {
        return schema.parse(raw);
      } catch (err) {
        throw new TransportError("parse", url, { cause: err });
      }
    });

  return {
    getJson<T>(
      url: string,
      schema: SchemaLike<T>,
      opts: TransportOptions = {},
    ): Promise<T> {
      return requestJson({ method: "GET" }, url, schema, opts);
    },
    postJson<T>(
      url: string,
      body: unknown,
      schema: SchemaLike<T>,
      opts: TransportOptions = {},
    ): Promise<T> {
      return requestJson(
        {
          method: "POST",
          body: JSON.stringify(body),
          contentType: "application/json",
        },
        url,
        schema,
        opts,
      );
    },
    postText(
      url: string,
      body: string,
      opts: TransportOptions = {},
    ): Promise<{ status: number; text: string }> {
      return requestWithRetries(opts, sleep, async (attemptIndex, retries) => {
        const outcome = await runAttempt(
          deps.fetch ?? globalThis.fetch,
          url,
          { method: "POST", body },
          "text",
          opts,
        );
        // A 5xx retries while attempts remain, then resolves.
        if (outcome.status >= 500 && attemptIndex < retries) {
          throw new TransportError("http", url, { status: outcome.status });
        }
        return outcome;
      });
    },
    postForm<T>(
      url: string,
      params: Record<string, string>,
      schema: SchemaLike<T>,
      opts: TransportOptions = {},
    ): Promise<T> {
      return requestJson(
        {
          method: "POST",
          body: new URLSearchParams(params).toString(),
          contentType: "application/x-www-form-urlencoded",
        },
        url,
        schema,
        opts,
      );
    },
    getRaw(url: string, opts: TransportOptions = {}): Promise<RawResponse> {
      return requestWithRetries(opts, sleep, async (attemptIndex, retries) => {
        const outcome = await runAttempt(
          deps.fetch ?? globalThis.fetch,
          url,
          { method: "GET" },
          "raw",
          opts,
        );
        // A 5xx retries while attempts remain, then resolves.
        if (outcome.status >= 500 && attemptIndex < retries) {
          throw new TransportError("http", url, { status: outcome.status });
        }
        return outcome;
      });
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

/** POST text through the shared browser port. */
export function postText(
  url: string,
  body: string,
  opts?: TransportOptions,
): Promise<{ status: number; text: string }> {
  return defaultPort.postText(url, body, opts);
}

/** POST a form through the shared browser port. */
export function postForm<T>(
  url: string,
  params: Record<string, string>,
  schema: SchemaLike<T>,
  opts?: TransportOptions,
): Promise<T> {
  return defaultPort.postForm(url, params, schema, opts);
}

/** GET a raw response through the shared browser port. */
export function getRaw(
  url: string,
  opts?: TransportOptions,
): Promise<RawResponse> {
  return defaultPort.getRaw(url, opts);
}
