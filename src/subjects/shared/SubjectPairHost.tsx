/**
 * Holmes and Watson in a subject case — the small subject host beside
 * SubjectCase.tsx. SubjectCase mounts it lazily, behind
 * isEnabled("detectivePair"), inside a display:contents slot — the
 * LoopScreen pattern — so flag off means no pair DOM and no pair code.
 *
 * Reuse only: the shipped DetectivePair rigs (SVG, or the 3D figure when
 * pair3d is on), detective.css's figure, bubble and celebrate-cluster
 * classes, CELEBRATE_LAYOUT's palm-to-palm offset and U8's jump timing.
 * No new rigs, poses, props or art. The rigs' halo follows hostsStaging,
 * exactly as DetectiveHost passes it.
 *
 * Answer-blind: the only inputs are SubjectPairProps (subject-pair.ts) —
 * which case is open and one of open / wrong / correct / finished.
 *
 * Voice: existing fixed clips only, one voice at a time through the
 * shared voice channel (subject-pair-voice.ts).
 *
 * Placement: an in-flow station between the case's clue card and its
 * answer card (the bench/gutter idea — the pair stands beside the case,
 * never over it), with headroom reserved for the speech bubble so a
 * bubble never covers clue text. Pointer-transparent and aria-hidden;
 * the spoken words are mirrored to a polite live region.
 *
 * Reduced motion: still poses, no walk, no jump — the win goes straight
 * to the high-five (detective.css also freezes every rig animation).
 * The 3D layer is not started at all then (HolmesRig/WatsonRig skip
 * it, and pair3d's gate refuses reduced motion).
 */
import { useEffect, useRef, useState } from "react";
import {
  CELEBRATE_LAYOUT,
  HolmesRig,
  WatsonRig,
} from "@/game/loop/detective/DetectivePair";
import { CELEBRATE_JUMP_MS } from "@/game/loop/detective/detective-state";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { isEnabled } from "@/lib/flags";
import "@/game/loop/detective/detective.css";
import { lineForState, posesForState, type SubjectPairProps } from "./subject-pair";
import { createSubjectPairVoice, type SubjectPairVoice } from "./subject-pair-voice";

export default function SubjectPairHost({ caseIndex, state }: SubjectPairProps) {
  const reducedMotion = usePrefersReducedMotion();
  const halo = isEnabled("hostsStaging");
  const won = state === "correct" || state === "finished";

  // One celebrate jump as the win lands (motion only), then the high-five.
  const [jumping, setJumping] = useState(false);
  useEffect(() => {
    if (!won || reducedMotion) {
      setJumping(false);
      return;
    }
    setJumping(true);
    const t = setTimeout(() => setJumping(false), CELEBRATE_JUMP_MS);
    return () => clearTimeout(t);
  }, [won, caseIndex, reducedMotion]);

  // Who is speaking right now (null = nobody). Set by the voice below.
  const [speaking, setSpeaking] = useState<"holmes" | "watson" | null>(null);
  const line = lineForState(state);

  // Every line goes through the shared one-voice channel
  // (subject-pair-voice.ts): the case-open line waits its turn, the win
  // line (the player's own tap) takes the channel and stops whoever
  // speaks. Unmount stops the pair's line and gives the channel back.
  const voiceRef = useRef<SubjectPairVoice | null>(null);
  useEffect(() => {
    const voice = createSubjectPairVoice();
    voiceRef.current = voice;
    // Fetch the manifest and prime the audio element now, so a later
    // pick can call play() without waiting on the network (iOS).
    void voice.preload();
    const onTap = () => voice.unlockFromUserGesture();
    document.addEventListener("pointerdown", onTap, true);
    return () => {
      document.removeEventListener("pointerdown", onTap, true);
      voice.dispose();
      if (voiceRef.current === voice) voiceRef.current = null;
      setSpeaking(null);
    };
  }, []);
  useEffect(() => {
    const next = lineForState(state);
    const voice = voiceRef.current;
    if (!next || !voice) return;
    void voice.say(next, { userInitiated: state !== "open" }, setSpeaking);
  }, [caseIndex, state]);
  const caption = speaking && line && line.who === speaking ? line : null;

  const poses = posesForState(state, { reducedMotion, jumping });
  const bubble = (who: "holmes" | "watson") =>
    caption?.who === who ? (
      <span className="detective-bubble" data-testid="subject-pair-bubble" data-who={who}>
        {caption.words}
      </span>
    ) : null;
  const holmes = (
    <div className="detective-host-figure" data-detective="holmes">
      {bubble("holmes")}
      <HolmesRig pose={poses.holmes} facing="right" speaking={speaking === "holmes"} halo={halo} />
    </div>
  );
  const watson = (
    <div className="detective-host-figure" data-detective="watson">
      {bubble("watson")}
      <WatsonRig pose={poses.watson} facing="left" speaking={speaking === "watson"} halo={halo} />
    </div>
  );

  return (
    <div
      className="pointer-events-none flex justify-center pt-14"
      data-testid="subject-pair"
      data-state={state}
      data-case={caseIndex}
      data-speaking={speaking ?? ""}
    >
      <div aria-hidden="true">
        {poses.celebrate ? (
          <div className="detective-host-celebrate" data-testid="subject-pair-celebrate">
            <div className="detective-celebrate-holmes">{holmes}</div>
            <div
              className="detective-celebrate-watson"
              style={{
                transform: `translate(${CELEBRATE_LAYOUT.watsonOffsetPx.x}px, ${CELEBRATE_LAYOUT.watsonOffsetPx.y}px)`,
              }}
            >
              {watson}
            </div>
            {!reducedMotion && poses.holmes === "high-five" ? (
              <span
                className="detective-celebrate-spark"
                style={{
                  left: CELEBRATE_LAYOUT.holmesContactPx.x,
                  top: CELEBRATE_LAYOUT.holmesContactPx.y,
                }}
              >
                ✦
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-end gap-1">
            {holmes}
            {watson}
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" data-testid="subject-pair-caption">
        {caption?.words ?? ""}
      </p>
    </div>
  );
}
