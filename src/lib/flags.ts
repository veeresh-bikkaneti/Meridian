/**
 * Feature flags — zero-cost, dependency-free kill-switches for Meridian.
 *
 * Why: experimental tracks merge behind flags, disabled in production until
 * proven. A redeployed `public/flags.json` flips a flag off without a new
 * client release — the change reaches clients on their next boot, never
 * waiting on a pending service-worker update; baked-in defaults always
 * equal current production behavior, so the safe fallback is byte-identical
 * to today's app.
 *
 * Boot-time, not reactive: `loadFlags()` memoizes the production fetch, so
 * concurrent callers share one request. Kill-switches MUST await the shared
 * promise before checking the flag — the `__root.tsx` pattern is
 * `loadFlags().then(() => { if (!isEnabled("x")) return; ... })`. The ~1.5s
 * timeout bounds the delay and never blocks first paint (first paint is
 * unaffected: gating happens post-commit in an effect). Pure UI gates may
 * keep the synchronous read, accepting the baked-in defaults until the load
 * resolves. Gate inside an init/effect function, never at module scope —
 * module scope always reads the baked-in defaults. Gated systems treat the
 * boot-time value as authoritative for the session; there is intentionally
 * no subscription mechanism.
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
export type FlagName = "pwaUpdateToast" | "learningOutcomes";

/**
 * Baked-in defaults — MUST equal current production behavior for every
 * flag, always. The app runs correctly with these alone; the remote file
 * only ever turns experiments off (or on again after proof).
 */
export const FLAG_DEFAULTS: Record<FlagName, boolean> = {
  // PWA service-worker registration + "Update available" toast.
  // true = today's behavior; false = plain web app (no SW, no toast).
  pwaUpdateToast: true,
  // Learning-outcomes prototype (per-place learning records + growth UI).
  // false = today's behavior: no records, no growth surfaces, no storage.
  learningOutcomes: false,
};

export const FLAGS_FETCH_TIMEOUT_MS = 1500;
const FLAGS_FILE = "flags.json";

/** Remote overrides, replaced wholesale on each successful load. */
let overrides: Partial<Record<FlagName, boolean>> = {};

/**
 * Observability endpoint from the top-level `observabilityEndpoint` field
 * of flags.json (NOT inside `flags` — it is a URL, not a boolean flag).
 * Null = observability transport disabled (the shipped default).
 */
let observabilityEndpointValue: string | null = null;

/**
 * Memoized production load promise: concurrent `loadFlags()` callers share
 * one fetch. Cleared when the load settles, so a later explicit call
 * re-fetches rather than returning a stale promise. The `testEnv` seam
 * bypasses this entirely (always fresh) to preserve test semantics.
 */
let inflight: Promise<void> | null = null;

/**
 * Test-only reset: restores the pre-load state (no remote overrides, no
 * shared in-flight load). Production code never calls this.
 */
export function resetFlags(): void {
  overrides = {};
  observabilityEndpointValue = null;
  inflight = null;
}

/**
 * Validate an observability endpoint candidate: a string of at most 2048
 * chars that is either a root-relative path ("/…", never protocol-relative
 * "//…") or an absolute https: URL. Anything else is rejected so a bad
 * flags.json deploy fails closed to "no endpoint" (transport disabled).
 */
export function isValidObservabilityEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > 2048 || /[\s\u0000-\u001f]/.test(v)) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    const url = new URL(v);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Current observability endpoint, or null when unset/invalid. Never throws. */
export function getObservabilityEndpoint(): string | null {
  try {
    return observabilityEndpointValue;
  } catch {
    return null;
  }
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
  observabilityEndpoint?: unknown;
}

/**
 * Merge a decoded remote payload into `overrides`. Only known flag names
 * with boolean values are accepted; everything else is ignored so a bad
 * deploy of flags.json fails closed to the baked-in defaults.
 */
function applyPayload(data: unknown): void {
  if (typeof data !== "object" || data === null) return;
  // Top-level observability endpoint: validated independently of `flags`
  // so an endpoint-only payload still applies, and an invalid/missing
  // endpoint resolves to null (transport disabled — the safe default).
  const endpointCandidate = (data as FlagsPayload).observabilityEndpoint;
  observabilityEndpointValue = isValidObservabilityEndpoint(endpointCandidate)
    ? (endpointCandidate as string).trim()
    : null;
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
 * Load remote flag overrides. Network-first with a timeout — never blocks
 * first paint and never rejects. On timeout / network failure / offline /
 * invalid payload, the baked-in defaults win silently.
 *
 * Kill-switches MUST await this before checking the flag; the production
 * promise is memoized so the boot-time kickoff and every gated effect share
 * one fetch. (`testEnv` is a test seam: under `node --test`,
 * `import.meta.env` is undefined, so unit tests inject `BASE_URL`, a fake
 * `fetch`, and a `timeoutMs` here — and that path always runs fresh, never
 * sharing the memoized promise.) Production callers omit it.
 */
export function loadFlags(testEnv?: LoadFlagsEnv): Promise<void> {
  if (testEnv) return doLoad(testEnv);
  // SSR without a DOM: no fetch is safe to share across modules — defaults win.
  if (typeof window === "undefined") return Promise.resolve();
  if (!inflight) {
    inflight = doLoad().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** One load attempt: fetch, validate, and merge the remote payload. */
async function doLoad(env: LoadFlagsEnv = {}): Promise<void> {
  const fetchFn =
    env.fetch ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchFn) return; // no fetch available — defaults win

  const timeoutMs = env.timeoutMs ?? FLAGS_FETCH_TIMEOUT_MS;
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const timer =
    controller && Number.isFinite(timeoutMs)
      ? setTimeout(() => controller.abort(), Math.max(0, timeoutMs))
      : null;

  try {
    const res = await fetchFn(flagsUrl(env.BASE_URL ?? viteBaseUrl()), {
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
