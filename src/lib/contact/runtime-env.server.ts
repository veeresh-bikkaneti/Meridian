/**
 * Where the `meridian` worker's runtime environment lives.
 *
 * On Cloudflare a worker's secrets, vars and bindings are on its `env`
 * object. They reach `process.env` only when the worker runs with
 * `nodejs_compat` (+ a compatibility date of 2025-04-01 or later, or
 * `nodejs_compat_populate_process_env`). The repo cannot see the deployed
 * wrangler config, so contact config must not depend on that flag.
 *
 * Two places hold the real `env`, and which one is live depends on which
 * server entry Cloudflare serves (the probe in docs/contact-activation.md
 * settles that):
 *   1. `globalThis.__env__`. Nitro's Cloudflare presets put the worker's
 *      `env` there.
 *   2. `import("cloudflare:workers")`. The official runtime module that
 *      exports `env`. It only exists on workerd. On Node, in tests, or in
 *      the Vercel/preview build, the import throws.
 * Both are tried and every one found is returned (first = highest
 * priority), so a key is read from whichever source actually has it.
 *
 * This is the ONE place that knows how to find the runtime env. The sink
 * config, the origin allowlist, the rate-limit bindings and the readiness
 * check all go through it, so they can never disagree about what the worker
 * was given.
 */

let sourcesLookup: Promise<Record<string, unknown>[]> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

async function lookupSources(): Promise<Record<string, unknown>[]> {
  const found: Record<string, unknown>[] = [];
  try {
    const nitro = asRecord((globalThis as { __env__?: unknown }).__env__);
    if (nitro) found.push(nitro);
  } catch {
    /* fall through */
  }
  try {
    // The specifier is a variable so bundlers leave this import alone. It
    // only resolves on Cloudflare's runtime.
    const specifier = "cloudflare:workers";
    const mod = (await import(/* @vite-ignore */ specifier)) as { env?: unknown };
    const runtime = asRecord(mod?.env);
    if (runtime && !found.includes(runtime)) found.push(runtime);
  } catch {
    /* not on workerd */
  }
  return found;
}

/** The runtime env objects, highest priority first. [] on Node. Cached. */
export function readRuntimeEnvSources(): Promise<Record<string, unknown>[]> {
  sourcesLookup ??= lookupSources();
  return sourcesLookup;
}

/**
 * A string var/secret from the runtime env, or undefined. Non-strings are
 * ignored: a binding object under a secret's name must never be coerced
 * into config.
 */
export async function readRuntimeString(name: string): Promise<string | undefined> {
  for (const source of await readRuntimeEnvSources()) {
    const value = source[name];
    if (typeof value === "string") return value;
  }
  return undefined;
}

/** Test-only: forget the cached lookup. */
export function resetRuntimeEnvLookupForTests(): void {
  sourcesLookup = null;
}
