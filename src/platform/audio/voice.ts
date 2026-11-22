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
 * - pause() moves a live voice (loading or playing) back to
 *   "ready" with its position kept, holding the channel, so
 *   play() resumes it. It fires no callbacks, and calling it on
 *   a voice already ready, idle or terminal is a no-op: pause()
 *   is idempotent. A play() rejection that arrives after such a
 *   pause is the pause working, not a failure: the voice stays
 *   "ready" and no error fires.
 */

import type { VoiceClaim } from "../../game/audio/voice-channel.ts";

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
  /** Clip length in seconds; NaN until the metadata loads. */
  duration: number;
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
  /** A channel claim the caller already holds, for the port to
   * adopt instead of claiming again: claiming twice would stop
   * the first claim's owner — the caller itself. The port
   * releases an adopted claim on exactly the paths it releases
   * a claim it took itself; when creation returns null the
   * claim stays with the caller. */
  claim?: VoiceClaim;
  /** True for a deliberate once-only line (a speaker button) that
   * plays despite the sound toggle being off. The hidden-tab
   * guard still applies: a bypassed line never sounds in a
   * hidden tab. Automatic lines never set this. */
  bypassSoundGate?: boolean;
  /** Where playback starts, in seconds, on the first play()
   * only. A resume after pause() keeps its position instead. */
  startAtSeconds?: number;
  /** The clip played to its end. Fires at most once. */
  onEnded?: () => void;
  /** The clip failed to load or play. Fires at most once. The
   * cause carries the refusal or failure behind it where one
   * is known; a handler that takes no argument keeps working. */
  onError?: (cause?: unknown) => void;
  /** Another voice took the channel. Fires at most once. */
  onInterrupted?: () => void;
  /** Playback started (or resumed): the element's playing event.
   * Fires on every playing event, so a resume re-arms stall
   * checks exactly like the first start. */
  onPlaying?: () => void;
  /** Playback position moved, in seconds. */
  onTimeUpdate?: (seconds: number) => void;
}

/** One voice for one line, as its owner holds it. */
export interface VoiceHandle {
  /** Current place in the statechart. */
  readonly state: VoiceState;
  /** Start the line. Works only from "idle" or "ready". */
  play(): void;
  /** Pause a live voice, keeping its position and the channel,
   * so play() resumes it. Idempotent, and fires no callbacks. */
  pause(): void;
  /** Stop the line and give the channel back. Idempotent, and
   * fires no callbacks. */
  stop(): void;
  /** Playback position, in seconds. */
  currentTime(): number;
  /** Clip length in seconds; NaN until the metadata loads. */
  duration(): number;
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
