/**
 * Feature flags — zero-cost, dependency-free kill-switches for Meridian.
 *
 * Why: experimental tracks merge behind flags, dark in production until
 * proven. A remote `public/flags.json` can flip a flag off without a new
 * deploy; baked-in defaults always equal current production behavior, so
 * the safe fallback is byte-identical to today's app.
 *
 * Boot-time, not reactive: `loadFlags()` is kicked off fire-and-forget at
 * boot in parallel with rendering. `isEnabled()` is a synchronous read —
 * calls made before `loadFlags()` resolves see the baked-in defaults.
 * Gated systems therefore read their flag once, before they initialize
 * (not on every render), and treat the boot-time value as authoritative
 * for the session. There is intentionally no subscription mechanism.
 *
 * Safety contract:
 * - `isEnabled()` never throws and never returns a non-boolean.
 * - `loadFlags()` never rejects and never blocks first paint: it fetches
 *   network-first with a ~1.5s timeout, and any failure (timeout, network
 *   error, offline, invalid payload) silently leaves the baked-in defaults
 *   in place.
 * - Remote payloads are validated field-by-field: unknown flag names are
 *   ignored, non-boolean values are ignored — fail closed to defaults.
 */

/** The flag catalog. Grow it by extending this union and `FLAG_DEFAULTS`. */
export type FlagName = "pwaUpdateToast";

/**
 * Baked-in defaults — MUST equal current production behavior for every
 * flag, always. The app runs correctly with these alone; the remote file
 * only ever turns experiments off (or on again after proof).
 */
export const FLAG_DEFAULTS: Record<FlagName, boolean> = {
  // PWA service-worker registration + "Update available" toast.
  // true = today's behavior; false = plain web app (no SW, no toast).
  pwaUpdateToast: true,
};

export const FLAGS_FETCH_TIMEOUT_MS = 1500;
const FLAGS_FILE = "flags.json";

/** Remote overrides, replaced wholesale on each successful load. */
let overrides: Partial<Record<FlagName, boolean>> = {};

/**
 * Test-only reset: restores the pre-load state (no remote overrides).
 * Production code never calls this.
 */
export function resetFlags(): void {
  overrides = {};
}

function viteBaseUrl(): string | undefined {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } })
    .env;
  return env?.BASE_URL;
}

function flagsUrl(baseUrl: string | undefined): string {
  // Same pattern as src/lib/pwa.ts's swUrl: respect the Vite base path
  // ("/Meridian/" on GitHub Pages, "/" locally).
  const base = baseUrl ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}${FLAGS_FILE}`;
}

export interface LoadFlagsEnv {
  /** Overrides `import.meta.env.BASE_URL`. */
  BASE_URL?: string;
  /** Fetch implementation (tests inject a fake; defaults to global fetch). */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Fetch timeout override (tests inject a tiny value). */
  timeoutMs?: number;
}

/**
 * Read a flag's current value. Synchronous and total: returns the loaded
 * remote override when present and valid, otherwise the baked-in default.
 * Never throws.
 */
export function isEnabled(flag: FlagName): boolean {
  try {
    const override = overrides[flag];
    if (typeof override === "boolean") return override;
    const def = FLAG_DEFAULTS[flag];
    return typeof def === "boolean" ? def : false;
  } catch {
    // Paranoia: a corrupt module state must never break a flag check.
    return false;
  }
}

interface FlagsPayload {
  version?: unknown;
  flags?: unknown;
}

/**
 * Merge a decoded remote payload into `overrides`. Only known flag names
 * with boolean values are accepted; everything else is ignored so a bad
 * deploy of flags.json fails closed to the baked-in defaults.
 */
function applyPayload(data: unknown): void {
  if (typeof data !== "object" || data === null) return;
  const flags = (data as FlagsPayload).flags;
  if (typeof flags !== "object" || flags === null) return;
  const next: Partial<Record<FlagName, boolean>> = {};
  const record = flags as Record<string, unknown>;
  for (const name of Object.keys(FLAG_DEFAULTS) as FlagName[]) {
    const value = record[name];
    if (typeof value === "boolean") next[name] = value;
  }
  overrides = next;
}

/**
 * Load remote flag overrides. Network-first with a timeout; fire-and-forget
 * in parallel with boot — it never blocks first paint and never rejects.
 * On timeout / network failure / offline / invalid payload, the baked-in
 * defaults win silently.
 *
 * `testEnv` is a test seam: under `node --test`, `import.meta.env` is
 * undefined, so unit tests inject `BASE_URL`, a fake `fetch`, and a
 * `timeoutMs` here. Production callers omit it.
 */
export async function loadFlags(testEnv?: LoadFlagsEnv): Promise<void> {
  const fetchFn =
    testEnv?.fetch ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchFn) return; // no fetch available (SSR without polyfill) — defaults win

  const timeoutMs = testEnv?.timeoutMs ?? FLAGS_FETCH_TIMEOUT_MS;
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const timer =
    controller && Number.isFinite(timeoutMs)
      ? setTimeout(() => controller.abort(), Math.max(0, timeoutMs))
      : null;

  try {
    const res = await fetchFn(flagsUrl(testEnv?.BASE_URL ?? viteBaseUrl()), {
      signal: controller?.signal,
      // The SW serves flags.json network-first with its own small cache;
      // no-store here keeps the browser HTTP cache out of the kill path.
      cache: "no-store",
    });
    if (!res.ok) return;
    applyPayload(await res.json());
  } catch {
    // Timeout, network failure, offline, invalid JSON — defaults win, silently.
  } finally {
    if (timer) clearTimeout(timer);
  }
}
