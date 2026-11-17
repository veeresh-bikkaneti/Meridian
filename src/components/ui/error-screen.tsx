/**
 * ErrorScreen: the ONLY error surface (Stream S contract,
 * fix/ui-shared-shell, items 7 and 10). SiteHeader on top, one plain
 * message, and exactly two exits — Try again and Home — so a stuck
 * child is never trapped on a dead screen. Page-local error blocks
 * are banned by lint:nav.
 *
 * Copy standard (UX seat): short, blameless, band reading level,
 * never an error code or a technical term — the defaults below are
 * the pinned copy; a host message must meet the same standard.
 * Focus goes to the heading on mount, so keyboard and switch-device
 * children land somewhere instead of tabbing through the page behind.
 *
 * Props (PR 3 Step 2): `title`, `body` and the `actions` labels are
 * the host's only copy levers — the pinned defaults stand when they
 * are absent — and `surface` picks the panel treatment ("card", the
 * shipped .mode-card panel, or "plain" on screens that already sit
 * inside a card). Variants are props, never forks.
 *
 * Layout reuses prod only: PageColumn "narrow", the .mode-card
 * panel, the .mode-title / .name-eyebrow patterns, --error as the
 * accent, and the shared Button (Try again primary, Home secondary).
 */
import { useEffect, useRef } from "react";
import { Button } from "./button";
import { PageColumn } from "./page-column";
import { SiteHeader } from "./site-header";

export type ErrorScreenProps = {
  onHome: () => void;
  onRetry: () => void;
  /** Defaults to the pinned blameless copy. */
  title?: string;
  /** The message under the title. Defaults to the pinned copy. */
  body?: string;
  /** Labels for the two exits; both default to the pinned words. */
  actions?: {
    retryLabel?: string;
    homeLabel?: string;
  };
  /** Panel treatment: the .mode-card card (default) or plain. */
  surface?: "card" | "plain";
};

export function ErrorScreen({
  onHome,
  onRetry,
  title = "That page couldn't load.",
  body = "Try again, or go home — it's not your fault.",
  actions,
  surface = "card",
}: ErrorScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <PageColumn width="narrow">
      <SiteHeader onHome={onHome} status={null} mute={null} />
      <div className={surface === "card" ? "mode-card error-screen-panel" : "error-screen-panel"}>
        <p className="name-eyebrow error-screen-eyebrow">Oops</p>
        <h1 ref={headingRef} tabIndex={-1} className="mode-title text-3xl text-fg">
          {title}
        </h1>
        <p className="error-screen-message">{body}</p>
        <div className="error-screen-actions">
          <Button onClick={onRetry}>{actions?.retryLabel ?? "Try again"}</Button>
          <Button variant="secondary" onClick={onHome}>
            {actions?.homeLabel ?? "Home"}
          </Button>
        </div>
      </div>
    </PageColumn>
  );
}
