import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  CHALLENGE_FAIRNESS_COPY,
  CHALLENGE_WELCOME_TITLE,
  type ChallengeRoute,
} from "@/game/challenge";
import type { MapMode } from "@/lib/map-mode";
import { Button } from "@/components/ui/button";
import { SCOUT_COPY } from "./scout-copy.ts";

/**
 * Step 11 (TD-06.9) — the received-challenge welcome card, moved
 * verbatim out of game-app.tsx. An overlay on Home, shown only
 * between a validated mc2 boot and the player's Start tap.
 */

export function ChallengeWelcome({
  route,
  hasSavedRun,
  mapMode,
  onMapModeSelect,
  onStart,
  onDismiss,
}: {
  route: ChallengeRoute;
  hasSavedRun: boolean;
  /** The map this challenge will be played on, resolved before the
   * card showed (stored manual record, else the boot capability
   * qualification) — or the player's staged flip of it. Flipping
   * here, at challenge open, is the one moment a switch costs
   * nothing (owner ruling, 2026-10-29); the pick is staged, and
   * Start commits it as the player's saved manual map choice. */
  mapMode: MapMode;
  onMapModeSelect: (mode: MapMode) => void;
  onStart: () => void;
  /** Declining is free: nothing is committed, no save is touched — the
   * displacement bargain (C6) binds only the Start tap. */
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  const scout = mapMode === "scout";
  const flipMap = useCallback(() => {
    onMapModeSelect(scout ? "full" : "scout");
  }, [scout, onMapModeSelect]);
  const onMapSwitchKey = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flipMap();
      }
    },
    [flipMap],
  );
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={CHALLENGE_WELCOME_TITLE}
      data-testid="challenge-welcome"
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 className="font-display text-2xl text-fg">{CHALLENGE_WELCOME_TITLE}</h2>
        {/* Grouped blocks (governing manifest §Q3): Context first —
            title, then the locked fairness line, then the task — then
            the Stakes goal card (Package B, when the link carries a
            winner block), then the Action block: map row, disclosure,
            Start / Not now. */}
        <p className="mt-3 text-base text-muted">{CHALLENGE_FAIRNESS_COPY}</p>
        <p className="mt-2 text-base text-fg">
          Find {route.ids.length} places in {route.regionName}. Get inside the{" "}
          {route.radiusKm} km circle — closer is better!
        </p>
        {hasSavedRun ? (
          <p className="mt-2 text-base text-muted">
            Your game in progress is saved — it will be waiting when you finish.
          </p>
        ) : null}
        {/* Stakes (governing manifest §Q3, Package B): one goal card
            when the link carries a winner block. The bar is always
            bestScore; the sender's own score nests under it only when
            someone else set the mark. Attempts appears NOWHERE on
            this card (§Q4's display ruling). */}
        {route.winner ? (
          <div
            className="mt-4 rounded-xl border border-line px-3 py-2.5"
            data-testid="challenge-welcome-goal"
          >
            <p className="text-base font-semibold text-fg">
              🎯 Beat {route.winner.bestScore.toLocaleString("en-US")} — the best score
              yet on this route.
            </p>
            <p className="mt-1 text-sm text-muted">
              {route.winner.senderScore < route.winner.bestScore
                ? `Your friend scored ${route.winner.senderScore.toLocaleString("en-US")} on this one.`
                : "Your friend set it."}
            </p>
          </div>
        ) : null}
        {/* The map pick (owner ruling, 2026-10-29): the mode the boot
            resolved for this device, shown before Start — and the one
            place a challenge receiver can change it, because the
            in-challenge toggle can no longer switch (it used to force
            home and kill the challenge). Flipping only stages the
            pick; Start commits it, "Not now" drops it — declining
            commits nothing. The switch's hit area is at least 44px
            tall (the accessibility floor) even though the visual
            track is 24px. */}
        <div className="mt-4 rounded-xl border border-line px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base text-fg">
              {SCOUT_COPY.welcome.label}:{" "}
              <span data-testid="challenge-welcome-map-mode" data-mode={mapMode}>
                {scout ? "Scout Map" : "Full map"}
              </span>
            </span>
            <div
              role="switch"
              aria-checked={scout}
              aria-label={SCOUT_COPY.toggle.label}
              tabIndex={0}
              data-testid="challenge-welcome-map-switch"
              onClick={flipMap}
              onKeyDown={onMapSwitchKey}
              className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-end gap-2 rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
            >
              <span className="text-sm font-medium text-muted">{scout ? "On" : "Off"}</span>
              <span
                aria-hidden="true"
                className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${scout ? "justify-end bg-[#f2c14e]" : "justify-start bg-black/15"}`}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow" />
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-sm text-muted">{SCOUT_COPY.welcome.note}</p>
        </div>
        {/* The honesty disclosure (§Q3): last before the buttons,
            only when a score is being attested. The number in a link
            is the sender's word — the game cannot check it, and says
            so before the receiver commits to the chase. */}
        {route.winner ? (
          <p className="mt-3 text-sm text-muted" data-testid="challenge-welcome-disclosure">
            One honest note: this score is your friend's word — Meridian can't check
            scores sent in links.
          </p>
        ) : null}
        <Button className="mt-5 w-full" onClick={onStart} data-testid="challenge-start">
          Start
        </Button>
        <Button
          variant="secondary"
          className="mt-2 w-full"
          onClick={onDismiss}
          data-testid="challenge-not-now"
        >
          Not now
        </Button>
      </div>
    </div>
  );
}