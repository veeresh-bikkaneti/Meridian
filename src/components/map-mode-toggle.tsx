/**
 * Scout Map settings toggle (PBI-7) — Play top-bar left cluster.
 *
 * A 44×44 frosted round button beside the sound toggle. Opens a small
 * popover with the label, the explainer, and a role="switch" row.
 *
 * State contract: the mode state is owned by GameApp and threaded down
 * as a prop — this component only calls onSelect. Flipping the switch
 * ends the current game and sends the player home (owner ruling,
 * 2026-10-20): the map is built once per game, so the new mode can only
 * take effect in a new game. The popover copy says this BEFORE the tap.
 * Escape closes the popover and returns focus to the button.
 *
 * This component owns NO live region and moves NO focus on the flip:
 * flipping unmounts it (with Play) in the very commit that lands the
 * player home, so an announcement region here would be destroyed in
 * the same commit that set its text and could never be spoken.
 * GameApp therefore hosts the announcement in a hoisted live region
 * that survives the exit, and lands focus on the home heading
 * (pipeline Block A cure).
 */

import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { Layers } from "lucide-react";
import type { MapMode } from "@/map/capability";
import { SCOUT_COPY } from "./scout-copy.ts";

export function MapModeToggle(props: {
  mapMode: MapMode;
  onSelect: (mode: MapMode) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const scout = props.mapMode === "scout";

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
    // onSelect IS the whole interaction: GameApp persists the mode,
    // sets the hoisted announcement, and exits the run home. Nothing
    // can run after it here — this component is about to unmount.
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
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[rgba(10,12,16,0.72)] text-white/80 backdrop-blur-[14px] transition-colors hover:text-white"
      >
        <Layers aria-hidden="true" size={20} />
      </button>
      {open ? (
        <div className="pointer-events-auto absolute top-full left-0 z-40 mt-2 w-64 rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.92)] p-4 text-white shadow-xl backdrop-blur-[14px]">
          <p className="text-sm font-semibold">{SCOUT_COPY.toggle.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">{SCOUT_COPY.toggle.explainer}</p>
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
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">
            Switching sends you back home — this game ends here. Your next
            game uses the new map.
          </p>
        </div>
      ) : null}
    </div>
  );
}
