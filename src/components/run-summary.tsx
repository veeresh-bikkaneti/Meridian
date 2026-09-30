import type { JSX } from "react";
import { formatDistance } from "@/game/geo";
import type { RunSummary } from "@/game/run";
import { Button } from "@/components/ui/button";

/**
 * End-of-run summary (endless mode). Shown after the player explicitly ends
 * the game via endRun — never auto-shown. Grand total first, then the
 * natural stats. The total is announced via the aria-live region.
 */
export function RunSummaryCard(props: {
  summary: RunSummary;
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

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-white/60">Places played</dt>
            <dd className="tabular-nums">{summary.placesPlayed}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-white/60">Hits</dt>
            <dd className="tabular-nums">{summary.hits}</dd>
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
