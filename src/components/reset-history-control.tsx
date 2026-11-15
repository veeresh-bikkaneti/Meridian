/**
 * ResetHistoryControl — the game's "Start over" reset entry point:
 * an opener button plus the confirm alertdialog, driven entirely by
 * the host's onReset (GameApp's handleResetHistory, which runs
 * resetHistory() from @/game/reset-history and does the in-memory
 * half). Extracted from game-app.tsx (2026-11-14, case-navigation
 * fix) so the Why Learn screens can render the game's own control
 * without importing the app shell — the lazy subject chunk must not
 * pull GameApp in. The copy, dialog mechanics and testids are
 * byte-identical to the original in-place definition; GameApp's two
 * existing surfaces (home Review card, ReviewComplete) render this
 * same component.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ResetHistoryResult } from "@/game/reset-history";

/**
 * Locked player-facing copy for the "Start over" reset (manifest
 * 2026-10-28 §4 — byte-exact; do not paraphrase, punctuate, or
 * re-wrap in code or tests).
 */
const RESET_HISTORY_COPY = {
  opener: "Start over",
  title: "Start over?",
  sub: "This clears your misses to practise again, every place you have seen or cleared, your learning growth, your GeoDetective streaks and solved cases, your Cold Trail case and stars, any game you left in the middle, and your score for today. Your badges stay. Your grown-up choices stay. This cannot be undone.",
  confirm: "Yes, start over",
  cancel: "Keep my history",
  partial: "Some things could not be cleared. Try again.",
} as const;

/**
 * The reset entry point shared by the home Review card, ReviewComplete
 * and the Why Learn screens (subject picker and subject case): an opener button plus ONE role="alertdialog" confirm
 * mirroring AgeProfileSettings — focus moves into the dialog on open,
 * Esc means "no change", and focus returns to the opener on a
 * no-change close. Nothing is deleted before the confirm. A partial
 * failure keeps the dialog open with the locked partial line and the
 * danger button becomes the retry; on success the opener unmounts with
 * the wiped surface, so there is no focus return (the host shows the
 * success toast instead).
 */
export function ResetHistoryControl({
  onReset,
}: {
  /** Run the reset; the result decides close-vs-retry. */
  onReset: () => ResetHistoryResult;
}) {
  const [open, setOpen] = useState(false);
  const [partial, setPartial] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Focus moves into the dialog when it opens (the AgeProfileSettings
  // pattern) — this is also what lets the dialog's Esc handler fire.
  useEffect(() => {
    if (open) dialogRef.current?.focus({ preventScroll: true });
  }, [open ]);

  const closeWithoutChange = useCallback(() => {
    setOpen(false);
    setPartial(false);
    const opener = openerRef.current;
    if (opener && document.contains(opener)) {
      // The dialog unmounts on the next paint — return focus after
      // that, without scrolling the page (closeAgeSettings pattern).
      requestAnimationFrame(() => {
        if (document.contains(opener)) opener.focus({ preventScroll: true });
      });
    }
  }, []);

  const confirm = useCallback(() => {
    const result = onReset();
    if (result.failed.length > 0) {
      // Honest partial failure (D4): stay open, name it, offer retry.
      setPartial(true);
      return;
    }
    setOpen(false);
    setPartial(false);
  }, [onReset]);

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        className="reset-history-open"
        data-testid="reset-history-open"
        onClick={() => setOpen(true)}
      >
        {RESET_HISTORY_COPY.opener}
      </button>
      {/* The dialog renders through a portal at the document root (the
          AgeProfileSettings placement): inside the review card, the
          text column is a flex item with z-index 1, which caps the
          dialog's own z-index below the sibling cards' stretch layers
          — their buttons would paint and hit-test over the dialog. */}
      {open
        ? createPortal(
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-history-title"
              className="agep-screen"
              data-testid="reset-history-confirm"
              ref={dialogRef}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeWithoutChange();
              }}
            >
              <h1 id="reset-history-title" className="agep-h1">
                {RESET_HISTORY_COPY.title}
              </h1>
              <p className="agep-sub">{RESET_HISTORY_COPY.sub}</p>
              {partial ? (
                <p className="agep-note" role="alert">
                  {RESET_HISTORY_COPY.partial}
                </p>
              ) : null}
              <div className="agep-actions">
                <button
                  type="button"
                  className="agep-danger"
                  data-testid="reset-history-confirm-clear"
                  onClick={confirm}
                >
                  {RESET_HISTORY_COPY.confirm}
                </button>
                <button
                  type="button"
                  className="agep-ghost"
                  data-testid="reset-history-cancel"
                  onClick={closeWithoutChange}
                >
                  {RESET_HISTORY_COPY.cancel}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

