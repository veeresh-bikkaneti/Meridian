/**
 * SubjectDetectiveHost — Holmes & Watson inside every subject case.
 *
 * Mounted ONCE by the shared SubjectCase (one element, beside the
 * case flow), so math, physics, chemistry, general knowledge and
 * social studies all get the pair from the same mount. The host owns
 * everything else:
 *
 * - Self-gating: it renders nothing until the shared flags load
 *   resolves and isEnabled("detectivePair") reads on (the game-app /
 *   existing-hosts pattern: await loadFlags(), then read; the
 *   boot-time value is authoritative). Flag off — including while the
 *   load is still in flight — the case is exactly main's text-only
 *   case: no rig DOM, no player, no audio requests.
 * - Props are the answer-blind whitelist ONLY
 *   (subject-host-props.ts): solved / wrongPick / finished booleans
 *   derived from the case's own flow state. No item, answer, choice
 *   or band ever reaches this component.
 * - The rigs are the shipped GeoDetective pair (DetectivePair.tsx,
 *   consumed, never edited) at the host rig height, in a slim
 *   in-flow strip at the top of the case — the bench idea from
 *   GeoDetective's station, in plain page flow like its bookend
 *   strip: no walk-ins, no portals, pointer-events none so it can
 *   never cover the AnswerCard buttons. Staging follows
 *   hostsStaging exactly as the other hosts pass it (the halo prop).
 *   Same pair for every age band. Reduced motion: detective.css's
 *   own reduced-motion block stills every rig animation — poses
 *   still change, motion does not; audio behaviour is unchanged.
 *
 * Voice (createDetectiveSpeech, detective-audio.ts, unchanged):
 * the player is created in its default "auto" speech mode,
 * deliberately NOT "tap". Evidence from detective-audio.ts: in
 * "tap" mode an item plays for real only as a selection read, an
 * armed guess read, or an ending ref (isEndingRef) — the open line
 * lets-find-clues is none of those, and the tap hold retains only
 * clue sequences, which a subject case never enqueues — so in tap
 * mode the pair's one opening line would be silently skipped on a
 * surface with no Listen / replay control. "auto" is the smallest
 * mode that plays it, and its play-time gates stay authoritative:
 * isSoundOn (the global sound toggle + hidden-tab guard) and
 * canAutoPlay (detectiveCanAutoPlay — the read-aloud preference
 * veto) are checked per clip, so sound off or a "never" read-aloud
 * preference still silences the pair. Each clip runs through the
 * player's runClip, which claims the shared voice channel
 * (voice-channel.ts) as "detective" before sounding — one voice at
 * a time across the whole app. The clip mapping itself (open →
 * lets-find-clues, correct → win-holmes, wrong → silence, finished
 * → silence, with the determinations) lives in
 * subject-host-props.ts. The player is stopped and disposed on
 * unmount, and "finished" is guarded to the first time per mount
 * here, in the host.
 */
import { useEffect, useRef, useState } from "react";
import {
  HolmesRig,
  WatsonRig,
  type HolmesPose,
  type WatsonPose,
} from "@/game/loop/detective/DetectivePair";
import {
  createDetectiveSpeech,
  type DetectiveSpeaker,
  type DetectiveSpeechPlayer,
} from "@/game/loop/detective/detective-audio";
import { isEnabled, loadFlags } from "@/lib/flags";
import {
  speakRefForSubjectSignal,
  subjectPairPoses,
  subjectSignalsFor,
  type SubjectCaseSignal,
  type SubjectDetectiveHostProps,
} from "./subject-host-props";
import "@/game/loop/detective/detective.css";

export default function SubjectDetectiveHost(
  props: SubjectDetectiveHostProps,
) {
  const [pairOn, setPairOn] = useState(false);
  const [speaking, setSpeaking] = useState<DetectiveSpeaker | null>(null);
  const [lastSignal, setLastSignal] = useState<SubjectCaseSignal | null>(null);
  const [player, setPlayer] = useState<DetectiveSpeechPlayer | null>(null);
  const prevRef = useRef<SubjectDetectiveHostProps | null>(null);
  const openedRef = useRef(false);
  const finishedFiredRef = useRef(false);

  // Self-gate: the pair appears when the flag resolves on.
  useEffect(() => {
    let active = true;
    loadFlags().then(() => {
      if (active) setPairOn(isEnabled("detectivePair"));
    });
    return () => {
      active = false;
    };
  }, []);

  // One player per flag-on mount; stop + dispose on unmount.
  useEffect(() => {
    if (!pairOn) return;
    const created = createDetectiveSpeech({
      onSpeakingChange: (who) => setSpeaking(who),
    });
    setPlayer(created);
    return () => {
      created.stopAll();
      created.dispose();
      setPlayer(null);
    };
  }, [pairOn]);

  // Signals: "open" once the player exists, then one edge pass per
  // prop change. Silent signals (wrong / finished) enqueue nothing —
  // speakRefForSubjectSignal returns null for them — they only move
  // the poses. "finished" fires at most once per mount.
  useEffect(() => {
    if (!player) return;
    if (!openedRef.current) {
      openedRef.current = true;
      setLastSignal("open");
      const ref = speakRefForSubjectSignal("open");
      if (ref) player.enqueue(ref);
    }
    const prev = prevRef.current ?? { solved: false, wrongPick: false, finished: false };
    prevRef.current = props;
    for (const signal of subjectSignalsFor(prev, props)) {
      if (signal === "finished") {
        if (finishedFiredRef.current) continue;
        finishedFiredRef.current = true;
      }
      setLastSignal(signal);
      const ref = speakRefForSubjectSignal(signal);
      if (ref) player.enqueue(ref);
    }
  }, [player, props]);

  if (!pairOn) return null;

  const poses = subjectPairPoses({
    finished: props.finished,
    lastSignal,
    speaking,
  });
  return (
    <div
      data-testid="subject-detective-pair"
      data-signal={lastSignal ?? ""}
      data-speaking={speaking ?? ""}
      className="flex items-end justify-center gap-4"
      style={{ pointerEvents: "none" }}
      role="img"
      aria-label="Holmes and Watson"
    >
      <div className="detective-host-figure" data-detective="holmes">
        <HolmesRig
          pose={poses.holmes as HolmesPose}
          facing="right"
          speaking={speaking === "holmes"}
          halo={isEnabled("hostsStaging")}
        />
      </div>
      <div className="detective-host-figure" data-detective="watson">
        <WatsonRig
          pose={poses.watson as WatsonPose}
          facing="left"
          speaking={speaking === "watson"}
          halo={isEnabled("hostsStaging")}
        />
      </div>
    </div>
  );
}
