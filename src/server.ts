import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { withSecurityHeaders } from "@/lib/security-headers";
import { ServerFnGuard } from "@/lib/server/server-fn-guard";

/**
 * Server entry (TanStack Start picks up src/server.ts automatically).
 *
 * This is the default entry (`createStartHandler(defaultStreamHandler)`)
 * with ONE addition in front of it: ServerFnGuard answers
 * malformed or impossible `/_serverFn/…` requests with a clean 404/405
 * instead of TanStack's unhandled 500 (review S5, see
 * src/lib/server/server-fn-guard.ts). Every other request, including any
 * real server-function call, goes to the unchanged TanStack handler. That
 * handler still runs the CSRF and security-header request middleware from
 * src/start.ts.
 *
 * Guard responses never reach that middleware, so they get the same
 * security headers here directly.
 */
const startFetch = createStartHandler(defaultStreamHandler);
const serverFnGuard = new ServerFnGuard();

export default createServerEntry({
  fetch(request, opts) {
    const blocked = serverFnGuard.check(request);
    if (blocked) return Promise.resolve(withSecurityHeaders(blocked));
    return startFetch(request, opts);
  },
});
