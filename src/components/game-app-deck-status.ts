import { useEffect, useState } from "react";
import type { Run } from "../game/run.ts";
import { deckCounts, emptyReviewDeck, readReviewDeck } from "../game/review-deck.ts";
import { isEnabled, loadFlags } from "../lib/flags.ts";

export type DeckStatus = { enabled: boolean; due: number; total: number };

/**
 * Review-deck entry status for the edition picker. Gated on the
 * `learningOutcomes` flag like the other growth surfaces: flag off = no
 * deck entry at all (the deck only populates while the flag is on). Re-read
 * whenever the app returns to the picker (`run` → null): a review session
 * reschedules cards and a normal game adds misses, so a boot-time snapshot
 * would go stale — and a stale "N cards due" with an empty queue would make
 * "Start review" silently no-op.
 */
export function useDeckStatus(
  run: Run | null,
  historyResetEpoch: number,
): DeckStatus {
  const [status, setStatus] = useState<DeckStatus>({ enabled: false, due: 0, total: 0 });
  const onPicker = run === null;
  useEffect(() => {
    let active = true;
    loadFlags().then(() => {
      if (!active) return;
      if (!isEnabled("learningOutcomes")) {
        setStatus({ enabled: false, due: 0, total: 0 });
        return;
      }
      const deck = readReviewDeck() ?? emptyReviewDeck();
      if (!active) return;
      const { total, due } = deckCounts(deck, Date.now());
      setStatus({ enabled: true, total, due });
    });
    return () => {
      active = false;
    };
    // historyResetEpoch (D14): a reset performed on the picker must
    // re-read the deck in place — the picker never unmounted, so the
    // onPicker edge alone would leave the stale due count on screen.
  }, [onPicker, historyResetEpoch]);
  return status;
}
