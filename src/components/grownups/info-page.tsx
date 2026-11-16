/**
 * Shared shell for the grown-ups pages (/privacy, /contact, /credits).
 *
 * Board v3 Phase 2 (spec §7 + the 2026-11-15 theme-parity ruling):
 * these pages join the game world instead of sitting plainer beside
 * it — the homepage's parchment, card and type language (home-v5
 * tokens, checked by src/board/theme-parity.test.ts), a doors nav
 * that moves between the game, the board and the grown-ups pages
 * without a dead end, and one family graphic per page that says what
 * the page IS: an atlas book for Credits, a closed satchel for
 * Privacy, an envelope for Contact. The words inside — including
 * every line of the privacy text — are unchanged; only the room
 * they sit in changed.
 */
import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import "./info-page.css";

export type GrownGraphic = "book" | "satchel" | "envelope";

const INK = "#33302a";
const BRASS = "#8a6d2f";
const FOREST = "#33503f";
const SAGE = "#8fa382";
const CARD = "#fdfbf3";
const GOLD = "#b8932f";

const GRAPHICS: Record<GrownGraphic, ReactNode> = {
  /* Credits: the atlas the game's knowledge comes from. */
  book: (
    <svg viewBox="0 0 300 150" role="img" aria-label="An open atlas">
      <path d="M92 30 C 118 18, 140 22, 150 32 V 122 C 140 112, 118 108, 92 118 Z" fill={CARD} stroke={BRASS} strokeWidth="2.5" />
      <path d="M208 30 C 182 18, 160 22, 150 32 V 122 C 160 112, 182 108, 208 118 Z" fill={CARD} stroke={BRASS} strokeWidth="2.5" />
      <path d="M104 52 C 120 45, 132 47, 140 52 M104 72 C 120 65, 132 67, 140 72 M196 52 C 180 45, 168 47, 160 52" stroke={SAGE} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="M222 38 l3.4 7 7.6 1.1 -5.5 5.4 1.3 7.5 -6.8 -3.6 -6.8 3.6 1.3 -7.5 -5.5 -5.4 7.6 -1.1 Z" fill={GOLD} />
      <circle cx="76" cy="106" r="10" fill="none" stroke={FOREST} strokeWidth="2.5" />
      <path d="M76 99 v14 M69 106 h14" stroke={FOREST} strokeWidth="2" />
    </svg>
  ),
  /* Privacy: a closed satchel, locked. Still by design — nothing
     about privacy should perform. */
  satchel: (
    <svg viewBox="0 0 300 150" role="img" aria-label="A closed, locked satchel">
      <path d="M78 58 h144 a10 10 0 0 1 10 10 v44 a12 12 0 0 1 -12 12 H80 a12 12 0 0 1 -12 -12 V68 a10 10 0 0 1 10 -10 Z" fill="#e9dfc6" stroke={BRASS} strokeWidth="3" />
      <path d="M68 58 C 96 84, 204 84, 232 58 L 232 74 C 204 98, 96 98, 68 74 Z" fill={CARD} stroke={BRASS} strokeWidth="2.5" />
      <path d="M112 58 v-8 a38 20 0 0 1 76 0 v8" fill="none" stroke={INK} strokeWidth="5" />
      <rect x="132" y="76" width="36" height="28" rx="6" fill={BRASS} />
      <circle cx="150" cy="87" r="5" fill={CARD} />
      <rect x="147.5" y="89" width="5" height="9" rx="2" fill={CARD} />
    </svg>
  ),
  /* Contact: a letter, ready to send. */
  envelope: (
    <svg viewBox="0 0 300 150" role="img" aria-label="A letter ready to send">
      <rect x="62" y="38" width="176" height="86" rx="10" fill={CARD} stroke={BRASS} strokeWidth="3" />
      <path d="M66 44 L150 96 L234 44" fill="none" stroke={FOREST} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M150 118 c-10 -8 -16 -13 -16 -19 a8.5 8.5 0 0 1 16 -4 a8.5 8.5 0 0 1 16 4 c0 6 -6 11 -16 19 Z" fill="#b3543f" transform="translate(52 -6) scale(0.62)" />
      <path d="M216 22 l2.6 5.4 5.9 .9 -4.3 4.1 1 5.9 -5.2 -2.8 -5.2 2.8 1 -5.9 -4.3 -4.1 5.9 -.9 Z" fill={GOLD} />
    </svg>
  ),
};

const DOORS: { to: string; label: string; search?: { view: string } }[] = [
  { to: "/", label: "Play the game" },
  { to: "/board", label: "See what we're making next" },
  { to: "/board", label: "Ask for something new", search: { view: "tip" } },
  { to: "/contact", label: "Contact us" },
  { to: "/credits", label: "Credits" },
  { to: "/privacy", label: "Privacy" },
];

export function InfoPage({
  title,
  graphic,
  children,
}: {
  title: string;
  graphic?: GrownGraphic;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <main className="grown-page">
      <div className="gp-wrap">
        <nav className="gp-doors" aria-label="Grown-ups pages">
          {DOORS.map((door) => {
            const isCurrent = pathname === door.to && !door.search;
            return (
              <Link
                key={door.label}
                to={door.to}
                search={door.search}
                aria-current={isCurrent ? "page" : undefined}
              >
                {door.label}
              </Link>
            );
          })}
        </nav>
        <div className="gp-card">
          {graphic ? <div className="gp-graphic">{GRAPHICS[graphic]}</div> : null}
          <h1 className="gp-title">{title}</h1>
          <div className="gp-body">{children}</div>
        </div>
      </div>
    </main>
  );
}
