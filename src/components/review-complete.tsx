/**
 * ReviewComplete (TD-06.12, step 13): the review-session complete
 * screen, extracted from game-app.tsx as a pure move.
 *
 * A fragment, not a <main>: the composer (game-app) renders the
 * <main> wrapper at the call site, so this file adds no
 * pageLocalMain row. Takes EndOfFlowHome, not HomeButton.
 */
import { Button } from "@/components/ui/button";
import { EndOfFlowHome } from "@/components/ui/end-of-flow-home";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";
import { CHALLENGE_REVIEW_LABEL } from "@/game/challenge";
import { REVIEW_DECK_COPY } from "@/game/review-deck";
import { type ResetHistoryResult } from "@/game/reset-history";
import { type PlaceResult } from "@/game/run";
import { ResetHistoryControl } from "./reset-history-control";

export type ReviewCompleteProps = {
  results: PlaceResult[];
  total: number;
  onDone: () => void;
  /** Present only when the deck still holds cards (fresh read, D16). */
  onResetHistory?: () => ResetHistoryResult;
  /** Present only while the friendChallenges flag is on (manifest
   * §1(e)): the review-surface challenge entry. Unlike the reset
   * entry it is NOT deck-gated — it deals fresh from the picked
   * region, never from the deck, so an empty deck is fine here. */
  onChallengeFriend?: () => void;
};

export function ReviewComplete({
  results,
  total,
  onDone,
  onResetHistory,
  onChallengeFriend,
}: ReviewCompleteProps) {
  const remembered = results.filter((r) => r.hit).length;
  return (
    <>
      {/* The shared shell (PR 3 Step 3.7): SiteHeader carries the
          one Home control at the top — this screen had no header
          at all. The content keeps its vertical centring in the
          space below the header. The primary HomeButton in the
          flow stays: it is this end-of-flow screen's own exit
          action beside its challenge/reset entries, the sanctioned
          end surface. No failure branch exists on this screen —
          the total === 0 state is an empty deck, not an error —
          so there is nothing to route to ErrorScreen. */}
      <SiteHeader onHome={onDone} status={null} mute={null} />
      <div className="flex flex-1 flex-col justify-center">
      <p className="text-sm tracking-wide text-muted uppercase">
        {REVIEW_DECK_COPY.pickerTitle}
      </p>
      <h1 className="mt-2 font-display text-4xl text-fg" data-testid="review-complete">
        {total === 0
          ? "Nothing to review."
          : `${REVIEW_DECK_COPY.completeTitle} You remembered ${remembered} of ${total}.`}
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        {total === 0
          ? REVIEW_DECK_COPY.pickerEmpty
          : remembered === total
            ? "Each card comes back later — further out every time you get it right."
            : "The ones you missed are due again right away. One more round locks them in."}
      </p>
      <div className="mt-6 flex flex-col items-start gap-3">
        <EndOfFlowHome onHome={onDone} variant="primary" />
        {/* "Challenge a friend — pick a map" (manifest §1(e)): the
            review is finished, so this door leaves it — the GameApp
            handler runs the Editions exit and opens the shipped
            region mini-picker in one act. Secondary beside the
            primary exit: the review's own flow stays the headline. */}
        {onChallengeFriend ? (
          <Button
            variant="secondary"
            onClick={onChallengeFriend}
            data-testid="review-challenge-a-friend"
          >
            {CHALLENGE_REVIEW_LABEL}
          </Button>
        ) : null}
        {onResetHistory ? <ResetHistoryControl onReset={onResetHistory} /> : null}
      </div>
      </div>
      {/* The shared footer (footer standardization, 2026-11-18):
          the review-end screen carries SiteFooter + Grandpa's band
          like every other page; its in-flow primary Home button
          above stays the end-of-flow exit. */}
      <SiteFooter />
    </>
  );
}
