import { claimVoice, type VoiceClaim } from "../game/audio/voice-channel.ts";

/**
 * Take or retake the app-wide voice channel for storyteller narration.
 *
 * Releases a leftover claim first. After another voice takes over, the
 * component still holds a stale claim whose release is a no-op; calling
 * this on resume is what actually stops the other voice.
 *
 * A user-initiated claim (speaker, replay, figure-tap resume) stops
 * whoever is speaking. An automatic claim waits its turn and returns
 * null if the channel is busy.
 */
export function claimStorytellerVoice(
  previous: VoiceClaim | null,
  stop: () => void,
  opts: { userInitiated: boolean },
): VoiceClaim | null {
  previous?.release();
  return claimVoice("storyteller", stop, opts);
}
