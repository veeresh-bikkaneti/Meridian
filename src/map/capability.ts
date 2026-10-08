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
 * is re-qualified on fresh signals. Manual toggles never decay.
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
    if (source !== "manual" && now - parsed.setAt > MAP_MODE_DECAY_MS) return null;
    return { mode: parsed.mode, source, setAt: parsed.setAt };
  } catch {
    return null;
  }
}

/**
 * Persist an assignment. Write policy (Q3): call ONLY on a new qualifying
 * event or an explicit state change — manual toggle (PBI-7), boot-offer
 * acceptance (PBI-6), webglcontextlost switch (PBI-5). NEVER rewrite on
 * every boot: a boot-time rewrite would refresh setAt and silently defeat
 * the 7-day decay. resolveMapMode() reads but never writes.
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

/**
 * Pre-mount convenience wrapper: reads the (decay-applied) stored mode,
 * runs the boot probe + memory signal, and qualifies in the settled order.
 * Guarded for SSR / no-window — returns `{ mode: "full", source: "default" }`
 * when no DOM is available. Never throws. Reads but never writes (Q3).
 *
 * Q1 (offer, not force): when the returned source is "prior-crash", the
 * caller MUST show the boot offer modal and keep the session in full mode
 * until the user accepts — a prior-crash scout decision never applies
 * silently.
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
