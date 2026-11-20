/**
 * The one reader for the contact webhook secret.
 *
 * Runtime only. This file never reads a build-time constant. Order, first
 * non-empty string wins:
 * 1. `import("cloudflare:workers").env` — the Worker secret binding
 * 2. `globalThis.__env__` — the runtime env the server framework exposes
 * 3. `process.env` — local dev and tests
 *
 * Callers get the string back. This module does not log it.
 */

export const CONTACT_WEBHOOK_SECRET_NAME = "CONTACT_DISCORD_WEBHOOK_URL";

const CLOUDFLARE_WORKERS_SPECIFIER = "cloudflare:workers";

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/** Worker binding, then Nitro env, then process.env. Blank strings are skipped. */
export function pickRuntimeSecret(
  workerValue: unknown,
  nitroValue: unknown,
  processValue: unknown,
): string | undefined {
  return nonEmpty(workerValue) ?? nonEmpty(nitroValue) ?? nonEmpty(processValue);
}

function syncSources(): { nitro?: string; proc?: string } {
  try {
    const procEnv = (globalThis as { process?: { env?: Record<string, unknown> } }).process?.env;
    const nitroEnv = (globalThis as { __env__?: Record<string, unknown> }).__env__;
    return {
      nitro: nonEmpty(nitroEnv?.[CONTACT_WEBHOOK_SECRET_NAME]),
      proc: nonEmpty(procEnv?.[CONTACT_WEBHOOK_SECRET_NAME]),
    };
  } catch {
    return {};
  }
}

/** Sync sources only: Nitro runtime env, then process.env. */
export function readContactWebhookSecret(): string | undefined {
  const { nitro, proc } = syncSources();
  return pickRuntimeSecret(undefined, nitro, proc);
}

/**
 * Full runtime read. The Worker binding outranks the sync sources.
 * Outside a Worker the import fails and the sync sources are used.
 */
export async function readContactWebhookSecretRuntime(): Promise<string | undefined> {
  let worker: string | undefined;
  try {
    const mod = (await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_SPECIFIER)) as {
      env?: Record<string, unknown>;
    };
    worker = nonEmpty(mod?.env?.[CONTACT_WEBHOOK_SECRET_NAME]);
  } catch {
    worker = undefined;
  }
  const { nitro, proc } = syncSources();
  return pickRuntimeSecret(worker, nitro, proc);
}
