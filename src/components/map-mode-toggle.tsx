/**
 * Scout Map settings toggle (PBI-7) — hosted in two places:
 *
 * - In the Play top-bar left cluster (context "play", the original
 *   host): a 44×44 frosted round button beside the sound toggle.
 * - On Home, in the hero's top row (context "home", Block C cure): the
 *   same control with a brass-outline button to match the home theme,
 *   beside a visible mode indicator GameApp renders next to it — a
 *   player can SEE they are on Scout Map and flip back without
 *   starting (and discarding) a game first.
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
  /** Host context: "play" (default) or "home" — see the header. */
  context?: "play" | "home";
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const scout = props.mapMode === "scout";
  const atHome = props.context === "home";

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Escape closes the popover and returns focus to the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

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
        aria-label="Map mode settings"
        onClick={() => setOpen((v) => !v)}
        className={
          atHome
            ? // Home theme: brass outline, matching the sound toggle
              // beside it (styles.css .atlas-sound-toggle).
              "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--atlas-card-line)] bg-transparent text-[var(--atlas-brass)] transition-colors hover:border-[var(--atlas-brass)]"
            : "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[rgba(10,12,16,0.72)] text-white/80 backdrop-blur-[14px] transition-colors hover:text-white"
        }
      >
        <Layers aria-hidden="true" size={20} />
      </button>
      {open ? (
        <div className="pointer-events-auto absolute top-full left-0 z-40 mt-2 w-64 rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.92)] p-4 text-white shadow-xl backdrop-blur-[14px]">
          <p className="text-sm font-semibold">{SCOUT_COPY.toggle.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            {atHome ? SCOUT_COPY.toggle.homeExplainer : SCOUT_COPY.toggle.explainer}
          </p>
          {atHome ? null : (
            // Block B: the consequence prints ABOVE the switch, at the
            // explainer's size and contrast — never as fine print
            // below the control that ends the game.
            <p data-testid="map-mode-warning" className="mt-2 text-xs leading-relaxed text-white/70">
              {SCOUT_COPY.toggle.warning}
            </p>
          )}
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
        </div>
      ) : null}
    </div>
  );
}
