/**
 * The ONE link list (PR 3 Step 2): every route the shared shell
 * points at is defined here once, and each surface — SiteFooter,
 * the grown-ups doors nav (InfoPage) — renders its own labels from
 * these same entries. A route or label changes in one place; the
 * surfaces cannot drift apart (the footer and the doors carried
 * separate hand-copied lists until this file existed).
 *
 * Labels differ per surface on purpose: the footer speaks to the
 * child holding the device ("Contact us (grown-ups)"), the doors
 * nav speaks to the grown-up already through the gate ("Contact
 * us"). The route set is shared; the wording is the surface's.
 */

type SiteRoute = {
  to: string;
  /** Label in the grown-ups doors nav. */
  doorsLabel: string;
  /** Label in SiteFooter, when the footer carries the route. */
  footerLabel?: string;
  /** SiteFooter's test id for the route, when it carries it. */
  footerTestId?: string;
  search?: { view: string };
};

const ROUTES = {
  home: { to: "/", doorsLabel: "Play the game" },
  board: {
    to: "/board",
    doorsLabel: "What's coming",
    footerLabel: "What's coming (grown-ups)",
    footerTestId: "board-link",
  },
  boardTip: { to: "/board", doorsLabel: "Ask for something new", search: { view: "tip" } },
  contact: {
    to: "/contact",
    doorsLabel: "Contact us",
    footerLabel: "Contact us (grown-ups)",
    footerTestId: "contact-link",
  },
  credits: { to: "/credits", doorsLabel: "Credits", footerLabel: "Credits", footerTestId: "credits-link" },
  privacy: { to: "/privacy", doorsLabel: "Privacy", footerLabel: "Privacy", footerTestId: "privacy-link" },
} satisfies Record<string, SiteRoute>;

/** SiteFooter's route links, in the shipped order. */
export const FOOTER_ROUTE_LINKS: readonly { to: string; label: string; testId: string }[] = [
  ROUTES.privacy,
  ROUTES.contact,
  ROUTES.credits,
  ROUTES.board,
].map((r) => ({ to: r.to, label: r.footerLabel!, testId: r.footerTestId! }));

/** The grown-ups doors nav (InfoPage), in the shipped order. */
export const GROWNUP_DOORS: readonly { to: string; label: string; search?: { view: string } }[] = [
  ROUTES.home,
  ROUTES.board,
  ROUTES.boardTip,
  ROUTES.contact,
  ROUTES.credits,
  ROUTES.privacy,
].map((r) => ({ to: r.to, label: r.doorsLabel, search: "search" in r ? r.search : undefined }));
