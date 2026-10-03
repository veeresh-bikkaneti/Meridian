import { formatDistance } from "@/game/geo";
import { summarizeRun, type Run } from "@/game/run";
import { formatBreakdown, comboForStreak, formatFactor } from "@/game/scoring";
import { shareText } from "@/game/share";
import { SHARE_URL } from "@/game/share-action";
import { ShareButton } from "./share-button";
import type { Starter } from "@/game/starters";
import { Button } from "@/components/ui/button";
import type { Drop } from "./game-app";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { splitLede } from "./story-lede";
import { useAiSportsTeams, withSportsLine } from "@/game/sports-ai";
import { useAiStory, AI_STORY_BADGE } from "@/game/story-ai";

// Frosted chrome tokens shared by the floating aim/reveal chrome.
const CHROME =
  "backdrop-blur-[14px] bg-[rgba(10,12,16,0.72)] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Single 500ms rise on mount; opacity-only fade under reduced motion. */
function Rise({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={`transition-all ease-[cubic-bezier(0.16,1,0.3,1)] ${
        entered ? "translate-y-0 opacity-100" : reduced ? "opacity-0" : "translate-y-4 opacity-0"
      }`}
      style={{ transitionDuration: reduced ? "150ms" : "500ms" }}
    >
      {children}
    </div>
  );
}

/** Quick fade for the dismiss/restore transitions (267ms). */
function Fade({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={`transition-opacity ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      style={{ transitionDuration: reduced ? "0ms" : "267ms" }}
    >
      {children}
    </div>
  );
}

/**
 * Subtle disclosure for on-device AI story content. Non-interactive —
 * disclosure that doesn't interrupt kids. `role="img"` makes the
 * accessible name ("Written with on-device AI") programmatically
 * reachable: `aria-label` on a plain span is unreliable per ARIA, and
 * `title` tooltips never fire on touch devices.
 */
function AiStoryBadge() {
  return (
    <span
      role="img"
      aria-label={AI_STORY_BADGE.title}
      title={AI_STORY_BADGE.title}
      className="ml-1.5 inline-flex items-center rounded border border-white/20 bg-white/10 px-1 py-px align-middle text-[10px] font-medium tracking-wide text-white/70"
    >
      {AI_STORY_BADGE.label}
    </span>
  );
}

function ShareResult({ run, copyVariant = "primary" }: { run: Run; copyVariant?: "primary" | "secondary" }) {
  const summary = summarizeRun(run);
  const line = shareText({
    regionName: run.regionName,
    dateKey: run.dateKey,
    totalScore: summary.totalScore,
    placesPlayed: summary.placesPlayed,
    averagePerPlace: summary.averagePerPlace,
    bestStreak: run.bestStreak,
    scores: run.results.map((r) => r.score),
  });
  return (
    <div className="flex flex-col gap-3">
      <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 px-4 py-3 font-sans text-sm leading-relaxed text-white">
        {line}
      </pre>
      <ShareButton
        title="Meridian score"
        text={line}
        url={SHARE_URL}
        label="Share result"
        variant={copyVariant}
      />
    </div>
  );
}

export function ResultCard({
  run,
  place,
  placeLabel,
  drop,
  story,
  empty,
  dismissed,
  onDismissedChange,
  onContinue,
}: {
  run: Run;
  place: Starter | null;
  /**
   * The qualified question label ("Manhattan, Nebraska, United States"),
   * computed by the parent via buildQuestionLabel so the reveal card title
   * matches what the question bubble asked. Falls back to the bare place
   * name when disambiguation can't resolve.
   */
  placeLabel: string;
  drop: Drop | null;
  story: string | null;
  empty: boolean;
  dismissed: boolean;
  onDismissedChange: (dismissed: boolean) => void;
  onContinue: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const aiSports = useAiSportsTeams(place);
  const baseStory = story ?? place?.story ?? "";
  // On-device AI story fallback (story-ai.ts): fires only for generated
  // places with no build-time enrichment (no history hook, no ladder fact,
  // not curated). No Wikipedia extract is passed at this wiring stage, so
  // validation runs length + banned-pattern checks with prompt-only
  // grounding ("reply EMPTY rather than guess") — accepted deliberately;
  // the extract-fetch upgrade is a tracked follow-up, not a blocker.
  // The generic blurb is already on screen — the AI sentence upgrades it
  // when (and only when) it arrives validated. Null = blurb stands, no UI.
  const aiStory = useAiStory(place);
  // Composition order is deliberately blurb-first, deviating from card
  // rule 1 (history first): the blurb must paint instantly with no reflow
  // when the AI sentence lands seconds later, and the AI sentence stays
  // last so its badge unambiguously labels it (never the sports line).
  const withSports =
    aiSports && aiSports.length > 0 ? withSportsLine(baseStory, aiSports) : baseStory;
  const [storyLede, storyRest] = splitLede(withSports);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the card heading when a result appears (phase → story/done).
  // The commit control the user activated is gone by then; without this,
  // keyboard and screen-reader users lose their place.
  const phase = run.phase;
  useEffect(() => {
    if ((phase === "story" || phase === "done") && !dismissed) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [phase, dismissed, place?.name]);

  if (dismissed) {
    // Dismissing the card must never strand the run: the restore pill keeps
    // company with the continue action, so hiding the card can't funnel the
    // player into "End game" as the only visible way forward.
    return (
      <div className="pointer-events-none absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-2.5 z-20">
        <Fade reduced={reduced}>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Show result"
              onClick={() => onDismissedChange(false)}
              className={`flex h-11 items-center rounded-full px-4 text-sm font-medium text-white ${CHROME}`}
            >
              Result
            </button>
            {place ? (
              <button
                type="button"
                onClick={onContinue}
                className="flex h-11 items-center rounded-full bg-fg px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90"
              >
                Next place
              </button>
            ) : null}
          </div>
        </Fade>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2.5 pb-[max(16px,env(safe-area-inset-bottom))]">
      <Rise reduced={reduced}>
        <section
          aria-label="Result"
          className={`pointer-events-auto max-h-[45dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl p-4 text-white ${CHROME}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {place ? (
                <>
                  <p className="text-[11px] tracking-wider text-white/60 uppercase">
                    {run.regionName}
                  </p>
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-0.5 font-display text-2xl leading-tight outline-none"
                  >
                    {placeLabel}
                  </h2>
                </>
              ) : (
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-display text-2xl leading-tight outline-none"
                >
                  {run.regionName}
                </h2>
              )}
            </div>
            <button
              type="button"
              aria-label="Hide result"
              onClick={() => onDismissedChange(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {run.phase === "story" && place ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="font-display text-4xl tabular-nums">
                {drop ? formatDistance(drop.distanceKm) : "Hit"}
              </p>
              {drop?.breakdown ? (
                <p
                  data-testid="score-breakdown"
                  data-base={drop.breakdown.base}
                  data-mult={drop.breakdown.diffMult}
                  data-combo={drop.breakdown.combo}
                  data-bonus={drop.breakdown.regionBonus}
                  data-score={drop.breakdown.score}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm tabular-nums text-amber-100"
                >
                  {formatBreakdown(drop.breakdown)}
                </p>
              ) : null}
              <p className="text-sm text-white/70">
                The line is your pin to the spot. The circle is close enough.
              </p>
              <div
                className="max-h-44 overflow-y-auto"
                tabIndex={0}
                role="region"
                aria-label="Place story"
              >
                <p className="text-sm leading-relaxed">
                  {withSports}
                  {/* Dedicated live element: only the new AI sentence is
                      announced, never a full-paragraph re-read. */}
                  <span aria-live="polite">
                    {aiStory ? (
                      <>
                        {" "}{aiStory}
                        <AiStoryBadge />
                      </>
                    ) : null}
                  </span>
                </p>
              </div>
              <a
                className="text-sm text-white/70 underline"
                href={place.sourceHref}
                target="_blank"
                rel="noreferrer"
              >
                {place.sourceLabel}
              </a>
              <Button onClick={onContinue}>Next place</Button>
            </div>
          ) : null}

          {run.phase === "done" && place ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="font-display text-4xl tabular-nums">
                {drop ? `${formatDistance(drop.distanceKm)} off` : "Miss"}
              </p>
              <p
                data-testid="miss-subscript"
                className="text-xs leading-relaxed text-white/70"
                title={`White pin is your guess · gold is the true spot. ${storyLede}`}
              >
                <span className="text-white/60">
                  White pin is your guess · gold is the true spot.
                </span>
                <br />
                <span className="mt-1 block text-sm leading-relaxed text-white/85">
                  {storyLede}
                </span>
              </p>
              {drop && drop.streakBefore >= 2 ? (
                <p className="text-sm text-amber-100">
                  🔥 {drop.streakBefore}-place streak reset — combo back to{" "}
                  {formatFactor(comboForStreak(1))}x.
                </p>
              ) : null}
              {storyRest ? (
                <div
                  className="max-h-44 overflow-y-auto"
                  tabIndex={0}
                  role="region"
                  aria-label="Place story, continued"
                >
                  <p className="text-sm leading-relaxed">{storyRest}</p>
                </div>
              ) : null}
              {/* AI sentence as its own announced paragraph: the miss-card
                  lede keeps the blurb's first sentence; the hook — often
                  the only memorable fact on a blurb-only card — arrives
                  here and is announced once via the polite live region. */}
              <div aria-live="polite">
                {aiStory ? (
                  <p className="text-sm leading-relaxed">
                    {aiStory}
                    <AiStoryBadge />
                  </p>
                ) : null}
              </div>
              <a
                className="text-sm text-white/70 underline"
                href={place.sourceHref}
                target="_blank"
                rel="noreferrer"
              >
                {place.sourceLabel}
              </a>
              <Button onClick={onContinue}>Next place</Button>
              <ShareResult run={run} copyVariant="secondary" />
            </div>
          ) : null}

          {run.phase === "done" && empty ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-white/70">
                This trail has no places yet.
              </p>
              <ShareResult run={run} />
            </div>
          ) : null}
        </section>
      </Rise>
    </div>
  );
}
