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

import { resolveSession } from "./storage-slot.ts";

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
/** sessionStorage key marking that this tab already refreshed once
 *  for a stale build (the one-shot guard every stale surface shares). */
export const STALE_REFRESH_KEY = "meridian.staleRefresh";

/** A stale-refresh mark older than this no longer skips the probe. */
export const STALE_REFRESH_MAX_AGE_MS = 900_000;

/**
 * True only when the stale-refresh mark is a timestamp whose age is
 * in [0, STALE_REFRESH_MAX_AGE_MS] (F6). Writers (the boundary's
 * retry, game-app's and LoopScreen's refreshForNewBuild) now write
 * Date.now() instead of the legacy "1": that legacy value parses as
 * epoch, its age is enormous, and the probe runs — fail-open, exactly
 * right for a mark whose freshness cannot be proven. Unreadable
 * storage also reads as not-recent (the probe runs and fails closed
 * on its own), matching the boundary's long-standing rule.
 */
export function staleRefreshRecentlyUsed(
  storage?: { getItem: (key: string) => string | null } | null,
  now: number = Date.now(),
): boolean {
  let store = storage;
  if (store === undefined) {
    store = resolveSession() ?? null;
  }
  if (!store) return false;
  let raw: string | null;
  try {
    raw = store.getItem(STALE_REFRESH_KEY);
  } catch {
    return false;
  }
  if (raw === null) return false;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return false;
  const age = now - parsed;
  return age >= 0 && age <= STALE_REFRESH_MAX_AGE_MS;
}

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
