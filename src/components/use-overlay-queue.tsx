import { useCallback, useEffect, useRef, useState } from "react";
import {
  CelebrationOverlay,
  celebrationSeamSpec,
  type CelebrationSpec,
} from "./celebration-overlay";
import { type ClearedInfo } from "./cleared-celebration";
import { playCelebrationSound } from "@/game/audio/play-guards";
import { type TutorialBeat } from "@/game/tutorial";

/**
 * Step 6 — overlay queue: first-visit, tutorial / invite, celebration / cleared.
 * Owns the overlay state and the celebration element; GameApp mounts the
 * queue (FirstVisitQueue, TutorialInvite / TutorialOverlay, the cleared
 * dialog) and still owns screen routing. The prompt computation stays
 * in the composer — it needs the tour callbacks, which are defined
 * after this hook runs. `mapMode` is a plain string (not the map
 * capability type) so this module adds no upward-import row.
 */
export function useOverlayQueue(mapMode: string) {
  // Cleared-mode celebration: set when a difficulty band's full cycle is
  // celebrated (primary onContinue trigger or the run-start backstop). The
  // dialog renders over the current screen; dismissing returns the player
  // to exactly where they were.
  const [cleared, setCleared] = useState<ClearedInfo | null>(null);
  // Celebration overlay (spec §7.2): the parent owns the spec; dismiss →
  // null → unmount. Set by first-win (endless game), streak milestones via
  // sound only, and GeoDetective's 387 completion (via onCelebrate).
  // A harness may name a boot overlay variant. With no harness this
  // stays null and the player path is unchanged.
  const [celebration, setCelebration] = useState<CelebrationSpec | null>(() =>
    typeof window === "undefined" ? null : celebrationSeamSpec(window.location.search),
  );
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const celebrationOverlay = celebration ? (
    <CelebrationOverlay
      variant={celebration.variant}
      character={celebration.character}
      title={celebration.title}
      body={celebration.body}
      onDismiss={dismissCelebration}
      // PBI-3: Scout Map disables motion — no confetti, same calm card.
      motionOff={mapMode === "scout"}
    />
  ) : null;
  // Celebration audio (spec §3): the cleared-mode dialog's opening beat.
  // Easy/Medium get the medium applause; Hard gets the grand fanfare
  // (coronation — the 60 s grand cooldown drops it to applause instead of
  // stacking). First clear only: the cleared mark is set before the dialog
  // opens, so the ref guard fires once per open — an Escape dismissal
  // still sounds, because the trigger is the open, never the close.
  const clearedSoundRef = useRef<ClearedInfo | null>(null);
  useEffect(() => {
    if (!cleared) {
      clearedSoundRef.current = null;
      return;
    }
    if (clearedSoundRef.current === cleared) return;
    clearedSoundRef.current = cleared;
    playCelebrationSound(cleared.choice === "hard" ? "grandFanfare" : "mediumApplause");
  }, [cleared]);
  // First-run tutorial: null when inactive, otherwise the current beat
  // (1 = aim coachmark, 2 = reveal feedback, 3 = completion hook). Owned
  // by GameApp so the menu invitation, the run, and the cleanup paths all
  // share one source of truth; Play/PlayLoaded only render from it.
  const [tutorial, setTutorial] = useState<TutorialBeat | null>(null);
  // The menu invitation is shown at most once per page load; the
  // local-storage seen-flag persists the decision across visits.
  const [inviteDismissed, setInviteDismissed] = useState(false);
  // Item 9: bumped when the queued read-aloud sheet is answered, so the
  // first-visit queue recomputes which prompt wants to show next.
  const [, bumpPromptQueue] = useState(0);
  // Arrival modal (owner direction, 2026-11-20): true while the
  // read-aloud sheet is the queue's visible prompt — the queue drives
  // it via onModalChange and the Home page below goes inert for
  // exactly that span, the ask-first age gate's mechanism.
  const [firstVisitModalOpen, setFirstVisitModalOpen] = useState(false);

  return {
    cleared,
    setCleared,
    celebration,
    setCelebration,
    dismissCelebration,
    celebrationOverlay,
    tutorial,
    setTutorial,
    inviteDismissed,
    setInviteDismissed,
    bumpPromptQueue,
    firstVisitModalOpen,
    setFirstVisitModalOpen,
  };
}
