import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

// Unit B — the game-end celebration on the run-summary screen, in EVERY
// edition (State / Country / Globe / GeoDetective alike).
//
// Why this is its own lazy component: RunSummaryCard renders it only
// when the `detectivePair` flag is on, behind React.lazy, so the
// flag-off game pays ~zero bundle cost for the pair and — stronger —
// contains no pair DOM at all. The choreography reuses the shipped
// celebration (the DetectivePair rigs, CELEBRATE_LAYOUT's high-five
// contact arithmetic, detective.css's transform/opacity-only classes,
// and U8's dwell timings), driven by a small LOCAL driver below — the
// GeoDetective loop's state machine and companion are never touched:
// a per-case solve still celebrates inside LoopScreen exactly as
// before, and this mount is the single game-end firing per summary.
//
// The storyteller narration that lives at the top of the summary card
// yields to a celebration through the shipped handshake (the
// celebration-overlay pattern): while this celebration plays, the
// root carries data-celebration="active" and the window hears
// meridian:celebration-open; when it settles, the close event fires
// and the narration may proceed. While the celebration plays, the
// pair owns the slot — the narration stays yielded.
//
// Spoken score — PATH 2 (measured fallback, see render-plan.mjs):
// a composable spoken total was measured broken (single-word number
// renders are pitch-unstable across passes), so Holmes speaks ONE
// fixed line ("score-celebration") and the score itself is presented
// in this frame as text — the same summary.totalScore and
// summary.byEdition the card renders below. A spoken number can
// therefore never disagree with the displayed total. Speech honours
// decision 6 at play time: the global sound toggle, the hidden-tab
// guard, and the player's read-aloud preference (detectiveCanAutoPlay)
// — the same gates the loop player applies.
//
// Degradation (U9 matrix, via resolveSummaryCelebrationMode):
// reduced-motion / Save-Data / low memory → the pair stands frozen at
// the high-five with the score in frame: no motion, no audio, and no
// celebration yield (nothing is playing, so the narration is free).
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
import { EDITION_LABELS, type SessionSummary } from "@/game/session";
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
 * the driver below (cure, panel round 1 — Game Audio MAJOR). */

export function SummaryDetectiveCelebration(props: {
  totalScore: number;
  byEdition: SessionSummary["byEdition"];
}): JSX.Element {
  const { totalScore, byEdition } = props;
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
  // The celebration "plays" (and the narration yields) from mount
  // until the choreography has settled AND the line has finished.
  const [playing, setPlaying] = useState(animated);
  const startedRef = useRef(false);

  /* The storyteller yield handshake — the celebration-overlay pattern
   * verbatim: announce on play, release on settle/unmount. The
   * data-celebration attribute on the root covers a narration that
   * mounts while the celebration is already in flight. */
  useEffect(() => {
    if (!playing) return;
    window.dispatchEvent(new Event("meridian:celebration-open"));
    return () => {
      window.dispatchEvent(new Event("meridian:celebration-close"));
    };
  }, [playing]);

  /* The local driver: U8's dwell chain (jump 1150 ms → high-five
   * 900 ms → clap 800 ms → settle), with the spoken line running in
   * parallel from the first beat. Fires exactly once per mount —
   * one mount per summary presentation, so exactly one game-end
   * celebration per run end. Static mode never enters here. */
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
      data-testid="summary-detective-celebration"
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
        aria-label={`Holmes and Watson celebrate your score of ${totalScore}`}
      >
        <div className="detective-celebrate-holmes">
          <div className="detective-host-figure" data-detective="holmes">
            <HolmesRig pose={poses.holmes} facing="right" speaking={speaking} />
          </div>
        </div>
        <div
          className="detective-celebrate-watson"
          style={{
            transform: `translate(${CELEBRATE_LAYOUT.watsonOffsetPx.x}px, ${CELEBRATE_LAYOUT.watsonOffsetPx.y}px)`,
          }}
        >
          <div className="detective-host-figure" data-detective="watson">
            <WatsonRig pose={poses.watson} facing="left" speaking={false} />
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
      {/* The score in the celebration frame: the same total and the
          same per-edition split the card renders below — presented
          here so the celebration itself carries the result. */}
      <div className="min-w-32 text-center">
        <p
          className="font-display text-4xl tabular-nums"
          data-testid="celebration-total"
        >
          {totalScore}
        </p>
        <p className="mt-0.5 text-xs text-white/60">total score</p>
        {byEdition.length > 0 ? (
          <dl className="mt-2 space-y-1 text-left text-xs">
            {byEdition.map((b) => (
              <div key={b.edition} className="flex justify-between gap-3">
                <dt className="text-white/60">
                  {EDITION_LABELS[b.edition]}{" "}
                  <span className="text-white/40">
                    · {b.places} {b.places === 1 ? "place" : "places"}
                  </span>
                </dt>
                <dd className="tabular-nums">
                  {b.score.toLocaleString("en-US")}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}

export default SummaryDetectiveCelebration;
