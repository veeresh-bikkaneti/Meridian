import { useEffect, useRef, type JSX } from "react";
import "./celebration-overlay.css";
import { Character, type CharacterName } from "./characters";
import { ConfettiCanvas } from "./confetti";
import { usePrefersReducedMotion } from "../hooks/use-prefers-reduced-motion";
// Static import: play-guards is tiny and already in the main bundle (game-app,
// LoopMap, satellite-map all import it statically), so a dynamic import here
// cannot split anything — it only produced an [INEFFECTIVE_DYNAMIC_IMPORT]
// warning and a useless 0.3 kB chunk.
import { claimGrand, soundAudible } from "../game/audio/play-guards";
// Static namespace import: sfx.ts is statically imported by game-app,
// comet-greeting, LoopScreen, satellite-map and play-guards, so the old
// dynamic import() here could never split it into another chunk — it only
// produced an [INEFFECTIVE_DYNAMIC_IMPORT] warning. The string lookup +
// optional call below preserves the silent no-op on a missing export.
import * as sfxRecipes from "../game/audio/sfx";
import {
  CELEBRATION_CHROME,
  CELEBRATION_SFX,
  CELEBRATION_VARIANT_LABEL,
  type CelebrationVariant,
} from "./celebration-copy";

// The copy constant lives in celebration-copy.ts (pure data, unit-testable);
// it is re-exported here so app code imports it from the overlay module.
export {
  CELEBRATION_COPY,
  celebrationFromSearch,
  celebrationSeamSpec,
  celebrationSpec,
  hasCelebratedFirstWin,
  markFirstWinCelebrated,
} from "./celebration-copy";
export type {
  CelebrationMomentKey,
  CelebrationSpec,
  CelebrationVariant,
} from "./celebration-copy";
export type { CharacterName } from "./characters";

export type CelebrationOverlayProps = {
  variant: CelebrationVariant;
  character: CharacterName;
  title: string;
  body: string;
  onDismiss: () => void;
  /**
   * PBI-3: Scout Map disables motion (confetti, float/pop) — treated like
   * reduced-motion. Defaults to false; full-mode behavior unchanged.
   */
  motionOff?: boolean;
};

/**
 * Celebration overlay (spec §7.2): dismissible card + confetti + a floating
 * Chart Room Crew character.
 *
 * Layering: the root is the positioning context; the atmosphere layer
 * (confetti + floating character) is pointer-events-none so map gestures
 * pass through; only the card is pointer-events-auto. Dismissal is always
 * user-driven (visible Close button / Escape) — there is no auto-timer.
 *
 * Sound: the mount effect plays the variant's mapped SFX. The anti-annoyance
 * guards and the sfx recipes are static imports — both modules already ship
 * in the main bundle, so dynamic import()s here could never split anything
 * (they only produced [INEFFECTIVE_DYNAMIC_IMPORT] warnings). A missing
 * recipe export stays a silent no-op via the optional call, never a crash.
 * mystery-solved plays nothing — playWin() already fired for the solve.
 * Sounds are unaffected by reduced motion (spec §4.6).
 */
export function CelebrationOverlay({
  variant,
  character,
  title,
  body,
  onDismiss,
  motionOff = false,
}: CelebrationOverlayProps): JSX.Element {
  // PBI-3: motionOff (Scout Map) forces the reduced-motion treatment —
  // no confetti canvas, no float/pop animation, same calm card.
  const reducedMotion = usePrefersReducedMotion() || motionOff;
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Focus the heading on open so screen-reader users land on the news.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // P1-1: announce the overlay to any mounted Storyteller narration (the
  // tour handshake pattern: meridian:tour-walk-start/end). The narration
  // yields while the overlay owns the screen — it hides and never starts
  // its gesture-gated audio — so the celebration fanfare and the narration
  // never double. The data-celebration attribute covers narrations that
  // mount while the overlay is already open (same-commit first win).
  useEffect(() => {
    window.dispatchEvent(new Event("meridian:celebration-open"));
    return () => {
      window.dispatchEvent(new Event("meridian:celebration-close"));
    };
  }, []);

  // Escape dismisses.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Mount effect: play the mapped SFX once, with the spec §3 anti-annoyance
  // guards (hidden-tab suppression, grand-tier cooldown). mystery-solved
  // plays nothing — playWin() already fired for the solve. Sounds are
  // unaffected by reduced motion (spec §4.6).
  useEffect(() => {
    const name = CELEBRATION_SFX[variant];
    if (name === null) return;
    let cancelled = false;
    try {
      if (cancelled) return;
      // Rule 6: no sound while the tab is hidden — the visual is unseen,
      // so sound would become the sole signal.
      if (!soundAudible()) return;
      const recipes = sfxRecipes as unknown as Record<string, (() => void) | undefined>;
      if (cancelled) return;
      // Rule 1: a recent grand-tier celebration cools the fanfare down to
      // applause instead of stacking grandeur.
      const recipe = name === "playGrandFanfare" && !claimGrand() ? "playMediumApplause" : name;
      recipes[recipe]?.();
      // The pop only ever accompanies visible confetti.
      if (!reducedMotion) recipes["playConfettiPop"]?.();
    } catch {
      // Sound is enhancement-only; never break the overlay.
    }
    return () => {
      cancelled = true;
    };
  }, [variant, reducedMotion]);

  return (
    <div
      className="celebration-overlay absolute inset-0 z-50 flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      data-celebration="active"
      data-reduced-motion={reducedMotion ? "true" : undefined}
      data-testid="celebration-overlay"
    >
      {/* Atmosphere — confetti + floating character; never intercepts input. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {reducedMotion ? null : <ConfettiCanvas density="auto" />}
        <div
          className={`absolute top-[10%] left-1/2 -translate-x-1/2 ${
            reducedMotion ? "" : "celebration-float"
          }`}
        >
          <Character name={character} size={120} />
        </div>
      </div>

      {/* The card is the only interactive layer. */}
      <div className="pointer-events-auto relative w-full max-w-sm">
        <div
          className={`rounded-2xl border border-[rgba(232,182,76,0.28)] bg-[rgba(16,34,42,0.94)] p-6 text-[#f0e7d2] shadow-2xl backdrop-blur-sm ${
            reducedMotion ? "" : "celebration-pop"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] tracking-wider text-[#9db3ad] uppercase">
              {CELEBRATION_VARIANT_LABEL[variant]}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={CELEBRATION_CHROME.dismissLabel}
              className="rounded-md px-2 py-1 text-lg leading-none text-[#9db3ad] transition-colors hover:bg-white/10 hover:text-[#f0e7d2]"
            >
              ×
            </button>
          </div>
          <h2
            id={CELEBRATION_CHROME.headingId}
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-display text-2xl outline-none"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#f0e7d2]/80">{body}</p>
        </div>
      </div>
    </div>
  );
}
