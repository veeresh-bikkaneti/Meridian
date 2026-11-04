/**
 * Telemetry field manifest — the client-side source of truth for the
 * fixed, coarse field set crash telemetry may carry (DESIGN-FINAL §8.1).
 *
 * Every field in §1.2 of the design has exactly one row here. The shape
 * of `runtimeFacts()` (src/lib/observability.ts) and its presence test
 * are driven by this list: a manifest device key that `runtimeFacts()`
 * does not stamp fails the suite. The worker carries the mirror
 * allowlist (`DEVICE_FIELD_ALLOWLIST` in
 * workers/crash-report/src/index.ts); the parity guard
 * (scripts/observability-field-parity.test.mjs) extracts
 * `DEVICE_FIELD_KEYS` below and the worker list and fails until they
 * agree. Adding a field = one manifest row + one allowlist row + one
 * corpus/fixture row + (for a device field) one entry in the literal
 * `DEVICE_FIELD_KEYS` array below.
 *
 * `provenance` vocabulary (design §1.2): parsed = deterministic
 * extraction from the UA string; read = direct synchronous API read;
 * inferred = rule-based inference with an "unknown" escape; heuristic =
 * multi-signal guess, never presented as fact; state = persisted
 * session state; derived = computed from other stamped facts.
 *
 * `amendment` is null for every field except the two admitted under
 * the §6.3 COPPA safeguard amendment (design §6.4: flipping
 * COLLECT_MEMORY_CORES in observability.ts to false stamps both
 * "unknown" and changes no wire shape).
 */

export interface TelemetryField {
  key: string;
  /** Where the field rides: inside the `device` object, or top-level. */
  wire: "device" | "top-level";
  type: string;
  provenance: "parsed" | "read" | "inferred" | "heuristic" | "state" | "derived";
  amendment: "coppa-2026-amendment" | null;
}

export const TELEMETRY_MANIFEST: readonly TelemetryField[] = [
  // --- device fields (§1.2 rows 1-11, 16-19, 20) ---
  { key: "browser", wire: "device", type: "safari|chrome|edge|firefox|samsung|unknown", provenance: "parsed", amendment: null },
  { key: "browserVersion", wire: "device", type: "string <major>.<minor>|unknown (Chromium minor is frozen, never triaged on)", provenance: "parsed", amendment: null },
  { key: "engine", wire: "device", type: "webkit|blink|gecko|unknown", provenance: "inferred", amendment: null },
  { key: "os", wire: "device", type: "ios|android|windows|mac|linux|other", provenance: "parsed", amendment: null },
  { key: "osVersion", wire: "device", type: "string dotted|10.0 (Windows bucket)|unknown (frozen tokens denied, §2.3)", provenance: "parsed", amendment: null },
  { key: "deviceClass", wire: "device", type: "phone|tablet|desktop|unknown (class only, never a model)", provenance: "heuristic", amendment: null },
  { key: "hardwareConcurrency", wire: "device", type: "integer 1..64|unknown (as read; WebKit clamps it — compare only within one engine, §2.4)", provenance: "read", amendment: "coppa-2026-amendment" },
  { key: "deviceMemory", wire: "device", type: "number (GB, as read)|unknown (unknown on WebKit IS the jetsam-population signal)", provenance: "read", amendment: "coppa-2026-amendment" },
  { key: "screen", wire: "device", type: "sm|md|lg|xl|unknown (short-side bucket, never exact pixels)", provenance: "read", amendment: null },
  { key: "dpr", wire: "device", type: "integer 1..4|unknown (rounded bucket)", provenance: "read", amendment: null },
  { key: "touchPoints", wire: "device", type: "0|1|2-5|6+|unknown (bucketed maxTouchPoints)", provenance: "read", amendment: null },
  { key: "displayMode", wire: "device", type: "standalone|browser|unknown (browser only where display-mode support is established, §2.5)", provenance: "read", amendment: null },
  { key: "connection", wire: "device", type: "slow-2g|2g|3g|4g|unknown (effectiveType, validated)", provenance: "read", amendment: null },
  { key: "locale", wire: "device", type: "string <=12 chars (primary BCP-47 tag, navigator.language only)|unknown", provenance: "read", amendment: null },
  { key: "form", wire: "device", type: "mobile|desktop (derived from deviceClass, legacy vocabulary)", provenance: "derived", amendment: null },
  { key: "webgl1", wire: "device", type: "boolean (watchdog path only)", provenance: "read", amendment: null },
  { key: "webgl2", wire: "device", type: "boolean (watchdog path only)", provenance: "read", amendment: null },
  // --- top-level fields (§1.2 rows 12-15, 21) ---
  { key: "mapMode", wire: "top-level", type: "full|scout|unknown (crashed session's persisted as-run mode)", provenance: "state", amendment: null },
  { key: "lastMilestone", wire: "top-level", type: "string (funnel position)", provenance: "state", amendment: null },
  { key: "msSinceBootStart", wire: "top-level", type: "non-negative integer ms|unknown", provenance: "derived", amendment: null },
  { key: "unfinishedBoots", wire: "top-level", type: "integer 0..99 (durable streak counter, §4.3)", provenance: "state", amendment: null },
  { key: "deviceSource", wire: "top-level", type: "crashed_session|detecting_boot|live", provenance: "state", amendment: null },
] as const;

/**
 * The device-object keys, sorted — the exact list the worker's
 * DEVICE_FIELD_ALLOWLIST must mirror. Kept as a literal array (not
 * derived at runtime) so the parity guard can regex-extract it from
 * this file the same way it extracts the worker's list. The manifest
 * test asserts this list equals the manifest's device rows, so the
 * two can never drift apart silently.
 */
export const DEVICE_FIELD_KEYS: readonly string[] = [
  "browser",
  "browserVersion",
  "connection",
  "deviceClass",
  "deviceMemory",
  "displayMode",
  "dpr",
  "engine",
  "form",
  "hardwareConcurrency",
  "locale",
  "os",
  "osVersion",
  "screen",
  "touchPoints",
  "webgl1",
  "webgl2",
];
