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
 * Layout reuses prod only: PageColumn "read", the .mode-card panel,
 * the .mode-title / .name-eyebrow patterns, --error as the accent,
 * and the shared Button (Try again primary, Home secondary).
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
  /** Defaults to the pinned blameless copy. */
  message?: string;
};

export function ErrorScreen({
  onHome,
  onRetry,
  title = "That page couldn't load.",
  message = "Try again, or go home — it's not your fault.",
}: ErrorScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <PageColumn width="read">
      <SiteHeader onHome={onHome} status={null} mute={null} />
      <div className="mode-card error-screen-panel">
        <p className="name-eyebrow error-screen-eyebrow">Oops</p>
        <h1 ref={headingRef} tabIndex={-1} className="mode-title text-3xl text-fg">
          {title}
        </h1>
        <p className="error-screen-message">{message}</p>
        <div className="error-screen-actions">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="secondary" onClick={onHome}>
            Home
          </Button>
        </div>
      </div>
    </PageColumn>
  );
}
