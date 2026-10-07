import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import "./support-footer.css";

/**
 * Ko-fi tip-jar footer for the Chart Room home page.
 *
 * Veeresh 2026-10-07 — Game Designer v1: a quiet footer colophon, passive
 * page chrome like a copyright line. No banner, no callout, no icons, no
 * entrance animation, no audio, no analytics. Comet never presents it.
 *
 * Hard rules (grep-verifiable):
 * - zero imports from the audio system (no sfx.ts)
 * - zero analytics calls (no gtag)
 * - URL is a hardcoded constant, never built from config or input
 * - plain <a>, never the router <Link> (keeps Ko-fi out of the PWA scope)
 * - hidden while offline (a dead link is worse than no link)
 */
const KOFI_URL = "https://ko-fi.com/thesaltandpepperguy";

export function SupportFooter() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const openGate = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    // Intercept: COPPA gate first ("ask a grown-up"), real link as fallback.
    e.preventDefault();
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const closeGate = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const onBackdropTap = useCallback((e: MouseEvent<HTMLDialogElement>) => {
    // One-tap-outside dismiss; Esc is native to <dialog>.
    if (e.target === dialogRef.current) dialogRef.current?.close();
  }, []);

  const onContinue = useCallback(() => {
    dialogRef.current?.close();
    window.open(KOFI_URL, "_blank", "noopener,noreferrer");
  }, []);

  if (!online) return null;

  return (
    <>
      <footer className="support-footer" data-testid="support-footer">
        <p className="support-footer-colophon">
          Free forever, charted by Veeresh · Grown-ups: keep the atlas sailing on{" "}
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openGate}
            data-testid="support-footer-link"
          >
            Ko-fi
          </a>
        </p>
        <p className="support-footer-disclaimer">
          Meridian is free forever — every game, every map, every mystery. Support is
          optional and helps keep the maps fresh.
        </p>
      </footer>
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
    </>
  );
}
