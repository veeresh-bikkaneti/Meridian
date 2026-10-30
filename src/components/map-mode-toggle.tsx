/**
 * Scout Map settings toggle (PBI-7) — hosted in two places:
 *
 * - In the Play top-bar left cluster (context "play", the original
 *   host): a 44×44 frosted round button beside the sound toggle.
 * - On Home, in the hero's top row (context "home", Block C cure): the
 *   same control with a brass-outline button to match the home theme,
 *   beside a visible mode indicator GameApp renders next to it — a
 *   player can SEE they are on Scout Map and flip back without
 *   starting (and discarding) a game first. The button's accessible
 *   name carries the current mode ("Map mode settings — currently
 *   Scout Map"), so a screen-reader player hears the state the
 *   sighted player reads off the indicator pill (re-vote nit).
 *
 * Both hosts open the same popover: label, explainer, role="switch"
 * row. The copy adapts to the host. In Play, flipping ends the current
 * game (owner ruling, 2026-10-20 — the map is built once per game, so
 * the new mode can only take effect in a new game), so the popover
 * prints the game-ending warning ABOVE the switch at reading size:
 * the consequence is read before the tap target (Block B cure). On
 * Home there is no game to end, so the explainer talks about the next
 * game instead and there is no warning.
 *
 * Third host context (owner ruling, 2026-10-29): inside a friend
 * challenge (context "challenge") the popover shows the reason a
 * challenge's map cannot change mid-challenge and renders NO switch
 * at all — the map is picked on the challenge welcome card, at open,
 * and the force-home flip must never fire inside a challenge run.
 *
 * State contract: the mode state is owned by GameApp and threaded down
 * as a prop — this component only calls onSelect, and GameApp's handler
 * differs per host (force-home in Play; write-and-apply on Home).
 * Escape closes the popover and returns focus to the button.
 *
 * This component owns NO live region and moves NO focus on the flip:
 * in Play the flip unmounts it (with Play) in the very commit that
 * lands the player home, so an announcement region here would be
 * destroyed in the same commit that set its text and could never be
 * spoken. GameApp therefore hosts the announcement in a hoisted live
 * region that survives the exit, and lands focus on the home heading
 * (pipeline Block A cure).
 */

import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { Layers } from "lucide-react";
import type { MapMode } from "@/map/capability";
import { SCOUT_COPY } from "./scout-copy.ts";

export function MapModeToggle(props: {
  mapMode: MapMode;
  onSelect: (mode: MapMode) => void;
  /**
   * Host context: "play" (default), "home", or "challenge" — see the
   * header. In a challenge run the popover carries the reason and NO
   * switch: a challenge's map is picked when the challenge opens, and
   * the force-home flip must never fire mid-challenge (owner ruling,
   * 2026-10-29).
   */
  context?: "play" | "home" | "challenge";
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const inChallenge = props.context === "challenge";
  // Home popover horizontal offset relative to the button, measured at
  // open time (and on resize) so the absolute popover stays anchored
  // 8px below the button while scrolling with the page.
  const [homeLeftOffset, setHomeLeftOffset] = useState<number>(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const scout = props.mapMode === "scout";
  const atHome = props.context === "home";

  const measureHomeLeftOffset = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Clamp the 256px (w-64) popover inside the viewport with an 8px
    // margin on both sides, expressed as a left offset from the button.
    const width = 256;
    const clampedViewportLeft = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8),
    );
    setHomeLeftOffset(clampedViewportLeft - rect.left);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const toggleOpen = useCallback(() => {
    if (!open && atHome) {
      measureHomeLeftOffset();
    }
    setOpen((v) => !v);
  }, [open, atHome, measureHomeLeftOffset]);

  // Escape closes the popover and returns focus to the button; resize
  // updates the horizontal offset on Home.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    if (atHome) {
      window.addEventListener("resize", measureHomeLeftOffset);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      if (atHome) {
        window.removeEventListener("resize", measureHomeLeftOffset);
      }
    };
  }, [open, close, atHome, measureHomeLeftOffset]);

  const flip = useCallback(() => {
    const next: MapMode = scout ? "full" : "scout";
    // onSelect IS the whole interaction: GameApp persists the mode and
    // sets the hoisted announcement; in Play it also exits the run
    // home, so nothing can run after it there — this component is
    // about to unmount. (On Home the component survives and the
    // popover simply re-renders showing the new state.)
    props.onSelect(next);
  }, [scout, props]);

  const onSwitchKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        flip();
      }
    },
    [flip],
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-testid="map-mode-button"
        aria-expanded={open}
        aria-label={
          atHome
            ? `Map mode settings — currently ${scout ? "Scout Map" : "Full map"}`
            : "Map mode settings"
        }
        onClick={toggleOpen}
        className={
          atHome
            ? "hv5-pill hv5-map-mode-pill pointer-events-auto"
            : "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[rgba(10,12,16,0.72)] text-white/80 backdrop-blur-[14px] transition-colors hover:text-white"
        }
      >
        {atHome ? (
          <>
            <Layers aria-hidden="true" size={16} />
            <span data-testid="map-mode-indicator" data-mode={props.mapMode}>
              {scout ? "Scout Map" : "Full map"}
            </span>
          </>
        ) : (
          <Layers aria-hidden="true" size={20} />
        )}
      </button>
      {open ? (
        // In both Play and Home the popover is position: absolute
        // (top-full mt-2) inside the relative wrapper so it stays
        // anchored 8px below the button and scrolls with the page
        // instead of travelling with the viewport. On Home the button
        // sits in the hero's wrapping top row, so its horizontal
        // offset is clamped to the viewport [8, innerWidth - 264].
        <div
          data-testid="map-mode-popover"
          style={atHome ? { left: homeLeftOffset } : undefined}
          className="pointer-events-auto absolute top-full left-0 z-40 mt-2 w-64 rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.92)] p-4 text-white shadow-xl backdrop-blur-[14px]"
        >
          <p className="text-sm font-semibold">{SCOUT_COPY.toggle.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            {atHome ? SCOUT_COPY.toggle.homeExplainer : SCOUT_COPY.toggle.explainer}
          </p>
          {inChallenge ? (
            // Challenge context: the reason, at reading size — and no
            // switch below it. The map was picked at challenge open;
            // nothing in this popover can end the challenge.
            <p
              data-testid="map-mode-challenge-note"
              className="mt-2 text-xs leading-relaxed text-white/70"
            >
              {SCOUT_COPY.toggle.challengeNote}
            </p>
          ) : atHome ? null : (
            // Block B: the consequence prints ABOVE the switch, at the
            // explainer's size and contrast — never as fine print
            // below the control that ends the game.
            <p data-testid="map-mode-warning" className="mt-2 text-xs leading-relaxed text-white/70">
              {SCOUT_COPY.toggle.warning}
            </p>
          )}
          {inChallenge ? null : (
          <div
            role="switch"
            aria-checked={scout}
            aria-label={SCOUT_COPY.toggle.label}
            tabIndex={0}
            onClick={flip}
            onKeyDown={onSwitchKey}
            className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 px-3 py-2.5"
          >
            <span className="text-sm font-medium">{scout ? "On" : "Off"}</span>
            <span
              aria-hidden="true"
              className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${scout ? "justify-end bg-[#f2c14e]" : "justify-start bg-white/15"}`}
            >
              <span className="h-5 w-5 rounded-full bg-white shadow" />
            </span>
          </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
