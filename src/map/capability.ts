/**
 * Scout Map qualification — pre-mount capability gate (spec §2).
 *
 * Decision order (first hit wins):
 *   1. Manual toggle (localStorage `meridian:map-mode`) — user override always wins.
 *   2. Map-attributed prior-crash flag — a previous session crashed with the map mounted.
 *   3. Boot WebGL probe — offscreen canvas with `failIfMajorPerformanceCaveat`;
 *      failure or a known-weak (software) renderer means scout.
 *   4. Low-memory signal — `navigator.deviceMemory <= 2` (coarse, anonymous).
 *
 * Hard rule: full mode is the default; scout only activates through one of
 * the checks above. A signal that is unavailable is ignored (fail-closed:
 * assume capable). No UA string is read anywhere in this module.
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

/** deviceMemory at or below this (GB) qualifies as a low-memory device. */
export const LOW_MEMORY_GB = 2;

export type MapModeSource = "manual" | "prior-crash" | "probe" | "low-memory" | "contextlost" | "default";

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
  const mem = signals.deviceMemoryGB;
  if (typeof mem === "number" && Number.isFinite(mem) && mem <= LOW_MEMORY_GB) {
    return { mode: "scout", source: "low-memory" };
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
        : parsed.source === "prior-crash" || parsed.source === "probe" || parsed.source === "low-memory" || parsed.source === "contextlost"
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

export interface ResolveMapModeOptions {
  /** Set by the crash pipeline when a previous session crashed with the map mounted. */
  priorMapCrash?: boolean;
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
   * writes nothing.
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
    });
  } catch {
    return { mode: "full", source: "default" };
  }
}
