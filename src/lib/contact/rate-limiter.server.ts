/**
 * Rate limiting for `POST /api/contact` (review P3, 2026-10-21).
 *
 * Shape (same small-interface style as ContactSink in
 * contact-handler.server.ts): every limiter implements ContactRateLimiter,
 * and selectRateLimiter() composes them. The handler only ever sees the
 * interface, so swapping a backend never touches request handling.
 *
 *   InMemoryRateLimiter            → always on. Per-isolate fixed windows:
 *                                    3 / 10 min per client, 60 / h per
 *                                    isolate. Keys are a SALTED SHA-256 of
 *                                    the IP with a random per-isolate salt.
 *   CloudflareBindingRateLimiter   → added ONLY when the Workers Rate
 *                                    Limiting binding(s) are present. Counts
 *                                    across isolates within a Cloudflare
 *                                    location, which the in-memory layer
 *                                    cannot do.
 *   LayeredRateLimiter             → asks each layer in order; the first
 *                                    "no" wins.
 *
 * Why the binding is allowed here (owner rule: free options only): the
 * Workers Rate Limiting API has no plan gate and no billing line in
 * Cloudflare's docs (bindings/rate-limit, platform/pricing, checked
 * 2026-10-21). It only spends the normal per-request CPU the worker already
 * uses. It is GA since 2025-09-19. See docs/contact-rate-limiting.md.
 *
 * Privacy:
 * - The raw IP is hashed and then dropped. It is never stored, logged, or
 *   forwarded.
 * - The binding needs a key that is the SAME in every isolate, so it cannot
 *   use the random per-isolate salt. Its key is
 *   SHA-256("meridian-contact-rl:v1:<UTC day>:<ip>"), cut to 64 bits. The
 *   day in the input means the pseudonym changes every UTC day and cannot
 *   link one day's sender to the next. The counter lives only in
 *   Cloudflare's rate-limit cache for the 60-second period. Meridian keeps
 *   no copy.
 * - Fail-safe: a missing, malformed, or throwing binding never blocks a
 *   message by itself and never breaks the request. The in-memory layer
 *   still applies, so the endpoint is never left with no limit at all.
 */

import { readRuntimeEnvSources, resetRuntimeEnvLookupForTests } from "./runtime-env.server.ts";

export interface RateDecision {
  allowed: boolean;
  /** Seconds the client should wait (Retry-After). 0 when allowed. */
  retryAfterSec: number;
}

/** One rate-limit layer. `take` consumes a slot when it allows. */
export interface ContactRateLimiter {
  readonly name: string;
  take(ip: string, now: number): Promise<RateDecision>;
}

/**
 * The Workers Rate Limiting binding's runtime surface (`env.X.limit()`),
 * typed locally so this file needs no @cloudflare/workers-types.
 */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Binding names. They must match config/cloudflare/meridian.wrangler.toml. */
export const CLIENT_LIMITER_BINDING = "CONTACT_RATE_LIMITER";
export const GLOBAL_LIMITER_BINDING = "CONTACT_GLOBAL_RATE_LIMITER";

/**
 * The binding's period, in seconds. Cloudflare only allows 10 or 60, and it
 * is set in the wrangler config, not in code. This is only the Retry-After
 * hint sent back when the binding says no.
 */
export const BINDING_PERIOD_SEC = 60;

export function isRateLimitBinding(value: unknown): value is RateLimitBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { limit?: unknown }).limit === "function"
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string, bytes: number): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return hex(new Uint8Array(digest).slice(0, bytes));
}

// --- In-memory (always on) ----------------------------------------------

export interface InMemoryLimits {
  perClientMax: number;
  perClientWindowMs: number;
  globalMax: number;
  globalWindowMs: number;
}

export const DEFAULT_IN_MEMORY_LIMITS: InMemoryLimits = {
  perClientMax: 3,
  perClientWindowMs: 10 * 60_000,
  globalMax: 60,
  globalWindowMs: 60 * 60_000,
};

interface FixedWindow {
  start: number;
  count: number;
}

/**
 * Per-isolate fixed windows. This was the only limiter before the binding
 * existed, and it stays as the floor. Its state is a few hashed keys with
 * counters, and it disappears when the isolate is recycled.
 */
export class InMemoryRateLimiter implements ContactRateLimiter {
  readonly name = "in-memory";
  private readonly limits: InMemoryLimits;
  private readonly perClient = new Map<string, FixedWindow>();
  private globalWindow: FixedWindow = { start: 0, count: 0 };
  private salt: string | null = null;

  constructor(limits: InMemoryLimits = DEFAULT_IN_MEMORY_LIMITS) {
    this.limits = limits;
  }

  /** Salted SHA-256 of the client IP. The raw IP goes no further than this. */
  async keyFor(ip: string): Promise<string> {
    if (this.salt === null) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      this.salt = hex(bytes);
    }
    return sha256Hex(`${this.salt}:${ip}`, 12);
  }

  async take(ip: string, now: number): Promise<RateDecision> {
    const key = await this.keyFor(ip);
    const L = this.limits;
    for (const [k, w] of this.perClient) if (now - w.start >= L.perClientWindowMs) this.perClient.delete(k);
    if (now - this.globalWindow.start >= L.globalWindowMs) this.globalWindow = { start: now, count: 0 };
    if (this.globalWindow.count >= L.globalMax) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((this.globalWindow.start + L.globalWindowMs - now) / 1000)) };
    }
    const w = this.perClient.get(key);
    if (w && w.count >= L.perClientMax) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((w.start + L.perClientWindowMs - now) / 1000)) };
    }
    if (w) w.count += 1;
    else this.perClient.set(key, { start: now, count: 1 });
    this.globalWindow.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  }

  /** Test-only: forget every window and the salt. */
  reset(): void {
    this.perClient.clear();
    this.globalWindow = { start: 0, count: 0 };
    this.salt = null;
  }
}

// --- Cloudflare Workers Rate Limiting binding (optional) ------------------

/**
 * Key for the binding: the same in every isolate and changed every UTC day
 * (see the header). It is a pseudonym, not the IP.
 */
export async function bindingClientKey(ip: string, now: number): Promise<string> {
  const day = new Date(now).toISOString().slice(0, 10);
  return `c:${await sha256Hex(`meridian-contact-rl:v1:${day}:${ip}`, 8)}`;
}

/** A constant key, so the global binding counts every sender together. */
export const GLOBAL_BINDING_KEY = "meridian-contact:all";

export type BindingErrorReporter = (bindingName: string) => void;

export class CloudflareBindingRateLimiter implements ContactRateLimiter {
  readonly name = "cf-binding";
  private readonly client: RateLimitBinding;
  private readonly global: RateLimitBinding | null;
  private readonly onError: BindingErrorReporter;

  constructor(client: RateLimitBinding, global: RateLimitBinding | null = null, onError: BindingErrorReporter = () => {}) {
    this.client = client;
    this.global = global;
    this.onError = onError;
  }

  async take(ip: string, now: number): Promise<RateDecision> {
    // Per client first. A sender who is already over their own limit should
    // not use up the shared global budget.
    if (!(await this.ask(this.client, await bindingClientKey(ip, now), CLIENT_LIMITER_BINDING))) {
      return { allowed: false, retryAfterSec: BINDING_PERIOD_SEC };
    }
    if (this.global && !(await this.ask(this.global, GLOBAL_BINDING_KEY, GLOBAL_LIMITER_BINDING))) {
      return { allowed: false, retryAfterSec: BINDING_PERIOD_SEC };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  /** true = allowed. A throwing binding fails OPEN, because the in-memory layer is still there. */
  private async ask(binding: RateLimitBinding, key: string, name: string): Promise<boolean> {
    try {
      const res = await binding.limit({ key });
      return res?.success !== false;
    } catch {
      this.onError(name);
      return true;
    }
  }
}

// --- Composition ------------------------------------------------------------

export class LayeredRateLimiter implements ContactRateLimiter {
  readonly layers: readonly ContactRateLimiter[];
  readonly name: string;

  constructor(layers: readonly ContactRateLimiter[]) {
    this.layers = layers;
    this.name = layers.map((l) => l.name).join("+");
  }

  async take(ip: string, now: number): Promise<RateDecision> {
    for (const layer of this.layers) {
      const d = await layer.take(ip, now);
      if (!d.allowed) return d;
    }
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** What selectRateLimiter reads. These are binding objects, not strings. */
export interface RateLimitBindings {
  CONTACT_RATE_LIMITER?: unknown;
  CONTACT_GLOBAL_RATE_LIMITER?: unknown;
}

/** The isolate's in-memory limiter, shared by every request on this isolate. */
const sharedInMemory = new InMemoryRateLimiter();

export function sharedInMemoryLimiterForTests(): InMemoryRateLimiter {
  return sharedInMemory;
}

/**
 * The in-memory floor, plus the binding layer when CONTACT_RATE_LIMITER is
 * a real binding. The global binding is optional and only used together
 * with the client one.
 */
export function selectRateLimiter(env: RateLimitBindings, onError?: BindingErrorReporter): LayeredRateLimiter {
  const layers: ContactRateLimiter[] = [sharedInMemory];
  const client = env.CONTACT_RATE_LIMITER;
  if (isRateLimitBinding(client)) {
    const global = isRateLimitBinding(env.CONTACT_GLOBAL_RATE_LIMITER) ? env.CONTACT_GLOBAL_RATE_LIMITER : null;
    layers.push(new CloudflareBindingRateLimiter(client, global, onError));
  }
  return new LayeredRateLimiter(layers);
}

// --- Runtime binding lookup -------------------------------------------------

/**
 * Find the rate-limit bindings in the Workers runtime. Bindings are objects,
 * so `process.env`, which only carries string vars and secrets, never has
 * them. They come from the runtime env sources in runtime-env.server.ts
 * (`globalThis.__env__`, then `cloudflare:workers`); a missing binding just
 * means "in-memory only".
 */
let bindingLookup: Promise<RateLimitBindings> | null = null;

export function readRateLimitBindings(): Promise<RateLimitBindings> {
  bindingLookup ??= lookupBindings();
  return bindingLookup;
}

/** Test-only: forget the cached lookup. */
export function resetRateLimitBindingLookupForTests(): void {
  bindingLookup = null;
  resetRuntimeEnvLookupForTests();
}

function pick(source: unknown): RateLimitBindings | null {
  if (typeof source !== "object" || source === null) return null;
  const s = source as Record<string, unknown>;
  if (!isRateLimitBinding(s[CLIENT_LIMITER_BINDING])) return null;
  return {
    CONTACT_RATE_LIMITER: s[CLIENT_LIMITER_BINDING],
    CONTACT_GLOBAL_RATE_LIMITER: s[GLOBAL_LIMITER_BINDING],
  };
}

async function lookupBindings(): Promise<RateLimitBindings> {
  for (const source of await readRuntimeEnvSources()) {
    const found = pick(source);
    if (found) return found;
  }
  return {};
}
