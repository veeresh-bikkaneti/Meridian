/**
 * Scout Map boot offer — dedicated modal at the GameApp level.
 *
 * Fires once per boot, on the home render, in two situations:
 * - variant "prior-crash" (PBI-6): the map-attributed prior-crash flag is
 *   set. Offer, not force: the session stays in full mode unless the
 *   player taps "Use Scout Map".
 * - variant "probe" | "low-memory": the boot capability probe or the
 *   low-memory signal qualified the device for Scout Map. The user chooses:
 *   accept the lighter trail, or explicitly keep the full map (stored as a
 *   manual "full" choice — never decays, never re-prompts).
 *
 * Dismissal semantics (UX review 2026-10-12): only the explicit decline
 * button records a choice. Scrim tap and Escape merely dismiss the dialog
 * WITHOUT persisting anything — a stray tap is not an explicit choice, so
 * the dialog may re-fire on the next boot if the device still qualifies.
 *
 * - fixed inset-0 z-50; scrim tap / Escape = dismiss (no persist);
 *   decline button = decline (manual full, permanent)
 * - role="dialog" aria-modal; focus on the primary action on open;
 *   focus returns to the home heading on close
 * - data-testid="scout-boot-offer" (E2E contract),
 *   data-offer-source="<variant>" (which signal triggered it)
 */

import { useEffect, useRef, type JSX } from "react";
import { SCOUT_COPY } from "./scout-copy.ts";

export type ScoutOfferVariant = "prior-crash" | "probe" | "low-memory";

export function ScoutBootOffer(props: {
  variant: ScoutOfferVariant;
  onAccept: () => void;
  onDecline: () => void;
  /** Non-choice dismissal (scrim tap, Escape): closes without persisting. */
  onDismiss: () => void;
}): JSX.Element {
  const acceptRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onDeclineRef = useRef(props.onDecline);
  onDeclineRef.current = props.onDecline;
  const onDismissRef = useRef(props.onDismiss);
  onDismissRef.current = props.onDismiss;

  const variant = props.variant;
  const body =
    variant === "prior-crash"
      ? SCOUT_COPY.bootOffer.body
      : variant === "probe"
        ? SCOUT_COPY.capabilityOffer.probeBody
        : SCOUT_COPY.capabilityOffer.lowMemoryBody;
  const acceptLabel =
    variant === "prior-crash" ? SCOUT_COPY.bootOffer.accept : SCOUT_COPY.capabilityOffer.accept;
  const declineLabel =
    variant === "prior-crash" ? SCOUT_COPY.bootOffer.decline : SCOUT_COPY.capabilityOffer.decline;

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

  // Escape dismisses WITHOUT persisting (a keypress is not an explicit
  // choice — only the decline button records manual full). Tab is trapped
  // inside the dialog: focus cycles between the two buttons and never
  // escapes to the page behind the modal.
  useEffect(() => {
    const dialog = dialogRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismissRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-testid="scout-boot-offer"
      data-offer-source={variant}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => onDismissRef.current()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scout-boot-offer-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.92)] p-6 text-white shadow-2xl backdrop-blur-[14px]"
      >
        <h2 id="scout-boot-offer-title" className="text-lg font-semibold">
          Try Scout Map?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={acceptRef}
            type="button"
            onClick={props.onAccept}
            className="w-full rounded-xl bg-[#f2c14e] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#ffd97a]"
          >
            {acceptLabel}
          </button>
          <button
            type="button"
            onClick={() => onDeclineRef.current()}
            className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            {declineLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
