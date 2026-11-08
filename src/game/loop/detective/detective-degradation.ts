/**
 * detective-degradation.ts — the pair's degradation matrix (U9,
 * BUILD-SCOPE §2.5), as one PURE function.
 *
 * Why pure: every row of the matrix must be unit-testable in node with
 * no DOM, no React, and no timers — the same discipline as
 * detective-state.ts and companion.ts. DetectiveHost owns the
 * environment (it reads the real signals — reduced-motion hook,
 * navigator.connection / deviceMemory in the card-film pattern, the
 * battery where the browser exposes one, the sound toggle, and the
 * speech player's own autoplay verdict) and feeds them in here; this
 * module owns only the decision.
 *
 * The matrix (scope §2.5, exact):
 * - prefers-reduced-motion → walks become instant cuts. Audio is
 *   UNAFFECTED: reduced motion mutes animation, never sound.
 * - Save-Data OR deviceMemory ≤ 4 OR battery saver → Holmes stays
 *   dock-only (no berthing), AND speech degrades auto → tap (the kid
 *   taps Listen per clue instead of the pair auto-playing).
 * - Sound off → speech off entirely; the pair is fully visual.
 * - Auto-speech not allowed (read-aloud pref "never"/"sometimes", or
 *   the autoplay verdict vetoes) → speech is tap-to-play. The Listen
 *   button stays — the kid's tool is never hidden.
 * - Otherwise speech plays automatically.
 *
 * Precedence: "off" (sound) beats "tap" — there is nothing to tap for
 * while the sound toggle is off, and the held sequence is dropped, not
 * stored (the player enforces that; see detective-audio.ts).
 */

export type CompanionDegradation = "full" | "dock-only";
export type WalkMode = "animated" | "cut";
export type SpeechMode = "auto" | "tap" | "off";

export interface DegradationInputs {
  /** prefers-reduced-motion (src/hooks/use-prefers-reduced-motion.ts). */
  reducedMotion: boolean;
  /** navigator.connection.saveData (card-film.tsx's gate pattern). */
  saveData: boolean;
  /** navigator.deviceMemory in GB, or null where the browser hides it. */
  deviceMemory: number | null;
  /** Battery saver / very low battery, or null where no battery read
   * exists (navigator.getBattery absent or unreadable). */
  batterySaver: boolean | null;
  /** The global sound toggle (isSoundEnabled, src/game/audio/sfx.ts). */
  soundOn: boolean;
  /** The speech player's autoplay verdict (detectiveCanAutoPlay: the
   * read-aloud preference applied to this surface). */
  autoSpeechAllowed: boolean;
}

export interface DetectiveDegradation {
  companionMode: CompanionDegradation;
  walkMode: WalkMode;
  speechMode: SpeechMode;
}

/** Low-memory threshold from the matrix: deviceMemory ≤ 4 GB docks
 * Holmes and degrades speech to tap. (card-film uses ≤ 2 for its own
 * heavier film gate; the pair's number is the council's §2.5/§11 one.) */
export const DEGRADATION_LOW_MEMORY_GB = 4;

/** Reduced-motion berthing pause (council Q2 §11): with walks cut, a
 * berth is confirmed only after the pointer has paused this long —
 * longer than the animated 350/450 ms pause, same berth offsets. */
export const REDUCED_MOTION_PAUSE_MS = 600;

/** True when any of the three resource signals forces dock-only. */
export function resourceConstrained(
  input: Pick<DegradationInputs, "saveData" | "deviceMemory" | "batterySaver">,
): boolean {
  if (input.saveData) return true;
  if (
    typeof input.deviceMemory === "number" &&
    input.deviceMemory > 0 &&
    input.deviceMemory <= DEGRADATION_LOW_MEMORY_GB
  ) {
    return true;
  }
  return input.batterySaver === true;
}

export function resolveDetectiveDegradation(
  input: DegradationInputs,
): DetectiveDegradation {
  const constrained = resourceConstrained(input);
  const speechMode: SpeechMode = !input.soundOn
    ? "off"
    : !input.autoSpeechAllowed || constrained
      ? "tap"
      : "auto";
  return {
    companionMode: constrained ? "dock-only" : "full",
    walkMode: input.reducedMotion ? "cut" : "animated",
    speechMode,
  };
}

/* ------------------------------------------------------------------ */
/* Game-end summary celebration mode (Unit B)                          */
/* ------------------------------------------------------------------ */

/**
 * The run-summary celebration's mode (Unit B): "animated" runs the
 * full jump → high-five → clap → settle choreography and Holmes's
 * fixed celebration line (speech still gated at play time by the
 * sound toggle + read-aloud preference — decision 6); "static" shows
 * the pair frozen at the high-five with the score in frame — NO
 * motion and NO audio at all. Static is chosen by the same signals
 * as the U9 matrix's resource rows: reduced motion, Save-Data, or
 * low memory (deviceMemory ≤ 4 GB, via resourceConstrained). The
 * battery signal is not read on the summary surface (the card is a
 * resting screen, not a walk), so it never forces static here.
 */
export type SummaryCelebrationMode = "animated" | "static";

export function resolveSummaryCelebrationMode(input: {
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemory: number | null;
}): SummaryCelebrationMode {
  if (input.reducedMotion) return "static";
  if (
    resourceConstrained({
      saveData: input.saveData,
      deviceMemory: input.deviceMemory,
      batterySaver: null,
    })
  ) {
    return "static";
  }
  return "animated";
}

/** The host-root summary attribute (U10's spec surface), e.g.
 * "companion:full,walk:animated,speech:auto". */
export function formatDegradation(d: DetectiveDegradation): string {
  return `companion:${d.companionMode},walk:${d.walkMode},speech:${d.speechMode}`;
}

/* ------------------------------------------------------------------ */
/* Tap-Watson replay cue (Unit A)                                      */
/* ------------------------------------------------------------------ */

/** Phases where the tap-Watson replay control may show: the clue
 * phases (Watson reading / the thinking beat) and the guessing phases
 * that follow them — the same set the Listen button uses (the host's
 * LISTEN_PHASES). Endings, the case-open duet, and the selection read
 * itself never carry it. */
export const WATSON_REPLAY_PHASES: ReadonlySet<string> = new Set([
  "READING",
  "THINKING_BEAT",
  "SEARCH_IDLE",
  "SEARCH_AREA",
]);

/**
 * Pure visibility rule for the tap-Watson replay control + its cue
 * (Unit A). The control lives and dies with Watson's presence:
 * - Watson must be on screen (placement "station" at the clue card or
 *   "dock" on the map) and the pair must not be absent (sheet / rings
 *   / external speech — the view's `hidden` flag);
 * - speech must be replayable: "auto" and "tap" modes retain the
 *   clue sequence, "off" holds nothing, so no cue is offered.
 * Reduced motion does NOT hide the cue — it only makes it static
 * (the CSS owns that); walk/companion modes do not affect it.
 */
export function watsonReplayCueVisible(input: {
  phase: string;
  watsonPlacement: string;
  hidden: boolean;
  speechMode: SpeechMode;
}): boolean {
  if (input.hidden) return false;
  if (input.speechMode === "off") return false;
  if (input.watsonPlacement !== "station" && input.watsonPlacement !== "dock") {
    return false;
  }
  return WATSON_REPLAY_PHASES.has(input.phase);
}

/* ------------------------------------------------------------------ */
/* Environment reads (host-side helpers — NOT part of the pure matrix) */
/* ------------------------------------------------------------------ */

/** Save-Data + deviceMemory, read exactly as card-film.tsx reads them.
 * Guarded: any failure means "no signal", never a throw into the game. */
export function readConnectionSignals(): {
  saveData: boolean;
  deviceMemory: number | null;
} {
  try {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    return {
      saveData: nav.connection?.saveData === true,
      deviceMemory:
        typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    };
  } catch {
    return { saveData: false, deviceMemory: null };
  }
}

interface BatteryLike {
  level: number;
  charging: boolean;
  /** Non-standard saver flag some browsers expose; honoured when present. */
  savingMode?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
}

/**
 * Battery-saver verdict from navigator.getBattery(), where available.
 * Resolves null when the API is absent or fails — "no signal", which
 * the matrix treats as not-constrained. Saver = an explicit savingMode
 * flag when the browser exposes one, else a battery at ≤ 20% that is
 * not charging (council Q2 §11's "battery ≤ 20%" gate).
 */
export async function readBatterySaver(
  onChange?: (saver: boolean | null) => void,
): Promise<boolean | null> {
  try {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryLike>;
    };
    if (typeof nav.getBattery !== "function") return null;
    const battery = await nav.getBattery();
    const verdict = (): boolean =>
      typeof battery.savingMode === "boolean"
        ? battery.savingMode
        : battery.level <= 0.2 && !battery.charging;
    if (onChange && typeof battery.addEventListener === "function") {
      const push = () => onChange(verdict());
      battery.addEventListener("levelchange", push);
      battery.addEventListener("chargingchange", push);
    }
    return verdict();
  } catch {
    return null;
  }
}
