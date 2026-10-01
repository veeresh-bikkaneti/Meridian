/**
 * Deploy-awareness: detect when the tab is running a bundle older than the
 * current deploy, so chunk-load failures can offer a refresh instead of a
 * dead-end error.
 *
 * `__MERIDIAN_BUILD_ID__` is baked into the bundle by vite.config.ts
 * (`buildIdForBundle()`: prebuild-written `public/build-meta.json` first,
 * `resolveBuildId()` fallback in scripts/build-id.mjs); the same meta file
 * is served on the server, written by scripts/write-build-meta.mjs during
 * `prebuild`/`prebuild:pages`. A mismatch means the deploy moved on
 * while this tab was open — the old content-hashed chunk URLs 404.
 */

declare const __MERIDIAN_BUILD_ID__: string | undefined;

/** The build ID this bundle was built with ("dev" when not baked in). */
export const CURRENT_BUILD_ID: string =
  typeof __MERIDIAN_BUILD_ID__ === "string" && __MERIDIAN_BUILD_ID__
    ? __MERIDIAN_BUILD_ID__
    : "dev";

function baseUrl(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export interface StalenessDeps {
  fetchFn?: typeof fetch;
  base?: string;
  /** Abort the meta fetch after this long (default 8s) so a hanging network
   *  can never delay the error notice indefinitely. */
  timeoutMs?: number;
}

/**
 * True when the server's build-meta.json names a different build than this
 * bundle. Fails closed: any fetch/parse problem returns false, so the caller
 * keeps its original error instead of prompting a useless refresh.
 */
export async function isNewBuildDeployed(deps: StalenessDeps = {}): Promise<boolean> {
  const fetchFn = deps.fetchFn ?? fetch;
  const base = deps.base ?? baseUrl();
  const timeoutMs = deps.timeoutMs ?? 8000;
  try {
    const res = await fetchFn(`${base}build-meta.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const meta = (await res.json()) as { buildId?: unknown };
    return typeof meta.buildId === "string" && meta.buildId !== CURRENT_BUILD_ID;
  } catch {
    return false;
  }
}
