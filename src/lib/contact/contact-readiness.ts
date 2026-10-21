/**
 * Contact-delivery readiness — the honest answer to "will the form
 * deliver?".
 *
 * WHY this exists (panel finding B3 on PR #207): a readiness check must
 * never claim delivery that cannot happen. There was no honest check in
 * the tree, so this one is built to be the opposite of a false green: it
 * asks selectSink() which sink the current config really picks, and
 * reports NOT configured (parked) whenever that is NoopSink. The CLI
 * wrapper (scripts/contact-readiness.mjs, `npm run check:contact`) exits
 * non-zero in that state, so a human or a CI log can never mistake
 * parked for ready.
 *
 * It reads config the same way the route does (readContactRuntimeEnv — one
 * reader for both), so what it reports is what the handler would do with
 * the same environment. For production, `--url` asks the live worker which
 * sink it selected (GET /api/contact), because a shell cannot see a worker
 * secret. Sink selection itself is unchanged — this only reports on it.
 */
import { readContactRuntimeEnv, selectSink, type ContactEnv } from "./contact-handler.server.ts";

export interface ContactReadiness {
  /** True only when a real delivery sink is selected. */
  configured: boolean;
  /** The selected sink's name ("noop" while parked, "discord" when wired). */
  sink: string;
  /** One plain line for a human or a CI log. */
  line: string;
}

/**
 * Turn a sink name into the honest line. `where` says WHOSE config was
 * checked — this shell's environment or a live worker — because the two can
 * differ: a webhook exported in your terminal says nothing about what
 * production was given. A "discord" answer is only ever as good as the
 * place it came from, so the line always names it.
 */
export function describeSink(sinkName: string, where: string): ContactReadiness {
  if (sinkName === "discord") {
    return {
      configured: true,
      sink: sinkName,
      line: `contact delivery (${where}): configured — sink is discord; messages will be delivered`,
    };
  }
  return {
    configured: false,
    sink: sinkName,
    line: `contact delivery (${where}): NOT configured (parked) — sink is ${sinkName}; messages are accepted and discarded, nobody can read them`,
  };
}

export function evaluateContactReadiness(env: ContactEnv, where = "this process"): ContactReadiness {
  return describeSink(selectSink(env).name, where);
}

/** Readiness for the environment this process was actually started with (same reader as the route). */
export async function contactReadinessFromRuntimeEnv(): Promise<ContactReadiness> {
  return evaluateContactReadiness(await readContactRuntimeEnv(), "this shell's environment, not production");
}

/**
 * Readiness of a LIVE deployment, asked of the worker itself: GET
 * <origin>/api/contact answers `{ "sink": "discord" | "noop" }`. This is the
 * only check that sees what production was really given, and it never needs
 * the webhook value. Anything unexpected (non-200, not JSON, no sink field,
 * network error) is NOT configured — never a green by default.
 */
export async function contactReadinessFromUrl(
  origin: string,
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
): Promise<ContactReadiness> {
  // Print only the bare origin (no credentials, path or query) and never
  // follow a redirect: this reads a remote answer and must not be steerable.
  let where: string;
  try {
    where = new URL(origin).origin;
  } catch {
    return unreachable("(invalid url)", "not a valid URL");
  }
  try {
    const res = await fetchFn(`${where}/api/contact`, {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return unreachable(where, `HTTP ${res.status}`);
    const body: unknown = await res.json();
    const sink = typeof body === "object" && body !== null ? (body as { sink?: unknown }).sink : undefined;
    // Only the two known names are ever printed; anything else is a remote
    // string we refuse to echo (terminal escapes, lookalikes).
    if (sink !== "discord" && sink !== "noop") return unreachable(where, "unexpected sink value in the response");
    return describeSink(sink, where);
  } catch (err) {
    return unreachable(where, "request failed");
  }
}

function unreachable(where: string, why: string): ContactReadiness {
  return {
    configured: false,
    sink: "unknown",
    line: `contact delivery (${where}): NOT confirmed — could not read the sink (${why}); treat as not configured`,
  };
}
