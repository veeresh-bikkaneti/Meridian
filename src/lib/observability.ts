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
 * the fixed coarse device field set named in the telemetry field
 * manifest (src/lib/telemetry-manifest.ts — OS/browser/engine as parsed
 * from the UA, class/form/DPR/screen/touch buckets, and, under the
 * §6.3 safeguard amendment recorded in DESIGN-FINAL, deviceMemory and
 * hardwareConcurrency as read or "unknown"; see runtimeFacts) and
 * truncated error name/message only. The raw UA string never leaves
 * the device and is no longer stored on it (§4.1).
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
import { hasDurableMapCrashMarker, writeDurableMapCrashMarker } from "../map/capability.ts";
import { parseRuntimeUA } from "./ua-parse.ts";

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
  | "game_loaded"
  | "storyteller_ready"
  /**
   * Crash-classification milestones (2026-10-12): Android routinely kills
   * backgrounded tabs for memory, which the next-boot asymmetry detector
   * cannot distinguish from a genuine foreground crash — both surface as
   * `suspected_crash` with no error. Recording the visibility transitions
   * makes every future report self-classifying: a trail ending at
   * "backgrounded" is an OS background kill (expected mobile lifecycle),
   * anything else is a real foreground kill worth investigating.
   */
  | "backgrounded"
  | "foregrounded";

export type ObservabilityEventType =
  | "suspected_crash"
  | "recovery_outcome"
  | "boot_failure"
  | "js_error"
  | "unhandled_rejection"
  | "map_error"
  | "tile_failed"
  | "webgl_context_lost"
  | "storyteller_shown"
  | "narration_started"
  | "narration_completed"
  | "narration_replayed"
  | "narration_failed"
  | "narration_dismissed";

export interface DeviceInfo {
  /**
   * Legacy raw-UA slot. runtimeFacts() NEVER sets it and
   * collectDeviceInfo() no longer stores it (§4.1: the raw UA exists
   * nowhere in telemetry storage). The field survives in the type only
   * so legacy stored trails still parse; both the client (before send)
   * and the worker (on arrival) strip it.
   */
  ua?: string;
  /** Parsed browser name (§3 rules B1-B9) or "unknown". */
  browser?: string;
  /** "<major>.<minor>" or "unknown"; Chromium minor is frozen (§2.3). */
  browserVersion?: string;
  /** Inferred engine (§3 rules E1-E5) or "unknown". */
  engine?: string;
  /** Coarse OS bucket derived from the UA — never the raw UA string. */
  os?: string;
  /** Parsed OS version or "unknown" (frozen tokens denied, §2.3). */
  osVersion?: string;
  /** Device class only — phone|tablet|desktop|unknown, never a model. */
  deviceClass?: string;
  /** As read (1..64) or "unknown"; WebKit clamps it (§2.4). */
  hardwareConcurrency?: number | "unknown";
  /** GB as read or "unknown" — unknown on WebKit IS the signal (§1.2). */
  deviceMemory?: number | "unknown";
  /** Coarse form-factor bucket: "mobile" | "desktop". */
  form?: string;
  dpr?: number | "unknown";
  /** Exact pixels — internal read surface only, never stamped by runtimeFacts(). */
  screenW?: number;
  /** Exact pixels — internal read surface only, never stamped by runtimeFacts(). */
  screenH?: number;
  /**
   * Screen-size bucket sent in reports instead of exact pixels:
   * "sm" (short side < 480), "md" (< 768), "lg" (< 1080), "xl".
   */
  screen?: ScreenBucket | "unknown";
  /** Bucketed maxTouchPoints: "0" | "1" | "2-5" | "6+" | "unknown". */
  touchPoints?: string;
  /** "standalone" | "browser" | "unknown" (§2.5 honesty rule). */
  displayMode?: string;
  /** navigator.connection effectiveType, validated, or "unknown". */
  connection?: string;
  /** Primary BCP-47 tag (navigator.language only) or "unknown". */
  locale?: string;
  /** Watchdog path only: WebGL1 availability. */
  webgl1?: boolean;
  /** Watchdog path only: WebGL2 availability. */
  webgl2?: boolean;
}

export type ScreenBucket = "sm" | "md" | "lg" | "xl";

/**
 * Bucket a screen by its SHORT side. Exact width × height (together with
 * DPR and OS) narrows a device down far more than crash triage needs —
 * kids' privacy wins (crash-telemetry coarsening — a code change in
 * this PR, not an owner decision; see remediation doc decision 2).
 */
export function screenBucket(w: unknown, h: unknown): ScreenBucket | undefined {
  if (typeof w !== "number" || typeof h !== "number" || !(w > 0) || !(h > 0)) return undefined;
  const short = Math.min(w, h);
  return short < 480 ? "sm" : short < 768 ? "md" : short < 1080 ? "lg" : "xl";
}

/** DPR rounded to the nearest whole number (1, 2, 3…), capped at 4. */
export function dprBucket(dpr: unknown): number | undefined {
  if (typeof dpr !== "number" || !(dpr > 0)) return undefined;
  return Math.min(4, Math.max(1, Math.round(dpr)));
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
  /**
   * PBI-8: tile-failure count for the current map mount (suggestive only —
   * never a switch signal). Carried into suspected_crash via the stored
   * trail so the Phase 0 measurement gate sees tile_failed counts.
   */
  tileErrors?: number;
  /** #335 (§4.2): the session's as-run map mode, persisted at the switch. */
  mapMode?: "full" | "scout";
  /**
   * §4.1: this session's parsed runtime snapshot (runtimeFacts() at
   * trail creation). Parsed-only — it may leave the device, unlike the
   * raw-UA `device` slot it replaces.
   */
  runtime?: DeviceInfo;
  /**
   * §2.2: persisted terminal-visibility state, written by the
   * visibility listener AT the transition (init false) — classifier
   * stamps read this state instead of re-deriving from history.
   */
  bgTerminal?: boolean;
  /** §2.2: persisted stuck state, evaluated at backgrounding time. */
  trailStuck?: boolean;
  /**
   * [GRAFT] Set at trail creation by builds that install visibility
   * tracking in the same init() — a marker-carrying trail provably had
   * tracking its whole life, so silent history means never-backgrounded.
   */
  vis?: true;
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
  /** §4.2: widens to include "unknown" for crashed-session reports. */
  mapMode?: "full" | "scout" | "unknown";
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
  /**
   * Issue #330: localStorage-backed store for the durable map-crash
   * marker. Separate from `storage` (sessionStorage) on purpose — the
   * marker exists to survive the session store's loss. Defaults to the
   * real localStorage; tests inject a fake.
   */
  durableStorage?: ObsStorage | null;
  transport?: ObsTransport;
  endpoint?: string | null;
  now?: () => number;
  randomId?: () => string;
  device?: DeviceInfo;
  buildId?: string;
  isUnclean?: () => boolean;
  /**
   * Minimal document surface for visibility tracking (injected for tests;
   * defaults to the global document). Kept narrow so node --test needs no
   * DOM — pass a fake.
   */
  document?: {
    visibilityState?: string;
    addEventListener?: (type: string, listener: () => void) => void;
  } | null;
}

function defaultStorage(): ObsStorage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function defaultDurableStorage(): ObsStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
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
      // §4.1: the raw UA is NO LONGER stored here — it exists nowhere in
      // telemetry storage now. (The pre-amendment 2026-10-21 note that
      // deviceMemory/hardwareConcurrency were deliberately not collected
      // is superseded for OUTBOUND facts by the §6.3 safeguard
      // amendment: runtimeFacts() below stamps both as read or
      // "unknown", gated by COLLECT_MEMORY_CORES.)
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
 * §6.4 de-scope switch: when true (the shipped default, under the §6.3
 * safeguard amendment), runtimeFacts() stamps deviceMemory and
 * hardwareConcurrency as read. Flipping this one constant to false
 * stamps both "unknown" unconditionally — the always-stamp rule (§2.1)
 * means no wire shape, validator, or template changes with it.
 */
export const COLLECT_MEMORY_CORES = true;

/** Bucketed maxTouchPoints (§1.2 row 11): exact counts never stamp. */
function touchPointsBucket(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "unknown";
  const n = Math.floor(v);
  return n === 0 ? "0" : n === 1 ? "1" : n <= 5 ? "2-5" : "6+";
}

/**
 * Display mode (§1.2 row 16, §2.5 honesty rule): "browser" is emitted
 * only where the display-mode media feature is known-supported —
 * Chromium engines, and iOS (whose Safari has supported the query for
 * the incident-era floor, decided via the standalone/fullscreen
 * OR-path). Desktop WebKit/Gecko non-matches stay "unknown": claiming
 * "browser" on an engine that cannot evaluate the query would be a
 * guess dressed as a read.
 */
function readDisplayMode(engine: string, os: string): string {
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as unknown as Record<string, unknown>) : {};
    let standaloneMatch = false;
    let fullscreenMatch = false;
    let hasMatchMedia = false;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      hasMatchMedia = true;
      standaloneMatch = !!window.matchMedia("(display-mode: standalone)").matches;
      fullscreenMatch = !!window.matchMedia("(display-mode: fullscreen)").matches;
    }
    if (standaloneMatch) return "standalone";
    if (os === "ios") {
      if (nav.standalone === true) return "standalone";
      if (fullscreenMatch) return "standalone";
      // iOS Safari evaluates the query; a non-match there is a read.
      return hasMatchMedia ? "browser" : "unknown";
    }
    if (!hasMatchMedia) return "unknown";
    if (engine === "blink") return "browser";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * The session's runtime facts (§§2.1, 3.3): the parsed UA snapshot
 * merged with the per-session API reads. EVERY manifest device key
 * (except the watchdog-only webgl pair) is present on every return —
 * an absent API or unparseable input stamps the field's "unknown"
 * form, never a missing key (§2.1: unknown is a value). Every read is
 * individually guarded: a throwing read stamps its own field
 * "unknown" and affects no other field. Reads only live globals,
 * never stored state, so a tainted stored UA cannot leak through here.
 * Shape is driven by src/lib/telemetry-manifest.ts and pinned by the
 * presence test in observability.test.ts.
 */
export function runtimeFacts(): DeviceInfo {
  let ua = "";
  let maxTouchPoints: number | undefined;
  let hasClientHints = false;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.userAgent === "string") {
      ua = navigator.userAgent;
    }
  } catch {
    ua = "";
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.maxTouchPoints === "number") {
      maxTouchPoints = navigator.maxTouchPoints;
    }
  } catch {
    maxTouchPoints = undefined;
  }
  try {
    hasClientHints =
      typeof navigator !== "undefined" &&
      typeof (navigator as unknown as Record<string, unknown>).userAgentData !== "undefined";
  } catch {
    hasClientHints = false;
  }
  const parsed = parseRuntimeUA(ua, { maxTouchPoints, hasClientHints });

  // Form (§1.2 row 19): derived from deviceClass; the unknown class
  // falls back to today's os-derived rule (keeps the legacy vocabulary
  // — and the iPad-as-Mac trail now reports mobile via its class).
  const form =
    parsed.deviceClass === "phone" || parsed.deviceClass === "tablet"
      ? "mobile"
      : parsed.deviceClass === "desktop"
        ? "desktop"
        : parsed.os === "android" || parsed.os === "ios"
          ? "mobile"
          : "desktop";

  const raw = collectDeviceInfo();

  let hardwareConcurrency: number | "unknown" = "unknown";
  if (COLLECT_MEMORY_CORES) {
    try {
      const v = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
      if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 64) {
        hardwareConcurrency = v;
      }
    } catch {
      hardwareConcurrency = "unknown";
    }
  }
  let deviceMemory: number | "unknown" = "unknown";
  if (COLLECT_MEMORY_CORES) {
    try {
      const v =
        typeof navigator !== "undefined"
          ? (navigator as unknown as Record<string, unknown>).deviceMemory
          : undefined;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) deviceMemory = v;
    } catch {
      deviceMemory = "unknown";
    }
  }
  let connection = "unknown";
  try {
    const eff = (navigator as unknown as Record<string, unknown> | undefined)?.connection as
      | { effectiveType?: unknown }
      | undefined;
    const et = eff?.effectiveType;
    if (et === "slow-2g" || et === "2g" || et === "3g" || et === "4g") connection = et;
  } catch {
    connection = "unknown";
  }
  let locale = "unknown";
  try {
    const lang = typeof navigator !== "undefined" ? navigator.language : undefined;
    if (typeof lang === "string" && lang.length > 0 && lang.length <= 12 && /^[A-Za-z-]+$/.test(lang)) {
      locale = lang;
    }
  } catch {
    locale = "unknown";
  }

  return {
    browser: parsed.browser,
    browserVersion: parsed.browserVersion,
    engine: parsed.engine,
    os: parsed.os,
    osVersion: parsed.osVersion,
    deviceClass: parsed.deviceClass,
    hardwareConcurrency,
    deviceMemory,
    form,
    dpr: dprBucket(raw.dpr) ?? "unknown",
    screen: screenBucket(raw.screenW, raw.screenH) ?? "unknown",
    touchPoints: touchPointsBucket(maxTouchPoints),
    displayMode: readDisplayMode(parsed.engine, parsed.os),
    connection,
    locale,
  };
}

/**
 * The LEGACY coarse device (pre-enrichment shape: os/form/dpr/screen
 * only). [GRAFT §1.1] Funnel events (storyteller_shown, narration_*)
 * stamp this and nothing more — they are engagement telemetry, not
 * crash triage, and their device surface does not grow.
 */
function legacyCoarseFacts(): DeviceInfo {
  const parsed = (() => {
    try {
      const ua =
        typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
          ? navigator.userAgent
          : "";
      return parseRuntimeUA(ua, {});
    } catch {
      return parseRuntimeUA("", {});
    }
  })();
  const d = collectDeviceInfo();
  return {
    os: parsed.os,
    form: parsed.os === "android" || parsed.os === "ios" ? "mobile" : "desktop",
    dpr: dprBucket(d.dpr),
    screen: screenBucket(d.screenW, d.screenH),
  };
}

/**
 * @deprecated Kept as a re-export of runtimeFacts() for one release so
 * no other call site changes (DESIGN-FINAL §3.3). New code calls
 * runtimeFacts().
 */
export function coarseDeviceFacts(): DeviceInfo {
  return runtimeFacts();
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

/**
 * Known-benign browser noise. A ResizeObserver callback that triggers layout
 * synchronously re-fires the observer within the same frame; the browser
 * completes the loop and logs this complaint. Nothing is broken — but left
 * unclassified it would ship to the crash pipeline as a js_error and read
 * like a real crash in the telemetry.
 */
const BENIGN_BROWSER_NOISE: RegExp[] = [
  /ResizeObserver loop completed with undelivered notifications/i,
];

/** True when an error message is known-benign browser noise, never a crash. */
export function isBenignBrowserNoise(message: string): boolean {
  try {
    return BENIGN_BROWSER_NOISE.some((re) => re.test(String(message)));
  } catch {
    return false;
  }
}

// --- Crash-report verdicts (Slice 1, 2026-10-25) --------------------------
//
// Every crash-class report carries a verdict, derived from evidence
// stamps on the event. The classifier is a pure function of the stamped
// facts; it is MIRRORED in workers/crash-report/src/index.ts, where the
// receiver re-derives the verdict authoritatively and renders it (the
// client stamp below is provisional only). Keep the two copies in step —
// the fixture tables in both test files are identical on purpose.
//
// Evidence stamps (design §4 A1, Consensus Manifest 2026-10-25):
// - `bgTerminal` / `buildReplaced` / `trailStuck`: booleans stamped on
//   `suspected_crash` only, resolved at init() from the STORED trail
//   before any payload trimming. Since the telemetry enrichment
//   (DESIGN-FINAL §2.2), bgTerminal/trailStuck are persisted STATE
//   written by the visibility listener at each transition; init()
//   resolves them by the pinned precedence state field → history scan
//   (last VISIBILITY entry — a raw last-milestone test is wrong) →
//   vis-gated false, and OMITS bgTerminal only for a marker-less
//   legacy trail whose history is also silent, so the classifier
//   fails closed instead of guessing.
// - `storageOk`: boolean stamped on every event at the emit() choke
//   point. It records whether this session's storage reads/writes have
//   succeeded so far. It cannot size the storage-blocked blind spot: a
//   fully blocked session emits no suspected_crash at all (design F4).
// - `lcV`: this classifier's logic version, stamped on every event.
//   Absent stamps (older builds in the fleet) fail closed — see the
//   classifier's missing-fields rule.

/** Classifier logic version stamped on every event as `lcV`. */
export const CLASSIFIER_VERSION = "2";

export type CrashVerdict =
  | "not_a_real_issue"
  | "auto_fixed"
  | "developer_needed"
  | "insufficient_evidence";

export type CrashWhyKey =
  | "bg_close"
  | "bg_stuck"
  | "fg_vanished"
  | "fg_kill_replaced"
  | "fg_kill_current"
  | "captured_error"
  | "recovery_confirmed"
  | "recovery_failed"
  | "recovery_stood_down"
  | "recovery_unconfirmed"
  | "marker_unreadable"
  | "missing_fields";

export interface CrashVerdictFacts {
  type: string;
  error?: { name: string; message: string };
  lastMilestone?: string;
  bgTerminal?: boolean;
  buildReplaced?: boolean;
  trailStuck?: boolean;
  lcV?: string;
  recoveryOutcome?: string;
}

/** Types whose presence alone is a captured failure (design §2.2). */
const CAPTURED_ERROR_TYPES = new Set([
  "js_error",
  "unhandled_rejection",
  "map_error",
  "boot_failure",
]);

/** Types that carry a verdict at all in Slice 1 (hiccup/funnel: never). */
const CRASH_CLASS_TYPES = new Set([
  "suspected_crash",
  "boot_failure",
  "js_error",
  "unhandled_rejection",
  "map_error",
]);

/** Last-step values that mean the session was in active play (shapes D/E). */
const GAMEPLAY_MILESTONES = new Set([
  "run_start",
  "data_chunk_load_start",
  "data_loaded",
  "map_init_start",
  "map_ready",
  "game_loaded",
  "storyteller_ready",
]);

/**
 * Classify one report from its stamped facts. Precedence (design §2.3):
 * a captured error defeats every benign pattern and every missing-stamp
 * gap; developer-needed evidence defeats insufficient-evidence; benign
 * is the last resort, reachable only with its full evidence pattern.
 * `auto_fixed` is returned only by the Slice 2 recovery_outcome branch
 * above (a confirmed recovery); an attempt alone never earns it.
 */
export function classifyCrashVerdict(
  facts: CrashVerdictFacts,
): { verdict: CrashVerdict; whyKey: CrashWhyKey } {
  // Slice 2: the recovery_outcome branch is evaluated FIRST, before the
  // captured-error rule (Consensus Manifest 2026-10-25). A missing or
  // invalid recoveryOutcome fails closed to insufficient_evidence.
  if (facts.type === "recovery_outcome") {
    switch (facts.recoveryOutcome) {
      case "confirmed":
        return { verdict: "auto_fixed", whyKey: "recovery_confirmed" };
      case "repeat_failure":
        return { verdict: "developer_needed", whyKey: "recovery_failed" };
      case "stood_down":
        return { verdict: "insufficient_evidence", whyKey: "recovery_stood_down" };
      case "unconfirmed_closed":
      case "unconfirmed_died":
      case "unconfirmed_expired":
        return { verdict: "insufficient_evidence", whyKey: "recovery_unconfirmed" };
      case "marker_unreadable":
        return { verdict: "insufficient_evidence", whyKey: "marker_unreadable" };
      default:
        return { verdict: "insufficient_evidence", whyKey: "missing_fields" };
    }
  }
  if (facts.error || CAPTURED_ERROR_TYPES.has(facts.type)) {
    return { verdict: "developer_needed", whyKey: "captured_error" };
  }
  if (facts.type !== "suspected_crash") {
    return { verdict: "insufficient_evidence", whyKey: "missing_fields" };
  }
  // Fail closed (design F8): any absent stamp → can't tell, never benign.
  if (
    typeof facts.bgTerminal !== "boolean" ||
    typeof facts.buildReplaced !== "boolean" ||
    typeof facts.trailStuck !== "boolean" ||
    typeof facts.lcV !== "string" ||
    facts.lcV.length === 0
  ) {
    return { verdict: "insufficient_evidence", whyKey: "missing_fields" };
  }
  if (facts.bgTerminal) {
    return facts.trailStuck
      ? { verdict: "insufficient_evidence", whyKey: "bg_stuck" }
      : { verdict: "not_a_real_issue", whyKey: "bg_close" };
  }
  if (facts.lastMilestone && GAMEPLAY_MILESTONES.has(facts.lastMilestone)) {
    return facts.buildReplaced
      ? { verdict: "insufficient_evidence", whyKey: "fg_kill_replaced" }
      : { verdict: "developer_needed", whyKey: "fg_kill_current" };
  }
  return { verdict: "insufficient_evidence", whyKey: "fg_vanished" };
}

// --- Recovery outcome marker (Slice 2, 2026-10-25) -----------------------
//
// chunk-recovery writes `meridian.chunkRecovery` before a verified
// auto-reload (design §3.3 / §4 A4); observability claims it at init()
// and owns every terminal `recovery_outcome` emission. The validity
// predicate below is specified once in the Slice 2 Consensus Manifest
// and implemented IDENTICALLY in src/lib/chunk-recovery.ts — the two
// must not drift, and both test files fixture-test the same shapes.

/** sessionStorage key holding the recovery-outcome marker (Slice 2). */
export const CHUNK_RECOVERY_KEY = "meridian.chunkRecovery";
/** sessionStorage key holding the chunk-reload stamp (corroboration). */
export const CHUNK_RELOAD_KEY = "meridian.chunkReloadAt";
/** A valid marker older than this at init resolves unconfirmed_expired. */
export const RECOVERY_MARKER_MAX_AGE_MS = 86_400_000;
/** A fresh reload stamp (age ≤ this) corroborates an unreadable marker. */
export const RELOAD_STAMP_CORROBORATION_MAX_AGE_MS = 900_000;

/** Outcome signals arriving from chunk-recovery via the host wiring. */
export type RecoverySignal = "episode_cleared" | "repeat_failure" | "stood_down";

/** Facts accompanying a recovery signal (the attempt it belongs to). */
export interface RecoverySignalFacts {
  build?: string;
  at?: number;
}

export interface RecoveryMarker {
  v: 1;
  at: number;
  build: string;
  claimed?: boolean;
  outcome?: string;
  [key: string]: unknown;
}

/**
 * The marker-validity predicate (Consensus Manifest, Slice 2): parses
 * as a JSON object; `v === 1`; `at` a finite number; `build` a non-empty
 * string; `claimed`, if present, a boolean; `outcome`, if present, a
 * string. A marker carrying an `outcome` field is a TERMINAL record,
 * never a pending attempt.
 */
export function isValidRecoveryMarker(parsed: unknown): parsed is RecoveryMarker {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const m = parsed as Record<string, unknown>;
  if (m.v !== 1) return false;
  if (typeof m.at !== "number" || !Number.isFinite(m.at)) return false;
  if (typeof m.build !== "string" || m.build.length === 0) return false;
  if (m.claimed !== undefined && typeof m.claimed !== "boolean") return false;
  if (m.outcome !== undefined && typeof m.outcome !== "string") return false;
  return true;
}

export type RecoveryMarkerParse =
  | { kind: "valid"; marker: RecoveryMarker }
  | { kind: "terminal"; marker: RecoveryMarker }
  | { kind: "invalid-version" }
  | { kind: "invalid" };

/**
 * Parse a raw marker string for init()'s claim protocol. `terminal` =
 * a parseable record carrying an `outcome` string (already reported;
 * deleted silently). `invalid-version` = parseable with a numeric
 * `v !== 1` (always `marker_unreadable`). `invalid` = unparseable or
 * predicate-failing (the corroboration split decides). Null raw input
 * (no marker stored) returns null.
 */
export function parseRecoveryMarker(raw: string | null): RecoveryMarkerParse | null {
  if (raw === null || raw === undefined || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid" };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const m = parsed as Record<string, unknown>;
    if (typeof m.outcome === "string") {
      return { kind: "terminal", marker: m as RecoveryMarker };
    }
    if (typeof m.v === "number" && m.v !== 1) return { kind: "invalid-version" };
  }
  if (isValidRecoveryMarker(parsed)) return { kind: "valid", marker: parsed };
  return { kind: "invalid" };
}

/**
 * Terminal visibility state of a stored trail: true when the session
 * ended backgrounded — the last VISIBILITY entry in its history is
 * "backgrounded" (a later non-visibility entry does not change that;
 * the tab was still in the background when it was recorded); false when
 * that entry is "foregrounded". With NO visibility entry at all the
 * state is unknown and this returns undefined — the stamp is then
 * omitted and the classifier fails closed (design §4 A1: a raw
 * last-milestone test is wrong; C3 binding constraint). Never inferred
 * from lastMilestone.
 */
export function terminalBackgrounded(prev: Breadcrumb): boolean | undefined {
  const history = Array.isArray(prev.history) ? prev.history : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const name = history[i]?.name;
    if (name === "backgrounded") return true;
    if (name === "foregrounded") return false;
  }
  return undefined;
}

/** Start milestones whose matching ready/loaded step never arrived. */
const START_MILESTONES = new Set([
  "run_start",
  "data_chunk_load_start",
  "map_init_start",
]);

/**
 * Shape A-stuck: the session ended backgrounded, but the last progress
 * step before that backgrounding was a start-without-ready — the player
 * backgrounded an app that appeared stuck, so the background-close
 * pattern must not whitewash it (design §2.3). Reads the stored history
 * before any trimming, like terminalBackgrounded.
 */
export function trailWasStuck(prev: Breadcrumb): boolean {
  if (terminalBackgrounded(prev) !== true) return false;
  const history = Array.isArray(prev.history) ? prev.history : [];
  let bgIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.name === "backgrounded") {
      bgIdx = i;
      break;
    }
    if (history[i]?.name === "foregrounded") break;
  }
  if (bgIdx < 0) return false;
  for (let i = bgIdx - 1; i >= 0; i--) {
    const name = history[i]?.name;
    if (name === "backgrounded" || name === "foregrounded") continue;
    return START_MILESTONES.has(name);
  }
  return false;
}

function byteLength(s: string): number {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length;
  }
}

/**
 * Enforce the payload hard cap — the §7.4 trim order, reordered so the
 * fields triage needs die last (each step re-serialises and stops as
 * soon as the event fits):
 *  1. Trim breadcrumb.history to its last 4 entries.
 *  2. Drop breadcrumb.history entirely.
 *  3. Reduce the nested breadcrumb to a stub {sessionId, buildId,
 *     startedAt, lastMilestone, mapMode} — the #335-critical mode and
 *     the msSinceBootStart inputs survive for ~90 bytes. The top-level
 *     device object is NOT dropped here (a deliberate inversion of the
 *     old order, which dropped device wholesale at this point).
 *  4. Truncate error.message to 140, then 60.
 *  5. Drop the breadcrumb stub.
 *  6. Truncate remaining long strings at 120/60/24.
 *  7. Drop device.locale, then device.connection, then
 *     device.browserVersion (lowest triage value first, named order).
 *  8. Core-only fallback {type, ts, buildId}.
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
  const fits = () => byteLength(JSON.stringify(clone)) <= cap;
  let out = JSON.stringify(clone);
  if (byteLength(out) <= cap) return out;

  // Steps 1-2: history first.
  if (clone.breadcrumb?.history?.length) {
    clone.breadcrumb = { ...clone.breadcrumb, history: clone.breadcrumb.history.slice(-4) };
    if (fits()) return JSON.stringify(clone);
    clone.breadcrumb = { ...clone.breadcrumb, history: [] };
    if (fits()) return JSON.stringify(clone);
  }
  // Step 3: breadcrumb → stub (device survives).
  if (clone.breadcrumb) {
    const b = clone.breadcrumb;
    const stub: Breadcrumb = {
      sessionId: b.sessionId,
      buildId: b.buildId,
      startedAt: b.startedAt,
      lastMilestone: b.lastMilestone,
      history: [],
    };
    if (b.mapMode) stub.mapMode = b.mapMode;
    clone.breadcrumb = stub;
    if (fits()) return JSON.stringify(clone);
  }
  // Step 4: error message before anything else string-shaped.
  if (clone.error) {
    for (const limit of [140, 60]) {
      clone.error = { name: clone.error.name, message: clone.error.message.slice(0, limit) };
      if (fits()) return JSON.stringify(clone);
    }
  }
  // Step 5: drop the stub.
  if (clone.breadcrumb) {
    delete clone.breadcrumb;
    if (fits()) return JSON.stringify(clone);
  }
  // Step 6: truncate every long string field progressively.
  for (const limit of [120, 60, 24]) {
    for (const key of Object.keys(clone)) {
      const v = clone[key];
      if (typeof v === "string" && v.length > limit) clone[key] = v.slice(0, limit);
    }
    if (clone.error) {
      clone.error = { name: clone.error.name.slice(0, 40), message: clone.error.message.slice(0, limit) };
    }
    if (fits()) return JSON.stringify(clone);
  }
  // Step 7: the three lowest-triage-value device fields, named order.
  if (clone.device) {
    for (const key of ["locale", "connection", "browserVersion"] as const) {
      const dev: DeviceInfo = { ...clone.device };
      delete dev[key];
      clone.device = dev;
      if (fits()) return JSON.stringify(clone);
    }
  }
  // Step 8: last resort — keep only the identifying core.
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
  /**
   * PBI-6: true when the previous boot's trail says the page was killed
   * while the map was mounted (last milestone map_init_start/map_ready).
   * Set once during init(); drives the Scout Map boot offer (offer, not
   * force — see capability.ts Q1). Issue #330: also true when the
   * durable localStorage map-crash marker is inside its decay window,
   * even if the session trail is gone.
   */
  wasMapAttributedCrash: () => boolean;
  /** PBI-8: record the current map mount's tile-failure count on the trail. */
  setTileErrorCount: (count: number) => void;
  /**
   * #335 (§4.2): the setReportMapMode choke point, instance side —
   * updates the stamped mode AND persists it onto the live breadcrumb
   * so the next boot reports the crashed session's as-run mode.
   */
  setReportMapMode: (mode: "full" | "scout") => void;
  /**
   * Slice 2: a recovery signal from chunk-recovery (wired by GameApp).
   * Resolves the claimed outcome marker at most once — see the Slice 2
   * Consensus Manifest for the per-signal rules.
   */
  noteRecoverySignal: (signal: RecoverySignal, facts?: RecoverySignalFacts) => void;
}

/**
 * Milestones that mean "the map was mounted" — a crash whose trail ends
 * here is map-attributed (PBI-6). Anything earlier (boot/data) is not.
 */
const MAP_ATTRIBUTED_MILESTONES = new Set(["map_init_start", "map_ready"]);

/**
 * PBI-8: the game map mode ("full" | "scout") carried on every emitted
 * observability event, including crash reports. Set by the app shell
 * (GameApp owns the mode); defaults to "full".
 */
let reportMapMode: "full" | "scout" = "full";

/**
 * Bridge from the module-level setReportMapMode() to the live
 * observability instance's breadcrumb (§4.2): createObservability
 * registers its persist hook here so the choke point can write
 * breadcrumb.mapMode without a GameApp change. Null when no instance
 * exists yet — the mode still lands on the module variable, and trail
 * creation / the map_init_start pin pick it up from there.
 */
let liveMapModeSink: ((mode: "full" | "scout") => void) | null = null;

/** PBI-8: set the map mode stamped on outbound observability events. */
export function setReportMapMode(mode: "full" | "scout"): void {
  reportMapMode = mode === "scout" ? "scout" : "full";
  try {
    liveMapModeSink?.(reportMapMode);
  } catch {
    // Mode persistence must never break gameplay.
  }
}

/**
 * §1.1 [GRAFT]: the funnel types stamp the LEGACY coarse device only.
 * Hiccup types (tile_failed, webgl_context_lost) are NOT in this set —
 * tile/WebGL triage is browser × OS work and keeps the full device.
 */
const FUNNEL_TYPES = new Set([
  "storyteller_shown",
  "narration_started",
  "narration_completed",
  "narration_replayed",
  "narration_failed",
  "narration_dismissed",
]);

/** Crash-class types for the §1.1 top-level stamps (incl. recovery). */
const STAMPED_TYPES = new Set([...CRASH_CLASS_TYPES, "recovery_outcome"]);

/** localStorage key for the §4.3 durable unfinished-boot counter. */
export const BOOT_HEALTH_KEY = "meridian:boot-health";

export function createObservability(deps: ObservabilityDeps = {}): Observability {
  const storage: ObsStorage | null = deps.storage !== undefined ? deps.storage : defaultStorage();
  const durableStorage: ObsStorage | null =
    deps.durableStorage !== undefined ? deps.durableStorage : defaultDurableStorage();
  const transport: ObsTransport = deps.transport ?? defaultTransport();
  const now = deps.now ?? (() => Date.now());
  const randomId = deps.randomId ?? defaultRandomId;
  const buildId = deps.buildId ?? CURRENT_BUILD_ID;
  const checkUnclean = deps.isUnclean ?? (() => isUncleanShutdown(storage));
  let endpoint: string | null = deps.endpoint ?? null;
  let breadcrumb: Breadcrumb | null = null;
  let initialized = false;
  let handlersInstalled = false;
  /** Crash-classification: visibility listener installed once in init(). */
  let visibilityTracked = false;
  /** PBI-6: set once in init() — the previous page died with the map mounted. */
  let mapAttributedCrash = false;
  /** Slice 1: false once any storage read/write in this session throws. */
  let storageOk = true;
  /**
   * §4.3: the current unfinished-boot streak. init() is the SOLE
   * reader/writer of the durable counter (via the durableStorage dep
   * #331 added); this closure value is what emit() stamps on live
   * crash-class events without incrementing.
   */
  let unfinishedBoots = 0;
  /**
   * Slice 2: the claimed recovery attempt held by init(). The two
   * confirmation legs are LATCHED BOOLEANS here in the closure — never
   * re-derived from the capped trail history. `resolved` enforces the
   * at-most-once rule: resolve deletes the marker, sets this flag, and
   * emits exactly once; every later signal for the attempt drops.
   */
  interface PendingRecovery {
    build: string;
    at: number;
    gameLoaded: boolean;
    clearLeg: boolean;
    resolved: boolean;
  }
  let pendingRecovery: PendingRecovery | null = null;
  const queue: ObservabilityEvent[] = [];

  function readStoredBreadcrumb(): Breadcrumb | null {
    let raw: string | null = null;
    try {
      raw = storage?.getItem(BREADCRUMB_KEY) ?? null;
    } catch {
      // A throwing read is the storageOk probe failing (Slice 1).
      storageOk = false;
      return null;
    }
    if (!raw) return null;
    try {
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
      storageOk = false;
    }
  }

  /**
   * §4.2 (#335): apply a map-mode switch — update the module stamp AND
   * persist the as-run mode onto the live breadcrumb, so the next
   * boot's suspected_crash reports THIS session's mode, not the
   * detecting boot's default. Registered as the module choke point's
   * sink so every existing setReportMapMode() call site (all seven in
   * GameApp) gains persistence with no GameApp change.
   */
  function applyReportMapMode(mode: "full" | "scout"): void {
    reportMapMode = mode === "scout" ? "scout" : "full";
    try {
      if (breadcrumb && breadcrumb.mapMode !== reportMapMode) {
        breadcrumb.mapMode = reportMapMode;
        persist();
      }
    } catch {
      // Trail bookkeeping never breaks gameplay.
    }
  }
  liveMapModeSink = (mode) => {
    try {
      if (breadcrumb && breadcrumb.mapMode !== mode) {
        breadcrumb.mapMode = mode;
        persist();
      }
    } catch {
      // Trail bookkeeping never breaks gameplay.
    }
  };

  /**
   * §4.3: read the durable boot-health counter. A malformed record
   * reads as a zero streak; a throwing store reads as zero AND flips
   * storageOk (the blindness is reported, never hidden). This counter
   * NEVER touches #331's meridian:map-crash marker — different key,
   * different shape, different consumer; Scout qualification never
   * reads it (a telemetry counter must not become a gameplay input).
   */
  function readBootHealth(): { unfinished: number; lastUnfinishedAt: number } {
    try {
      const raw = durableStorage?.getItem(BOOT_HEALTH_KEY) ?? null;
      if (!raw) return { unfinished: 0, lastUnfinishedAt: 0 };
      const p = JSON.parse(raw) as { v?: unknown; unfinished?: unknown; lastUnfinishedAt?: unknown };
      if (!p || p.v !== 1) return { unfinished: 0, lastUnfinishedAt: 0 };
      return {
        unfinished:
          typeof p.unfinished === "number" && Number.isFinite(p.unfinished)
            ? Math.max(0, Math.floor(p.unfinished))
            : 0,
        lastUnfinishedAt:
          typeof p.lastUnfinishedAt === "number" && Number.isFinite(p.lastUnfinishedAt)
            ? p.lastUnfinishedAt
            : 0,
      };
    } catch {
      storageOk = false;
      return { unfinished: 0, lastUnfinishedAt: 0 };
    }
  }

  /** §4.3: write the durable boot-health counter (init() only). */
  function writeBootHealth(v: { unfinished: number; lastUnfinishedAt: number }): void {
    try {
      durableStorage?.setItem(
        BOOT_HEALTH_KEY,
        JSON.stringify({ v: 1, unfinished: v.unfinished, lastUnfinishedAt: v.lastUnfinishedAt }),
      );
    } catch {
      storageOk = false;
    }
  }

  /** Slice 2: best-effort marker deletion (init claim + resolve). */
  function deleteRecoveryMarker(): void {
    try {
      storage?.removeItem(CHUNK_RECOVERY_KEY);
    } catch {
      storageOk = false;
    }
  }

  /**
   * Slice 2: build + emit one recovery_outcome event. Built from the
   * CURRENT breadcrumb (as every existing emit site does) and carrying
   * buildId = the marker's failing-session build — the event is
   * attributed to the session it is about (the suspected_crash
   * precedent). Callers pass the running build only for
   * marker_unreadable, where no trustworthy marker build exists.
   */
  function emitRecoveryOutcome(
    recoveryOutcome: string,
    eventBuildId: string,
    ctx?: {
      sessionId?: string;
      edition?: string;
      regionId?: string;
      chunkId?: string;
      lastMilestone?: string;
      /** §4.1/§4.2: init-time calls pass the crashed session's facts. */
      device?: DeviceInfo;
      deviceSource?: string;
      mapMode?: "full" | "scout" | "unknown";
    },
  ): void {
    emit({
      type: "recovery_outcome",
      ts: now(),
      buildId: eventBuildId,
      recoveryOutcome,
      sessionId: ctx?.sessionId ?? breadcrumb?.sessionId,
      lastMilestone: ctx?.lastMilestone ?? breadcrumb?.lastMilestone,
      edition: ctx?.edition ?? breadcrumb?.edition,
      regionId: ctx?.regionId ?? breadcrumb?.regionId,
      chunkId: ctx?.chunkId ?? breadcrumb?.chunkId,
      ...(ctx?.device ? { device: ctx.device } : {}),
      ...(ctx?.deviceSource ? { deviceSource: ctx.deviceSource } : {}),
      ...(ctx?.mapMode ? { mapMode: ctx.mapMode } : {}),
    });
  }

  /**
   * Slice 2: resolve the held attempt exactly once — delete the
   * marker, set resolved, then emit (delete-before-emit: a lost queue
   * can lose an outcome, it can never double-report one).
   */
  function resolveRecovery(recoveryOutcome: string): void {
    if (!pendingRecovery || pendingRecovery.resolved) return;
    const eventBuild = pendingRecovery.build;
    pendingRecovery.resolved = true;
    deleteRecoveryMarker();
    emitRecoveryOutcome(recoveryOutcome, eventBuild);
  }

  /**
   * Slice 2: the confirmation AND-gate. Confirmation emits at whichever
   * leg lands second: game_loaded (latched in recordMilestone) AND the
   * failure-free clear leg (episode_cleared from chunk-recovery).
   */
  function maybeResolveConfirmed(): void {
    if (!pendingRecovery || pendingRecovery.resolved) return;
    if (pendingRecovery.gameLoaded && pendingRecovery.clearLeg) {
      resolveRecovery("confirmed");
    }
  }

  function noteRecoverySignal(signal: RecoverySignal, facts?: RecoverySignalFacts): void {
    try {
      if (signal === "episode_cleared") {
        if (!pendingRecovery || pendingRecovery.resolved) return;
        pendingRecovery.clearLeg = true;
        maybeResolveConfirmed();
        return;
      }
      if (signal === "repeat_failure") {
        if (!pendingRecovery || pendingRecovery.resolved) return;
        // Replaces any held legs — a recurrence before confirmation
        // flips the outcome (Manifest A2(iii)).
        resolveRecovery("repeat_failure");
        return;
      }
      if (signal === "stood_down") {
        if (pendingRecovery) {
          if (pendingRecovery.resolved) return;
          resolveRecovery("stood_down");
          return;
        }
        // No held attempt: the chunk side's own stand-down record —
        // emitted standalone with the FAILING session's build.
        emitRecoveryOutcome("stood_down", facts?.build || buildId);
      }
    } catch {
      // Outcome reporting must never break gameplay.
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
      const isFunnel = FUNNEL_TYPES.has(event.type);
      const isStamped = STAMPED_TYPES.has(event.type);
      const enriched: ObservabilityEvent = {
        ...event,
        ts: typeof event.ts === "number" ? event.ts : now(),
        buildId: event.buildId || buildId,
        sessionId: event.sessionId ?? breadcrumb?.sessionId,
        // Two-level device (§1.1 [GRAFT]): funnel types stamp the
        // LEGACY coarse device only (engagement telemetry — its device
        // surface does not grow); every other type stamps the full
        // parsed runtimeFacts(). An explicitly supplied device (the
        // crashed session's persisted snapshot on suspected_crash)
        // always wins over both levels.
        device: event.device ?? (isFunnel ? legacyCoarseFacts() : runtimeFacts()),
        // PBI-8: every event (including crash reports) carries the game
        // map mode — the Scout adoption / crash-delta signal. An
        // explicit value (incl. "unknown" on crashed-session reports,
        // §4.2) is never overwritten by the detecting boot's default.
        mapMode: event.mapMode ?? reportMapMode,
        // Slice 1 evidence stamps, at this single choke point so every
        // event carries them (design §4 A1): whether this session's
        // storage has worked so far, and the classifier logic version.
        storageOk,
        lcV: CLASSIFIER_VERSION,
        // §1.1: the new top-level stamps ride crash-class events only.
        // deviceSource [GRAFT]: "live" unless the constructor stamped
        // the crashed session / detecting boot provenance (§4.1).
        // msSinceBootStart (§1.2 row 14): live events derive it from
        // the live trail at this choke point. unfinishedBoots (§4.3):
        // the current streak, stamped without incrementing.
        ...(isStamped
          ? {
              deviceSource:
                typeof event.deviceSource === "string" ? event.deviceSource : "live",
              msSinceBootStart:
                event.msSinceBootStart !== undefined
                  ? event.msSinceBootStart
                  : breadcrumb
                    ? Math.max(0, now() - breadcrumb.startedAt)
                    : "unknown",
              unfinishedBoots:
                typeof event.unfinishedBoots === "number"
                  ? event.unfinishedBoots
                  : unfinishedBoots,
            }
          : {}),
      };
      // Slice 2 afterRecovery choke point (Manifest A1): while a
      // claimed outcome is pending and unresolved, captured-error
      // events gain afterRecovery: true (present only when true, never
      // stamped false). Evidence-neutral: NOT a classifier input in
      // either mirror, and it never alters the paired report's own
      // classification. (The one suspected_crash case — the same-init
      // leftover link — is stamped explicitly in init(), not here:
      // suspected_crash is not a captured-error type.)
      if (
        enriched.afterRecovery === undefined &&
        pendingRecovery &&
        !pendingRecovery.resolved &&
        CAPTURED_ERROR_TYPES.has(enriched.type)
      ) {
        enriched.afterRecovery = true;
      }
      // Slice 1: the provisional verdict for crash-class events. The
      // receiver re-derives it from these same stamped facts and renders
      // its own derivation — this stamp is a cross-check, never the
      // rendered text (design §2.5). Hiccup/funnel events carry none.
      if (enriched.verdict === undefined && CRASH_CLASS_TYPES.has(enriched.type)) {
        const derived = classifyCrashVerdict({
          type: enriched.type,
          error: enriched.error,
          lastMilestone: enriched.lastMilestone,
          bgTerminal: typeof enriched.bgTerminal === "boolean" ? enriched.bgTerminal : undefined,
          buildReplaced: typeof enriched.buildReplaced === "boolean" ? enriched.buildReplaced : undefined,
          trailStuck: typeof enriched.trailStuck === "boolean" ? enriched.trailStuck : undefined,
          lcV: CLASSIFIER_VERSION,
        });
        enriched.verdict = derived.verdict;
        enriched.whyKey = derived.whyKey;
      }
      // Slice 2: the provisional verdict for recovery_outcome events,
      // stamped through the same classifier (NOT via CRASH_CLASS_TYPES
      // — Manifest A10). The receiver re-derives it authoritatively.
      if (enriched.verdict === undefined && enriched.type === "recovery_outcome") {
        const derived = classifyCrashVerdict({
          type: enriched.type,
          recoveryOutcome:
            typeof enriched.recoveryOutcome === "string" ? enriched.recoveryOutcome : undefined,
          lcV: CLASSIFIER_VERSION,
        });
        enriched.verdict = derived.verdict;
        enriched.whyKey = derived.whyKey;
      }
      if (!endpoint) {
        queue.push(enriched);
        // Bounded queue with suspected_crash protection (D3): evict the
        // oldest NON-suspected_crash event first — a boot-time burst of
        // live error events must not silently evict the queued crash
        // report. Only a queue made up entirely of suspected_crash
        // events may drop its oldest one. The MAX_QUEUE memory bound
        // still holds either way.
        while (queue.length > MAX_QUEUE) {
          // Slice 2: recovery_outcome is protected like suspected_crash
          // (Manifest, Architect miss #3) — evict the oldest event that
          // is neither, first.
          const evictIdx = queue.findIndex(
            (ev) => ev.type !== "suspected_crash" && ev.type !== "recovery_outcome",
          );
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
          // §4.1: the parsed snapshot replaces the raw-UA device slot.
          runtime: runtimeFacts(),
          // §2.2: classifier state starts false; the visibility
          // listener updates it at each transition from here on.
          bgTerminal: false,
          trailStuck: false,
          vis: true,
        };
      }
      const at = now();
      breadcrumb.lastMilestone = name;
      breadcrumb.history = [...breadcrumb.history, { name, at }].slice(-MAX_HISTORY);
      // §4.2 pin: at map_init_start, a mode resolved before the trail
      // existed (so no setReportMapMode call could persist it) lands
      // on the trail if mapMode is still unset.
      if (name === "map_init_start" && breadcrumb.mapMode === undefined) {
        breadcrumb.mapMode = reportMapMode;
      }
      if (context?.edition) breadcrumb.edition = context.edition;
      if (context?.regionId) breadcrumb.regionId = context.regionId;
      if (context?.chunkId) breadcrumb.chunkId = context.chunkId;
      persist();
      // Slice 2: the game_loaded confirmation leg is LATCHED here,
      // inside the closure, when the milestone records while an
      // outcome is pending (Manifest A14) — never re-derived later
      // from the capped trail history.
      if (name === "game_loaded" && pendingRecovery && !pendingRecovery.resolved) {
        pendingRecovery.gameLoaded = true;
        maybeResolveConfirmed();
      }
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
      // §4.3 durable unfinished-boot counter — init() is the sole
      // reader/writer, through the durableStorage dep (#331's seam).
      // Increment when this boot found the previous session unfinished;
      // reset only on a POSITIVELY clean previous trail [GRAFT — C
      // §5.5]: no prev trail does NOT reset, because a missing trail
      // also means storage was blocked or cleared, which is not
      // evidence a crash loop ended.
      try {
        const storedHealth = readBootHealth();
        if (unclean && prev) {
          unfinishedBoots = Math.min(99, storedHealth.unfinished + 1);
          writeBootHealth({ unfinished: unfinishedBoots, lastUnfinishedAt: now() });
        } else if (!unclean && prev && storedHealth.unfinished > 0) {
          unfinishedBoots = 0;
          writeBootHealth({ unfinished: 0, lastUnfinishedAt: storedHealth.lastUnfinishedAt });
        } else {
          unfinishedBoots = storedHealth.unfinished;
        }
      } catch {
        unfinishedBoots = 0;
      }
      // Slice 2: recovery-marker handling — after the `unclean`
      // computation, before the suspected_crash construction, on this
      // module's own storage handle, in the Consensus Manifest's exact
      // order. Init-time outcome events carry the previous trail's
      // context (the current breadcrumb does not exist yet).
      let suspectedAfterRecovery = false;
      try {
        const prevCtx: {
          sessionId?: string;
          edition?: string;
          regionId?: string;
          chunkId?: string;
          lastMilestone?: string;
          device?: DeviceInfo;
          deviceSource?: string;
          mapMode?: "full" | "scout" | "unknown";
        } = {
          sessionId: prev?.sessionId,
          edition: prev?.edition,
          regionId: prev?.regionId,
          chunkId: prev?.chunkId,
          lastMilestone: prev?.lastMilestone,
          // §4.1/§4.2: init-time outcomes carry the crashed session's
          // persisted snapshot + as-run mode when they exist, else the
          // detecting boot's fresh facts — labelled either way via
          // deviceSource [GRAFT], never silently conflated.
          device: prev?.runtime ?? runtimeFacts(),
          deviceSource: prev?.runtime ? "crashed_session" : "detecting_boot",
          mapMode: prev?.mapMode ?? "unknown",
        };
        let rawMarker: string | null = null;
        try {
          rawMarker = storage?.getItem(CHUNK_RECOVERY_KEY) ?? null;
        } catch {
          storageOk = false;
          rawMarker = null;
        }
        const parsedMarker = parseRecoveryMarker(rawMarker);
        if (parsedMarker?.kind === "terminal") {
          // (1) Already reported by the chunk side — delete silently,
          // never claim.
          deleteRecoveryMarker();
        } else if (parsedMarker?.kind === "invalid-version") {
          // (2a) Parseable with a numeric v !== 1 — always unreadable.
          deleteRecoveryMarker();
          emitRecoveryOutcome("marker_unreadable", buildId, prevCtx);
        } else if (parsedMarker?.kind === "invalid") {
          // (2b) Unparseable / predicate-failing: unreadable only when
          // a fresh reload stamp corroborates that a recovery attempt
          // really happened; otherwise delete silently.
          let corroborated = false;
          try {
            const rawStamp = storage?.getItem(CHUNK_RELOAD_KEY) ?? null;
            const stamp = rawStamp === null || rawStamp === undefined ? NaN : Number(rawStamp);
            corroborated =
              Number.isFinite(stamp) &&
              now() - stamp <= RELOAD_STAMP_CORROBORATION_MAX_AGE_MS;
          } catch {
            storageOk = false;
          }
          deleteRecoveryMarker();
          if (corroborated) emitRecoveryOutcome("marker_unreadable", buildId, prevCtx);
        } else if (parsedMarker?.kind === "valid") {
          const marker = parsedMarker.marker;
          if (now() - marker.at > RECOVERY_MARKER_MAX_AGE_MS) {
            // (3) Expired beats claimed; NO afterRecovery linkage.
            deleteRecoveryMarker();
            emitRecoveryOutcome("unconfirmed_expired", marker.build, prevCtx);
          } else if (marker.claimed === true) {
            // (4) Leftover from a session that never resolved it.
            // Delete BEFORE queueing the emit (at-most-once).
            deleteRecoveryMarker();
            if (unclean) {
              suspectedAfterRecovery = true;
              emitRecoveryOutcome("unconfirmed_died", marker.build, prevCtx);
            } else {
              emitRecoveryOutcome("unconfirmed_closed", marker.build, prevCtx);
            }
          } else {
            // (5) Claim: rewrite the parsed object spread plus
            // claimed: true (never reconstruct, never refresh `at`),
            // and hold pending state only on a verified read-back.
            let claimed = false;
            try {
              storage?.setItem(
                CHUNK_RECOVERY_KEY,
                JSON.stringify({ ...marker, claimed: true }),
              );
              const back = storage?.getItem(CHUNK_RECOVERY_KEY) ?? null;
              const reparsed = parseRecoveryMarker(back);
              claimed = reparsed?.kind === "valid" && reparsed.marker.claimed === true;
            } catch {
              storageOk = false;
              claimed = false;
            }
            if (claimed) {
              pendingRecovery = {
                build: marker.build,
                at: marker.at,
                gameLoaded: false,
                clearLeg: false,
                resolved: false,
              };
            }
          }
        }
      } catch {
        // Marker handling must never block boot.
      }
      // PBI-6: map-attributed crash detection — the previous page was
      // killed AND its trail ends at a map-mounted milestone. This is the
      // signal behind the Scout Map boot offer (offer, not force).
      const sessionMapCrash =
        unclean && !!prev && MAP_ATTRIBUTED_MILESTONES.has(prev.lastMilestone);
      // Issue #330: make that signal durable. A session-detected crash
      // also stamps the localStorage marker; later boots whose session
      // trail is gone (tab discarded, fresh visit) still read the crash
      // from the marker inside its 7-day decay window. The marker is
      // written ONLY on a session detection — never refreshed by a
      // marker-only read, or weekly boots would slide the decay forever.
      // This changes only the wasMapAttributedCrash() input's lifetime;
      // the suspected_crash emit below still requires the session trail.
      let durableMapCrash = false;
      try {
        durableMapCrash = hasDurableMapCrashMarker(durableStorage, now());
      } catch {
        durableMapCrash = false;
      }
      if (sessionMapCrash) {
        try {
          writeDurableMapCrashMarker(durableStorage, now());
        } catch {
          // Best-effort: the session signal already drives this boot.
        }
      }
      mapAttributedCrash = sessionMapCrash || durableMapCrash;
      if (unclean && prev) {
        // §4.1: the nested breadcrumb now carries the crashed session's
        // parsed runtime snapshot (parsed-only — it may leave the
        // device) instead of the old device slot. The delete is kept as
        // belt-and-braces for legacy trails: a stored device.ua must
        // never leave the phone, and the tainted stored copy is rotated
        // below regardless, so it never persists past this boot.
        const prevCopy: Breadcrumb = { ...prev };
        delete prevCopy.device;
        // §2.2 evidence stamps, stamped HERE from the stored trail —
        // the only moment the full, untrimmed history is in hand.
        // Precedence for bgTerminal is pinned and must never silently
        // invert: persisted state field → history scan → vis-gated
        // false. The final false fires only for a marker-carrying
        // trail (provably tracked its whole life, so silent history
        // means never-backgrounded); a marker-less legacy trail with
        // silent history keeps the stamp OMITTED and the classifier
        // fails closed on it [GRAFT — A §2.3].
        const scannedBg = terminalBackgrounded(prev);
        const bgTerminal: boolean | undefined =
          typeof prev.bgTerminal === "boolean"
            ? prev.bgTerminal
            : scannedBg !== undefined
              ? scannedBg
              : prev.vis === true
                ? false
                : undefined;
        const trailStuck =
          typeof prev.trailStuck === "boolean" ? prev.trailStuck : trailWasStuck(prev);
        // §1.2 row 14, from the crashed trail itself: its last history
        // entry's timestamp minus its start. No usable history stamps
        // "unknown" — never a number invented from the detecting boot.
        const lastEntry =
          Array.isArray(prev.history) && prev.history.length
            ? prev.history[prev.history.length - 1]
            : undefined;
        const msSinceBootStart: number | "unknown" =
          lastEntry &&
          typeof lastEntry.at === "number" &&
          typeof prev.startedAt === "number" &&
          lastEntry.at >= prev.startedAt
            ? lastEntry.at - prev.startedAt
            : "unknown";
        const event: ObservabilityEvent = {
          type: "suspected_crash",
          ts: now(),
          buildId: prev.buildId || buildId,
          sessionId: prev.sessionId,
          edition: prev.edition,
          regionId: prev.regionId,
          chunkId: prev.chunkId,
          lastMilestone: prev.lastMilestone,
          // §4.1: the CRASHED session's facts — its persisted snapshot,
          // or (legacy trail, no snapshot) the detecting boot's fresh
          // facts, labelled by deviceSource [GRAFT] either way. Today
          // this stamps the detecting boot's facts unlabelled, which
          // misattributes the crash whenever the two sessions differ.
          device: prev.runtime ?? runtimeFacts(),
          deviceSource: prev.runtime ? "crashed_session" : "detecting_boot",
          // §4.2: explicit, including "unknown" — emit()'s
          // `?? reportMapMode` must never overwrite it with the
          // detecting boot's module default. This is the #335 fix.
          mapMode: prev.mapMode ?? "unknown",
          msSinceBootStart,
          // §4.3: the post-increment streak — the crashed session is
          // included in its own count.
          unfinishedBoots,
          breadcrumb: prevCopy,
          ...(bgTerminal !== undefined ? { bgTerminal } : {}),
          buildReplaced: (prev.buildId || buildId) !== buildId,
          trailStuck,
          // Slice 2: the one suspected_crash afterRecovery case — the
          // same-init leftover link (a claimed marker resolved as
          // unconfirmed_died directly above, §3.3.4).
          ...(suspectedAfterRecovery ? { afterRecovery: true } : {}),
        };
        try {
          storage?.removeItem(BREADCRUMB_KEY);
        } catch {
          // Even if removal fails, the in-memory trail below is fresh;
          // a stale stored copy could re-fire — storage failure is the
          // documented best-effort limit of exactly-once.
          storageOk = false;
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
      // §4.1: this session's parsed snapshot, taken once at creation.
      // The raw-UA device slot is gone from the trail (§4.1).
      runtime: runtimeFacts(),
      // §2.2: state stamps start false; the listener installed below
      // (same init) updates them at every transition from here on.
      bgTerminal: false,
      trailStuck: false,
      // [GRAFT] This build installs visibility tracking in this same
      // init() — the marker is what licenses the vis-gated false in
      // the next boot's bgTerminal precedence.
      vis: true,
    };
    persist();
    installVisibilityTracking();
  }

  /**
   * Crash-classification (2026-10-12): record visibility transitions on the
   * breadcrumb trail. A tab Android kills while backgrounded leaves
   * lastMilestone "backgrounded" — distinguishable from a genuine
   * foreground kill. Installed once; total (never throws into boot).
   */
  function installVisibilityTracking(): void {
    if (visibilityTracked) return;
    visibilityTracked = true;
    try {
      const doc =
        deps.document !== undefined
          ? deps.document
          : typeof document !== "undefined"
            ? document
            : null;
      if (!doc || typeof doc.addEventListener !== "function") return;
      doc.addEventListener("visibilitychange", () => {
        try {
          const hidden = doc.visibilityState === "hidden";
          // §2.2: this listener is the single writer of the persisted
          // classifier STATE. bgTerminal is the trail's CURRENT
          // terminal state, set at the transition; trailStuck is
          // evaluated at backgrounding time, while its input (the last
          // non-visibility milestone) is complete — later, the
          // MAX_HISTORY cap could evict it and the derivation would
          // lie. recordMilestone()'s persist() right below carries
          // both fields out with the milestone, same write.
          if (breadcrumb) {
            if (hidden) {
              let lastNonVis: string | undefined;
              const hist = Array.isArray(breadcrumb.history) ? breadcrumb.history : [];
              for (let i = hist.length - 1; i >= 0; i--) {
                const n = hist[i]?.name;
                if (n === "backgrounded" || n === "foregrounded") continue;
                lastNonVis = n;
                break;
              }
              if (lastNonVis === undefined) lastNonVis = breadcrumb.lastMilestone;
              breadcrumb.trailStuck =
                lastNonVis !== undefined && START_MILESTONES.has(lastNonVis);
              breadcrumb.bgTerminal = true;
            } else {
              breadcrumb.bgTerminal = false;
              breadcrumb.trailStuck = false;
            }
          }
          recordMilestone(hidden ? "backgrounded" : "foregrounded");
        } catch {
          // Trail bookkeeping never breaks gameplay.
        }
      });
    } catch {
      // Visibility tracking is best-effort.
    }
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

  function setTileErrorCount(count: number): void {
    try {
      if (!breadcrumb) return;
      const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      if (breadcrumb.tileErrors === n) return;
      breadcrumb.tileErrors = n;
      persist();
    } catch {
      // Trail bookkeeping never breaks gameplay.
    }
  }

  function installGlobalHandlers(target?: Window): void {
    if (handlersInstalled) return;
    handlersInstalled = true;
    try {
      const w = target ?? (typeof window !== "undefined" ? window : undefined);
      if (!w || typeof w.addEventListener !== "function") return;
      w.addEventListener("error", (e: ErrorEvent) => {
        const sanitized = sanitizeError(e?.error ?? e?.message ?? "unknown error");
        if (isBenignBrowserNoise(sanitized.message)) {
          // Known-benign browser housekeeping: keep it out of the crash
          // pipeline entirely. Deliberately no breadcrumb touch —
          // lastMilestone must keep describing game progress, not noise.
          return;
        }
        emit({ type: "js_error", ts: now(), buildId, error: sanitized, lastMilestone: breadcrumb?.lastMilestone });
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
    wasMapAttributedCrash: () => mapAttributedCrash,
    setTileErrorCount,
    setReportMapMode: applyReportMapMode,
    noteRecoverySignal,
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

/** Slice 2: GameApp's wiring target for chunk-recovery signals. */
export function noteRecoverySignal(signal: RecoverySignal, facts?: RecoverySignalFacts): void {
  try {
    getObservability().noteRecoverySignal(signal, facts);
  } catch {
    // Never break gameplay.
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

/** PBI-6: did the previous page die with the map mounted? Never throws. */
export function wasMapAttributedCrash(): boolean {
  try {
    return getObservability().wasMapAttributedCrash();
  } catch {
    return false;
  }
}

/** PBI-8: record the current map mount's tile-failure count. Never throws. */
export function recordTileErrors(count: number): void {
  try {
    getObservability().setTileErrorCount(count);
  } catch {
    // ignore
  }
}
