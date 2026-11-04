/**
 * Scout Map qualification — pre-mount capability gate (spec §2).
 *
 * Decision order (first hit wins):
 *   1. Manual toggle (localStorage `meridian:map-mode`) — user override always wins.
 *   2. Map-attributed prior-crash flag — a previous session crashed with the map mounted.
 *   3. Boot WebGL probe — offscreen canvas with `failIfMajorPerformanceCaveat`;
 *      failure or a known-weak (software) renderer means scout.
 *   4. Low-memory signal — `navigator.deviceMemory <= 1` always; `<= 2` only
 *      when the WebGL probe did NOT come back clean (see qualifyMapMode).
 *   5. Unknown memory on a coarse-pointer device (issue #330): Safari has
 *      no `navigator.deviceMemory`, so check 4 can never fire there and a
 *      4 GB phone qualified as "strong". When memory is unknown AND the
 *      primary pointer is coarse, the session starts in Scout as a trial
 *      (source "unknown-memory") and may upgrade to full in-session once
 *      the Scout map proves stable — see shouldFireScoutUpgrade. Fine
 *      pointers (desktops) keep the old default.
 *
 * Hard rule: full mode is the default; scout only activates through one of
 * the checks above. A signal that is unavailable is ignored (fail-closed:
 * assume capable) — the one exception is check 5, where the *combination*
 * of unknown memory + a coarse pointer is itself the signal. No UA string
 * is read anywhere in this module.
 *
 * Reset/decay: an auto-assigned mode decays after 7 days — a stale
 * auto-assignment never demotes a capable device twice in a row without a
 * fresh qualifying event. A manual toggle is the user's own choice and never
 * decays.
 *
 * Pure core (`qualifyMapMode`) is DOM-free and node-testable; the effectful
 * wrappers (`resolveMapMode`, storage helpers, probe, memory reader) are
 * guarded for SSR / no-window environments and never throw.
 */

export type MapMode = "full" | "scout";

/** Single map-attributed storage key — never shared with other features. */
export const MAP_MODE_STORAGE_KEY = "meridian:map-mode";

/** Auto-assigned modes older than this decay back to unassigned. */
export const MAP_MODE_DECAY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * deviceMemory at or below this (GB) qualifies as low-memory — but only as
 * a TIEBREAKER when the WebGL probe is not a clean pass (see below).
 */
export const LOW_MEMORY_GB = 2;

/**
 * deviceMemory at or below this (GB) demotes to Scout on its own, even with
 * a clean probe: 1 GB-class phones genuinely cannot hold the satellite map.
 */
export const VERY_LOW_MEMORY_GB = 1;

export type MapModeSource =
  | "manual"
  | "prior-crash"
  | "probe"
  | "low-memory"
  | "unknown-memory"
  | "contextlost"
  | "default";

export interface StoredMapMode {
  mode: MapMode;
  /**
   * The qualifying event that produced this assignment (Q2): a stale
   * record can never re-trigger scout on its own — after decay the record
   * reads as absent and re-demotion requires a FRESH qualifying event
   * (fresh probe/memory/crash signal at boot). Manual assignments never
   * decay (the user's own choice).
   */
  source: MapModeSource;
  /** Epoch ms when this assignment was written. */
  setAt: number;
  /**
   * True when a person accepted this Scout assignment from the boot choice
   * dialog the app showed before 2026-10-20. The dialog is gone (weak
   * devices now auto-switch silently — see planBootMapMode), so no new
   * record is ever written with this flag; but records already on players'
   * devices carry it, and an accepted choice is the user's own answer, so —
   * like a manual toggle — it never decays. `source` still records the
   * qualifying signal (probe / low-memory) for telemetry. Absent on every
   * auto assignment, which still decays after MAP_MODE_DECAY_MS.
   */
  accepted?: true;
}

export interface MapModeDecision {
  mode: MapMode;
  source: MapModeSource;
}

export interface CapabilitySignals {
  /**
   * The non-decayed stored assignment (a manual toggle, or an auto
   * assignment inside its decay window) — a live assignment stands without
   * re-qualification. The stored source is preserved on the decision so
   * the app layer can tell a user choice from an auto assignment.
   */
  manual?: StoredMapMode | null;
  /** A previous session crashed while the map was mounted (map-attributed). */
  priorMapCrash?: boolean;
  /**
   * Boot WebGL probe result: false = probe failed or weak renderer,
   * true = capable, null/undefined = unavailable (ignored, assume capable).
   */
  webglProbeOk?: boolean | null;
  /**
   * `navigator.deviceMemory` in GB: number = signal, null/undefined =
   * unavailable (ignored, assume capable).
   */
  deviceMemoryGB?: number | null;
  /**
   * True when the primary pointer is coarse (touch). Only consulted by
   * the unknown-memory rule (check 5): unknown memory demotes to a Scout
   * trial on coarse pointers only, so desktops — which also often lack
   * `deviceMemory` (Firefox, Safari) — behave exactly as before.
   */
  coarsePointer?: boolean;
}

/**
 * Pure qualification: returns the mode + which check decided it.
 * Manual toggle wins; an unavailable signal is skipped (fail-closed).
 */
export function qualifyMapMode(signals: CapabilitySignals = {}): MapModeDecision {
  const manual = signals.manual;
  if (manual && (manual.mode === "full" || manual.mode === "scout")) {
    // A live stored assignment stands — manual forever, auto inside its
    // decay window. The stored source is preserved (never rewritten here).
    return {
      mode: manual.mode,
      source: manual.source === "default" ? "manual" : manual.source,
    };
  }
  if (signals.priorMapCrash === true) {
    return { mode: "scout", source: "prior-crash" };
  }
  if (signals.webglProbeOk === false) {
    return { mode: "scout", source: "probe" };
  }
  // Prefer the Full map (review finding P1-7, 2026-10-21). Chrome buckets
  // deviceMemory coarsely (0.25/0.5/1/2/4/8) and reports 2 on plenty of
  // mid-range phones that render the satellite map fine, so "≤ 2 GB" alone
  // demoted capable devices to Scout. Now: a hardware-accelerated probe
  // pass (no major performance caveat, not a software renderer) outranks
  // a 2 GB reading; only ≤ 1 GB demotes regardless. Low-end safety nets
  // are unchanged — prior-crash, a failed probe, and the mid-game
  // webglcontextlost tripwire all still switch to Scout.
  const mem = signals.deviceMemoryGB;
  if (typeof mem === "number" && Number.isFinite(mem)) {
    const probeClean = signals.webglProbeOk === true;
    if (mem <= VERY_LOW_MEMORY_GB || (mem <= LOW_MEMORY_GB && !probeClean)) {
      return { mode: "scout", source: "low-memory" };
    }
  }
  // Issue #330, check 5: memory unknown (Safari has no deviceMemory) on a
  // coarse-pointer device. This is a Scout *trial*, not a weak-device
  // verdict: it sits after prior-crash / probe / low-memory so any real
  // weak signal keeps its own source (and weak devices never upgrade —
  // see shouldFireScoutUpgrade), and it never fires for fine pointers or
  // for devices that reported a memory size.
  const memUnknown = typeof mem !== "number" || !Number.isFinite(mem);
  if (memUnknown && signals.coarsePointer === true) {
    return { mode: "scout", source: "unknown-memory" };
  }
  return { mode: "full", source: "default" };
}

/**
 * Read the stored assignment, applying decay: an auto (non-manual)
 * assignment older than MAP_MODE_DECAY_MS is treated as absent — the device
 * is re-qualified on fresh signals. Manual toggles and accepted offers (a
 * person's own answer) never decay.
 * Returns null when nothing valid is stored. Never throws.
 */
export function readStoredMapMode(
  storage?: Pick<Storage, "getItem"> | null,
  now: number = Date.now(),
): StoredMapMode | null {
  try {
    const store = storage ?? defaultLocalStorage();
    if (!store) return null;
    const raw = store.getItem(MAP_MODE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMapMode>;
    if (parsed.mode !== "full" && parsed.mode !== "scout") return null;
    if (typeof parsed.setAt !== "number" || !Number.isFinite(parsed.setAt)) return null;
    const source: MapModeSource =
      parsed.source === "manual"
        ? "manual"
        : parsed.source === "prior-crash" ||
            parsed.source === "probe" ||
            parsed.source === "low-memory" ||
            parsed.source === "unknown-memory" ||
            parsed.source === "contextlost"
          ? parsed.source
          : "default";
    const accepted = parsed.accepted === true;
    if (source !== "manual" && !accepted && now - parsed.setAt > MAP_MODE_DECAY_MS) return null;
    return accepted
      ? { mode: parsed.mode, source, setAt: parsed.setAt, accepted: true }
      : { mode: parsed.mode, source, setAt: parsed.setAt };
  } catch {
    return null;
  }
}

/**
 * Persist an assignment. Write policy (Q3): call ONLY on a new qualifying
 * event or an explicit state change — manual toggle, the boot auto-switch
 * (a fresh qualification IS the qualifying event, so it writes once per
 * qualifying boot), webglcontextlost switch. NEVER rewrite a standing
 * record just because a boot happened: that would refresh setAt and
 * silently defeat the 7-day decay. resolveMapMode() reads but never writes.
 *
 * New records never carry `accepted: true` — that flag belongs to the
 * removed boot dialog (see StoredMapMode.accepted); the reader still
 * honors it on records written by older builds.
 */
export function writeStoredMapMode(
  mode: MapMode,
  source: Exclude<MapModeSource, "default">,
  storage?: Pick<Storage, "setItem"> | null,
  now: number = Date.now(),
): void {
  try {
    const store = storage ?? defaultLocalStorage();
    if (!store) return;
    store.setItem(
      MAP_MODE_STORAGE_KEY,
      JSON.stringify({ mode, source, setAt: now } satisfies StoredMapMode),
    );
  } catch {
    // Storage blocked/full — the session still qualifies correctly in memory.
  }
}

/** Clear the stored assignment (used by the settings toggle reset). */
export function clearStoredMapMode(storage?: Pick<Storage, "removeItem"> | null): void {
  try {
    const store = storage ?? defaultLocalStorage();
    if (!store) return;
    store.removeItem(MAP_MODE_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

function defaultLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Boot WebGL probe: offscreen canvas with `failIfMajorPerformanceCaveat`.
 * Returns false when the probe fails or reports a known-weak software
 * renderer, true when capable, null when the signal is unavailable
 * (fail-closed: assume capable). No UA string is read; the renderer string
 * is a GPU fact, never transmitted.
 */
export function probeWebGL(): boolean | null {
  try {
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) as
      | WebGLRenderingContext
      | null;
    if (!gl) return false;
    // Issue #330: the probe context is dead weight after this function —
    // release it on every path out so the real map's context is not
    // competing with a retained probe context in the same jetsam budget.
    // Result semantics are unchanged.
    try {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const key = ext?.UNMASKED_RENDERER_WEBGL;
      if (ext && key) {
        const renderer = String(gl.getParameter(key) ?? "").toLowerCase();
        if (
          renderer.includes("swiftshader") ||
          renderer.includes("llvmpipe") ||
          renderer.includes("softpipe") ||
          renderer.includes("software") ||
          renderer.includes("basic render")
        ) {
          return false;
        }
      }
    } catch {
      // Renderer string unavailable — context creation under
      // failIfMajorPerformanceCaveat is itself the capability signal.
    } finally {
      try {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        // Releasing is best-effort; a stuck probe context changes nothing.
      }
    }
    return true;
  } catch {
    return null;
  }
}

/**
 * Coarse low-memory signal from `navigator.deviceMemory` (GB).
 * Returns null when unavailable (fail-closed: assume capable).
 */
export function readDeviceMemoryGB(): number | null {
  try {
    if (typeof navigator === "undefined") return null;
    const mem = (navigator as Navigator & { deviceMemory?: unknown }).deviceMemory;
    return typeof mem === "number" && Number.isFinite(mem) && mem > 0 ? mem : null;
  } catch {
    return null;
  }
}

/**
 * Coarse-pointer signal (the primary pointer is touch). Guarded for
 * SSR / tests. Mirrors `isCoarsePointer` in map-options.ts; it lives
 * here too because map-options imports this module, not the reverse.
 */
export function readCoarsePointer(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Durable map-crash marker (issue #330, fix item 3)
//
// The session-scoped prior-crash signal (sessionStorage breadcrumb +
// clean-exit flag) dies with the tab, so a crash loop could restart from
// a clean slate on a fresh visit. When a boot *detects* a map-attributed
// crash through that session signal, observability also writes this
// timestamped marker to localStorage. Later boots consult it under the
// same 7-day decay as auto map-mode records. It is an auto signal: a
// manual record still outranks it, and it never changes what the
// suspected_crash beacon reports — only how long the demotion input lasts.
// ---------------------------------------------------------------------------

/** localStorage key for the durable map-crash marker. */
export const MAP_CRASH_MARKER_KEY = "meridian:map-crash";

/** Persist the durable marker at `now` (epoch ms). Never throws. */
export function writeDurableMapCrashMarker(
  storage?: Pick<Storage, "setItem"> | null,
  now: number = Date.now(),
): void {
  try {
    const store = storage ?? defaultLocalStorage();
    if (!store) return;
    store.setItem(MAP_CRASH_MARKER_KEY, JSON.stringify({ at: now }));
  } catch {
    // Storage blocked/full — the session signal still works for this tab.
  }
}

/**
 * True when a durable marker exists inside the decay window
 * (MAP_MODE_DECAY_MS). Garbage and stale markers read as absent.
 * Never throws.
 */
export function hasDurableMapCrashMarker(
  storage?: Pick<Storage, "getItem"> | null,
  now: number = Date.now(),
): boolean {
  try {
    const store = storage ?? defaultLocalStorage();
    if (!store) return false;
    const raw = store.getItem(MAP_CRASH_MARKER_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { at?: unknown };
    if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) return false;
    return now - parsed.at <= MAP_MODE_DECAY_MS;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scout → full in-session upgrade (issue #330, fix item 1)
//
// Only a session that started in Scout *solely* because of the
// unknown-memory rule may upgrade. The gate is a pure function so the
// state machine is unit-testable without a map:
//
//   boot (unknown memory + coarse) → Scout, source "unknown-memory",
//   nothing persisted → Scout map reaches map_ready, first idle render
//   completes → soak of SCOUT_UPGRADE_SOAK_MS with no crash → upgrade
//   fires → session-only switch to full, nothing persisted.
//
// If the upgraded full map kills the process, the next boot's
// prior-crash signal (session, or the durable marker above) qualifies
// the device as prior-crash Scout, whose source is not "unknown-memory"
// — so the upgrade never fires again for that crash. Nothing about the
// trial or the upgrade is ever written to the map-mode record, so no
// stored artifact can suppress the prior-crash check on a later boot.
//
// Kill-switch (PR #331 panel cure): the trial is gated by the
// `scoutUpgradeTrial` feature flag (src/lib/flags.ts, baked-in default
// true = armed). GameApp's boot effect awaits the shared flags load and
// only sets upgrade eligibility when the flag is on, so redeploying
// flags.json with the flag false disarms the trial — Scout-first boot
// still happens, the upgrade simply never arms — with no code change.
// ---------------------------------------------------------------------------

/**
 * How long the Scout map must stay stable after its first completed
 * render before the session upgrades to full. 3 s past `map_ready` +
 * first idle: the crash window in #330 is map construction itself
 * (map_init_start → map_ready), so a Scout map that loaded, rendered,
 * and then survived 3 more seconds has cleared the window the trial
 * exists to probe — and 3 s is short enough that a capable phone
 * reaches the full map inside its first game.
 */
export const SCOUT_UPGRADE_SOAK_MS = 3000;

export interface ScoutUpgradeGate {
  /** The boot decision source that put this session in Scout. */
  initialSource: MapModeSource;
  /** A prior map crash is known (session signal or durable marker). */
  priorMapCrash?: boolean;
  /** A live stored record (manual or auto) decided this boot's mode. */
  storedRecordPresent?: boolean;
  /**
   * The `scoutUpgradeTrial` feature flag (src/lib/flags.ts), read by the
   * caller at boot: false = the trial is disarmed by remote config and
   * the upgrade must never fire, however stable Scout proves. Absent =
   * armed — the flag's baked-in default is true, so an omitted value
   * keeps the shipped #331 behavior byte-for-byte.
   */
  trialArmed?: boolean;
  /** Epoch ms when the Scout map finished its first render; null = not yet. */
  scoutReadyAtMs: number | null;
  /** Epoch ms to evaluate at. */
  nowMs: number;
}

/** Pure upgrade gate: true only for the armed unknown-memory trial, post-soak. */
export function shouldFireScoutUpgrade(gate: ScoutUpgradeGate): boolean {
  if (gate.trialArmed === false) return false;
  if (gate.initialSource !== "unknown-memory") return false;
  if (gate.priorMapCrash === true) return false;
  if (gate.storedRecordPresent === true) return false;
  if (gate.scoutReadyAtMs === null) return false;
  return gate.nowMs - gate.scoutReadyAtMs >= SCOUT_UPGRADE_SOAK_MS;
}

export interface ResolveMapModeOptions {
  /** Set by the crash pipeline when a previous session crashed with the map mounted. */
  priorMapCrash?: boolean;
  /** Override for the coarse-pointer signal (tests); defaults to readCoarsePointer(). */
  coarsePointer?: boolean;
}

export interface BootMapModePlan {
  /** The mode the session starts in. */
  mode: MapMode;
  /**
   * The qualifying source to persist as a fresh AUTO record, or null to
   * write nothing. An auto record is nobody's answer, so it decays after
   * MAP_MODE_DECAY_MS and the device is re-qualified on fresh signals —
   * the same persistence semantics the webglcontextlost record has always
   * had. Only a scout decision persists; a full ("default") decision
   * writes nothing. An "unknown-memory" scout decision also writes
   * nothing: it is a trial, not a verdict, and any record written for it
   * could later stand in front of the prior-crash check — if the
   * in-session upgrade to full is what kills the process, the next boot
   * must meet the prior-crash signal with nothing in its way.
   */
  persistSource: "prior-crash" | "probe" | "low-memory" | null;
}

/**
 * Pure boot plan for a fresh qualification (no live stored assignment):
 * the mode the session starts in, and what to persist.
 *
 * Caller contract: only ask when no live stored assignment stands.
 * game-app's boot effect reads the stored record itself — it needs the
 * stored mode either way — and calls this solely from its no-stored
 * branch. That check is the one place the "a stored assignment stands
 * over fresh signals" rule lives; this function takes no stored
 * parameter, so its type can't pretend otherwise (issue #154 item 3 —
 * production always passed null, and the dead branch hid that).
 *
 * Owner ruling (2026-10-20): "Auto-switch silently on weak devices (my
 * decision stands)" — his words: "check the device capability and auto
 * switch; also allow user to manually switch." A fresh scout decision
 * (prior-crash / probe / low-memory) therefore applies SILENTLY: the
 * session starts in Scout Map, no dialog, and the auto record above is
 * written so later boots stand on it until it decays.
 *
 * SUPERSEDED: the previous directive — "a capability-detected weak device
 * gets a CHOICE, never a silent routing" — sent these same decisions to a
 * boot choice dialog and kept the session in full mode until the player
 * accepted. That behavior shipped until 2026-10-20 and is why stored
 * records with `accepted: true` exist (see StoredMapMode.accepted). The
 * owner's 2026-10-20 ruling above replaces it; this note stays so the
 * history is not lost.
 */
export function planBootMapMode(decision: MapModeDecision): BootMapModePlan {
  if (
    decision.mode === "scout" &&
    (decision.source === "prior-crash" ||
      decision.source === "probe" ||
      decision.source === "low-memory")
  ) {
    return { mode: "scout", persistSource: decision.source };
  }
  if (decision.mode === "scout" && decision.source === "unknown-memory") {
    // Issue #330 trial: start in Scout, persist nothing, and let the
    // session upgrade after the soak (shouldFireScoutUpgrade).
    return { mode: "scout", persistSource: null };
  }
  return { mode: "full", persistSource: null };
}

/**
 * Pre-mount convenience wrapper: reads the (decay-applied) stored mode,
 * runs the boot probe + memory signal, and qualifies in the settled order.
 * Guarded for SSR / no-window — returns `{ mode: "full", source: "default" }`
 * when no DOM is available. Never throws. Reads but never writes (Q3).
 *
 * When the returned source is "prior-crash", "probe", or "low-memory"
 * and no stored assignment stands, the caller applies the decision
 * silently and persists it as an auto record — see planBootMapMode for
 * the owner's 2026-10-20 auto-switch ruling.
 */
export function resolveMapMode(options: ResolveMapModeOptions = {}): MapModeDecision {
  try {
    return qualifyMapMode({
      manual: readStoredMapMode(),
      priorMapCrash: options.priorMapCrash === true,
      webglProbeOk: probeWebGL(),
      deviceMemoryGB: readDeviceMemoryGB(),
      coarsePointer: options.coarsePointer ?? readCoarsePointer(),
    });
  } catch {
    return { mode: "full", source: "default" };
  }
}
