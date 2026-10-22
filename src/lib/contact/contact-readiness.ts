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
 * It reads config the same way the route does (readContactEnv), so what
 * it reports is what the handler would do with the same environment.
 * Sink selection itself is unchanged — this only reports on it.
 */
import { NoopSink, readContactEnv, selectSink, type ContactEnv } from "./contact-handler.server.ts";

export interface ContactReadiness {
  /** True only when a real delivery sink is selected. */
  configured: boolean;
  /** The selected sink's name ("noop" while parked, "discord" when wired). */
  sink: string;
  /** One plain line for a human or a CI log. */
  line: string;
}

export function evaluateContactReadiness(env: ContactEnv): ContactReadiness {
  const sink = selectSink(env);
  if (sink instanceof NoopSink) {
    return {
      configured: false,
      sink: sink.name,
      line: "contact delivery: NOT configured (parked) — sink is NoopSink; messages are accepted and discarded, nobody can read them",
    };
  }
  return {
    configured: true,
    sink: sink.name,
    line: `contact delivery: configured — sink is ${sink.name}; messages will be delivered`,
  };
}

/** Readiness for the environment this process was actually started with. */
export function contactReadinessFromRuntimeEnv(): ContactReadiness {
  return evaluateContactReadiness(readContactEnv());
}
