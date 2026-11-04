/**
 * Pure user-agent parser for crash telemetry (DESIGN-FINAL §3).
 *
 * One parser, two runtimes: this canonical implementation feeds the app
 * (`runtimeFacts()` in observability.ts); the inline watchdog carries
 * an ES5 port of the subset it emits (scripts/crash-watchdog.mjs),
 * written against the same rule IDs. Agreement is pinned by one corpus
 * file, src/lib/ua-corpus.json, consumed by both suites.
 *
 * Honesty rules baked in:
 * - The return value is ALWAYS complete — every field present, no
 *   `undefined` anywhere (§3.2). "unknown" is a value (§2.1).
 * - Frozen UA tokens are never stamped as versions (§2.3 denylist,
 *   applied after extraction, before returning).
 * - No device model is ever extracted: the UA never carries an iPhone
 *   model, and the decaying Android model token (incl. the placeholder
 *   `K`) is never read. `deviceClass` is class only.
 *
 * This module is pure: no globals, no imports. The only non-UA inputs
 * arrive via `ParserHints`.
 */

export interface ParsedUA {
  browser: "safari" | "chrome" | "edge" | "firefox" | "samsung" | "unknown";
  /** "<major>.<minor>" or "unknown". Chromium minor is the frozen 0 (§2.3). */
  browserVersion: string;
  engine: "webkit" | "blink" | "gecko" | "unknown";
  os: "ios" | "android" | "windows" | "mac" | "linux" | "other";
  /** Dotted version, the literal "10.0" Windows bucket, or "unknown". */
  osVersion: string;
  deviceClass: "phone" | "tablet" | "desktop" | "unknown";
}

export interface ParserHints {
  /** Witness for the iPad-as-Mac rule P1; the only size-like input. */
  maxTouchPoints?: number;
  /**
   * Caller-read `typeof navigator.userAgentData !== "undefined"`.
   * Rule E1's tripwire (§3.4): an iOS build exposing Client Hints does
   * NOT get the inferred WebKit stamp, so the day a non-WebKit iOS
   * engine ships, the parser says "unknown" instead of lying.
   */
  hasClientHints?: boolean;
}

/** "<major>[.<minor>...]" → "<major>.<minor>" (minor defaults to 0). */
function majorMinor(v: string): string {
  const parts = v.split(".");
  const major = parts[0] || "0";
  const minor = parts.length > 1 && parts[1] !== "" ? parts[1] : "0";
  return `${major}.${minor}`;
}

/** First two dotted components ("8.1.0" → "8.1", "13" → "13"). */
function majorMinorKept(v: string): string {
  const parts = v.split(".").filter((p) => p !== "");
  if (parts.length === 0) return "unknown";
  return parts.slice(0, 2).join(".");
}

interface BrowserHit {
  browser: ParsedUA["browser"];
  version: string;
}

/** Browser rules B1-B9 (§3.4): first match wins; order is load-bearing. */
function parseBrowser(ua: string): BrowserHit {
  let m: RegExpExecArray | null;
  // B1 — Samsung's shell beats the Chrome token it also carries.
  if ((m = /SamsungBrowser\/([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { browser: "samsung", version: majorMinor(m[1]) };
  }
  // B2 — Edge: desktop (Edg/), Android (EdgA/) and iOS (EdgiOS/)
  // spellings. EdgA/ must be in this alternation: an Edge-on-Android
  // UA otherwise falls through to its Chrome/ token (B6) and stamps
  // the wrong browser.
  if ((m = /(?:EdgA|EdgiOS|Edg)\/([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { browser: "edge", version: majorMinor(m[1]) };
  }
  // B3 — Chrome on iOS.
  if ((m = /CriOS\/([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { browser: "chrome", version: majorMinor(m[1]) };
  }
  // B4 — Firefox on iOS.
  if ((m = /FxiOS\/([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { browser: "firefox", version: majorMinor(m[1]) };
  }
  // B5 — Firefox proper: Mozilla ships major-only; minor is stamped 0.
  if ((m = /Firefox\/([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { browser: "firefox", version: majorMinor(m[1]) };
  }
  // B6 — Chrome: the minor is the frozen 0 (§2.3); majorMinor of a
  // "120.0.0.0" token yields exactly "120.0".
  if ((m = /Chrome\/([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { browser: "chrome", version: majorMinor(m[1]) };
  }
  // B6b — Chromium builds (e.g. Linux distro Chromium) carry a
  // Chromium/ token and no Chrome/ token, plus the Safari/ compat
  // token: without this rule they fall through to B8 and mislabel
  // as safari/webkit. Chromium is the Chrome family: chrome/blink.
  // This rule sits after B6 and before the Safari rules; no other
  // rule order changes.
  if ((m = /Chromium\/([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { browser: "chrome", version: majorMinor(m[1]) };
  }
  // B7 — Safari: the version is the Version/ token, NEVER the Safari/
  // build number.
  if ((m = /Version\/([0-9]+(?:\.[0-9]+)*)/.exec(ua)) && /Safari\//.test(ua)) {
    return { browser: "safari", version: majorMinor(m[1]) };
  }
  // B8 — Safari/ with no Version/: WKWebView / in-app — name only.
  if (/Safari\//.test(ua)) {
    return { browser: "safari", version: "unknown" };
  }
  // B9 — nothing matched.
  return { browser: "unknown", version: "unknown" };
}

interface OsHit {
  os: ParsedUA["os"];
  osVersion: string;
}

/** OS rules O1-O6 (§3.4): first match wins. */
function parseOS(ua: string): OsHit {
  let m: RegExpExecArray | null;
  // O1 — Android (before O5: Android UAs also contain "Linux").
  if ((m = /Android ([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { os: "android", osVersion: majorMinorKept(m[1]) };
  }
  // O2 — iOS: "CPU iPhone OS 16_4_1" or iPad's "CPU OS 16_6".
  if ((m = /(?:CPU iPhone OS|CPU OS) ([0-9]+(?:_[0-9]+)+)/.exec(ua))) {
    return { os: "ios", osVersion: m[1].replace(/_/g, ".") };
  }
  // O3 — Windows: the NT token stamps literally ("10.0" spans 10/11 —
  // a labelled coarse bucket, not a fiction; §2.3).
  if ((m = /Windows NT ([0-9]+(?:\.[0-9]+)*)/.exec(ua))) {
    return { os: "windows", osVersion: m[1] };
  }
  // O4 — Mac: underscores or dots ("10_15_7" Safari, "10.15" Firefox).
  if ((m = /Mac OS X ([0-9]+(?:[._][0-9]+)*)/.exec(ua))) {
    return { os: "mac", osVersion: m[1].replace(/_/g, ".") };
  }
  // O5 — Linux: no version token exists.
  if (/Linux/.test(ua)) {
    return { os: "linux", osVersion: "unknown" };
  }
  // O6 — none.
  return { os: "other", osVersion: "unknown" };
}

/**
 * Frozen-token denylist (§2.3), applied after extraction. A match
 * stamps "unknown" — a frozen token presented as a version would be a
 * fiction, and triage on it would mislead.
 */
function applyDenylist(ua: string, hit: OsHit): string {
  const { os, osVersion } = hit;
  if (os === "mac") {
    // Frozen since ~2017 on every engine. No condition rescues it.
    if (osVersion === "10.15.7" || osVersion === "10.15") return "unknown";
    return osVersion;
  }
  if (os === "android") {
    // Android 10 is the UA-Reduction freeze value. The CONDITION is
    // the tell, not the value: a pre-reduction UA with a real Android
    // 10 and a non-frozen Chrome token still stamps "10".
    // The parser can preserve the minor ("Android 10.0; K" parses to
    // "10.0"), so the comparison treats "10" and "10.0" as the same
    // frozen shape — either one is fiction when a witness is present.
    if (osVersion === "10" || osVersion === "10.0") {
      const chromeFrozen = /Chrome\/[0-9]+\.0\.0\.0/.test(ua);
      const modelPlaceholder = /;\s*K\)/.test(ua);
      const samsungFrozen = /SamsungBrowser\//.test(ua) && chromeFrozen;
      if (chromeFrozen || modelPlaceholder || samsungFrozen) return "unknown";
    }
    return osVersion;
  }
  if (os === "ios") {
    // The iOS token freezes from iOS 26; the freeze ships WITH Safari
    // 26, so a Version/ major >= 26 in the same UA is the honest gate
    // available synchronously. Without the witness (WKWebView), the
    // token stamps as read.
    if (osVersion === "18.6" || osVersion === "18.7") {
      const vm = /Version\/([0-9]+)/.exec(ua);
      if (vm && Number(vm[1]) >= 26) return "unknown";
    }
    return osVersion;
  }
  return osVersion;
}

/** Engine rules E1-E5 (§3.4), evaluated after B and O. */
function parseEngine(
  browser: ParsedUA["browser"],
  os: ParsedUA["os"],
  hints: ParserHints,
): ParsedUA["engine"] {
  // E1 — iOS is WebKit by platform rule today; the Client-Hints
  // tripwire keeps the escape open for a future non-WebKit iOS engine.
  if (os === "ios" && !hints.hasClientHints) return "webkit";
  // E2 — Chromium shells.
  if (browser === "chrome" || browser === "edge" || browser === "samsung") return "blink";
  // E3 — Firefox (E1 did not fire).
  if (browser === "firefox") return "gecko";
  // E4 — Safari off iOS. On iOS the WebKit claim comes from E1 alone:
  // with Client Hints present (the tripwire row) an iOS Safari falls
  // through to E5 "unknown" instead of re-claiming WebKit here.
  if (browser === "safari" && os !== "ios") return "webkit";
  // E5 — otherwise.
  return "unknown";
}

/** Device-class rules P1-P7 (§3.4), evaluated after O. */
function parseDeviceClass(
  ua: string,
  os: ParsedUA["os"],
  hints: ParserHints,
): ParsedUA["deviceClass"] {
  // P1 — iPad-as-Mac witness (heuristic): a "Mac" with multi-touch is
  // an iPad in desktop mode. os/osVersion are NOT rewritten — the
  // event honestly says mac/unknown with class tablet.
  if (os === "mac" && typeof hints.maxTouchPoints === "number" && hints.maxTouchPoints > 1) {
    return "tablet";
  }
  // P2 — iPhone / iPod token.
  if (ua.includes("iPhone") || ua.includes("iPod")) return "phone";
  // P3 — iPad token.
  if (ua.includes("iPad")) return "tablet";
  // P4 — Android with the Mobile token is a phone.
  if (os === "android" && ua.includes("Mobile")) return "phone";
  // P5 — Android without Mobile is a tablet (platform convention).
  if (os === "android") return "tablet";
  // P6 — desktop operating systems.
  if (os === "windows" || os === "mac" || os === "linux") return "desktop";
  // P7 — otherwise.
  return "unknown";
}

/**
 * Parse one UA string into the complete ParsedUA (§3.2). Pure and
 * total: any input, including "", yields all six fields.
 */
export function parseRuntimeUA(ua: string, hints: ParserHints = {}): ParsedUA {
  const raw = typeof ua === "string" ? ua : "";
  const b = parseBrowser(raw);
  const o = parseOS(raw);
  const osVersion = applyDenylist(raw, o);
  return {
    browser: b.browser,
    browserVersion: b.version,
    engine: parseEngine(b.browser, o.os, hints),
    os: o.os,
    osVersion,
    deviceClass: parseDeviceClass(raw, o.os, hints),
  };
}
