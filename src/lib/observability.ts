/**
 * Crash observability — breadcrumb trail + next-boot crash detection +
 * capped, opt-in event transport.
 *
 * Why this exists: iOS jetsam kills the WebContent process without firing
 * any JS error, `pagehide`, or beacon — a jetsam kill CANNOT beacon during
 * the kill. Detection is therefore by asymmetry at next boot, exactly like
 * the clean-exit flag (src/game/clean-exit.ts): this module persists a
 * lightweight breadcrumb trail in sessionStorage while the page is alive;
 * on the NEXT boot, if the clean-exit flag says the previous page was
 * killed (`isUncleanShutdown()`) and a previous breadcrumb exists, the new
 * boot emits ONE `suspected_crash` event carrying the previous trail
 * (especially its last milestone + edition/region) and immediately rotates
 * the trail, so the event fires exactly once even if transport fails.
 *
 * Privacy: events carry build id, milestone names, edition/region ids,
 * coarse device facts (OS/form buckets, DPR, screen size, memory, cores —
 * never the raw UA string) and truncated error name/message only.
 * NO guess/place content, NO coordinates, NO PII, NO stack traces.
 *
 * Transport is a complete no-op until an endpoint is configured (via the
 * `observabilityEndpoint` field in flags.json — see src/lib/flags.ts).
 * Boot ordering choice: flags load asynchronously, so boot-time events
 * (including `suspected_crash`) are QUEUED in memory and flushed once
 * `setObservabilityEndpoint()` is called after `loadFlags()` resolves.
 * Delivery is AT-MOST-ONCE: a queued event lives only in memory until
 * that flush (bounded by the flags load/timeout); if the tab is closed
 * or killed again in that window, the queued report is lost and will
 * not re-fire — the previous trail was already rotated at init(). If no
 * endpoint is ever configured, the queue is simply never sent.
 *
 * Every public function is total: collection, storage and transport
 * failures are swallowed — observability must never break gameplay.
 */

import { CURRENT_BUILD_ID } from "../game/build-staleness.ts";
import { isUncleanShutdown, type CleanExitStorage } from "../game/clean-exit.ts";

export const BREADCRUMB_KEY = "meridian.breadcrumb";
export const MAX_HISTORY = 12;
export const MAX_PAYLOAD_BYTES = 4096;
export const MAX_ERROR_CHARS = 300;
const MAX_QUEUE = 20;

export type MilestoneName =
  | "boot_start"
  | "boot_ready"
  | "run_start"
  | "data_chunk_load_start"
  | "data_loaded"
  | "map_init_start"
  | "map_ready"
  | "game_loaded";

export type ObservabilityEventType =
  | "suspected_crash"
  | "boot_failure"
  | "js_error"
  | "unhandled_rejection"
  | "map_error"
  | "tile_failed"
  | "webgl_context_lost";

export interface DeviceInfo {
  ua?: string;
  /** Coarse OS bucket (COPPA) derived from the UA — never the raw UA string. */
  os?: string;
  /** Coarse form-factor bucket: "mobile" | "desktop". */
  form?: string;
  dpr?: number;
  screenW?: number;
  screenH?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface MilestoneEntry {
  name: string;
  at: number;
}

export interface Breadcrumb {
  sessionId: string;
  buildId: string;
  startedAt: number;
  lastMilestone: string;
  history: MilestoneEntry[];
  edition?: string;
  regionId?: string;
  chunkId?: string;
  device?: DeviceInfo;
}

export interface ObservabilityEvent {
  type: ObservabilityEventType;
  ts: number;
  buildId: string;
  sessionId?: string;
  edition?: string;
  regionId?: string;
  chunkId?: string;
  lastMilestone?: string;
  device?: DeviceInfo;
  breadcrumb?: Breadcrumb;
  error?: { name: string; message: string };
  [key: string]: unknown;
}

/** Minimal storage surface (same seam shape as clean-exit.ts). */
export type ObsStorage = CleanExitStorage;

export interface ObsTransport {
  sendBeacon?: (url: string, data: string) => boolean;
  fetchFn?: (
    url: string,
    init: { method: string; keepalive: boolean; headers: Record<string, string>; body: string },
  ) => Promise<unknown>;
}

export interface ObservabilityDeps {
  storage?: ObsStorage | null;
  transport?: ObsTransport;
  endpoint?: string | null;
  now?: () => number;
  randomId?: () => string;
  device?: DeviceInfo;
  buildId?: string;
  isUnclean?: () => boolean;
}

function defaultStorage(): ObsStorage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function defaultTransport(): ObsTransport {
  const t: ObsTransport = {};
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      t.sendBeacon = (url, data) => navigator.sendBeacon(url, data);
    }
  } catch {
    // no beacon available
  }
  try {
    if (typeof fetch === "function") {
      t.fetchFn = (url, init) => fetch(url, init);
    }
  } catch {
    // no fetch available
  }
  return t;
}

export function collectDeviceInfo(): DeviceInfo {
  const d: DeviceInfo = {};
  try {
    if (typeof navigator !== "undefined") {
      if (typeof navigator.userAgent === "string") d.ua = navigator.userAgent.slice(0, MAX_ERROR_CHARS);
      const nav = navigator as Navigator & { deviceMemory?: number };
      if (typeof nav.deviceMemory === "number") d.deviceMemory = nav.deviceMemory;
      if (typeof navigator.hardwareConcurrency === "number") d.hardwareConcurrency = navigator.hardwareConcurrency;
    }
    if (typeof window !== "undefined") {
      if (typeof window.devicePixelRatio === "number") d.dpr = window.devicePixelRatio;
      if (typeof window.screen?.width === "number") d.screenW = window.screen.width;
      if (typeof window.screen?.height === "number") d.screenH = window.screen.height;
    }
  } catch {
    // Collection must never throw; partial info is fine.
  }
  return d;
}

function defaultRandomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * Coarse device facts for outbound crash reports — mirrors the watchdog's
 * COPPA posture (scripts/crash-watchdog.mjs): OS + form-factor buckets
 * derived from the UA, never the UA string itself. Numeric facts (DPR,
 * screen, memory, cores) pass through. Reads only live globals, never
 * stored state, so a tainted stored UA cannot leak through this path.
 */
export function coarseDeviceFacts(): DeviceInfo {
  let uaS = "";
  try {
    if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
      uaS = navigator.userAgent.toLowerCase();
    }
  } catch {
    uaS = "";
  }
  const os = /android/.test(uaS)
    ? "android"
    : /iphone|ipad|ipod/.test(uaS)
      ? "ios"
      : /windows/.test(uaS)
        ? "windows"
        : /mac/.test(uaS)
          ? "mac"
          : /linux/.test(uaS)
            ? "linux"
            : "other";
  const d = collectDeviceInfo();
  return {
    os,
    form: os === "android" || os === "ios" ? "mobile" : "desktop",
    dpr: d.dpr,
    screenW: d.screenW,
    screenH: d.screenH,
    deviceMemory: d.deviceMemory,
    hardwareConcurrency: d.hardwareConcurrency,
  };
}

export function sanitizeError(err: unknown): { name: string; message: string } {
  try {
    if (err instanceof Error) {
      return { name: String(err.name || "Error").slice(0, 80), message: String(err.message || "").slice(0, MAX_ERROR_CHARS) };
    }
    return { name: "Error", message: String(err).slice(0, MAX_ERROR_CHARS) };
  } catch {
    return { name: "Error", message: "" };
  }
}

function byteLength(s: string): number {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length;
  }
}

/**
 * Enforce the payload hard cap. Actual sequence: serialize; if over
 * `cap` bytes — trim the breadcrumb milestone history to its last 4
 * entries → drop the history entirely → drop breadcrumb + device →
 * progressively truncate string fields (limits 120/60/24; the error
 * name/message are also cut) → core-only fallback (type/ts/buildId).
 * Always returns valid JSON of at most `cap` bytes for any well-formed
 * event input.
 */
export function truncateEventToCap(event: ObservabilityEvent, cap = MAX_PAYLOAD_BYTES): string {
  let clone: ObservabilityEvent;
  try {
    clone = JSON.parse(JSON.stringify(event)) as ObservabilityEvent;
  } catch {
    clone = { type: event.type, ts: event.ts, buildId: event.buildId };
  }
  let out = JSON.stringify(clone);
  if (byteLength(out) <= cap) return out;

  if (clone.breadcrumb?.history?.length) {
    clone.breadcrumb = { ...clone.breadcrumb, history: clone.breadcrumb.history.slice(-4) };
    out = JSON.stringify(clone);
    if (byteLength(out) <= cap) return out;
    clone.breadcrumb = { ...clone.breadcrumb, history: [] };
    out = JSON.stringify(clone);
    if (byteLength(out) <= cap) return out;
  }
  // Drop the heaviest optional context.
  delete clone.breadcrumb;
  delete clone.device;
  out = JSON.stringify(clone);
  if (byteLength(out) <= cap) return out;

  // Truncate every long string field progressively.
  for (const limit of [120, 60, 24]) {
    for (const key of Object.keys(clone)) {
      const v = clone[key];
      if (typeof v === "string" && v.length > limit) clone[key] = v.slice(0, limit);
    }
    if (clone.error) {
      clone.error = { name: clone.error.name.slice(0, 40), message: clone.error.message.slice(0, limit) };
    }
    out = JSON.stringify(clone);
    if (byteLength(out) <= cap) return out;
  }
  // Last resort: keep only the identifying core.
  const core: ObservabilityEvent = { type: clone.type, ts: clone.ts, buildId: String(clone.buildId).slice(0, 40) };
  return JSON.stringify(core);
}

export interface Observability {
  init: () => void;
  recordMilestone: (name: MilestoneName | string, context?: { edition?: string; regionId?: string; chunkId?: string }) => void;
  emit: (event: ObservabilityEvent) => boolean;
  setEndpoint: (endpoint: string | null) => void;
  flushQueue: () => Promise<void>;
  getBreadcrumb: () => Breadcrumb | null;
  getQueueLength: () => number;
  emitMapError: (err: unknown) => boolean;
  emitTileFailed: () => boolean;
  emitWebglContextLost: () => boolean;
  installGlobalHandlers: (target?: Window) => void;
}

export function createObservability(deps: ObservabilityDeps = {}): Observability {
  const storage: ObsStorage | null = deps.storage !== undefined ? deps.storage : defaultStorage();
  const transport: ObsTransport = deps.transport ?? defaultTransport();
  const now = deps.now ?? (() => Date.now());
  const randomId = deps.randomId ?? defaultRandomId;
  const buildId = deps.buildId ?? CURRENT_BUILD_ID;
  const checkUnclean = deps.isUnclean ?? (() => isUncleanShutdown(storage));
  let endpoint: string | null = deps.endpoint ?? null;
  let breadcrumb: Breadcrumb | null = null;
  let initialized = false;
  let handlersInstalled = false;
  const queue: ObservabilityEvent[] = [];

  function readStoredBreadcrumb(): Breadcrumb | null {
    try {
      const raw = storage?.getItem(BREADCRUMB_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Breadcrumb;
      if (typeof parsed !== "object" || parsed === null || typeof parsed.sessionId !== "string") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function persist(): void {
    try {
      if (breadcrumb) storage?.setItem(BREADCRUMB_KEY, JSON.stringify(breadcrumb));
    } catch {
      // Storage blocked/full — trail lives in memory only.
    }
  }

  function sendNow(event: ObservabilityEvent): boolean {
    if (!endpoint) return false;
    const body = truncateEventToCap(event);
    try {
      if (transport.sendBeacon) {
        let ok = false;
        try {
          ok = transport.sendBeacon(endpoint, body);
        } catch {
          ok = false;
        }
        if (ok) return true;
      }
      if (transport.fetchFn) {
        // Fire-and-forget; failures are swallowed by design.
        Promise.resolve(
          transport.fetchFn(endpoint, {
            method: "POST",
            keepalive: true,
            headers: { "content-type": "application/json" },
            body,
          }),
        ).catch(() => {});
        return true;
      }
    } catch {
      // Transport must never throw into gameplay.
    }
    return false;
  }

  function emit(event: ObservabilityEvent): boolean {
    try {
      const enriched: ObservabilityEvent = {
        ...event,
        ts: typeof event.ts === "number" ? event.ts : now(),
        buildId: event.buildId || buildId,
        sessionId: event.sessionId ?? breadcrumb?.sessionId,
        // Coarse device bucket on every event (COPPA-safe: os/form only,
        // never raw UA) so alerts can say "ios/mobile" vs "desktop".
        device: event.device ?? coarseDeviceFacts(),
      };
      if (!endpoint) {
        queue.push(enriched);
        // Bounded queue with suspected_crash protection (D3): evict the
        // oldest NON-suspected_crash event first — a boot-time burst of
        // live error events must not silently evict the queued crash
        // report. Only a queue made up entirely of suspected_crash
        // events may drop its oldest one. The MAX_QUEUE memory bound
        // still holds either way.
        while (queue.length > MAX_QUEUE) {
          const evictIdx = queue.findIndex((ev) => ev.type !== "suspected_crash");
          if (evictIdx >= 0) queue.splice(evictIdx, 1);
          else queue.splice(0, 1);
        }
        return false;
      }
      return sendNow(enriched);
    } catch {
      return false;
    }
  }

  async function flushQueue(): Promise<void> {
    if (!endpoint) return;
    const pending = queue.splice(0, queue.length);
    for (const ev of pending) sendNow(ev);
  }

  function setEndpoint(next: string | null): void {
    endpoint = next;
    if (endpoint) void flushQueue();
  }

  function recordMilestone(name: string, context?: { edition?: string; regionId?: string; chunkId?: string }): void {
    try {
      if (!breadcrumb) {
        breadcrumb = {
          sessionId: randomId(),
          buildId,
          startedAt: now(),
          lastMilestone: name,
          history: [],
          device: deps.device ?? collectDeviceInfo(),
        };
      }
      const at = now();
      breadcrumb.lastMilestone = name;
      breadcrumb.history = [...breadcrumb.history, { name, at }].slice(-MAX_HISTORY);
      if (context?.edition) breadcrumb.edition = context.edition;
      if (context?.regionId) breadcrumb.regionId = context.regionId;
      if (context?.chunkId) breadcrumb.chunkId = context.chunkId;
      persist();
    } catch {
      // Milestones silently no-op on any failure.
    }
  }

  function init(): void {
    if (initialized) return;
    initialized = true;
    try {
      // IMPORTANT (jetsam asymmetry): a process kill cannot beacon during
      // the kill. We detect it HERE, at next boot, BEFORE overwriting the
      // previous trail and BEFORE the existing unclean-shutdown handling
      // in game-app consumes state: read the previous breadcrumb, and if
      // the clean-exit flag says the previous page was killed, emit one
      // suspected_crash carrying that trail — then rotate/clear the old
      // trail immediately, even if transport fails, guaranteeing
      // exactly-once across any number of subsequent boots.
      const prev = readStoredBreadcrumb();
      let unclean = false;
      try {
        unclean = checkUnclean();
      } catch {
        unclean = false;
      }
      if (unclean && prev) {
        // COPPA: the stored trail's device sub-object carries the raw UA
        // string (device.ua) — it must never leave the phone. Mirror the
        // watchdog (scripts/crash-watchdog.mjs): attach fresh coarse facts
        // (os/form buckets + numerics, no raw UA) and strip device from
        // the breadcrumb copy. The tainted stored copy is rotated below
        // regardless, so it never persists past this boot.
        const prevCopy: Breadcrumb = { ...prev };
        delete prevCopy.device;
        const event: ObservabilityEvent = {
          type: "suspected_crash",
          ts: now(),
          buildId: prev.buildId || buildId,
          sessionId: prev.sessionId,
          edition: prev.edition,
          regionId: prev.regionId,
          chunkId: prev.chunkId,
          lastMilestone: prev.lastMilestone,
          device: coarseDeviceFacts(),
          breadcrumb: prevCopy,
        };
        try {
          storage?.removeItem(BREADCRUMB_KEY);
        } catch {
          // Even if removal fails, the in-memory trail below is fresh;
          // a stale stored copy could re-fire — storage failure is the
          // documented best-effort limit of exactly-once.
        }
        emit(event);
      }
    } catch {
      // Detection failure must never block boot.
    }
    breadcrumb = {
      sessionId: randomId(),
      buildId,
      startedAt: now(),
      lastMilestone: "boot_start",
      history: [{ name: "boot_start", at: now() }],
      device: deps.device ?? collectDeviceInfo(),
    };
    persist();
  }

  function emitMapError(err: unknown): boolean {
    return emit({ type: "map_error", ts: now(), buildId, error: sanitizeError(err), lastMilestone: breadcrumb?.lastMilestone, edition: breadcrumb?.edition, regionId: breadcrumb?.regionId });
  }

  function emitTileFailed(): boolean {
    return emit({ type: "tile_failed", ts: now(), buildId, lastMilestone: breadcrumb?.lastMilestone, edition: breadcrumb?.edition, regionId: breadcrumb?.regionId });
  }

  function emitWebglContextLost(): boolean {
    return emit({ type: "webgl_context_lost", ts: now(), buildId, lastMilestone: breadcrumb?.lastMilestone, edition: breadcrumb?.edition, regionId: breadcrumb?.regionId });
  }

  function installGlobalHandlers(target?: Window): void {
    if (handlersInstalled) return;
    handlersInstalled = true;
    try {
      const w = target ?? (typeof window !== "undefined" ? window : undefined);
      if (!w || typeof w.addEventListener !== "function") return;
      w.addEventListener("error", (e: ErrorEvent) => {
        emit({ type: "js_error", ts: now(), buildId, error: sanitizeError(e?.error ?? e?.message ?? "unknown error"), lastMilestone: breadcrumb?.lastMilestone });
      });
      w.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
        emit({ type: "unhandled_rejection", ts: now(), buildId, error: sanitizeError(e?.reason ?? "unhandled rejection"), lastMilestone: breadcrumb?.lastMilestone });
      });
    } catch {
      // Handler installation is best-effort.
    }
  }

  return {
    init,
    recordMilestone,
    emit,
    setEndpoint,
    flushQueue,
    getBreadcrumb: () => breadcrumb,
    getQueueLength: () => queue.length,
    emitMapError,
    emitTileFailed,
    emitWebglContextLost,
    installGlobalHandlers,
  };
}

// --- App-wide singleton -------------------------------------------------

let singleton: Observability | null = null;

export function getObservability(): Observability {
  if (!singleton) singleton = createObservability();
  return singleton;
}

/** Test-only: drop the singleton so the next getObservability() is fresh. */
export function resetObservabilityForTests(): void {
  singleton = null;
}

export function initObservability(): void {
  getObservability().init();
}

export function recordMilestone(name: MilestoneName | string, context?: { edition?: string; regionId?: string; chunkId?: string }): void {
  try {
    getObservability().recordMilestone(name, context);
  } catch {
    // Never break gameplay.
  }
}

export function emitEvent(event: ObservabilityEvent): boolean {
  try {
    return getObservability().emit(event);
  } catch {
    return false;
  }
}

export function setObservabilityEndpoint(endpoint: string | null): void {
  try {
    getObservability().setEndpoint(endpoint);
  } catch {
    // ignore
  }
}

export function installGlobalErrorHandlers(target?: Window): void {
  try {
    getObservability().installGlobalHandlers(target);
  } catch {
    // ignore
  }
}

export function emitMapError(err: unknown): boolean {
  try {
    return getObservability().emitMapError(err);
  } catch {
    return false;
  }
}

export function emitTileFailed(): boolean {
  try {
    return getObservability().emitTileFailed();
  } catch {
    return false;
  }
}

export function emitWebglContextLost(): boolean {
  try {
    return getObservability().emitWebglContextLost();
  } catch {
    return false;
  }
}
