/**
 * hint-panel.tsx — the hint button UI for the quiz game (follow-up Item A).
 *
 * Wires the B1 hint policies to a real surface (owner decision 2026-10-09:
 * hints are a REAL feature). The policy enum rides in the run's band
 * snapshot; this component is the reader (AGENTS.md rule #6).
 *
 * - 5-7 ("free"): button always visible and free. After 2 misses in the
 *   run, a mascot offer appears (opt-in tap, never auto-interrupt).
 * - 8-10 ("one-per-round"): button visible; 1 hint per place — disables
 *   after use, re-enables on the next place.
 * - 11-13 ("none"): no button at all (Clean Round stays earnable).
 *
 * Hints NEVER touch points. The hint message itself comes from
 * hint-logic.ts (mechanical directional nudge — no fabrication).
 */
import { Lightbulb } from "lucide-react";
import {
  hintButtonState,
  mascotOffersHint,
  type HintPolicy,
} from "@/game/age-profile/run-config.ts";

export type HintPanelProps = {
  /** Hint policy from the run's band snapshot (deal-time, never live). */
  policy: HintPolicy;
  /** Hints used on the current place (drives 8-10 one-per-place). */
  hintsUsedThisPlace: number;
  /** Misses in the run (drives the 5-7 mascot offer). */
  missCount: number;
  /** The hint message to display after a hint is used (null = none yet). */
  hintMessage: string | null;
  /** Whether the mascot offer was dismissed for this run. */
  offerDismissed: boolean;
  /** Called when the kid taps the hint button (or accepts the offer). */
  onUseHint: () => void;
  /** Called when the kid dismisses the mascot offer. */
  onDismissOffer: () => void;
};

export function HintPanel({
  policy,
  hintsUsedThisPlace,
  missCount,
  hintMessage,
  offerDismissed,
  onUseHint,
  onDismissOffer,
}: HintPanelProps) {
  const state = hintButtonState(policy, hintsUsedThisPlace);
  if (state === "hidden") return null;

  const showOffer =
    mascotOffersHint(policy, missCount) && !offerDismissed && hintMessage === null;

  return (
    // pointer-events-none: taps pass through everywhere except the
    // interactive children (hint button + offer buttons). A full-width
    // auto container here would swallow taps on the question bubble's
    // "Hide question" control behind it (#113 overlap BLOCK).
    // items-end: children hug the right edge, away from the bubble's lane.
    <div className="pointer-events-none mt-2 flex flex-col items-end gap-2" data-testid="hint-panel">
      {/* Mascot offer (5-7 only): opt-in, never auto-interrupt. */}
      {showOffer ? (
        <div
          className="rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.72)] p-3 shadow-lg backdrop-blur-[14px]"
          role="dialog"
          aria-label="Hint offer"
          data-testid="hint-offer"
          onKeyDown={(e) => {
            if (e.key === "Escape") onDismissOffer();
          }}
        >
          <p className="text-sm text-white">Stuck? Want a hint?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onUseHint}
              className="pointer-events-auto flex min-h-11 items-center rounded-full bg-amber-400 px-4 text-sm font-semibold text-black"
            >
              Yes please
            </button>
            <button
              type="button"
              onClick={onDismissOffer}
              className="pointer-events-auto flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm text-white/80"
            >
              No thanks
            </button>
          </div>
        </div>
      ) : null}
      {/* The hint button: 44px minimum tap target. */}
      <button
        type="button"
        onClick={onUseHint}
        disabled={state === "disabled-used"}
        aria-label={state === "disabled-used" ? "Hint used" : "Get a hint"}
        data-testid="hint-button"
        className={`pointer-events-auto flex size-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-[14px] ${
          state === "disabled-used"
            ? "cursor-not-allowed border-white/10 bg-[rgba(10,12,16,0.4)] text-white/30"
            : "border-amber-300/30 bg-[rgba(10,12,16,0.72)] text-amber-200 hover:text-amber-100"
        }`}
      >
        <Lightbulb className="size-5" aria-hidden="true" />
      </button>
      {/* The hint message, once revealed. */}
      {hintMessage ? (
        <p
          className="rounded-2xl border border-amber-300/20 bg-[rgba(10,12,16,0.72)] p-3 text-sm text-amber-100 shadow-lg backdrop-blur-[14px]"
          role="status"
          data-testid="hint-message"
        >
          💡 {hintMessage}
        </p>
      ) : null}
    </div>
  );
}
