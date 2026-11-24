/**
 * One voice at a time, across the whole app.
 *
 * The owner's rule: "if one speak the other needs to shut up". Every
 * character voice (Grandpa, Comet, Holmes, Watson, read-aloud, a journal
 * movie with sound) claims this channel before it makes a sound and
 * releases it when it is done.
 *
 *  - A tap wins: a user-initiated claim stops whoever holds the channel,
 *    then takes it.
 *  - Autoplay waits its turn: a claim the player did not tap for gets
 *    `null` while anyone is speaking. It is not queued: a late greeting
 *    is worse than none.
 *  - `release()` is safe to call twice, and a stale release (from a claim
 *    that was already stopped) does nothing.
 *
 * No React, no DOM: plain module state, so any path can use it.
 */

export interface VoiceClaim {
  /** Give the channel back (clip ended, failed, or the owner unmounted). */
  release(): void;
}

interface Holder {
  owner: string;
  stop: () => void;
}

let holder: Holder | null = null;

function stopHolder(h: Holder): void {
  try {
    h.stop();
  } catch {
    /* stopping a voice must never throw into game flow */
  }
}

export function claimVoice(
  owner: string,
  stop: () => void,
  opts: { userInitiated: boolean },
): VoiceClaim | null {
  if (holder) {
    if (!opts.userInitiated) return null;
    const previous = holder;
    holder = null; // vacate first, so a stop() that releases is a no-op
    stopHolder(previous);
  }
  const mine: Holder = { owner, stop };
  holder = mine;
  return {
    release(): void {
      if (holder === mine) holder = null;
    },
  };
}

/** Stop whoever is speaking (route change, the sound toggle). */
export function stopAllVoices(): void {
  const current = holder;
  holder = null;
  if (current) stopHolder(current);
}

/**
 * The voice factory: how a domain player that may not import the
 * platform port still sounds through it. The shape is structural
 * (no platform import — the layer rule forbids it): the port's
 * createVoice satisfies it exactly.
 *
 * The shell registers the real factory once at startup
 * (src/platform/storage/register.ts); a player may also take one
 * per instance, which wins over the registered one (the storage
 * slot's explicit-beats-registered discipline). Unregistered
 * resolves to nothing: the player degrades to silence, never a
 * raw element.
 */
export type VoiceFactoryState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "ended"
  | "error"
  | "interrupted"
  | "aborted";

export interface VoiceFactoryOptions {
  owner: string;
  userInitiated: boolean;
  /** A channel claim the caller already holds, for the factory to
   * adopt instead of claiming again: claiming twice would stop
   * the first claim's owner — the caller itself. The factory
   * releases an adopted claim on exactly the paths it releases
   * a claim it took itself; when the factory returns null the
   * claim stays with the caller. */
  claim?: VoiceClaim;
  bypassSoundGate?: boolean;
  startAtSeconds?: number;
  onEnded?: () => void;
  onError?: (cause?: unknown) => void;
  onInterrupted?: () => void;
  onPlaying?: () => void;
  onTimeUpdate?: (seconds: number) => void;
}

export interface VoiceFactoryHandle {
  readonly state: VoiceFactoryState;
  play(): void;
  pause(): void;
  stop(): void;
  currentTime(): number;
  duration(): number;
}

export type VoiceFactory = (
  src: string,
  opts: VoiceFactoryOptions,
) => VoiceFactoryHandle | null;

let registeredVoiceFactory: VoiceFactory | undefined;

/** Register the voice factory (called once, from above, at startup). */
export function setVoiceFactory(factory: VoiceFactory | undefined): void {
  registeredVoiceFactory = factory;
}

/**
 * Resolve the voice factory to use: the explicit one when given,
 * else the registered factory, else undefined — no factory at
 * all, and the caller's silent-skip path carries the session.
 */
export function resolveVoiceFactory(
  explicit?: VoiceFactory,
): VoiceFactory | undefined {
  return explicit ?? registeredVoiceFactory;
}

/** Who holds the channel right now, or null. For callers and debugging. */
export function currentVoiceOwner(): string | null {
  return holder ? holder.owner : null;
}
