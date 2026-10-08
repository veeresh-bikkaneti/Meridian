/**
 * Scout Map boot offer (PBI-6) — dedicated modal at the GameApp level.
 *
 * Fires only on the home render when the map-attributed prior-crash flag
 * is set, once per boot. Offer, not force (settled constraint, Q1): the
 * session stays in full mode unless the player taps "Use Scout Map".
 *
 * - fixed inset-0 z-50; scrim tap / Escape / "Not now" = decline
 * - role="dialog" aria-modal; focus on the primary action on open;
 *   focus returns to the home heading on close
 * - data-testid="scout-boot-offer" (E2E contract)
 */

import { useEffect, useRef, type JSX } from "react";
import { SCOUT_COPY } from "./scout-copy.ts";

export function ScoutBootOffer(props: {
  onAccept: () => void;
  onDecline: () => void;
}): JSX.Element {
  const acceptRef = useRef<HTMLButtonElement | null>(null);
  const onDeclineRef = useRef(props.onDecline);
  onDeclineRef.current = props.onDecline;

  // Focus the primary action on open; return focus to the home heading
  // on close so keyboard/screen-reader users land back where they were.
  useEffect(() => {
    acceptRef.current?.focus();
    return () => {
      try {
        document.querySelector<HTMLElement>('[data-testid="home-heading"]')?.focus();
      } catch {
        // best-effort
      }
    };
  }, []);

  // Escape declines (stays full, stamped shown-this-boot by the owner).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDeclineRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-testid="scout-boot-offer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => onDeclineRef.current()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scout-boot-offer-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.92)] p-6 text-white shadow-2xl backdrop-blur-[14px]"
      >
        <h2 id="scout-boot-offer-title" className="text-lg font-semibold">
          Try Scout Map?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{SCOUT_COPY.bootOffer.body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={acceptRef}
            type="button"
            onClick={props.onAccept}
            className="w-full rounded-xl bg-[#f2c14e] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#ffd97a]"
          >
            {SCOUT_COPY.bootOffer.accept}
          </button>
          <button
            type="button"
            onClick={() => onDeclineRef.current()}
            className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            {SCOUT_COPY.bootOffer.decline}
          </button>
        </div>
      </div>
    </div>
  );
}
