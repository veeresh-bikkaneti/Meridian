/**
 * Guard for TanStack Start's server-function endpoint (review S5,
 * 2026-10-21).
 *
 * The problem: TanStack Start mounts an RPC endpoint at `/_serverFn/`.
 * Meridian calls no server functions, and the build's server-function
 * manifest is empty. Even so, probes of that path came back as unhandled
 * 500s:
 *
 *   GET /_serverFn/      → 500 {"unhandled":true,"message":"HTTPError"}
 *                          (TanStack throws "Invalid server action param"
 *                          before ANY request middleware runs, so
 *                          src/start.ts cannot catch it)
 *   GET /_serverFn/<id>  → 500 serialized "Server function info not found"
 *
 * These responses reveal the framework and add noise to the error logs.
 * This guard answers those requests in the server entry (src/server.ts)
 * before they reach TanStack:
 *
 *   - Path is the bare base, with no function id → 404.
 *   - Method other than GET/POST (OPTIONS, PUT, DELETE, …) → 405 with
 *     `Allow: GET, POST`.
 *   - Any id while SERVER_FUNCTIONS_IN_USE is false → 404, because no
 *     function can exist (server-fn-guard.test.ts pins that).
 *   - Any id while SERVER_FUNCTIONS_IN_USE is true → passed through
 *     untouched. TanStack's server-function handling AND the CSRF request
 *     middleware re-added in src/start.ts then run as usual.
 *
 * Nothing about TanStack's own pipeline changes: the guard only ever
 * short-circuits requests that TanStack would have failed anyway.
 *
 * Adding a server function later: set SERVER_FUNCTIONS_IN_USE to true in
 * the same change. The unit test fails until you do, because it scans
 * src/ for client-reachable createServerFn usage.
 */

/** Default TanStack Start server-function base (TSS_SERVER_FN_BASE). */
export const DEFAULT_SERVER_FN_BASE = "/_serverFn/";

/**
 * Whether the app ships any server function that a client may call.
 * Keep this false while the build's server-function manifest is empty.
 */
export const SERVER_FUNCTIONS_IN_USE = false;

/** Methods TanStack's server-function endpoint accepts. */
export const SERVER_FN_METHODS = ["GET", "POST"] as const;

export interface ServerFnGuardOptions {
  /** Server-function base path; must start and end with "/". */
  base?: string;
  /** See SERVER_FUNCTIONS_IN_USE. */
  functionsInUse?: boolean;
}

function jsonError(status: number, error: string, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

export class ServerFnGuard {
  private readonly base: string;
  private readonly functionsInUse: boolean;

  constructor(options: ServerFnGuardOptions = {}) {
    const base = options.base ?? DEFAULT_SERVER_FN_BASE;
    this.base = base.endsWith("/") ? base : `${base}/`;
    this.functionsInUse = options.functionsInUse ?? SERVER_FUNCTIONS_IN_USE;
  }

  /**
   * A clean response for a request TanStack would turn into a 500, or
   * null to let the request through to TanStack unchanged.
   *
   * `/_serverFn` without the trailing slash is passed through: TanStack's
   * router already answers it with its normal 404 page.
   */
  check(request: Request): Response | null {
    let pathname: string;
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      return null;
    }
    if (!pathname.startsWith(this.base)) return null;

    const method = request.method.toUpperCase();
    if (!(SERVER_FN_METHODS as readonly string[]).includes(method)) {
      return jsonError(405, "method not allowed", { allow: SERVER_FN_METHODS.join(", ") });
    }
    const id = pathname.slice(this.base.length).split("/")[0];
    if (!id || !this.functionsInUse) return jsonError(404, "not found");
    return null;
  }
}
