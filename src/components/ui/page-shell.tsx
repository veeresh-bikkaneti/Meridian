/**
 * PageShell: the ONE page frame (PR 3 Step 2) — SiteHeader on top,
 * the PageColumn holding an optional PageIntro title block and the
 * screen's content, SiteFooter at the bottom. A screen adopts the
 * shell by passing its header slots and footer callbacks; it never
 * hand-builds a header, footer or column, and never overrides the
 * shell components with className (the shell takes no className).
 *
 * PageIntro is the shell's one title block: eyebrow, title, sub —
 * the patterns screens used to hand-roll above their content. It
 * renders inside the column, under the header.
 */
import type { ReactNode } from "react";
import { PageColumn } from "./page-column.tsx";
import { SiteFooter, type SiteFooterProps } from "./site-footer.tsx";
import { SiteHeader, type SiteHeaderProps } from "./site-header.tsx";

export type PageIntroProps = {
  eyebrow?: string;
  title: string;
  sub?: string;
  /** Heading element ref, for screens that focus the title on mount. */
  titleRef?: React.RefObject<HTMLHeadingElement | null>;
};

export function PageIntro({ eyebrow, title, sub, titleRef }: PageIntroProps) {
  return (
    <div className="page-intro">
      {eyebrow ? <p className="name-eyebrow page-intro-eyebrow">{eyebrow}</p> : null}
      <h1 ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="mode-title text-4xl text-fg">
        {title}
      </h1>
      {sub ? <p className="page-intro-sub">{sub}</p> : null}
    </div>
  );
}

export type PageShellProps = {
  /** Everything SiteHeader needs (its home control included). */
  header: SiteHeaderProps;
  /** Column width: "narrow" (default, read pages and cases) or "wide". */
  width?: "narrow" | "wide";
  /** The title block under the header; omit on screens whose content
   *  carries its own heading (the map screens). */
  intro?: PageIntroProps;
  /** Footer callbacks; pass null for no footer (map screens). The
   *  default renders the shared footer with no host callbacks. */
  footer?: SiteFooterProps | null;
  children?: ReactNode;
};

export function PageShell({ header, width = "narrow", intro, footer, children }: PageShellProps) {
  return (
    <PageColumn width={width}>
      <SiteHeader {...header} />
      {intro ? <PageIntro {...intro} /> : null}
      {children}
      {footer === null ? null : <SiteFooter {...footer} />}
    </PageColumn>
  );
}
