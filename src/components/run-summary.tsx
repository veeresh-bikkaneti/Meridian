import type { JSX } from "react";
import { formatDistance } from "@/game/geo";
import { EDITION_LABELS, type SessionSummary } from "@/game/session";
import { Button } from "@/components/ui/button";

/**
 * End-of-game summary (endless mode). Shown after the player explicitly ends
 * the game — never auto-shown. The totals span the whole session (every
 * edition played since the game started), with a per-edition score
 * breakdown. The total is announced via the aria-live region.
 */
export function RunSummaryCard(props: {
  summary: SessionSummary;
  regionName: string;
  onDone: () => void;
  onPlayAgain: () => void;
}): JSX.Element {
  const { summary, regionName, onDone, onPlayAgain } = props;
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Game summary"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.95)] p-6 text-white shadow-2xl">
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

        <div className="mt-6 flex flex-col gap-2">
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
