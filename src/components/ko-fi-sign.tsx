import { useCallback, useEffect, useRef, useState } from "react";
import "./ko-fi-sign.css";
import { SupportGateDialog } from "./support-gate-dialog";

/**
 * Ko-fi tip-jar sign, presented by Comet on the Chart Room home page.
 *
 * Veeresh 2026-10-07 — explicit order, overriding the earlier expert
 * recommendation that Comet never present the ask: a small animated
 * wooden/brass sign near Comet's bottom-right spot, gentle idle sway,
 * tap → Comet does the happy boop + the "ask a grown-up" gate opens.
 *
 * Clean-UX bar: playful but never annoying — one slow sway loop, no
 * pulsing, no scaling, no entrance animation. Completely static under
 * prefers-reduced-motion.
 *
 * Hard rules (grep-verifiable):
 * - zero imports from the audio system (no sfx.ts) — silent
 * - zero analytics calls (no gtag) — Game Designer's COPPA call stands
 * - URL comes from the VITE_KOFI_URL build env (GitHub Secrets pattern);
 *   unset/empty → the sign does not render at all (fail-closed)
 * - plain window.open with noopener/noreferrer, never the router <Link>
 * - hidden while offline (a dead sign is worse than no sign)
 * - never gates gameplay; no perks, no tiers UI
 */
const KOFI_URL = import.meta.env.VITE_KOFI_URL?.trim() || undefined;

export function KoFiSign() {
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

  const onTap = useCallback(() => {
    // Comet does the happy boop when the sign is tapped — the sign lives
    // outside CometMascot, so it asks via event (same pattern as
    // comet:edition-select). Then the COPPA gate opens.
    window.dispatchEvent(new CustomEvent("comet:boop"));
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  if (!online) return null;
  // Fail-closed: no Ko-fi URL configured → render nothing.
  if (!KOFI_URL) return null;

  return (
    <>
      <div className="kofi-sign-wrap" data-testid="kofi-sign-wrap">
        <button
          type="button"
          className="kofi-sign"
          data-testid="kofi-sign"
          onClick={onTap}
          aria-label="Support the Expedition. Opens a confirmation before visiting Ko-fi."
        >
          <span className="kofi-sign-title">Support the Expedition</span>
          <span className="kofi-sign-sub">
            Grown-ups — fuel Comet&rsquo;s journey
          </span>
        </button>
      </div>
      <SupportGateDialog dialogRef={dialogRef} koFiUrl={KOFI_URL} />
    </>
  );
}
