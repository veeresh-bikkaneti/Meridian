import type { JSX } from "react";
import { Suspense, lazy } from "react";

// The Storyteller mascot stays out of the initial bundle (lazy chunk).
const StorytellerNarration = lazy(() => import("./storyteller"));
import { formatDistance } from "@/game/geo";
import {
  DIFFICULTY_LABELS,
  EDITION_LABELS,
  formatSuccessRate,
  type SessionSummary,
} from "@/game/session";
import { SHARE_URL, sessionShareText } from "@/game/share-action";
import { LEARNING_COPY, type GrowthSummary } from "@/game/learning";
import { REVIEW_DECK_COPY } from "@/game/review-deck";
import { Button } from "@/components/ui/button";
import { ShareButton } from "./share-button";

/**
 * End-of-game summary (endless mode). Shown after the player explicitly ends
 * the game — never auto-shown. The totals span the whole session (every
 * edition played since the game started), with a per-edition score
 * breakdown. The total is announced via the aria-live region.
 *
 * When the learning-outcomes flag is on, a "My growth" section renders the
 * player's own progress (places explored/mastered, day streak, regions
 * where their pins are landing closer) — encouragement about learning, not
 * a leaderboard. Never names distances in a shaming way; share text is
 * unchanged (learning records never leave the device).
 */
export function RunSummaryCard(props: {
  summary: SessionSummary;
  regionName: string;
  /** The session's date key, for the share text's date line. */
  dateKey: string;
  /** Growth data, flag-gated. Null when the flag is off. */
  growth?: GrowthSummary | null;
  onDone: () => void;
  onPlayAgain: () => void;
  /**
   * "Review my misses" invitation (flag-gated): starts a review session
   * over the due deck cards. Rendered only when reviewDueCount > 0 — the
   * deck is an invitation, never a gate.
   */
  onReview?: () => void;
  /** Cards currently due for review. */
  reviewDueCount?: number;
}): JSX.Element {
  const { summary, regionName, dateKey, growth, onDone, onPlayAgain, onReview, reviewDueCount } = props;
  // Session totals only — no per-place emoji strip; the session banks
  // totals, never per-place scores (see sessionShareText).
  const text = sessionShareText({ summary, regionName, dateKey });
  // Breakdowns render from the same summary object the share text uses —
  // unplayed difficulty modes are omitted (never shown as 0%), and region
  // names come from the session verbatim.
  const playedDifficulties = summary.byDifficulty.filter((m) => m.places > 0);
  const regionGroups = (
    [
      { edition: "state", label: "States" },
      { edition: "country", label: "Countries" },
      { edition: "globe", label: "Globe" },
    ] as const
  )
    .map((g) => ({
      ...g,
      regions: summary.regions.filter((r) => r.edition === g.edition),
    }))
    .filter((g) => g.regions.length > 0);
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Game summary"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.95)] p-6 text-white shadow-2xl">
        {/* Storyteller (secondary host): docked inside the modal above the
            title — the closing-chapter beat. One line, text-first + speaker. */}
        <Suspense fallback={null}>
          <StorytellerNarration
            screen="summary"
            trigger="summary"
            lineKey="summary"
            showFigure
            variant="modal"
          />
        </Suspense>
        <p className="text-[11px] tracking-wider text-white/60 uppercase">{regionName}</p>
        <h2 className="mt-1 font-display text-2xl">Game over</h2>

        <div className="mt-4 text-center">
          <p className="font-display text-5xl tabular-nums">{summary.totalScore}</p>
          <p className="mt-1 text-sm text-white/60">total score</p>
        </div>

        <div data-testid="summary-edition-breakdown" className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
          <h3 className="text-[11px] font-normal tracking-wider text-white/60 uppercase">Score by edition</h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            {summary.byEdition.map((b) => (
              <div key={b.edition} className="flex justify-between">
                <dt className="text-white/60">
                  {EDITION_LABELS[b.edition]}{" "}
                  <span className="text-white/40">
                    · {b.places} {b.places === 1 ? "place" : "places"}
                  </span>
                </dt>
                <dd className="tabular-nums">{b.score.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        </div>

        {playedDifficulties.length > 0 ? (
          <div
            data-testid="summary-difficulty-breakdown"
            className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3"
          >
            <h3 className="text-[11px] font-normal tracking-wider text-white/60 uppercase">
              By difficulty
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {playedDifficulties.map((m) => (
                <li key={m.difficulty} className="tabular-nums">
                  <span className="text-white/60">
                    {DIFFICULTY_LABELS[m.difficulty]} —{" "}
                  </span>
                  {m.hits}/{m.places} ({formatSuccessRate(m.hits, m.places)}) ·{" "}
                  {m.score.toLocaleString("en-US")} pts
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {regionGroups.length > 0 ? (
          <div
            data-testid="summary-region-breakdown"
            className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3"
          >
            <h3 className="text-[11px] font-normal tracking-wider text-white/60 uppercase">
              By region
            </h3>
            {regionGroups.map((g) => (
              <div key={g.edition} className="mt-2">
                <h4 className="text-[11px] font-normal tracking-wider text-white/40 uppercase">
                  {g.label}
                </h4>
                <ul className="mt-1 space-y-1.5 text-sm">
                  {g.regions.map((r) => (
                    <li key={r.regionId} className="tabular-nums">
                      <span className="text-white/60">{r.regionName} — </span>
                      {r.score.toLocaleString("en-US")} pts · {r.places}{" "}
                      {r.places === 1 ? "place" : "places"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-white/60">Places played</dt>
            <dd className="tabular-nums">{summary.placesPlayed}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Hits</dt>
            <dd className="tabular-nums">{summary.hits}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Average per place</dt>
            <dd data-testid="summary-avg" className="tabular-nums">
              {summary.averagePerPlace}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Best streak</dt>
            <dd data-testid="summary-best-streak" className="tabular-nums">
              {summary.bestStreak >= 2 ? `🔥 ${summary.bestStreak}` : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Average distance</dt>
            <dd className="tabular-nums">{formatDistance(summary.averageDistanceKm)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Best pin</dt>
            <dd className="tabular-nums">
              {summary.bestDistanceKm !== null
                ? formatDistance(summary.bestDistanceKm)
                : "—"}
            </dd>
          </div>
        </dl>

        {growth ? (
          <div
            data-testid="growth-section"
            className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3"
          >
            <h3 className="text-[11px] font-normal tracking-wider text-white/60 uppercase">
              {LEARNING_COPY.summaryHeader}
            </h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/60">{LEARNING_COPY.placesExplored}</dt>
                <dd className="tabular-nums">{growth.explored}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/60">{LEARNING_COPY.placesMastered}</dt>
                <dd className="tabular-nums">{growth.mastered}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/60">{LEARNING_COPY.dayStreak}</dt>
                <dd className="tabular-nums">
                  {growth.dayStreak} — {LEARNING_COPY.dayStreakNudge}
                </dd>
              </div>
            </dl>
            {growth.improvingRegions.map((t) => (
              <p key={t.regionId} className="mt-2 text-sm text-emerald-100/90">
                Your pins are landing closer in {t.regionName}!
              </p>
            ))}
            {onReview && (reviewDueCount ?? 0) > 0 ? (
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={onReview}
                data-testid="summary-review-deck"
              >
                {REVIEW_DECK_COPY.summaryCta} ({reviewDueCount})
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <ShareButton
            title="Meridian score"
            text={text}
            url={SHARE_URL}
            label="Share score"
            className="w-full"
            failureFallback={
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-left font-sans text-sm leading-relaxed text-white">
                {text}
              </pre>
            }
          />
          <Button className="w-full" onClick={onPlayAgain}>
            Play again
          </Button>
          <Button variant="secondary" className="w-full" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
