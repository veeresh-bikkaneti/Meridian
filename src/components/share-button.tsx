import type { JSX, ReactNode } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { shareScore } from "@/game/share-action";

type ShareStatus = "idle" | "shared" | "copied" | "failed";

const STATUS_LABEL: Record<Exclude<ShareStatus, "idle">, string> = {
  shared: "Shared ✓",
  copied: "Copied ✓",
  failed: "Copy manually",
};

/**
 * Share button with native-sheet → clipboard → selectable-text fallbacks.
 *
 * Button text IS the accessible label; feedback ("Copied ✓") is announced
 * through a polite live region so screen-reader users hear the result even
 * though the label changes. Focus styling comes from the global
 * `:focus-visible` rule, consistent with every other button.
 *
 * When both the share sheet and the clipboard fail and `failureFallback`
 * is provided, it renders after the button — the end-game summary uses
 * this to show the text selectable; call sites that already preview the
 * text (per-place ShareResult) pass nothing.
 */
export function ShareButton(props: {
  title: string;
  text: string;
  url: string;
  /** Idle label — e.g. "Share score", "Share result". */
  label: string;
  variant?: "primary" | "secondary";
  className?: string;
  failureFallback?: ReactNode;
}): JSX.Element {
  const { title, text, url, label, variant = "secondary", className, failureFallback } = props;
  const [status, setStatus] = useState<ShareStatus>("idle");
  // Ref (not state): ignoring a second click needs to work even before the
  // re-render — a rapid double-click would otherwise fire two concurrent
  // shareScore() calls (two share sheets / two clipboard writes).
  const pendingRef = useRef(false);

  async function onClick(): Promise<void> {
    if (pendingRef.current) return; // share/copy already in flight — ignore
    pendingRef.current = true;
    try {
      const outcome = await shareScore({ title, text, url });
      if (outcome === "cancelled") return; // user dismissed the sheet — stay quiet
      setStatus(outcome);
    } finally {
      pendingRef.current = false;
    }
  }

  return (
    <>
      <Button variant={variant} className={className} onClick={() => void onClick()}>
        {status === "idle" ? label : STATUS_LABEL[status]}
      </Button>
      <p aria-live="polite" className="sr-only">
        {status === "idle"
          ? ""
          : status === "failed"
            ? "Sharing failed. Copy the text from the preview."
            : STATUS_LABEL[status]}
      </p>
      {status === "failed" && failureFallback ? failureFallback : null}
    </>
  );
}
