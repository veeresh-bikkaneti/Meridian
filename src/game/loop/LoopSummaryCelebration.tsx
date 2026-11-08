import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

// The game-end celebration on the GeoDetective session summary — a
// SIBLING of src/components/summary-detective-celebration.tsx, not a
// reuse of it. The classic component is score-shaped: its props are
// totalScore + a per-edition score split, its frame renders a big
// score number, and its aria-label announces "your score of N".
// GeoDetective has no score — its session ends in cases closed — so
// the frame here carries the loop's own count instead. Everything
// else is the classic's machinery, shared verbatim: the DetectivePair
// rigs, CELEBRATE_LAYOUT's high-five contact arithmetic, the U8 dwell
// timings, createCelebrationLinePlayer (the fixed "What a game! Well
// played, everyone!" line carries no number, so it can never disagree
// with the count in frame), resolveSummaryCelebrationMode /
// readConnectionSignals for the degradation matrix, the
// meridian:celebration-open/close yield handshake while playing, and
// the hostsStaging halo.
//
// Why this is its own lazy component: LoopSessionSummary renders it
// only when the `detectivePair` flag is on, behind React.lazy, so a
// flag-off session pays ~zero bundle cost for the pair and contains
// no pair DOM at all. It fires exactly once per mount — one mount per
// summary presentation, so exactly one game-end celebration per
// session end.
import {
  CELEBRATE_LAYOUT,
  HolmesRig,
  WatsonRig,
  type HolmesPose,
  type WatsonPose,
} from "@/game/loop/detective/DetectivePair";
import {
  CELEBRATE_JUMP_MS,
  CLAP_HOLD_MS,
  HIGH_FIVE_HOLD_MS,
} from "@/game/loop/detective/detective-state";
import {
  readConnectionSignals,
  resolveSummaryCelebrationMode,
} from "@/game/loop/detective/detective-degradation";
import { createCelebrationLinePlayer } from "@/components/summary-celebration-line";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { isEnabled } from "@/lib/flags";
import "@/game/loop/detective/detective.css";

type CelebrateStep = "jump" | "high-five" | "clap" | "settle";

const STEP_POSES: Record<
  CelebrateStep,
  { holmes: HolmesPose; watson: WatsonPose }
> = {
  jump: { holmes: "celebrate-jump", watson: "celebrate-jump" },
  "high-five": { holmes: "high-five", watson: "high-five" },
  clap: { holmes: "clap", watson: "clap" },
  settle: { holmes: "gaze-up", watson: "station-idle" },
};

/* The spoken line itself lives in summary-celebration-line.ts (the
 * testable seam): its player holds the line's Audio element, gates
 * at play time and again after the manifest await, and subscribes
 * to onSoundChanged so a mid-line mute pauses the line and settles
 * the driver below. */

export default function LoopSummaryCelebration(props: {
  casesClosed: number;
}): JSX.Element {
  const { casesClosed } = props;
  const reducedMotion = usePrefersReducedMotion();
  // Mode is read once, at mount: the summary is a resting screen, so
  // the boot-time signals are the session's truth (the flags pattern).
  const [mode] = useState(() =>
    resolveSummaryCelebrationMode({
      reducedMotion,
      ...readConnectionSignals(),
    }),
  );
  const animated = mode === "animated";
  const [step, setStep] = useState<CelebrateStep>(
    animated ? "jump" : "high-five",
  );
  const [speaking, setSpeaking] = useState(false);
  // The celebration "plays" (and any narration yields) from mount
  // until the choreography has settled AND the line has finished.
  const [playing, setPlaying] = useState(animated);
  const startedRef = useRef(false);

  /* The yield handshake — the celebration-overlay pattern verbatim:
   * announce on play, release on settle/unmount. The
   * data-celebration attribute on the root covers a narration that
   * mounts while the celebration is already in flight. */
  useEffect(() => {
    if (!playing) return;
    window.dispatchEvent(new Event("meridian:celebration-open"));
    return () => {
      window.dispatchEvent(new Event("meridian:celebration-close"));
    };
  }, [playing]);

  /* The local driver: U8's dwell chain (jump → high-five → clap →
   * settle), with the spoken line running in parallel from the first
   * beat. Fires exactly once per mount — one mount per summary
   * presentation, so exactly one game-end celebration per session
   * end. Static mode never enters here. */
  useEffect(() => {
    if (!animated || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let speechDone = false;
    let settleDone = false;
    const maybeFinish = () => {
      if (!cancelled && speechDone && settleDone) setPlaying(false);
    };
    timers.push(setTimeout(() => !cancelled && setStep("high-five"), CELEBRATE_JUMP_MS));
    timers.push(
      setTimeout(
        () => !cancelled && setStep("clap"),
        CELEBRATE_JUMP_MS + HIGH_FIVE_HOLD_MS,
      ),
    );
    timers.push(
      setTimeout(
        () => {
          if (cancelled) return;
          setStep("settle");
          settleDone = true;
          maybeFinish();
        },
        CELEBRATE_JUMP_MS + HIGH_FIVE_HOLD_MS + CLAP_HOLD_MS,
      ),
    );
    // The line player (summary-celebration-line.ts) holds the
    // line's Audio element in its own ref and subscribes to
    // onSoundChanged for its lifetime: a mid-line mute pauses the
    // element, the pause settles the player's promise, and
    // speechDone lands through the .then below so the choreography
    // completes sanely instead of waiting on a silenced clip.
    // dispose() unsubscribes — called in this effect's cleanup, so
    // unmount always unsubscribes.
    const linePlayer = createCelebrationLinePlayer();
    void linePlayer
      .play(
        () => cancelled,
        (s) => !cancelled && setSpeaking(s),
      )
      .then(() => {
        speechDone = true;
        maybeFinish();
      });
    return () => {
      cancelled = true;
      linePlayer.dispose();
      for (const t of timers) clearTimeout(t);
    };
  }, [animated]);

  const poses = STEP_POSES[step];
  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-[rgba(232,182,76,0.28)] bg-black/30 px-3 py-2"
      data-testid="loop-summary-celebration"
      data-mode={mode}
      data-step={step}
      data-celebration={playing ? "active" : undefined}
    >
      {/* The pair, in the shipped celebrate cluster: Holmes at the
          origin, Watson offset by CELEBRATE_LAYOUT so the high-five
          step's raised hands meet palm-to-palm (HIGH_FIVE_CONTACT). */}
      <div
        className="detective-host-celebrate"
        role="img"
        aria-label={`Holmes and Watson celebrate with you — ${casesClosed} ${casesClosed === 1 ? "case" : "cases"} closed`}
      >
        <div className="detective-celebrate-holmes">
          <div className="detective-host-figure" data-detective="holmes">
            <HolmesRig pose={poses.holmes} facing="right" speaking={speaking} halo={isEnabled("hostsStaging")} />
          </div>
        </div>
        <div
          className="detective-celebrate-watson"
          style={{
            transform: `translate(${CELEBRATE_LAYOUT.watsonOffsetPx.x}px, ${CELEBRATE_LAYOUT.watsonOffsetPx.y}px)`,
          }}
        >
          <div className="detective-host-figure" data-detective="watson">
            <WatsonRig pose={poses.watson} facing="left" speaking={false} halo={isEnabled("hostsStaging")} />
          </div>
        </div>
        {animated && step === "high-five" ? (
          <span
            className="detective-celebrate-spark"
            style={{
              left: CELEBRATE_LAYOUT.holmesContactPx.x,
              top: CELEBRATE_LAYOUT.holmesContactPx.y,
            }}
            aria-hidden="true"
          >
            ✦
          </span>
        ) : null}
      </div>
      {/* The count in the celebration frame: the same cases-closed
          total the summary lists below — presented here so the
          celebration itself carries the result. */}
      <div className="min-w-32 text-center">
        <p
          className="font-display text-4xl tabular-nums"
          data-testid="loop-celebration-cases-closed"
        >
          {casesClosed}
        </p>
        <p className="mt-0.5 text-xs text-white/60">cases closed</p>
      </div>
    </div>
  );
}
