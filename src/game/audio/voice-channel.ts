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

/** Who holds the channel right now, or null. For tests and debugging. */
export function currentVoiceOwner(): string | null {
  return holder ? holder.owner : null;
}
