/**
 * The audio port's types — one place owns each kind of voice sound.
 *
 * A screen asks the port for a voice for one line, then plays it.
 * The port owns the one-voice channel claim, the element, and the
 * cleanup, so screens do not touch an audio element themselves.
 *
 * The statechart, in plain words:
 *
 * - A voice starts "idle" when it is created. Creation never
 *   auto-plays: nothing sounds until the owner calls play().
 * - play() works only from "idle" or "ready". It moves the voice
 *   to "loading"; the element then reports "ready" when it can
 *   play and "playing" once sound is coming out.
 * - "ended", "error", "interrupted" and "aborted" are terminal:
 *   the voice is done, no further play() or event changes it, and
 *   each terminal step fires its callback at most once.
 * - "interrupted" means another voice took the channel. "aborted"
 *   means the owner stopped the voice on purpose.
 * - stop() moves a live voice to "aborted", tears the element
 *   down and gives the channel back. It fires no callbacks, and
 *   calling it again is a no-op: stop() is idempotent.
 */

/** Where a voice is in its life, from the statechart above. */
export type VoiceState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "interrupted"
  | "ended"
  | "error"
  | "aborted";

/** The slice of an audio element the port touches. */
export interface VoiceAudioElement {
  src: string;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** What the owner passes when it asks for a voice. */
export interface CreateVoiceOptions {
  /** Channel owner name, as the voice channel knows it. */
  owner: string;
  /** True when the player tapped for this line, so it may take
   * the channel from whoever holds it. False lines wait their
   * turn and stay silent while another voice holds the channel. */
  userInitiated: boolean;
  /** The clip played to its end. Fires at most once. */
  onEnded?: () => void;
  /** The clip failed to load or play. Fires at most once. */
  onError?: () => void;
  /** Another voice took the channel. Fires at most once. */
  onInterrupted?: () => void;
  /** Playback position moved, in seconds. */
  onTimeUpdate?: (seconds: number) => void;
}

/** One voice for one line, as its owner holds it. */
export interface VoiceHandle {
  /** Current place in the statechart. */
  readonly state: VoiceState;
  /** Start the line. Works only from "idle" or "ready". */
  play(): void;
  /** Stop the line and give the channel back. Idempotent, and
   * fires no callbacks. */
  stop(): void;
  /** Playback position, in seconds. */
  currentTime(): number;
}

/** The port itself: screens depend on this, not on an element. */
export interface VoicePort {
  /** Make a voice for one line, or null when the line must stay
   * silent (sound off, tab hidden, channel held by another
   * voice, or no audio available). Creation never auto-plays. */
  createVoice(src: string, opts: CreateVoiceOptions): VoiceHandle | null;
}

/** Injectable seams for the port, so tests can drive it with no DOM. */
export interface VoicePortDeps {
  /** Build the element for a line. Defaults to the browser Audio. */
  createAudio?: (src: string) => VoiceAudioElement;
  /** The master sound toggle. Defaults to the game's toggle. */
  soundEnabled?: () => boolean;
  /** Whether sound may be heard right now, such as the tab being
   * visible. Defaults to the game's hidden-tab guard. */
  audible?: () => boolean;
}
