/**
 * Holmes and Watson in the subject cases (Stream E) — the mounted pair.
 *
 * Uses prod's own rigs (HolmesRig, WatsonRig from DetectivePair.tsx,
 * unchanged) and its own clip manifest. Mounted once, by SubjectCase,
 * and only behind the detectivePair flag, the same flag LoopScreen uses.
 * Halo follows hostsStaging, as in LoopScreen.
 */
import { useEffect, useState } from "react";
import { HolmesRig, WatsonRig, DETECTIVE_RIG_HEIGHT_PX } from "../../game/loop/detective/DetectivePair";
import {
  loadDetectiveManifest,
  resolveDetectiveClip,
} from "../../game/loop/detective/detective-audio";
import { isSoundEnabled } from "../../game/audio/sfx";
import { soundAudible } from "../../game/audio/play-guards";
import { claimVoice } from "../../game/audio/voice-channel";
import { isEnabled } from "../../lib/flags";
import {
  pairClipRequest,
  startPairClip,
  type PairAudio,
  type PairSpeaker,
  type SubjectPairProps,
} from "./subject-pair";

/** Rig poses per state: prod's existing poses only. */
const POSES = {
  open: { holmes: "dock", watson: "read" },
  correct: { holmes: "announce", watson: "clap" },
  wrong: { holmes: "ack", watson: "think" },
} as const;

function makeAudio(url: string): PairAudio {
  const audio = new Audio(url);
  return {
    play: () => audio.play(),
    pause: () => audio.pause(),
    onFinished: (fn) => {
      audio.onended = fn;
      audio.onerror = fn;
    },
  };
}

export default function SubjectPair(props: SubjectPairProps) {
  const [speaking, setSpeaking] = useState<PairSpeaker | null>(null);
  const { state, nonce } = props;

  useEffect(() => {
    if (!isSoundEnabled() || !soundAudible()) return;
    const req = pairClipRequest({ state, nonce });
    let cancelled = false;
    let stop: () => void = () => {};
    void (async () => {
      const manifest = await loadDetectiveManifest().catch(() => null);
      const clip = resolveDetectiveClip(manifest, { kind: "fixed", id: req.fixedId }, 0);
      if (!clip || cancelled) return;
      stop = startPairClip(req, {
        url: clip.url,
        makeAudio,
        claim: claimVoice,
        onSpeaking: setSpeaking,
      });
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [state, nonce]);

  const halo = isEnabled("hostsStaging");
  const pose = POSES[state];
  return (
    <div
      data-testid="subject-pair"
      data-state={state}
      className="flex items-end justify-center gap-4"
      style={{ minHeight: DETECTIVE_RIG_HEIGHT_PX }}
    >
      <HolmesRig pose={pose.holmes} speaking={speaking === "holmes"} halo={halo} />
      <WatsonRig pose={pose.watson} speaking={speaking === "watson"} halo={halo} />
    </div>
  );
}
