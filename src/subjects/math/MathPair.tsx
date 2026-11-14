/**
 * MathPair — Holmes & Watson as a slim bench strip above the math
 * case, mounted by MathCase ONLY when the detectivePair flag resolves
 * on (flag off: this component is never rendered and the case is
 * exactly what main renders).
 *
 * The rigs are the shipped GeoDetective pair (DetectivePair.tsx,
 * consumed never edited): pose / speaking props only, so the pair
 * stays answer-blind — the strip receives the case's answer-blind
 * event list (case-voice.ts), never an answer, an item, or game
 * state. Same pair for every age band; detective.css carries the
 * motion rules, including its prefers-reduced-motion block (poses
 * still change, motion does not — audio behaviour unchanged).
 *
 * Voice lives here: one createMathCaseVoice player per mount, fed
 * the events the wrapper has not processed yet, in order. The player
 * is stopped and disposed on unmount.
 */
import { useEffect, useRef, useState } from "react";
import {
  HolmesRig,
  WatsonRig,
  type HolmesPose,
  type WatsonPose,
} from "@/game/loop/detective/DetectivePair";
import { isEnabled } from "@/lib/flags";
import {
  createMathCaseVoice,
  posesForMathCase,
  type DetectiveSpeaker,
  type MathCaseEvent,
  type MathCaseVoice,
} from "./case-voice";
import "@/game/loop/detective/detective.css";

export default function MathPair({
  events,
}: {
  /** Every case event fired so far this mount, in firing order. */
  events: readonly MathCaseEvent[];
}) {
  const [speaking, setSpeaking] = useState<DetectiveSpeaker | null>(null);
  const [lastEvent, setLastEvent] = useState<MathCaseEvent | null>(null);
  const [voice, setVoice] = useState<MathCaseVoice | null>(null);
  const processedRef = useRef(0);

  // One player per mount; on unmount stop whatever is sounding,
  // then dispose it.
  useEffect(() => {
    const created = createMathCaseVoice({
      onSpeakingChange: (who) => setSpeaking(who),
    });
    setVoice(created);
    return () => {
      created.stopAll();
      created.dispose();
    };
  }, []);

  // Feed each new event to the player exactly once, in order (a
  // final correct arrives as correct → finished in one batch, and
  // both must enqueue, in that order).
  useEffect(() => {
    if (!voice) return;
    for (const event of events.slice(processedRef.current)) {
      processedRef.current += 1;
      setLastEvent(event);
      voice.handleEvent(event);
    }
  }, [events, voice]);

  const poses = posesForMathCase(lastEvent, speaking);
  return (
    <div
      data-testid="math-detective-pair"
      data-event={lastEvent ?? ""}
      data-speaking={speaking ?? ""}
      className="mx-auto flex w-full max-w-3xl items-end justify-center gap-4 px-5 pt-4"
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
