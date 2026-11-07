import { Suspense, lazy, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { deckLabelForId } from "@/components/pack-shelf-data";
import { isEnabled } from "@/lib/flags";
import type { LoopEndFate, LoopSessionSummary } from "./store.ts";

// The pair's game-end celebration, lazy for the same reason the
// classic summary's is: a flag-off session never fetches the chunk
// and contains no pair DOM at all.
const LoopSummaryCelebration = lazy(() => import("./LoopSummaryCelebration"));

/**
 * The GeoDetective session summary (owner ruling, 2026-11-07): shown
 * when a session ends through the header's End game button, on BOTH
 * fates. It counts closed cases only — the standing totals
 * completePuzzle maintains (cases closed, the solved/lost split,
 * current + best streak) plus per-deck progress. An in-flight case
 * never appears in the counts: outright it was discarded (counts for
 * nothing), on pause it is still open and counts once, when it later
 * closes. This is a transient screen state, like the classic run
 * summary — a reload here reopens the loop, which resumes (pause) or
 * deals fresh (outright).
 */
export function LoopSessionSummaryPanel({
  summary,
  fate,
  onDone,
}: {
  summary: LoopSessionSummary;
  fate: LoopEndFate | "none";
  onDone: () => void;
}) {
  // Arrival focus: land keyboard and screen-reader focus on the
  // heading when the summary arrives (the LoopScreen arrival pattern,
  // including its typeof guard for non-DOM renderers).
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const el = headingRef.current;
    if (el && typeof el.focus === "function") el.focus();
  }, []);

  return (
    <section
      role="dialog"
      aria-labelledby="loop-session-summary-title"
      data-testid="loop-session-summary"
      data-fate={fate}
      className="mode-card mt-10 p-5"
    >
      <h2
        id="loop-session-summary-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl text-fg"
      >
        How your cases went
      </h2>
      <p className="mt-1 text-sm text-muted">All your cases so far.</p>

      {isEnabled("detectivePair") ? (
        <Suspense fallback={null}>
          <LoopSummaryCelebration casesClosed={summary.casesClosed} />
        </Suspense>
      ) : null}

      {summary.casesClosed === 0 ? (
        <p className="mt-3 text-fg">No cases closed yet.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-fg">
          <li>
            Cases closed:{" "}
            <span data-testid="loop-summary-cases-closed" className="tabular-nums">
              {summary.casesClosed}
            </span>
          </li>
          <li>
            Solved: <span className="tabular-nums">{summary.solved}</span>
          </li>
          <li>
            Lost: <span className="tabular-nums">{summary.lost}</span>
          </li>
        </ul>
      )}

      <ul className="mt-3 space-y-1 text-fg">
        <li>
          Streak: <span className="tabular-nums">{summary.streak}</span>
        </li>
        <li>
          Best streak: <span className="tabular-nums">{summary.bestStreak}</span>
        </li>
      </ul>

      {fate === "pause" && summary.openCaseDeckId ? (
        <p className="mt-3 text-fg">
          Your open case is waiting — you can resume it from Home.
        </p>
      ) : null}

      {summary.decks.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {summary.decks.map((deck) => (
            <li key={deck.deckId}>
              {deckLabelForId(deck.deckId)} — Cycle {deck.cycle} · {deck.cycleCompleted}{" "}
              closed · {deck.remaining} to go{deck.openCase ? " · one case open" : ""}
            </li>
          ))}
        </ul>
      ) : null}


      <Button className="mt-4 min-h-[48px] w-full" onClick={onDone}>
        Done
      </Button>
    </section>
  );
}
