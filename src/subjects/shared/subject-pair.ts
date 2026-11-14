/**
 * Holmes and Watson in the subject cases (Stream E) — the pure part.
 *
 * Answer-blind by construction, like detective-host-props.ts: the pair
 * receives only a state and a nonce. It never receives the item, the
 * answer or any evaluation beyond "the kid picked a right or wrong
 * answer". The clips are existing fixed lines in
 * public/audio/detective/manifest.json, played through the shared voice
 * channel so a new line stops the one before it.
 *
 * No React, no DOM, no audio element here: makeAudio and claim are
 * injected, so the one-voice behaviour is unit-tested under plain Node.
 */
import type { VoiceClaim } from "../../game/audio/voice-channel.ts";

/** What the pair may know about the case. Nothing else. */
export type PairState = "open" | "correct" | "wrong";

export interface SubjectPairProps {
  state: PairState;
  /** Bumps on every event, so a repeat (a second wrong pick) replays. */
  nonce: number;
}

/** The exact key set the pair accepts, pinned by a unit test. */
export const SUBJECT_PAIR_PROP_KEYS = ["state", "nonce"] as const;

/** Keep only the allowed keys. Extra fields (item, answer, evaluation)
 * are dropped here, so they can never reach the pair. */
export function buildSubjectPairProps(input: SubjectPairProps): SubjectPairProps {
  return { state: input.state, nonce: input.nonce };
}

export type PairSpeaker = "holmes" | "watson";

/** One existing fixed clip per state. Silence is not an option here:
 * the wrong-pick line is the neutral ack, which fits any wrong answer
 * (it never names the map, a guess, a distance or a place). */
export const SUBJECT_PAIR_CLIPS: Record<
  PairState,
  { fixedId: string; speaker: PairSpeaker; userInitiated: boolean }
> = {
  open: { fixedId: "lets-find-clues", speaker: "watson", userInitiated: false },
  correct: { fixedId: "win-holmes", speaker: "holmes", userInitiated: true },
  wrong: { fixedId: "ack-3", speaker: "holmes", userInitiated: true },
};

export interface PairClipRequest {
  fixedId: string;
  speaker: PairSpeaker;
  userInitiated: boolean;
}

/** The clip a state plays. Open is autoplay (waits its turn), a pick is
 * the kid's own tap (wins the channel). */
export function pairClipRequest(props: SubjectPairProps): PairClipRequest {
  const clip = SUBJECT_PAIR_CLIPS[props.state];
  return { fixedId: clip.fixedId, speaker: clip.speaker, userInitiated: clip.userInitiated };
}

/** The slice of an HTMLAudioElement the pair uses. */
export interface PairAudio {
  play(): Promise<void>;
  pause(): void;
  onFinished(fn: () => void): void;
}

export type ClaimFn = (
  owner: string,
  stop: () => void,
  opts: { userInitiated: boolean },
) => VoiceClaim | null;

export interface StartPairClipDeps {
  url: string;
  makeAudio: (url: string) => PairAudio;
  claim: ClaimFn;
  onSpeaking: (who: PairSpeaker | null) => void;
}

export const PAIR_OWNER = "subject-pair";

/**
 * Play one pair clip through the shared voice channel.
 *
 * A tap wins the channel (a pick stops whatever is speaking); autoplay
 * waits its turn (the case-open line is dropped while anyone speaks).
 * Returns a stop function that the caller runs on re-render or unmount.
 */
export function startPairClip(req: PairClipRequest, deps: StartPairClipDeps): () => void {
  const audio = deps.makeAudio(deps.url);
  let claim: VoiceClaim | null = null;
  const halt = () => {
    audio.pause();
    deps.onSpeaking(null);
  };
  claim = deps.claim(PAIR_OWNER, halt, { userInitiated: req.userInitiated });
  if (!claim) return () => {};
  const mine = claim;
  deps.onSpeaking(req.speaker);
  audio.onFinished(() => {
    mine.release();
    deps.onSpeaking(null);
  });
  void audio.play().catch(() => {
    mine.release();
    deps.onSpeaking(null);
  });
  return () => {
    audio.pause();
    mine.release();
    deps.onSpeaking(null);
  };
}
