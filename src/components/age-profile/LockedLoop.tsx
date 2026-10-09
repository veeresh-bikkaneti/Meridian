/**
 * LockedLoop.tsx — the locked-loop tile variant (Phase 2 §1e).
 *
 * Same footprint as the unlocked card (no reflow); desaturated; the body
 * copy is verbatim "Ask a grown-up to open more games" — no ages, no
 * "too young." Tapping the tile body pulses the message once (no
 * navigation); only the grown-up link navigates to the gate.
 *
 * Layout/CSS only — zero map dependency, identical on the Scout Map
 * outlines-only path.
 */

import { useId, useState } from "react";

export interface LockedLoopProps {
  /** Loop title, e.g. "GeoDetective" — kept, never hidden. */
  title: string;
  /** Eyebrow above the title. */
  eyebrow?: string;
  /** Opens the grown-up gate (the same flow as the footer link). */
  onGrownUpOpen: () => void;
}

export function LockedLoop({ title, eyebrow = "More games", onGrownUpOpen }: LockedLoopProps) {
  const [pulsing, setPulsing] = useState(false);
  // Unique per tile instance — several locked tiles can share a screen.
  const titleId = useId();
  const msgId = useId();

  const pulse = () => {
    setPulsing(true);
    window.setTimeout(() => setPulsing(false), 350);
  };

  return (
    <article
      aria-labelledby={titleId}
      className={`atlas-dossier agep-locked${pulsing ? " agep-locked-pulse" : ""}`}
      data-testid="locked-loop-tile"
    >
      <p className="atlas-eyebrow">{eyebrow}</p>
      <h2 id={titleId} className="atlas-dossier-title">
        {title}
      </h2>
      <button
        type="button"
        className="agep-locked-body"
        onClick={pulse}
        aria-disabled="true"
        aria-describedby={msgId}
      >
        <span id={msgId}>Ask a grown-up to open more games</span>
      </button>
      <button
        type="button"
        className="agep-locked-link"
        onClick={onGrownUpOpen}
        aria-label="For grown-ups: open game settings"
      >
        Grown-ups, open here →
      </button>
    </article>
  );
}
