/**
 * SiteFooter: the ONE footer for every screen (Stream S contract,
 * fix/ui-shared-shell, item 3) — the shipped home footer, shared.
 *
 * The link set mirrors the home footer in game-app.tsx exactly (the
 * set that actually ships, per the designer seat — not the fix
 * prompt's list, which names links the home footer does not carry):
 * an optional lead slot (home puts its read-aloud settings there),
 * For grown-ups and Take the tour (host callbacks, same labels,
 * aria-labels and test ids as home), the four route links, and the
 * kids-privacy note. Every item keeps the .agep-footer-link 44px hit
 * height. Styling is .agep-footer / .agep-footer-link /
 * .agep-footer-note verbatim (age-profile.css, imported here so the
 * classes travel with the component).
 *
 * The kids-privacy note's statements are factual and must stay true:
 * if analytics, ads or accounts are ever added, update this note and
 * /privacy in the same PR (the rule on the home footer's copy).
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import "../age-profile/age-profile.css";

export type SiteFooterProps = {
  /** Rendered first inside the footer (home: ReadAloudPrefSettings). */
  lead?: ReactNode;
  /** Home's grown-ups gate opener; omit on screens without the gate. */
  onGrownUps?: () => void;
  /** Home's tour re-entry; omit on screens without the tour. */
  onTakeTour?: () => void;
  /** The kids-privacy note (default true, as on home). */
  note?: boolean;
  className?: string;
};

export function SiteFooter({ lead, onGrownUps, onTakeTour, note = true, className }: SiteFooterProps) {
  return (
    <footer className={cn("agep-footer", className)}>
      {lead}
      {onGrownUps ? (
        <button
          type="button"
          className="agep-footer-link"
          onClick={onGrownUps}
          aria-label="For grown-ups: game settings"
          data-testid="grownups-link"
        >
          🔒 For grown-ups
        </button>
      ) : null}
      {onTakeTour ? (
        <button
          type="button"
          className="agep-footer-link"
          onClick={onTakeTour}
          data-testid="take-tour-link"
          aria-label="Take the tour again"
        >
          🗺️ Take the tour
        </button>
      ) : null}
      <Link to="/privacy" className="agep-footer-link" data-testid="privacy-link">
        Privacy
      </Link>
      <Link to="/contact" className="agep-footer-link" data-testid="contact-link">
        Contact us (grown-ups)
      </Link>
      <Link to="/credits" className="agep-footer-link" data-testid="credits-link">
        Credits
      </Link>
      <Link to="/board" className="agep-footer-link" data-testid="board-link">
        What&rsquo;s coming (grown-ups)
      </Link>
      {note ? (
        <p className="agep-footer-note" data-testid="kids-privacy-note">
          Made for kids: no accounts, no ads, no tracking cookies, and no personal information collected from players.{" "}
          <Link to="/privacy" data-testid="kids-privacy-note-link">
            How we protect privacy
          </Link>
        </p>
      ) : null}
    </footer>
  );
}
