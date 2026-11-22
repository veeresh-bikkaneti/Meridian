/**
 * The transport port's types — one place owns each HTTP request.
 *
 * A caller asks the port for JSON at a URL, naming the shape it
 * expects as a schema — or for plain text, a form post, or a raw
 * response it reads itself. The port owns the attempt loop:
 * composing the caller's abort signal with a per-attempt
 * timeout, retrying only the failures the arena allowed, and
 * classifying every failure into one error type. Callers own
 * the policy numbers (retries, timeout) — the port has no
 * defaults that could fail silently.
 *
 * The rules, in plain words:
 *
 * - The schema is structural: anything with a `parse` method
 *   satisfies it, which a zod schema does. The port itself never
 *   imports zod, so zod cannot reach the entry bundle through it.
 * - Every failure a caller must handle is a TransportError with a
 *   kind: "network" (the request never landed), "timeout" (the
 *   attempt's own clock ran out), "http" (a response arrived with
 *   a failure status) or "parse" (the body was not JSON, or the
 *   schema rejected it).
 * - The caller's abort is not a failure: when the caller's signal
 *   aborts — before the call, mid-flight, or during the backoff
 *   between attempts — the promise rejects with an AbortError,
 *   never a TransportError, and no further attempt is made.
 * - Retries are the caller's count of extra attempts, and only
 *   network failures, timeouts and http 5xx responses are
 *   eligible. Parse failures and http 4xx are final. The
 *   resolving methods (postText, getRaw) retry a 5xx while
 *   attempts remain and resolve with it once they run out; they
 *   never throw for a failure status on their own.
 * - postText resolves with the status and text of any completed
 *   HTTP exchange, with no parse step; only network, timeout and
 *   retry-exhausted failures reject. getRaw never throws on a
 *   failure status either: it resolves with the status and the
 *   body's async parse, which the caller awaits or drops.
 */

/** The four ways a request can fail, as one closed set. */
export type TransportErrorKind = "network" | "timeout" | "http" | "parse";

/**
 * The one error type the port raises. Carries the failure kind,
 * the URL that was asked for, the response status for kind
 * "http", and the underlying error as `cause` where one exists.
 */
export class TransportError extends Error {
  readonly kind: TransportErrorKind;
  readonly url: string;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(
    kind: TransportErrorKind,
    url: string,
    opts: { status?: number; cause?: unknown } = {},
  ) {
    super(
      kind === "http" && opts.status !== undefined
        ? `Transport http failure (status ${opts.status}) for ${url}`
        : `Transport ${kind} failure for ${url}`,
    );
    this.name = "TransportError";
    this.kind = kind;
    this.url = url;
    if (opts.status !== undefined) this.status = opts.status;
    if ("cause" in opts) this.cause = opts.cause;
  }
}

/**
 * The shape of an expected response: anything that can check an
 * unknown value and hand back the typed one, throwing when the
 * value does not fit. A zod schema satisfies this as-is.
 */
export interface SchemaLike<T> {
  parse(input: unknown): T;
}

/** Per-call policy, owned by the caller (see the arena record). */
export interface TransportOptions {
  /** The caller's abort signal: aborting ends the request with
   * an AbortError and no further attempts. */
  signal?: AbortSignal;
  /** Extra attempts after the first, for eligible failures only.
   * Defaults to 0 — nothing retries that did not ask to. */
  retries?: number;
  /** Per-attempt timeout in milliseconds. No default: an attempt
   * without one waits as long as the network takes. */
  timeoutMs?: number;
  /** Extra headers, merged over the port's own. */
  headers?: Record<string, string>;
  /** Keep the request alive past the page's unload, for
   * fire-and-forget beacons. Passed into the request as-is. */
  keepalive?: boolean;
}

/** A response the caller reads itself: status, plus the body's
 * async parse. The parse promise rejects when the body is not
 * JSON; awaiting it is the caller's choice. */
export interface RawResponse {
  /** True for a 2xx status. */
  ok: boolean;
  /** The response's HTTP status. */
  status: number;
  /** The body's JSON parse, started on first read and memoized:
   * reading it twice awaits the one parse. */
  json: Promise<unknown>;
}

/** The port itself: callers depend on this, not on fetch. */
export interface TransportPort {
  /** GET a URL and return the body checked by the schema. */
  getJson<T>(
    url: string,
    schema: SchemaLike<T>,
    opts?: TransportOptions,
  ): Promise<T>;
  /** POST a body as JSON and return the response checked by the
   * schema. */
  postJson<T>(
    url: string,
    body: unknown,
    schema: SchemaLike<T>,
    opts?: TransportOptions,
  ): Promise<T>;
  /** POST a text body and resolve with the response's status
   * and text, for any completed HTTP exchange — no parse step,
   * no schema. Only network, timeout and retry-exhausted
   * failures reject. */
  postText(
    url: string,
    body: string,
    opts?: TransportOptions,
  ): Promise<{ status: number; text: string }>;
  /** POST urlencoded params and return the response checked by
   * the schema. */
  postForm<T>(
    url: string,
    params: Record<string, string>,
    schema: SchemaLike<T>,
    opts?: TransportOptions,
  ): Promise<T>;
  /** GET a URL and resolve with its status and body parse,
   * without throwing on a failure status. */
  getRaw(url: string, opts?: TransportOptions): Promise<RawResponse>;
}

/** Injectable seams for the port, so tests can drive it with no
 * network. */
export interface TransportPortDeps {
  /** The fetch to call. Defaults to the global fetch, resolved
   * lazily on each call. */
  fetch?: typeof fetch;
  /** The backoff wait between attempts. Defaults to a timer
   * promise; tests inject an instant one. */
  sleep?: (ms: number) => Promise<void>;
}

/** Where one request stands, as the hook exposes it. */
export type TransportStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "aborted";

/** The state of one request driven through the hook's controller. */
export interface TransportState<T> {
  status: TransportStatus;
  /** The parsed value once ready; null in every other state. */
  data: T | null;
  /** The failure once in error; null in every other state. An
   * aborted request carries no error — aborting is not failing. */
  error: TransportError | null;
}
