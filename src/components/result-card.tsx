import { initialBearing, windName8 } from "@/game/geo";
import { formatLength, scoreGradeBand, unitForEdition } from "@/game/units";
import { nameTier } from "@/game/place-name";
import { PlaceNameText } from "@/components/place-name";
import { GradeChip } from "@/components/grade-chip";
import { difficultyChip } from "@/game/scoring";
import { bubbleHeaderText } from "@/game/question-label";
import { summarizeRun, type Run } from "@/game/run";
import { formatBreakdown, comboForStreak, formatFactor } from "@/game/scoring";
import { shareText } from "@/game/share";
import { SHARE_URL } from "@/game/share-action";
import { ShareButton } from "./share-button";
import type { Starter } from "@/game/starters";
import { Button } from "@/components/ui/button";
import type { Drop } from "./game-app";
import { X } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { splitLede } from "./story-lede";
import { claimFirstRevealNarration } from "./storyteller-claim";
import { useAiSportsTeams, withSportsLine } from "@/game/sports-ai";
import { useAiStory, AI_STORY_BADGE } from "@/game/story-ai";
import { revealPinCompare } from "@/game/reverse-geocode";
import { ScrollCue, useMoreBelow } from "@/components/scroll-cue";

// The Storyteller mascot (figure + narration) stays out of the initial
// bundle — a separate lazy chunk, like the satellite map.
const StorytellerNarration = lazy(() => import("./storyteller"));

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
      className="ai-story-badge ml-1.5 inline-flex items-center rounded px-1 py-px align-middle text-[10px] font-medium tracking-wide"
    >
      {AI_STORY_BADGE.label}
    </span>
  );
}

/**
 * Learning-outcomes growth line (flag-gated). One kid-friendly sentence
 * below the place story — encouragement about the player's own progress,
 * never a grade and never a comparison. Renders nothing when the flag is
 * off (the line is null then).
 */
function GrowthLine({ line }: { line: string | null | undefined }) {
  if (!line) return null;
  return (
    <p data-testid="growth-line" className="growth-line text-sm leading-relaxed">
      <span role="img" aria-label="growing plant">
        🌱
      </span>{" "}
      {line}
    </p>
  );
}

function ShareResult({ run, copyVariant = "primary" }: { run: Run; copyVariant?: "primary" | "secondary" }) {  const summary = summarizeRun(run);
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
      <pre className="share-pre whitespace-pre-wrap rounded-lg px-4 py-3 font-sans text-sm leading-relaxed">
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
  growthLine,
  poolPlaces,
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
  /**
   * Kid-friendly growth note (learning-outcomes track, flag-gated). Never
   * replaces the place blurb — that shows on every reveal, right or wrong —
   * and sits below it, small. Null when the flag is off.
   */
  growthLine?: string | null;
  /**
   * The full dealing pool (the same array reference the parent already
   * holds — no copy, no extra memory). Feeds the nearest-place fallback
   * for the "Your pin" line in country/globe editions. Absent/empty →
   * nearestPoolPlace returns null → the classic pinCompareLine line
   * renders. Safe default.
   */
  poolPlaces?: Starter[];
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
  const continueWrapRef = useRef<HTMLDivElement>(null);
  // Storyteller v1: the session's first story reveal auto-narrates (T1 —
  // gesture-gated); every later reveal is text + speaker button. Claimed
  // once per session — a reload is a new session.
  const storytellerAuto = useMemo(() => claimFirstRevealNarration(), []);
  // Cartographer's Plate PR3 — the "more below" cue for the card body.
  const { ref: bodyRef, moreBelow } = useMoreBelow<HTMLDivElement>();

  // Move focus to the verdict heading when a result appears (phase →
  // story/done). The commit control the user activated is gone by then;
  // without this, keyboard and screen-reader users lose their place.
  const phase = run.phase;
  useEffect(() => {
    if ((phase === "story" || phase === "done") && !dismissed) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [phase, dismissed, place?.name]);

  // Pin-compare ledger for the miss card: a real <dl> naming BOTH locations
  // ("Your pin: Brazil · True spot: Angola" in globe; "Your pin: near
  // Cagliari, Sardinia · True spot: Reggio di Calabria, Calabria" in
  // country). In country edition the nearest-place fallback fills the gap
  // where vendored admin-1 data is missing (IT/FR); in state edition and
  // on any gate failure the classic pinCompareLine shape renders through
  // the structured compare. Fail closed — null renders exactly as today
  // (no ledger). Computed whenever a pin and place exist; only rendered
  // in the done (miss) block below — the hit card never shows it.
  // NOTE: poolPlaces is the full dealing pool passed by reference (no copy).
  // The nearest-match scan must not allocate new module-level data — Safari
  // jetsam budget (see design §7). Keep this prop a pass-through reference.
  const pinCompare = useMemo(() => {
    if (!drop || !place) return null;
    return revealPinCompare({
      edition: run.edition,
      playerLat: drop.lat,
      playerLon: drop.lon,
      truth: place,
      pool: poolPlaces ?? [],
    });
  }, [drop, place, run.edition, poolPlaces]);

  // Length unit for every distance on this card: USA country/state plays
  // read miles, the rest of the world reads kilometers — derived from the
  // edition/region context, never device locale (Veeresh's ratified
  // decision 4).
  const unit = unitForEdition(run.edition, run.regionId);

  // Bearing on the miss headline: the miss teaches direction as well as
  // distance — "457 km northeast of your pin" — naming what the drawn line
  // from the white pin to the gold spot already shows. Miss-only; the hit
  // card never shows a bearing. Fail closed: when the bearing can't be
  // computed (coincident points) the classic "{distance} off" line renders
  // byte-identical to before.
  const missWind = useMemo(() => {
    if (!drop || !place) return null;
    const bearing = initialBearing([drop.lon, drop.lat], [place.lon, place.lat]);
    return bearing === null ? null : windName8(bearing);
  }, [drop, place]);

  // Cartographer's Plate PR3 — the verdict block lives in the PINNED
  // header (never buried): the grade chip + the distance headline as an
  // h2 reading "Result: 2,073 km away" (visually-hidden "Result: "
  // prefix). The full answer name is NOT here — on the miss card it lives
  // only in the ledger's TRUE SPOT; on the hit card it is the answer
  // heading at the top of the scrolling body.
  const verdict =
    phase === "story" && place
      ? {
          text: drop ? formatLength(drop.distanceKm, unit) : "Hit",
          testId: undefined as string | undefined,
          chip: drop?.breakdown ? (
            <GradeChip
              emoji={scoreGradeBand(drop.breakdown.score).emoji}
              bandName={scoreGradeBand(drop.breakdown.score).name}
            />
          ) : null,
        }
      : phase === "done" && place
        ? {
            text: drop
              ? missWind
                ? `${formatLength(drop.distanceKm, unit)} ${missWind} of your pin`
                : `${formatLength(drop.distanceKm, unit)} off`
              : "Miss",
            testId: "miss-headline" as string | undefined,
            chip: (
              <GradeChip
                emoji={scoreGradeBand(drop?.breakdown?.score ?? 0).emoji}
                bandName={scoreGradeBand(drop?.breakdown?.score ?? 0).name}
              />
            ),
          }
        : null;

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
        <section aria-label="Result" className="game-chrome result-card pointer-events-auto">
          {/* Storyteller (primary host): docked top-left, peeking ~40% above
              the card edge; yields to the tasting tour while it walks. */}
          {place ? (
            <Suspense fallback={null}>
              <StorytellerNarration
                screen="story"
                trigger={storytellerAuto ? "first_gesture" : "speaker"}
                lineKey="reveal"
                showFigure
                variant="dock"
                onDismiss={() => continueWrapRef.current?.querySelector("button")?.focus({ preventScroll: true })}
              />
            </Suspense>
          ) : null}
          {/* ---- Zone 1: pinned header — meta band + verdict, never buried ---- */}
          <div className="result-header">
            <div className="result-topbar">
              {place ? (
                <div className="name-meta">
                  <p className="name-eyebrow">
                    {bubbleHeaderText(run.edition, run.regionName)}
                  </p>
                  <span data-testid="difficulty-chip" className="difficulty-chip">
                    {difficultyChip(place.difficulty)}
                  </span>
                </div>
              ) : (
                <p className="name-eyebrow">
                  {bubbleHeaderText(run.edition, run.regionName)}
                </p>
              )}
              <button
                type="button"
                aria-label="Hide result"
                onClick={() => onDismissedChange(true)}
                className="bubble-icon-button"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {verdict ? (
              <div className="verdict-row">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  {...(verdict.testId ? { "data-testid": verdict.testId } : {})}
                  className="verdict-headline outline-none"
                >
                  <span className="sr-only">Result: </span>
                  {verdict.text}
                </h2>
                {verdict.chip}
              </div>
            ) : (
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="place-name rname outline-none"
                data-name-tier={nameTier(bubbleHeaderText(run.edition, run.regionName))}
              >
                {bubbleHeaderText(run.edition, run.regionName)}
              </h2>
            )}
          </div>

          {/* ---- Zone 2: the single scrolling body. The two nested
              max-h-44 story scrollers are folded into this one region
              (spec §5): role="region" + accessible name + tabindex="0"
              per §8.1; brass fade + ⋯ + "more below" at the bottom edge. */}
          <div className="scroll-cue-wrap result-body-wrap">
            <div
              ref={bodyRef}
              className="result-body"
              role="region"
              aria-label="Place details — scroll for more"
              tabIndex={0}
            >
              {run.phase === "story" && place ? (
                <>
                  <h2
                    title={placeLabel}
                    data-name-tier={nameTier(placeLabel)}
                    className="place-name rname"
                  >
                    <PlaceNameText name={placeLabel} />
                  </h2>
                  {drop?.breakdown ? (
                    <p
                      data-testid="score-breakdown"
                      data-base={drop.breakdown.base}
                      data-mult={drop.breakdown.diffMult}
                      data-combo={drop.breakdown.combo}
                      data-bonus={drop.breakdown.regionBonus}
                      data-score={drop.breakdown.score}
                      className="score-breakdown"
                    >
                      {formatBreakdown(drop.breakdown)}
                    </p>
                  ) : null}
                  <p className="result-note">
                    The line is your pin to the spot. The circle is close enough.
                  </p>
                  <p className="result-story">
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
                  {/* Growth line sits below the blurb, never replacing it. */}
                  <GrowthLine line={growthLine} />
                  <a
                    className="result-source"
                    href={place.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {place.sourceLabel}
                  </a>
                </>
              ) : null}

              {run.phase === "done" && place ? (
                <>
                  {pinCompare ? (
                    <dl data-testid="pin-compare-line" className="pin-ledger">
                      <div className="pin-ledger-entry">
                        <dt>Your pin</dt>
                        <dd
                          className="place-name yourpin-name"
                          title={
                            pinCompare.kind === "verdict"
                              ? pinCompare.text
                              : `${pinCompare.near ? "near " : ""}${pinCompare.pin}`
                          }
                        >
                          {pinCompare.kind === "verdict" ? (
                            pinCompare.text
                          ) : (
                            <>
                              {pinCompare.near ? (
                                <span className="near-qualifier">near </span>
                              ) : null}
                              <PlaceNameText name={pinCompare.pin} />
                            </>
                          )}
                        </dd>
                      </div>
                      <div className="pin-ledger-entry">
                        <dt>
                          <span className="truespot-mark" aria-hidden="true" />
                          True spot
                        </dt>
                        <dd
                          className="place-name truespot-name"
                          data-name-tier={nameTier(
                            run.edition === "globe" && pinCompare?.kind === "named"
                              ? pinCompare.truth
                              : placeLabel,
                          )}
                          title={
                            run.edition === "globe" && pinCompare?.kind === "named"
                              ? pinCompare.truth
                              : placeLabel
                          }
                        >
                          <PlaceNameText
                            name={
                              run.edition === "globe" && pinCompare?.kind === "named"
                                ? pinCompare.truth
                                : placeLabel
                            }
                          />
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                  <p
                    data-testid="miss-subscript"
                    className="result-subscript"
                    title={`Your pin is your guess · the gold mark is the true spot. ${storyLede}`}
                  >
                    <span className="result-note">
                      Your pin is your guess · the gold mark is the true spot.
                    </span>
                    <br />
                    <span className="mt-1 block text-sm leading-relaxed">{storyLede}</span>
                  </p>
                  {drop && drop.streakBefore >= 2 ? (
                    <p className="result-note">
                      🔥 {drop.streakBefore}-place streak reset — combo back to{" "}
                      {formatFactor(comboForStreak(1))}x.
                    </p>
                  ) : null}
                  {storyRest ? <p className="result-story">{storyRest}</p> : null}
                  {/* AI sentence as its own announced paragraph: the miss-card
                      lede keeps the blurb's first sentence; the hook — often
                      the only memorable fact on a blurb-only card — arrives
                      here and is announced once via the polite live region. */}
                  <div aria-live="polite">
                    {aiStory ? (
                      <p className="result-story">
                        {aiStory}
                        <AiStoryBadge />
                      </p>
                    ) : null}
                  </div>
                  {/* Growth line sits below the story, never replacing it. */}
                  <GrowthLine line={growthLine} />
                  <a
                    className="result-source"
                    href={place.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {place.sourceLabel}
                  </a>
                  <ShareResult run={run} copyVariant="secondary" />
                </>
              ) : null}

              {run.phase === "done" && empty ? (
                <>
                  <p className="result-note">This trail has no places yet.</p>
                  <ShareResult run={run} />
                </>
              ) : null}
            </div>
            <ScrollCue visible={moreBelow} />
          </div>

          {/* ---- Zone 3: pinned CTA — never buried, never animates in late.
              Solid bg so scrolled text never ghosts behind the button. ---- */}
          {place ? (
            <div className="result-cta" ref={continueWrapRef}>
              <Button onClick={onContinue} className="min-h-[48px] w-full text-base">
                Next place →
              </Button>
            </div>
          ) : null}
        </section>
      </Rise>
    </div>
  );
}
