/**
 * SiteFooter: the ONE footer for every screen (Stream S contract,
 * fix/ui-shared-shell, item 3) — the shipped home footer, shared.
 *
 * The link set mirrors the home footer in game-app.tsx exactly (the
 * set that actually ships, per the designer seat — not the fix
 * prompt's list, which names links the home footer does not carry):
 * an optional lead slot (home puts its read-aloud settings there),
 * For grown-ups and Take the tour (host callbacks, same labels,
 * aria-labels and test ids as home), the four route links (from the
 * one shared list, site-links.ts — the grown-ups doors nav renders
 * the same routes), and the kids-privacy note. Every item keeps the .agep-footer-link 44px hit
 * height. Styling is .agep-footer / .agep-footer-link /
 * .agep-footer-note verbatim (age-profile.css, imported here so the
 * classes travel with the component).
 *
 * Under the links sits Grandpa's band: the coffee-run scene
 * (grandpa-coffee-run.tsx) in a 168px positioned strip — the same
 * composition Home has always shipped under its footer (owner,
 * 2026-11-18: Grandpa present in the footer of all pages, the real
 * coffee-run Grandpa, one standardized component). Pages differ
 * only by props: the lead slot (each page's tailored pill or
 * control), and three Home-only flags — grandpaTour (the tasting
 * tour measures Home's cards), grandpaAnchor (the band carries
 * #home-involved, the nav's get-involved target), and width="wide"
 * (Home renders the footer after </main>, so the links row takes
 * the page column's width and gutters itself). No page imports the
 * Grandpa scene directly; the shell registry test enforces that.
 *
 * The kids-privacy note's statements are factual and must stay true:
 * if analytics, ads or accounts are ever added, update this note and
 * /privacy in the same PR (the rule on the home footer's copy).
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { FOOTER_ROUTE_LINKS } from "./site-links.ts";
import { GrandpaCoffeeRun } from "../grandpa-coffee-run.tsx";
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
  /** Grandpa's coffee-run band under the links (default true). Only
   *  a host that renders the scene itself would turn this off — no
   *  shipped screen does. */
  grandpa?: boolean;
  /** Home only: let the band's scene run the full tasting tour. */
  grandpaTour?: boolean;
  /** Home only: the band carries the #home-involved anchor. */
  grandpaAnchor?: boolean;
  /** "wide": the links row constrains itself to the wide page
   *  column (Home, whose footer renders after </main>). Hosts that
   *  render the footer inside their column omit it. */
  width?: "wide";
  className?: string;
};

export function SiteFooter({
  lead,
  onGrownUps,
  onTakeTour,
  note = true,
  grandpa = true,
  grandpaTour = false,
  grandpaAnchor = false,
  width,
  className,
}: SiteFooterProps) {
  return (
    <>
      <footer className={cn("agep-footer", width === "wide" && "agep-footer-wide", className)}>
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
        {FOOTER_ROUTE_LINKS.map((link) => (
          <Link key={link.testId} to={link.to} className="agep-footer-link" data-testid={link.testId}>
            {link.label}
          </Link>
        ))}
        {note ? (
          <p className="agep-footer-note" data-testid="kids-privacy-note">
            Made for kids: no accounts, no ads, no tracking cookies, and no personal information collected from players.{" "}
            <Link to="/privacy" data-testid="kids-privacy-note-link">
              How we protect privacy
            </Link>
          </p>
        ) : null}
      </footer>
      {grandpa ? (
        <div
          className="grandpa-band"
          {...(grandpaAnchor ? { id: "home-involved", tabIndex: -1 } : {})}
        >
          <GrandpaCoffeeRun tastingTour={grandpaTour} />
        </div>
      ) : null}
    </>
  );
}
