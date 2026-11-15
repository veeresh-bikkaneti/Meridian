/**
 * ClueScene — a short film for a subject case's clue, drawn live
 * in the browser as ink line-art on paper (feat/clue-scene-pilot).
 * It sits above the text clue, which stays as the readable
 * fallback and caption; no new screen, no video file.
 *
 * Answer-blind, structurally (the subject-host-props.ts pattern):
 * this component receives ONLY a scene description (the givens
 * from the item's question, in data next to the answers) and a
 * phase — "setup" before the pick, "solved" after a correct one.
 * It never receives the answer, a choice, or a pick. The setup
 * film sets the scene only; the solved beat computes its grouping
 * from the givens at solve time, the derivation the result card
 * prints a moment later.
 *
 * Act 3 — the narrated summary. A description may carry a summary
 * (its script and clip, in the solved-phase data path). This
 * component reads it ONLY in the solved phase: after a correct
 * pick the same solved beat runs again, re-paced so each step
 * lands with its narration line, the clip playing through the
 * app-wide voice channel (voice-channel.ts — one voice at a
 * time, never over another speaker) while the captions step
 * under the film. The full script also stands as text in the
 * case's result section (ClueSummaryText, below), so the summary
 * is fully present with the sound off, the clip unavailable, or
 * motion reduced. Under reduced motion nothing auto-plays: the
 * still frame stands, and the Hear button plays the voice and
 * captions against the still.
 *
 * Motion discipline: CSS keyframes only (transform / opacity /
 * stroke draw-on), authored so every element's resting state IS
 * the film's final frame. The film plays once, then rests; a
 * Replay button runs it again. Animations pause while the scene
 * is off screen or the tab is hidden (IntersectionObserver +
 * visibilitychange, the GkGlobeOverlay rule). Under reduced
 * motion the parent passes reduced and the scene renders the
 * still frame of the current phase — no animation at all.
 *
 * The drawing discipline owes to the line-art-animation library
 * (MIT; see clue-scene-easing.ts): lines curve, nothing is
 * ruler-straight, and a seeded layout keeps the scatter identical
 * on every load. Its imperative DOM builders were not copied —
 * this tree renders SVG declaratively.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  countingTicks,
  dealOrder,
  summaryStepStart,
  type ClueSceneDescription,
  type ClueScenePhase,
  type ClueSceneSummary,
} from "./clue-scene-types";
import { seeded } from "./clue-scene-easing";
import { BusBoardingScene, PackBoxesScene } from "./clue-scene-kinds-a";
import {
  DigitShiftScene,
  PlaceCompareScene,
  PlaceValueScene,
} from "./clue-scene-kinds-b";
import {
  ChunkShareScene,
  RoundingLineScene,
  SplitProductScene,
} from "./clue-scene-kinds-c";
import { claimVoice, type VoiceClaim } from "../../game/audio/voice-channel";
import { isSoundEnabled } from "../../game/audio/sfx";
import { soundAudible } from "../../game/audio/play-guards";
import { getReadAloudPref } from "../../game/age-profile/read-aloud-pref";

export type { ClueScenePhase };

const delay = (s: number): CSSProperties => ({ animationDelay: `${s.toFixed(2)}s` });
const slideFrom = (fx: number, fy: number, s: number): CSSProperties =>
  ({
    "--fx": `${fx.toFixed(1)}px`,
    "--fy": `${fy.toFixed(1)}px`,
    animationDelay: `${s.toFixed(2)}s`,
  }) as CSSProperties;

/** The loose pile the coin scene opens with (seeded: same every load). */
function coinPile(total: number): { x: number; y: number }[] {
  const rnd = seeded(7);
  const pile: { x: number; y: number }[] = [];
  for (let i = 0; i < total; i++) {
    pile.push({ x: 52 + rnd() * 216, y: 100 + rnd() * 24 });
  }
  return pile;
}

/** Slot offsets inside one coin group (a centre coin, the rest ringed). */
function groupSlot(slot: number, groupSize: number): { x: number; y: number } {
  if (slot === 0 || groupSize === 1) return { x: 0, y: 0 };
  const angle = ((slot - 1) / (groupSize - 1)) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * 12, y: Math.sin(angle) * 11 };
}

function CoinGroupsScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "coin-groups" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, group g's beat starts at
   * stepDelay(g) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const pile = coinPile(description.total);
  const ticks = countingTicks(description);
  const groups = description.total / description.groupSize;
  const cols = Math.max(2, Math.ceil(Math.sqrt(groups * 1.8)));
  const groupCentre = (g: number) => ({
    x: 52 + (g % cols) * (216 / (cols - 1)),
    y: g < cols ? 58 : 116,
  });
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 92 Q160 86 296 92" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 140 Q160 145 304 140" style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d="M44 140 L40 166 M276 140 L280 166" style={delay(0.25)} />
      {phase === "setup"
        ? pile.map((p, i) => (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
              <g className="cs-pop" style={delay(0.5 + i * 0.055)}>
                <circle className="cs-coin" r="8.5" />
                <circle className="cs-coin-inner" r="4.4" />
              </g>
            </g>
          ))
        : pile.map((start, i) => {
            const g = Math.floor(i / description.groupSize);
            const slot = i % description.groupSize;
            const c = groupCentre(g);
            const off = groupSlot(slot, description.groupSize);
            const fin = { x: c.x + off.x, y: c.y + off.y };
            return (
              <g key={i} transform={`translate(${fin.x.toFixed(1)} ${fin.y.toFixed(1)})`}>
                <g
                  className="cs-slide"
                  style={slideFrom(
                    start.x - fin.x,
                    start.y - fin.y,
                    stepDelay ? stepDelay(g) + slot * 0.07 : 0.3 + g * 0.55 + slot * 0.07,
                  )}
                >
                  <circle className="cs-coin" r="8.5" />
                  <circle className="cs-coin-inner" r="4.4" />
                </g>
              </g>
            );
          })}
      {phase === "solved" ? (
        <>
          {Array.from({ length: groups }, (_, g) => {
            const c = groupCentre(g);
            return (
              <ellipse
                key={`ring-${g}`}
                className="cs-ring"
                cx={c.x}
                cy={c.y}
                rx="25"
                ry="22"
                style={delay(
                  stepDelay
                    ? stepDelay(g) + 0.85
                    : 0.3 + g * 0.55 + description.groupSize * 0.07 + 0.65,
                )}
              />
            );
          })}
          {ticks.map((t, ti) => (
            <text
              key={`tick-${t}`}
              className={`cs-tick${ti === ticks.length - 1 ? " cs-tick-final" : ""}`}
              x={30 + ti * (260 / Math.max(ticks.length - 1, 1))}
              y="24"
              style={delay(
                stepDelay
                  ? stepDelay(ti) + 0.75
                  : 0.3 + ti * 0.55 + description.groupSize * 0.07 + 0.8,
              )}
            >
              {t}
            </text>
          ))}
        </>
      ) : null}
    </>
  );
}

function PencilPacksScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "pencil-packs" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, pack g's beat starts at
   * stepDelay(g) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const ticks = countingTicks(description);
  const packX = (g: number) => 38 + g * 36;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 46 Q160 42 296 46" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M20 146 Q160 150 300 146" style={delay(0)} />
      <path className="cs-line cs-draw" pathLength={1} d="M16 184 Q160 187 304 184" style={delay(0.15)} />
      {Array.from({ length: description.packs }, (_, g) => (
        <g key={`pack-${g}`} transform={`translate(${packX(g)} 88)`}>
          <g className="cs-pop" style={delay(0.35 + g * 0.13)}>
            <rect className="cs-pack" x="0" y="0" width="28" height="58" rx="3" />
            <path className="cs-line cs-band" d="M1 40 Q14 42 27 40" />
            {phase === "setup" ? (
              <g className="cs-fade" style={delay(0.7 + g * 0.13)}>
                {Array.from({ length: description.perPack }, (_, s) => {
                  const tx = 4 + s * 5.6;
                  return (
                    <path
                      key={s}
                      className="cs-tip"
                      d={`M${tx.toFixed(1)} 1 L${(tx + 2.4).toFixed(1)} -9 L${(tx + 4.8).toFixed(1)} 1 Z`}
                    />
                  );
                })}
              </g>
            ) : (
              <path className="cs-line" d="M2 2 Q14 -5 26 2" />
            )}
          </g>
        </g>
      ))}
      {phase === "solved"
        ? Array.from({ length: description.packs }, (_, g) =>
            Array.from({ length: description.perPack }, (_, s) => {
              const x = packX(g) + 4 + s * 6.2;
              return (
                <g key={`pencil-${g}-${s}`} transform={`translate(${x.toFixed(1)} 165)`}>
                  <g
                    className="cs-pop"
                    style={delay(stepDelay ? stepDelay(g) + 0.1 + s * 0.05 : 0.4 + g * 0.6 + s * 0.05)}
                  >
                    <path className="cs-tip" d="M0 0 L4.6 0 L2.3 -6 Z" />
                    <rect className="cs-pencil" x="0" y="0" width="4.6" height="19" />
                  </g>
                </g>
              );
            }),
          )
        : null}
      {phase === "solved"
        ? ticks.map((t, ti) => (
            <text
              key={`tick-${t}`}
              className={`cs-tick${ti === ticks.length - 1 ? " cs-tick-final" : ""}`}
              x={packX(ti) + 14}
              y="26"
              style={delay(stepDelay ? stepDelay(ti) + 0.8 : 0.4 + ti * 0.6 + 0.35)}
            >
              {t}
            </text>
          ))
        : null}
    </>
  );
}

const FRIEND_X = [48, 122, 198, 272];
const SNACK_STACK = [
  { x: -8, y: 0 },
  { x: 8, y: 0 },
  { x: 0, y: -7 },
  { x: -4, y: -1 },
];

function snackPile(total: number): { x: number; y: number }[] {
  const rows = [
    { y: 72, xs: [-20, -7, 6, 19] },
    { y: 81, xs: [-26, -13, 0, 13, 26] },
    { y: 89, xs: [-14, 0, 14] },
  ];
  const pile: { x: number; y: number }[] = [];
  for (const row of rows) {
    for (const dx of row.xs) pile.push({ x: 160 + dx, y: row.y });
  }
  return pile.slice(0, total);
}

function SnackArt() {
  return (
    <>
      <circle className="cs-snack" r="6" />
      <circle className="cs-snack-dot" cx="-2" cy="-1.5" r="1" />
      <circle className="cs-snack-dot" cx="2.2" cy="1" r="1" />
      <circle className="cs-snack-dot" cx="-0.5" cy="2.6" r="1" />
    </>
  );
}

function FairShareScene({
  description,
  phase,
  stepDelay,
}: {
  description: Extract<ClueSceneDescription, { kind: "fair-share" }>;
  phase: ClueScenePhase;
  /** Summary pacing: when present, snack i's deal starts at
   * stepDelay(i) instead of the film's own stagger. */
  stepDelay?: (step: number) => number;
}) {
  const pile = snackPile(description.total);
  const order = dealOrder(description);
  const cheerDelay = stepDelay
    ? stepDelay(description.total - 1) + 1.0
    : 0.35 + description.total * 0.42 + 0.25;
  return (
    <>
      <path className="cs-line cs-soft cs-draw" pathLength={1} d="M24 38 Q160 34 296 38" style={delay(0.1)} />
      <path className="cs-line cs-draw" pathLength={1} d="M14 152 Q160 156 306 152" style={delay(0)} />
      {/* The snack stand at the back of the table. */}
      <ellipse className="cs-line cs-draw" pathLength={1} cx="160" cy="94" rx="54" ry="10" style={delay(0.2)} />
      <path className="cs-line cs-draw" pathLength={1} d="M160 104 L160 122 M146 124 Q160 121 174 124" style={delay(0.3)} />
      {/* Friends, with an empty plate each. */}
      {FRIEND_X.slice(0, description.friends).map((fx, fi) => (
        <g key={`friend-${fi}`}>
          <g className={phase === "solved" ? "cs-cheer" : undefined} style={phase === "solved" ? delay(cheerDelay) : undefined}>
            <circle className="cs-line cs-draw" pathLength={1} cx={fx} cy="58" r="11" style={delay(0.3 + fi * 0.15)} />
            <path
              className="cs-line cs-draw"
              pathLength={1}
              d={`M${fx - 4} 60 Q${fx} 64 ${fx + 4} 60`}
              style={delay(0.55 + fi * 0.15)}
            />
            <path
              className="cs-line cs-draw"
              pathLength={1}
              d={`M${fx - 17} 94 Q${fx} 76 ${fx + 17} 94`}
              style={delay(0.4 + fi * 0.15)}
            />
          </g>
          <ellipse
            className="cs-line cs-draw"
            pathLength={1}
            cx={fx}
            cy="140"
            rx="21"
            ry="5.5"
            style={delay(0.45 + fi * 0.15)}
          />
        </g>
      ))}
      {phase === "setup"
        ? pile.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y})`}>
              <g className="cs-pop" style={delay(0.6 + i * 0.06)}>
                <SnackArt />
              </g>
            </g>
          ))
        : pile.map((p, i) => {
            const friend = order[i] ?? 0;
            const round = Math.floor(i / description.friends);
            const off = SNACK_STACK[round % SNACK_STACK.length] ?? { x: 0, y: 0 };
            const fin = { x: (FRIEND_X[friend] ?? 160) + off.x, y: 131 + off.y };
            return (
              <g key={i} transform={`translate(${fin.x} ${fin.y})`}>
                <g
                  className="cs-deal"
                  style={slideFrom(p.x - fin.x, p.y - fin.y, stepDelay ? stepDelay(i) : 0.35 + i * 0.42)}
                >
                  <SnackArt />
                </g>
              </g>
            );
          })}
    </>
  );
}

/** Seconds between two animation steps that share one narration
 * line, per scene kind — groups land slower than single snacks. */
const SUMMARY_STAGGER: Record<ClueSceneDescription["kind"], number> = {
  "coin-groups": 0.62,
  "pencil-packs": 0.62,
  "fair-share": 0.34,
  "bus-boarding": 0.95,
  "pack-boxes": 0.85,
  "place-value": 0.8,
  "place-compare": 0.7,
  "rounding-line": 0.9,
  "digit-shift": 0.5,
  "split-product": 0.9,
  "chunk-share": 1.15,
};

/** The summary clip's URL (public/audio/subjects/, manifest.json). */
function summaryClipUrl(clip: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const withSlash = base.endsWith("/") ? base : `${base}/`;
  return `${withSlash}audio/subjects/${clip}`;
}

type SummaryState = "idle" | "playing" | "done";

/**
 * The summary's full script as standing text — rendered by the
 * case flow inside the result section, so the walk-through is
 * fully present once the case is solved: sound off, clip
 * unavailable, reduced motion, or a screen reader all get every
 * line. Static by design; the stepping captions live in the
 * scene card, beside the film they pace.
 */
export function ClueSummaryText({ summary }: { summary: ClueSceneSummary }) {
  return (
    <div className="clue-summary-text" data-testid="clue-summary-text">
      <p className="clue-summary-heading">The solving, step by step</p>
      <ol>
        {summary.lines.map((line, i) => (
          <li key={i}>{line.text}</li>
        ))}
      </ol>
    </div>
  );
}

/** The scene art for a description's kind — pilot kinds above,
 * the wave-1 kinds in their own modules (clue-scene-kinds-a/b/c). */
function SceneArt({
  description,
  phase,
  stepDelay,
}: {
  description: ClueSceneDescription;
  phase: ClueScenePhase;
  stepDelay?: (step: number) => number;
}) {
  switch (description.kind) {
    case "coin-groups":
      return <CoinGroupsScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "pencil-packs":
      return <PencilPacksScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "fair-share":
      return <FairShareScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "bus-boarding":
      return <BusBoardingScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "pack-boxes":
      return <PackBoxesScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "place-value":
      return <PlaceValueScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "place-compare":
      return <PlaceCompareScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "rounding-line":
      return <RoundingLineScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "digit-shift":
      return <DigitShiftScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "split-product":
      return <SplitProductScene description={description} phase={phase} stepDelay={stepDelay} />;
    case "chunk-share":
      return <ChunkShareScene description={description} phase={phase} stepDelay={stepDelay} />;
  }
}

export function ClueScene({
  description,
  phase,
  reduced,
}: {
  description: ClueSceneDescription;
  phase: ClueScenePhase;
  reduced: boolean;
}) {
  const [runKey, setRunKey] = useState(0);
  const [offScreen, setOffScreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ── Act 3: the narrated summary performance ──────────────────
  const [summaryState, setSummaryState] = useState<SummaryState>("idle");
  const [captionStep, setCaptionStep] = useState(-1);
  const [paced, setPaced] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const claimRef = useRef<VoiceClaim | null>(null);
  const timersRef = useRef<number[]>([]);
  const perfRef = useRef(0);

  /** Tear a performance down without touching state (unmount,
   * channel stop): silence the clip, clear its timers, give the
   * voice channel back. A stale release is a no-op by the
   * channel's own contract. */
  const clearPerformance = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    claimRef.current?.release();
    claimRef.current = null;
  };

  const stopPerformance = (finished: boolean) => {
    perfRef.current += 1;
    clearPerformance();
    // A natural finish leaves the closing line standing under
    // the film (the method's payoff stays on screen); a stop
    // clears the caption.
    const sum = description.summary;
    setCaptionStep(finished && sum ? sum.lines.length - 1 : -1);
    setSummaryState(finished ? "done" : "idle");
  };
  const stopRef = useRef(stopPerformance);
  stopRef.current = stopPerformance;

  /** Captions on timers — the fallback when the clip cannot play
   * (codec, network, autoplay refusal) and the silent run when
   * the sound is off. The pacing still lands on the same offsets. */
  const runCaptionTimers = (id: number, sum: ClueSceneSummary) => {
    sum.lines.forEach((line, i) => {
      timersRef.current.push(
        window.setTimeout(() => {
          if (perfRef.current === id) setCaptionStep(i);
        }, line.at * 1000),
      );
    });
  };

  const startPerformance = (userInitiated: boolean) => {
    const sum = description.summary;
    if (!sum || phase !== "solved") return;
    stopPerformance(false);
    const id = perfRef.current;
    // Re-run the solved beat paced to the narration. Under
    // reduced motion the still stands; only voice + captions run.
    setPaced(!reduced);
    setRunKey((k) => k + 1);
    setSummaryState("playing");
    let audioStarted = false;
    if (isSoundEnabled() && soundAudible()) {
      // One voice at a time: the summary claims the shared
      // channel like every other speaker. A tap takes the
      // channel; the automatic start waits its turn — if another
      // voice holds it, the performance runs on captions alone
      // and the Hear button can replay it with the voice later.
      const claim = claimVoice(
        "clue-summary",
        () => {
          if (perfRef.current === id) stopRef.current(false);
        },
        { userInitiated },
      );
      if (claim) {
        claimRef.current = claim;
        const audio = new Audio(summaryClipUrl(sum.clip));
        audioRef.current = audio;
        let fellBack = false;
        const fallBackToCaptions = () => {
          if (fellBack || perfRef.current !== id) return;
          fellBack = true;
          claimRef.current?.release();
          claimRef.current = null;
          if (audioRef.current === audio) audioRef.current = null;
          runCaptionTimers(id, sum);
        };
        audio.addEventListener("timeupdate", () => {
          if (perfRef.current !== id) return;
          const t = audio.currentTime;
          let step = -1;
          for (let i = 0; i < sum.lines.length; i++) {
            if (t >= (sum.lines[i]?.at ?? 0)) step = i;
          }
          setCaptionStep((prev) => (prev === step ? prev : step));
        });
        audio.addEventListener("ended", () => {
          if (perfRef.current === id) stopRef.current(true);
        });
        audio.addEventListener("error", fallBackToCaptions);
        audioStarted = true;
        void audio.play().catch(fallBackToCaptions);
      }
    }
    if (!audioStarted) runCaptionTimers(id, sum);
    // The performance ends with its last line even if the clip's
    // own end event is ever missed.
    timersRef.current.push(
      window.setTimeout(() => {
        if (perfRef.current === id) stopRef.current(true);
      }, (sum.duration + 0.6) * 1000),
    );
  };
  const startRef = useRef(startPerformance);
  startRef.current = startPerformance;

  // A phase change (the correct pick lands) starts the new beat.
  // In the solved phase the summary also starts itself — unless
  // reduced motion is on (nothing auto-plays then: the still, the
  // standing text, and the Hear button wait for a tap) or the
  // kid's read-aloud choice says tap-to-play: "sometimes" and
  // "never" never auto-play (read-aloud-pref's own semantics);
  // "always" and "unset" do, this surface's solved moment being
  // its own, like the detective pair's auto mode inside a case.
  useEffect(() => {
    if (phase !== "solved") {
      stopRef.current(false);
      setPaced(false);
      setRunKey((k) => k + 1);
      return;
    }
    const pref = getReadAloudPref();
    if (description.summary && !reduced && pref !== "sometimes" && pref !== "never") {
      startRef.current(false);
    } else {
      setRunKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOffScreen(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(root);
    const onVisibility = () => {
      setTabHidden(document.hidden);
      // No sound while the tab is hidden (the play-guards rule) —
      // a hidden tab ends the performance, voice included.
      if (document.hidden) stopRef.current(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Leaving the case silences the summary and frees the channel.
  useEffect(
    () => () => {
      perfRef.current += 1;
      clearPerformance();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const label = phase === "setup" ? description.labelSetup : description.labelSolved;
  const summary = phase === "solved" ? description.summary : undefined;
  const stepDelay =
    paced && summary
      ? (step: number) => summaryStepStart(summary, step, SUMMARY_STAGGER[description.kind])
      : undefined;

  const onSummaryTap = () => {
    if (summaryState === "playing") stopPerformance(false);
    else startPerformance(true);
  };

  return (
    <div
      ref={rootRef}
      className="clue-scene mode-card"
      data-testid="clue-scene"
      data-phase={phase}
      data-paused={offScreen || tabHidden ? "true" : undefined}
      data-still={reduced ? "true" : undefined}
      data-summary={summary ? summaryState : undefined}
    >
      <svg key={runKey} viewBox="0 0 320 190" role="img" aria-label={label}>
        <SceneArt description={description} phase={phase} stepDelay={stepDelay} />
      </svg>
      {summary ? (
        <p className="clue-scene-caption" data-testid="clue-scene-caption" aria-hidden="true">
          {captionStep >= 0 ? (summary.lines[captionStep]?.text ?? "") : ""}
        </p>
      ) : null}
      <div className="clue-scene-controls">
        {!reduced ? (
          <button
            type="button"
            className="clue-scene-replay"
            onClick={() => {
              stopPerformance(false);
              setPaced(false);
              setRunKey((k) => k + 1);
            }}
          >
            ↻ Replay the film
          </button>
        ) : null}
        {summary ? (
          <button
            type="button"
            className="clue-scene-replay"
            data-testid="clue-summary-play"
            onClick={onSummaryTap}
          >
            {summaryState === "playing"
              ? "⏸ Stop the summary"
              : summaryState === "done"
                ? "↻ Replay the summary"
                : "▶ Hear the summary"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
