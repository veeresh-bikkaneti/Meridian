import { useCallback, type MouseEvent, type RefObject } from "react";
import "./support-gate-dialog.css";

/**
 * "Ask a grown-up" interstitial gate before leaving Meridian for Ko-fi.
 *
 * COPPA mitigation (Veeresh 2026-10-07): parent-directed confirm shown
 * before any external donation page. Minimal native <dialog> — small,
 * centered, one-tap-outside or Esc to dismiss. No animation, no audio,
 * no analytics. Shared by the Ko-fi sign (Comet presents it).
 *
 * Hard rules (grep-verifiable):
 * - zero imports from the audio system (no sfx.ts)
 * - zero analytics calls (no gtag)
 * - plain window.open with noopener/noreferrer, never the router <Link>
 */
export function SupportGateDialog({
  dialogRef,
  koFiUrl,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  koFiUrl: string;
}) {
  const closeGate = useCallback(() => {
    dialogRef.current?.close();
  }, [dialogRef]);

  const onBackdropTap = useCallback(
    (e: MouseEvent<HTMLDialogElement>) => {
      // One-tap-outside dismiss; Esc is native to <dialog>.
      if (e.target === dialogRef.current) dialogRef.current?.close();
    },
    [dialogRef],
  );

  const onContinue = useCallback(() => {
    dialogRef.current?.close();
    window.open(koFiUrl, "_blank", "noopener,noreferrer");
  }, [dialogRef, koFiUrl]);

  return (
    <dialog
      ref={dialogRef}
      className="support-dialog"
      data-testid="support-dialog"
      onClick={onBackdropTap}
      aria-labelledby="support-dialog-title"
    >
      <p id="support-dialog-title" className="support-dialog-text">
        You&rsquo;re leaving Meridian to visit Ko-fi. Ask a grown-up!
      </p>
      <p className="support-dialog-disclaimer">
        Meridian is free forever — every game, every map, every mystery.
      </p>
      <div className="support-dialog-actions">
        <button
          type="button"
          className="support-dialog-btn support-dialog-btn-primary"
          onClick={onContinue}
          data-testid="support-dialog-continue"
        >
          Continue
        </button>
        <button
          type="button"
          className="support-dialog-btn"
          onClick={closeGate}
          data-testid="support-dialog-cancel"
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}
